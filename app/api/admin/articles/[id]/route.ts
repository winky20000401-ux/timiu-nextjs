import { getAdminUser } from "@/app/admin-auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const { id: rawId } = await params;
  const id = Number(rawId);
  const body = await request.json() as Record<string, unknown>;
  const title = String(body.title ?? "").trim().slice(0, 200);
  const slug = safeSlug(String(body.slug ?? ""));
  const description = String(body.description ?? "").trim().slice(0, 320);
  const contentText = String(body.contentText ?? "").trim().slice(0, 40_000);
  const categoryId = Number(body.categoryId);
  if (!Number.isInteger(id) || !title || !slug || !description || !contentText || !Number.isInteger(categoryId)) {
    return Response.json({ error: "标题、Slug、描述、栏目和正文均为必填项" }, { status: 400 });
  }
  const contentHtml = contentText.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const { env } = await import("cloudflare:workers");
  const result = await env.DB.prepare(
    `UPDATE articles SET title = ?, subtitle = ?, slug = ?, seo_title = ?, description = ?,
     content_html = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'archived'`
  ).bind(
    title, String(body.subtitle ?? "").trim().slice(0, 240), slug,
    String(body.seoTitle ?? title).trim().slice(0, 220), description,
    contentHtml, categoryId, id,
  ).run();
  if (!result.meta.changes) return Response.json({ error: "文章不存在或已归档" }, { status: 404 });
  await env.DB.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(id).run();
  const tagNames = Array.from(new Set(String(body.tags ?? "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
  for (const name of tagNames) {
    const tagSlug = safeSlug(name) || `tag-${await shortHash(name)}`;
    await env.DB.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)").bind(name.slice(0, 50), tagSlug).run();
    const tag = await env.DB.prepare("SELECT id FROM tags WHERE slug = ?").bind(tagSlug).first<{ id: number }>();
    if (tag) await env.DB.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)").bind(id, tag.id).run();
  }
  return Response.json({ ok: true, id, slug });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
function safeSlug(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
async function shortHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 5), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
