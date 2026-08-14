import type { MetadataRoute } from "next";
import { getVisibleArticles } from "@/lib/published-articles";
import { SITE_URL, absoluteSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const visibleArticles = await getVisibleArticles();
  const visibleTags = Array.from(new Set(visibleArticles.flatMap((article) => article.tags)));
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...["/news", "/hardware", "/guides", "/about", "/privacy"].map((path) => ({ url: absoluteSiteUrl(path), lastModified: now, changeFrequency: "weekly" as const, priority: path === "/about" || path === "/privacy" ? 0.3 : 0.8 })),
    ...visibleArticles.map((article) => ({ url: absoluteSiteUrl(`/article/${article.slug}`), lastModified: new Date(article.updatedAt), changeFrequency: "weekly" as const, priority: article.featured ? 0.9 : 0.7 })),
    ...visibleTags.map((tag) => ({ url: absoluteSiteUrl(`/tag/${encodeURIComponent(tag)}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
