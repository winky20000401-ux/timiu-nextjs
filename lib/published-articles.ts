import { Article, articles, CategoryKey } from "@/lib/content";

type PublishedArticleRow = {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  published_at: string;
  updated_at: string;
  content_chars: number;
  tags: string;
  cover_object_key: string | null;
  cover_source: string | null;
  cover_copyright: string | null;
};

export async function getPublishedArticles(limit = 100): Promise<Article[]> {
  try {
    const { env } = await import("cloudflare:workers");
    const result = await env.DB.prepare(
      `SELECT a.id, a.title, a.slug, a.description, c.slug AS category,
       a.published_at, a.updated_at, length(a.content_html) AS content_chars,
       a.cover_object_key, a.cover_source, a.cover_copyright,
       COALESCE((
         SELECT group_concat(t.name, '|||')
         FROM article_tags at
         JOIN tags t ON t.id = at.tag_id
         WHERE at.article_id = a.id
       ), '') AS tags
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       WHERE a.status = 'published' AND a.published_at IS NOT NULL
       ORDER BY a.published_at DESC
       LIMIT ?`
    ).bind(Math.max(1, Math.min(limit, 500))).all<PublishedArticleRow>();

    return result.results
      .filter((row) => isCategoryKey(row.category))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        dek: row.description,
        category: row.category as CategoryKey,
        tags: row.tags ? row.tags.split("|||").filter(Boolean) : [],
        publishedAt: normalizeDatabaseDate(row.published_at),
        updatedAt: normalizeDatabaseDate(row.updated_at),
        readingMinutes: Math.max(1, Math.ceil((row.content_chars || 0) / 500)),
        tone: toneForCategory(row.category as CategoryKey),
        kicker: "正式发布",
        content: [],
        sourceName: "已核验来源",
        sourceUrl: `/article/${row.slug}`,
        coverObjectKey: row.cover_object_key ?? undefined,
        coverSource: row.cover_source ?? undefined,
        coverCopyright: row.cover_copyright ?? undefined,
      }));
  } catch {
    return [];
  }
}

export async function getVisibleArticles(limit = 100) {
  const published = await getPublishedArticles(limit);
  const publishedSlugs = new Set(published.map((article) => article.slug));
  return [...published, ...articles.filter((article) => !publishedSlugs.has(article.slug))];
}

function isCategoryKey(value: string): value is CategoryKey {
  return value === "news" || value === "hardware" || value === "guides";
}

function toneForCategory(category: CategoryKey): Article["tone"] {
  if (category === "hardware") return "cyan";
  if (category === "guides") return "violet";
  return "lime";
}

function normalizeDatabaseDate(value: string) {
  if (!value) return new Date().toISOString();
  if (value.includes("T")) return value;
  return `${value.replace(" ", "T")}Z`;
}
