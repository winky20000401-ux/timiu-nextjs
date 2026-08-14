import { categoryMeta } from "@/lib/content";
import { getVisibleArticles } from "@/lib/published-articles";
import { SITE_URL, absoluteSiteUrl } from "@/lib/site";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}

export async function GET() {
  const visibleArticles = await getVisibleArticles();
  const items = visibleArticles.map((article) => `<item>
    <title>${escapeXml(article.title)}</title>
    <link>${absoluteSiteUrl(`/article/${article.slug}`)}</link>
    <guid isPermaLink="true">${absoluteSiteUrl(`/article/${article.slug}`)}</guid>
    <description>${escapeXml(article.dek)}</description>
    <category>${escapeXml(categoryMeta[article.category].name)}</category>
    <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
  </item>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>TIMIU 游戏资讯</title>
  <link>${SITE_URL}</link>
  <description>游戏新闻、科技硬件与游戏攻略</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date(visibleArticles[0]?.updatedAt ?? Date.now()).toUTCString()}</lastBuildDate>
  ${items}
</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
