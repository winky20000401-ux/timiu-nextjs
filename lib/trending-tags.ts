type TrendInput = {
  title: string;
  description?: string;
  contentHtml?: string;
  sourceUrl?: string;
  tags?: string[];
};

export const trendingTags = [
  {
    name: "PC游戏",
    slug: "pc游戏",
    keywords: ["pc", "windows", "电脑", "显卡", "rtx", "radeon", "nvidia", "amd", "键鼠", "steam deck", "掌机"],
  },
  {
    name: "PlayStation",
    slug: "playstation",
    keywords: ["playstation", "ps5", "ps4", "ps plus", "ps store", "sony interactive", "索尼"],
  },
  {
    name: "Xbox",
    slug: "xbox",
    keywords: ["xbox", "game pass", "series x", "series s", "microsoft gaming", "微软游戏"],
  },
  {
    name: "Nintendo",
    slug: "nintendo",
    keywords: ["nintendo", "switch", "任天堂", "eshop", "mario", "zelda", "宝可梦", "pokemon"],
  },
  {
    name: "Steam",
    slug: "steam",
    keywords: ["steam", "steam deck", "valve", "愿望单", "wishlist"],
  },
  {
    name: "独立游戏",
    slug: "独立游戏",
    keywords: ["indie", "independent game", "独立游戏", "独立团队", "独立开发", "小团队", "发行商"],
  },
] as const;

export function matchTrendingTags(input: TrendInput) {
  const haystack = normalizeSearchText([
    input.title,
    input.description,
    input.contentHtml?.replace(/<[^>]+>/g, " "),
    input.sourceUrl,
    ...(input.tags ?? []),
  ].filter(Boolean).join(" "));
  return trendingTags
    .filter((tag) => tag.keywords.some((keyword) => hasKeyword(haystack, keyword)))
    .map((tag) => tag.name);
}

export async function addRelevantTrendingTags(db: D1Database, articleId: number, input: TrendInput) {
  const names = matchTrendingTags(input);
  for (const name of names) {
    const tagSlug = safeSlug(name);
    await db.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)").bind(name, tagSlug).run();
    const tag = await db.prepare("SELECT id FROM tags WHERE slug = ?").bind(tagSlug).first<{ id: number }>();
    if (tag) await db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)").bind(articleId, tag.id).run();
  }
  return names;
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

function hasKeyword(haystack: string, keyword: string) {
  const normalized = normalizeSearchText(keyword);
  if (/^[a-z0-9][a-z0-9 +.-]*[a-z0-9]$/.test(normalized)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalized)}([^a-z0-9]|$)`).test(haystack);
  }
  return haystack.includes(normalized);
}

function safeSlug(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
