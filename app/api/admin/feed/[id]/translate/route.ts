import { getAdminUser } from "@/app/admin-auth";
import { FeedCandidate, selectRelated } from "@/lib/automation";
import { ensureDefaultCategories } from "@/lib/categories";
import { feedImageCandidate } from "@/lib/feed";
import {
  buildTranslationPrompt,
  extractInteractionText,
  estimateGeminiCostMicrousd,
  geminiErrorForUser,
  geminiRequestUrl,
  paragraphsToHtml,
  parseGeminiApiError,
  parseGeminiUsage,
  parseTranslationDraft,
} from "@/lib/gemini-translation";

type FeedRow = {
  id: number;
  title: string;
  url: string;
  summary: string;
  fingerprint: string;
  published_at: string | null;
  processing_status: string;
  raw_json: string;
};

type RelatedFeedRow = {
  id: number;
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
};

type DownloadedCover = {
  key: string;
  source: string;
  copyright: string;
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  if (process.env.RSS_TRANSLATION_ENABLED !== "true") {
    return Response.json({ error: "Gemini RSS 翻译功能尚未启用" }, { status: 409 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "尚未配置 Gemini API 密钥，请先完成安全环境变量设置" }, { status: 503 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "无效的 RSS 记录" }, { status: 400 });
  const { env } = await import("cloudflare:workers");
  const item = await env.DB.prepare(
    "SELECT id, title, url, summary, fingerprint, published_at, processing_status, raw_json FROM feed_items WHERE id = ?"
  ).bind(id).first<FeedRow>();
  if (!item) return Response.json({ error: "RSS 记录不存在" }, { status: 404 });
  if (!["translation_required", "translation_failed", "translation_running"].includes(item.processing_status)) {
    return Response.json({ error: "只有待翻译、处理中超时或翻译失败的外文 RSS 线索可以使用 Gemini 翻译" }, { status: 409 });
  }
  if (item.processing_status === "translation_running") {
    const stale = await env.DB.prepare(
      "SELECT 1 AS ok FROM feed_items WHERE id = ? AND updated_at < datetime('now', '-30 minutes')"
    ).bind(id).first<{ ok: number }>();
    if (!stale) return Response.json({ error: "该 RSS 正在翻译处理中，请稍后再试或等待当前任务完成" }, { status: 409 });
  }
  if (!item.summary.trim()) {
    await env.DB.prepare(
      "UPDATE feed_items SET processing_status = 'translation_failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(id).run();
    return Response.json({ error: "该 RSS 线索没有有效摘要，请先查看原始来源并手动编辑" }, { status: 409 });
  }

  const slug = `rss-${item.id}-${item.fingerprint.slice(0, 10)}`;
  const existing = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first<{ id: number }>();
  if (existing) {
    await env.DB.prepare(
      "UPDATE feed_items SET processing_status = 'drafted', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(id).run();
    return Response.json({ error: "该 RSS 条目已经创建过草稿", id: existing.id }, { status: 409 });
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  await env.DB.prepare(
    "UPDATE feed_items SET processing_status = 'translation_running', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(id).run();
  const job = await env.DB.prepare(
    `INSERT INTO automation_jobs
     (type, status, provider, model, input_count, output_count, attempt, started_at)
     VALUES (?, ?, ?, ?, 1, 0, 1, CURRENT_TIMESTAMP)`
  ).bind("rss_translation", "running", "gemini", model).run();
  const jobId = Number(job.meta.last_row_id);

  try {
    const related = await relatedFeedItems(env.DB, item);
    const relayUrl = process.env.GEMINI_RELAY_URL ?? "";
    const relaySecret = process.env.GEMINI_RELAY_SECRET ?? "";
    if (relayUrl && !relaySecret) throw new Error("GEMINI_RELAY_SECRET_MISSING");
    const response = await fetch(
      geminiRequestUrl(model, relayUrl),
      {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "content-type": "application/json",
        ...(relayUrl ? { authorization: `Bearer ${relaySecret}` } : {}),
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: buildTranslationPrompt({
              title: item.title,
              summary: item.summary,
              url: item.url,
              publishedAt: item.published_at,
            }, related),
          }],
        }],
      }),
    });
    if (!response.ok) {
      const details = parseGeminiApiError(await response.text(), response.status);
      await failJob(
        env.DB,
        jobId,
        `GEMINI_HTTP_${response.status}:${details.code}${details.message ? `:${details.message}` : ""}`,
        id,
      );
      return Response.json(
        { error: geminiErrorForUser(response.status, details.code, details.message), code: details.code },
        { status: 502 },
      );
    }

    const interaction = await response.json();
    const usage = parseGeminiUsage(interaction);
    const estimatedCostMicrousd = estimateGeminiCostMicrousd(model, usage);
    const draft = parseTranslationDraft(extractInteractionText(interaction));
    if (!draft) {
      await failJob(env.DB, jobId, "GEMINI_INVALID_OUTPUT", id);
      return Response.json({ error: "Gemini 返回内容无法解析，错误已记录" }, { status: 502 });
    }

    await ensureDefaultCategories(env.DB);
    const category = await env.DB.prepare("SELECT id FROM categories WHERE slug = ?").bind("news").first<{ id: number }>();
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    const reviewReason = draft.review_reason || "本文由 Gemini 根据 RSS 标题与摘要生成，未核验原始全文，发布前必须人工检查。";
    const contentHtml = paragraphsToHtml(draft.paragraphs);
    const cover = await maybeDownloadFeedCover(env.MEDIA, item);
    const article = await env.DB.prepare(
      `INSERT INTO articles
       (title, subtitle, slug, seo_title, description, content_html, category_id, status,
        confidence, requires_review, review_reason, canonical_url,
        cover_object_key, cover_source, cover_copyright)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'review', ?, true, ?, '', ?, ?, ?)`
    ).bind(
      draft.title,
      draft.subtitle,
      slug,
      draft.title,
      draft.description || draft.paragraphs[0].slice(0, 220),
      contentHtml,
      category.id,
      draft.confidence,
      reviewReason,
      cover?.key ?? "",
      cover?.source ?? "",
      cover?.copyright ?? "",
    ).run();
    const articleId = Number(article.meta.last_row_id);
    if (!articleId) throw new Error("ARTICLE_INSERT_FAILED");

    for (const name of draft.tags) {
      const tagSlug = safeSlug(name) || `tag-${await shortHash(name)}`;
      await env.DB.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)").bind(name.slice(0, 50), tagSlug).run();
      const tag = await env.DB.prepare("SELECT id FROM tags WHERE slug = ?").bind(tagSlug).first<{ id: number }>();
      if (tag) await env.DB.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)").bind(articleId, tag.id).run();
    }

    await env.DB.prepare(
      `INSERT INTO sources (url, title, publisher, published_at, fetched_at, is_valid)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)
       ON CONFLICT(url) DO UPDATE SET title = excluded.title, published_at = excluded.published_at,
       fetched_at = CURRENT_TIMESTAMP, is_valid = true`
    ).bind(item.url, item.title, new URL(item.url).hostname, item.published_at).run();
    const source = await env.DB.prepare("SELECT id FROM sources WHERE url = ?").bind(item.url).first<{ id: number }>();
    if (source) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO article_sources (article_id, source_id, role, similarity, used_in_generation) VALUES (?, ?, 'primary', 1, true)"
      ).bind(articleId, source.id).run();
    }

    await env.DB.batch([
      env.DB.prepare("UPDATE feed_items SET processing_status = 'drafted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
      env.DB.prepare(
        `UPDATE automation_jobs
         SET status = 'succeeded', output_count = 1, input_tokens = ?, output_tokens = ?,
             total_tokens = ?, estimated_cost_microusd = ?,
             finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(usage.inputTokens, usage.outputTokens, usage.totalTokens, estimatedCostMicrousd, jobId),
      env.DB.prepare(
        `INSERT INTO ai_generation_logs
         (article_id, job_id, provider, model, prompt_version, source_count, output_chars, requires_review)
         VALUES (?, ?, 'gemini', ?, 'rss_translation_v2', ?, ?, true)`
      ).bind(articleId, jobId, model, 1 + related.length, draft.paragraphs.join("").length),
    ]);

    return Response.json({
      id: articleId,
      title: draft.title,
      status: "review",
      provider: "gemini",
      model,
      usage,
      estimatedCostMicrousd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "RSS_TRANSLATION_UNKNOWN_ERROR";
    await failJob(env.DB, jobId, message, id);
    return Response.json({ error: "中文草稿创建失败，错误已记录" }, { status: 500 });
  }
}

async function relatedFeedItems(db: D1Database, item: FeedRow) {
  const result = await db.prepare(
    `SELECT id, title, url, summary, published_at
     FROM feed_items
     WHERE id != ?
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT 100`
  ).bind(item.id).all<RelatedFeedRow>();
  const primary: FeedCandidate = {
    id: String(item.id),
    title: item.title,
    url: item.url,
    summary: item.summary,
    publishedAt: item.published_at ?? undefined,
  };
  return selectRelated(primary, result.results.map((row) => ({
    id: String(row.id),
    title: row.title,
    url: row.url,
    summary: row.summary,
    publishedAt: row.published_at ?? undefined,
  }))).map((row) => ({
    title: row.title,
    summary: row.summary,
    url: row.url,
    publishedAt: row.publishedAt ?? null,
  }));
}

async function maybeDownloadFeedCover(media: R2Bucket, item: FeedRow): Promise<DownloadedCover | null> {
  const candidate = feedImageCandidate(item.raw_json);
  if (!candidate) return null;
  try {
    const response = await fetch(candidate.url, {
      headers: { accept: "image/jpeg,image/png,image/webp" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const extension = IMAGE_EXTENSIONS[contentType];
    if (!extension) return null;
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_IMAGE_BYTES) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES || bytes.byteLength === 0) return null;
    const now = new Date();
    const key = `covers/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${extension}`;
    await media.put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata: {
        source: candidate.url,
        importedFrom: candidate.source,
        feedItemId: String(item.id),
      },
    });
    return {
      key,
      source: candidate.url,
      copyright: "RSS 提供的图片，发布前请确认授权或替换为官方/自有素材",
    };
  } catch {
    return null;
  }
}

async function failJob(db: D1Database, jobId: number, message: string, feedItemId?: number) {
  const statements = [
    db.prepare(
      "UPDATE automation_jobs SET status = 'failed', error_message = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(message, jobId),
  ];
  if (feedItemId) {
    statements.push(db.prepare(
      "UPDATE feed_items SET processing_status = 'translation_failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(feedItemId));
  }
  await db.batch(statements);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function safeSlug(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

async function shortHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 5), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
