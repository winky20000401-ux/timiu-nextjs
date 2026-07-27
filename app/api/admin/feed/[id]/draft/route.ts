import { getAdminUser } from "@/app/admin-auth";

type FeedRow = {
  id: number;
  title: string;
  url: string;
  summary: string;
  fingerprint: string;
  published_at: string | null;
  processing_status: string;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "无效的 RSS 记录" }, { status: 400 });
  const { env } = await import("cloudflare:workers");
  const item = await env.DB.prepare(
    "SELECT id, title, url, summary, fingerprint, published_at, processing_status FROM feed_items WHERE id = ?"
  ).bind(id).first<FeedRow>();
  if (!item) return Response.json({ error: "RSS 记录不存在" }, { status: 404 });
  if (item.processing_status === "translation_required") {
    return Response.json({ error: "外文条目需要先人工翻译标题和短摘要" }, { status: 409 });
  }
  if (item.processing_status !== "review") {
    return Response.json({ error: "该条目当前不能生成草稿" }, { status: 409 });
  }

  await env.DB.prepare(
    "INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)"
  ).bind("游戏新闻", "news", "新作、发行、更新与游戏产业动态", 1).run();
  const category = await env.DB.prepare("SELECT id FROM categories WHERE slug = ?").bind("news").first<{ id: number }>();
  if (!category) return Response.json({ error: "栏目初始化失败" }, { status: 500 });

  const slug = `rss-${item.id}-${item.fingerprint.slice(0, 10)}`;
  const description = item.summary.slice(0, 180) || `${item.title}的新闻线索，等待编辑补充核验。`;
  const contentHtml = [
    `<p>${escapeHtml(item.summary || "RSS 未提供有效摘要，编辑需查看来源后补充事实。")}</p>`,
    `<p><strong>编辑提示：</strong>这是由 RSS 线索生成的短讯草稿，尚未核验，不可直接发布。</p>`,
    `<p>原始来源：<a href="${escapeHtml(item.url)}" rel="nofollow noreferrer">${escapeHtml(item.url)}</a></p>`,
  ].join("");
  const article = await env.DB.prepare(
    `INSERT INTO articles
     (title, slug, seo_title, description, content_html, category_id, status, confidence, requires_review, review_reason, canonical_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO NOTHING`
  ).bind(
    item.title, slug, item.title, description, contentHtml, category.id,
    "review", 0.4, true, "RSS 短讯草稿需要人工核验事实、来源与中文表达", "",
  ).run();
  const articleId = Number(article.meta.last_row_id);
  if (!articleId) return Response.json({ error: "该 RSS 条目已创建过草稿" }, { status: 409 });

  await env.DB.prepare(
    `INSERT INTO sources (url, title, publisher, published_at, fetched_at, is_valid)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(url) DO UPDATE SET title = excluded.title, published_at = excluded.published_at, fetched_at = CURRENT_TIMESTAMP`
  ).bind(item.url, item.title, new URL(item.url).hostname, item.published_at, true).run();
  const source = await env.DB.prepare("SELECT id FROM sources WHERE url = ?").bind(item.url).first<{ id: number }>();
  if (source) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO article_sources (article_id, source_id, role, similarity, used_in_generation) VALUES (?, ?, ?, ?, ?)"
    ).bind(articleId, source.id, "primary", 1, false).run();
  }
  await env.DB.prepare(
    "UPDATE feed_items SET processing_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind("drafted", id).run();
  return Response.json({ id: articleId, slug, title: item.title, status: "review" });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}
