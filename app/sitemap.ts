import type { MetadataRoute } from "next";
import { allTags, articles } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://timiu.com";
  const now = new Date("2026-07-28T00:00:00+08:00");
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...["/news", "/hardware", "/guides", "/about", "/privacy"].map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: "weekly" as const, priority: path === "/about" || path === "/privacy" ? 0.3 : 0.8 })),
    ...articles.map((article) => ({ url: `${base}/article/${article.slug}`, lastModified: new Date(article.updatedAt), changeFrequency: "weekly" as const, priority: article.featured ? 0.9 : 0.7 })),
    ...allTags.map((tag) => ({ url: `${base}/tag/${encodeURIComponent(tag)}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
