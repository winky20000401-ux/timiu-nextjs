import { articles, categoryMeta } from "@/lib/content";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}

export async function GET() {
  const items = articles.map((article) => `<item>
    <title>${escapeXml(article.title)}</title>
    <link>https://timiu.com/article/${article.slug}</link>
    <guid isPermaLink="true">https://timiu.com/article/${article.slug}</guid>
    <description>${escapeXml(article.dek)}</description>
    <category>${escapeXml(categoryMeta[article.category].name)}</category>
    <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
  </item>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>TIMIU 游戏资讯</title>
  <link>https://timiu.com</link>
  <description>游戏新闻、科技硬件与游戏攻略</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date(articles[0].updatedAt).toUTCString()}</lastBuildDate>
  ${items}
</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
