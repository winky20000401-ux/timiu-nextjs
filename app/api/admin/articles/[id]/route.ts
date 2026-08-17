import { getAdminUser } from "@/app/admin-auth";
import { safeCoverKey } from "@/lib/media";
import { absoluteSiteUrl } from "@/lib/site";
import { addRelevantTrendingTags } from "@/lib/trending-tags";

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
  const sourceUrl = safeSourceUrl(String(body.sourceUrl ?? ""));
  const requestedCoverKey = String(body.coverObjectKey ?? "").trim();
  const coverObjectKey = safeCoverKey(requestedCoverKey);
  const coverSource = String(body.coverSource ?? "").trim().slice(0, 300);
  const coverCopyright = String(body.coverCopyright ?? "").trim().slice(0, 500);
  if (!Number.isInteger(id) || !title || !slug || !description || !contentText || !Number.isInteger(categoryId)) {
    return Response.json({ error: "标题、Slug、描述、栏目和正文均为必填项" }, { status: 400 });
  }
  if (String(body.sourceUrl ?? "").trim() && !sourceUrl) {
    return Response.json({ error: "来源链接必须是有效的 http 或 https 地址" }, { status: 400 });
  }
  if (requestedCoverKey && !coverObjectKey) {
    return Response.json({ error: "封面文件标识无效，请重新上传" }, { status: 400 });
  }
  if (coverObjectKey && (!coverSource || !coverCopyright)) {
    return Response.json({ error: "使用封面时必须填写图片来源和版权/授权说明" }, { status: 400 });
  }
  const contentHtml = contentText.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const { env } = await import("cloudflare:workers");
  const canonicalUrl = absoluteSiteUrl(`/article/${slug}`);
  const result = await env.DB.prepare(
    `UPDATE articles SET title = ?, subtitle = ?, slug = ?, seo_title = ?, description = ?,
     content_html = ?, category_id = ?, cover_object_key = ?, cover_source = ?, cover_copyright = ?,
     canonical_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'archived'`
  ).bind(
    title, String(body.subtitle ?? "").trim().slice(0, 240), slug,
    String(body.seoTitle ?? title).trim().slice(0, 220), description,
    contentHtml, categoryId, coverObjectKey || null,
    coverObjectKey ? coverSource : null, coverObjectKey ? coverCopyright : null,
    canonicalUrl, id,
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
  await addRelevantTrendingTags(env.DB, id, {
    title,
    description,
    contentHtml,
    sourceUrl,
    tags: tagNames,
  });
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
      ).bind(id, source.id, "primary", 1, false).run();
    }
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
function safeSourceUrl(value: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
async function shortHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 5), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
