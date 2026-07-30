import { getAdminUser } from "@/app/admin-auth";
import { automationDefaults, canAutoPublish } from "@/lib/automation";

type SiteSettingRow = {
  value: string;
};

type CandidateArticle = {
  id: number;
  title: string;
  status: string;
  confidence: number;
  content_html: string;
  category_id: number | null;
  review_reason: string;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });

  const { env } = await import("cloudflare:workers");
  const [enabledSetting, limitSetting] = await Promise.all([
    env.DB.prepare("SELECT value FROM site_settings WHERE key = 'auto_publish_enabled'").first<SiteSettingRow>(),
    env.DB.prepare("SELECT value FROM site_settings WHERE key = 'auto_publish_limit'").first<SiteSettingRow>(),
  ]);
  const enabled = enabledSetting?.value === "true";
  if (!enabled) return Response.json({ error: "自动发布开关尚未开启" }, { status: 409 });
  const limit = normalizeLimit(Number(limitSetting?.value ?? 5));

  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (email, display_name, role) VALUES (?, ?, ?)"
  ).bind(user.email, user.displayName, "admin").run();
  const dbUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(user.email).first<{ id: number }>();

  const candidates = await env.DB.prepare(
    `SELECT id, title, status, confidence, content_html, category_id, review_reason
     FROM articles
     WHERE status IN ('draft', 'review') AND status != 'archived'
     ORDER BY updated_at DESC
     LIMIT ?`
  ).bind(limit * 3).all<CandidateArticle>();

  const results = [];
  let published = 0;
  let skipped = 0;
  for (const article of candidates.results) {
    if (published >= limit) break;
    const source = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM article_sources WHERE article_id = ?"
    ).bind(article.id).first<{ count: number }>();
    const evaluation = evaluateCandidate(article, source?.count ?? 0, enabled);
    if (!evaluation.ok) {
      skipped += 1;
      results.push({ id: article.id, title: article.title, published: false, reasons: evaluation.reasons });
      continue;
    }
    await env.DB.prepare(
      `UPDATE articles
       SET status = 'published', requires_review = 0, review_reason = '',
           published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('draft', 'review')`
    ).bind(article.id).run();
    await env.DB.prepare(
      "INSERT INTO publication_logs (article_id, user_id, action, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(article.id, dbUser?.id ?? null, "auto_publish", article.status, "published", "管理员手动执行自动发布检查").run();
    published += 1;
    results.push({ id: article.id, title: article.title, published: true, reasons: [] });
  }

  return Response.json({
    ok: true,
    checked: results.length,
    published,
    skipped,
    limit,
    results,
  });
}

function evaluateCandidate(article: CandidateArticle, sourceCount: number, enabled: boolean) {
  const contentChars = textLength(article.content_html);
  const hasConflict = /冲突|矛盾|conflict/i.test(`${article.title} ${article.review_reason}`);
  const isRumor = /传闻|爆料|rumou?r|leak/i.test(`${article.title} ${article.review_reason}`);
  const isDuplicate = /重复|duplicate/i.test(`${article.title} ${article.review_reason}`);
  const categoryValid = Number.isInteger(article.category_id) && Number(article.category_id) > 0;
  const ok = canAutoPublish({
    enabled,
    confidence: article.confidence,
    contentChars,
    sourceCount,
    hasConflict,
    isRumor,
    isDuplicate,
    categoryValid,
  });
  const reasons = [];
  if (article.confidence < automationDefaults.autoPublishConfidence) reasons.push(`置信度 ${article.confidence.toFixed(2)} < 0.60`);
  if (contentChars < automationDefaults.minimumArticleChars) reasons.push(`正文 ${contentChars} 字 < 600 字`);
  if (sourceCount < 1) reasons.push("没有有效来源");
  if (hasConflict) reasons.push("存在来源冲突");
  if (isRumor) reasons.push("疑似传闻/爆料");
  if (isDuplicate) reasons.push("疑似重复文章");
  if (!categoryValid) reasons.push("栏目无效");
  return { ok, reasons };
}

function textLength(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, "")
    .length;
}

function normalizeLimit(value: number) {
  return [5, 10, 20, 50, 100].includes(value) ? value : 5;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
