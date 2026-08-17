import { getAdminUser } from "@/app/admin-auth";
import { addRelevantTrendingTags } from "@/lib/trending-tags";

const ACTIONS = ["publish", "unpublish", "archive"] as const;
const MAX_BULK_ARTICLES = 100;

type BulkAction = typeof ACTIONS[number];

type ArticleRow = {
  id: number;
  title: string;
  status: string;
  description: string;
  content_html: string;
  category_id: number | null;
  tags: string;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const body = await request.json().catch(() => null) as { ids?: unknown; action?: unknown } | null;
  const action = String(body?.action ?? "") as BulkAction;
  const ids = Array.isArray(body?.ids)
    ? Array.from(new Set(body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))).slice(0, MAX_BULK_ARTICLES)
    : [];
  if (!ACTIONS.includes(action) || ids.length === 0) {
    return Response.json({ error: "请选择文章并提供有效操作" }, { status: 400 });
  }

  const { env } = await import("cloudflare:workers");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (email, display_name, role) VALUES (?, ?, ?)"
  ).bind(user.email, user.displayName, "admin").run();
  const dbUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(user.email).first<{ id: number }>();

  const results = [];
  let updated = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await transitionArticle(env.DB, id, action, dbUser?.id ?? null);
    results.push(result);
    if (result.ok) updated += 1;
    else failed += 1;
  }
  return Response.json({ ok: true, updated, failed, results });
}

async function transitionArticle(db: D1Database, id: number, action: BulkAction, userId: number | null) {
  const article = await db.prepare(
    `SELECT a.id, a.title, a.status, a.description, a.content_html, a.category_id,
            COALESCE((
              SELECT group_concat(t.name, '|||')
              FROM article_tags at
              JOIN tags t ON t.id = at.tag_id
              WHERE at.article_id = a.id
            ), '') AS tags
     FROM articles a WHERE a.id = ?`
  ).bind(id).first<ArticleRow>();
  if (!article) return { id, ok: false, error: "文章不存在" };
  if (article.status === "archived" && action !== "archive") return { id, ok: false, error: "已归档文章不能批量发布或撤回" };

  let target = "archived";
  if (action === "publish") {
    const source = await db.prepare("SELECT COUNT(*) AS count FROM article_sources WHERE article_id = ?").bind(id).first<{ count: number }>();
    if (!article.title || !article.description || !article.content_html || !article.category_id || !source?.count) {
      return { id, ok: false, error: "缺少标题、描述、正文、栏目或来源" };
    }
    await addRelevantTrendingTags(db, id, {
      title: article.title,
      description: article.description,
      contentHtml: article.content_html,
      tags: article.tags ? article.tags.split("|||").filter(Boolean) : [],
    });
    target = "published";
    await db.prepare(
      "UPDATE articles SET status = ?, requires_review = ?, review_reason = '', published_at = COALESCE(published_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(target, false, id).run();
  } else if (action === "unpublish") {
    target = "review";
    await db.prepare(
      "UPDATE articles SET status = ?, requires_review = ?, review_reason = ?, published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(target, true, "文章已批量撤回，需要重新审核", id).run();
  } else {
    await db.prepare("UPDATE articles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(target, id).run();
  }

  await db.prepare(
    "INSERT INTO publication_logs (article_id, user_id, action, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, userId, action, article.status, target, "管理员在文章列表批量执行").run();
  return { id, ok: true, status: target };
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
