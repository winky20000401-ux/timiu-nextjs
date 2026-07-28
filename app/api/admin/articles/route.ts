import { getAdminUser } from "@/app/admin-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;
  const title = String(body.title ?? "").trim().slice(0, 200);
  const requestedSlug = safeSlug(String(body.slug ?? "") || title);
  const description = String(body.description ?? "").trim().slice(0, 320);
  const contentText = String(body.contentText ?? "").trim().slice(0, 40_000);
  const categoryId = Number(body.categoryId);
  const sourceUrl = safeSourceUrl(String(body.sourceUrl ?? ""));
  const publishNow = body.publishNow === true;
  if (!title || !requestedSlug || !description || !contentText || !Number.isInteger(categoryId)) {
    return Response.json({ error: "标题、描述、栏目和正文均为必填项" }, { status: 400 });
  }
  if (String(body.sourceUrl ?? "").trim() && !sourceUrl) {
    return Response.json({ error: "来源链接必须是有效的 http 或 https 地址" }, { status: 400 });
  }
  if (publishNow && !sourceUrl) {
    return Response.json({ error: "直接发布前必须填写有效的主要来源链接" }, { status: 400 });
  }

  const contentHtml = textToHtml(contentText);
  const { env } = await import("cloudflare:workers");
  const slug = await findAvailableSlug(env.DB, requestedSlug);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (email, display_name, role) VALUES (?, ?, ?)"
  ).bind(user.email, user.displayName, "admin").run();
  const dbUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(user.email).first<{ id: number }>();

  let articleId = 0;
  try {
    const article = await env.DB.prepare(
      `INSERT INTO articles
       (title, subtitle, slug, seo_title, description, content_html, category_id, author_id,
        status, confidence, requires_review, review_reason, canonical_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, true, ?, '')`
    ).bind(
      title,
      String(body.subtitle ?? "").trim().slice(0, 240),
      slug,
      String(body.seoTitle ?? title).trim().slice(0, 220) || title,
      description,
      contentHtml,
      categoryId,
      dbUser?.id ?? null,
      "手动新建文章需要人工审核",
    ).run();
    articleId = Number(article.meta.last_row_id);
  } catch {
    return Response.json({ error: "草稿创建失败，请稍后重试" }, { status: 409 });
  }
  if (!articleId) return Response.json({ error: "草稿创建失败" }, { status: 500 });

  const tagNames = Array.from(new Set(String(body.tags ?? "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
  for (const name of tagNames) {
    const tagSlug = safeSlug(name) || `tag-${await shortHash(name)}`;
    await env.DB.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)").bind(name.slice(0, 50), tagSlug).run();
    const tag = await env.DB.prepare("SELECT id FROM tags WHERE slug = ?").bind(tagSlug).first<{ id: number }>();
    if (tag) await env.DB.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)").bind(articleId, tag.id).run();
  }

  if (sourceUrl) {
    await env.DB.prepare(
      `INSERT INTO sources (url, title, publisher, fetched_at, is_valid)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
       ON CONFLICT(url) DO UPDATE SET title = excluded.title, publisher = excluded.publisher, fetched_at = CURRENT_TIMESTAMP, is_valid = true`
    ).bind(
      sourceUrl,
      String(body.sourceTitle ?? "").trim().slice(0, 200) || new URL(sourceUrl).hostname,
      new URL(sourceUrl).hostname,
      true,
    ).run();
    const source = await env.DB.prepare("SELECT id FROM sources WHERE url = ?").bind(sourceUrl).first<{ id: number }>();
    if (source) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO article_sources (article_id, source_id, role, similarity, used_in_generation) VALUES (?, ?, ?, ?, ?)"
      ).bind(articleId, source.id, "primary", 1, false).run();
    }
  }

  if (publishNow) {
    await env.DB.prepare(
      `UPDATE articles SET status = 'published', requires_review = 0, review_reason = '',
       published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(articleId).run();
    await env.DB.prepare(
      "INSERT INTO publication_logs (article_id, user_id, action, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(articleId, dbUser?.id ?? null, "publish", "draft", "published", "管理员在新建文章页面审核并直接发布").run();
  }

  return Response.json({
    ok: true,
    id: articleId,
    slug,
    status: publishNow ? "published" : "draft",
  }, { status: 201 });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function safeSlug(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

async function findAvailableSlug(db: D1Database, requestedSlug: string) {
  let candidate = requestedSlug;
  for (let index = 1; index <= 100; index += 1) {
    const existing = await db.prepare("SELECT 1 AS found FROM articles WHERE slug = ? LIMIT 1").bind(candidate).first<{ found: number }>();
    if (!existing) return candidate;
    const suffix = `-${index + 1}`;
    candidate = `${requestedSlug.slice(0, 120 - suffix.length)}${suffix}`;
  }
  const suffix = `-${crypto.randomUUID().slice(0, 8)}`;
  return `${requestedSlug.slice(0, 120 - suffix.length)}${suffix}`;
}

function safeSourceUrl(value: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function textToHtml(value: string) {
  return value.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

async function shortHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 5), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
