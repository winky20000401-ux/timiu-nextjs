import { getAdminUser } from "@/app/admin-auth";
import { absoluteSiteUrl } from "@/lib/site";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const { id: rawId } = await params;
  const id = Number(rawId);
  const { action } = await request.json() as { action?: string };
  if (!Number.isInteger(id) || !["publish", "unpublish", "archive"].includes(action ?? "")) {
    return Response.json({ error: "无效操作" }, { status: 400 });
  }
  const { env } = await import("cloudflare:workers");
  const article = await env.DB.prepare(
    "SELECT id, title, slug, status, description, content_html, category_id FROM articles WHERE id = ?"
  ).bind(id).first<{ id: number; title: string; slug: string; status: string; description: string; content_html: string; category_id: number | null }>();
  if (!article) return Response.json({ error: "文章不存在" }, { status: 404 });
  let target = "archived";
  if (action === "publish") {
    const source = await env.DB.prepare("SELECT COUNT(*) AS count FROM article_sources WHERE article_id = ?").bind(id).first<{ count: number }>();
    if (!article.title || !article.description || !article.content_html || !article.category_id || !source?.count) {
      return Response.json({ error: "发布前必须补全标题、描述、正文、栏目和至少一个来源" }, { status: 409 });
    }
    target = "published";
    await env.DB.prepare(
      "UPDATE articles SET status = ?, requires_review = ?, review_reason = '', canonical_url = COALESCE(NULLIF(canonical_url, ''), ?), published_at = COALESCE(published_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(target, false, absoluteSiteUrl(`/article/${article.slug}`), id).run();
  } else if (action === "unpublish") {
    target = "review";
    await env.DB.prepare(
      "UPDATE articles SET status = ?, requires_review = ?, review_reason = ?, published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(target, true, "文章已撤回，需要重新审核", id).run();
  } else {
    await env.DB.prepare("UPDATE articles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(target, id).run();
  }
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (email, display_name, role) VALUES (?, ?, ?)"
  ).bind(user.email, user.displayName, "admin").run();
  const dbUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(user.email).first<{ id: number }>();
  await env.DB.prepare(
    "INSERT INTO publication_logs (article_id, user_id, action, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, dbUser?.id ?? null, action, article.status, target, "管理员在编辑工作台执行").run();
  return Response.json({ ok: true, status: target });
}
