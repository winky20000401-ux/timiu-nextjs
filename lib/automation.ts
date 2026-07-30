export const automationDefaults = {
  feedLimit: 100,
  relatedLimit: 4,
  relatedDays: 14,
  similarityThreshold: 0.45,
  primaryMaxChars: 18_000,
  supportingMaxChars: 6_000,
  minimumArticleChars: 600,
  autoPublishConfidence: 0.6,
} as const;

export type FeedCandidate = {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt?: string;
};

const stopWords = new Set(["的", "了", "在", "与", "和", "及", "将", "已", "新", "游戏", "版本"]);

export function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[《》【】()[\]（）:：·、,，.!！?？"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  const normalized = normalizeTitle(value);
  const chunks = normalized.match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/g) ?? [];
  return new Set(chunks.filter((token) => !stopWords.has(token)));
}

export function versionNumbers(value: string) {
  return Array.from(normalizeTitle(value).matchAll(/(?:^|\s|第|v)(\d{1,3})(?:\s|代|部|季|版|$)/g), (match) => match[1]);
}

export function hasVersionConflict(a: string, b: string) {
  const left = versionNumbers(a);
  const right = versionNumbers(b);
  return left.length > 0 && right.length > 0 && !left.some((number) => right.includes(number));
}

export function titleSimilarity(a: string, b: string) {
  if (hasVersionConflict(a, b)) return 0;
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return normalizeTitle(a) === normalizeTitle(b) ? 1 : 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

export function selectRelated(primary: FeedCandidate, pool: FeedCandidate[], now = new Date(primary.publishedAt ?? Date.now())) {
  const earliest = now.getTime() - automationDefaults.relatedDays * 86_400_000;
  return pool
    .filter((item) => item.id !== primary.id)
    .filter((item) => !item.publishedAt || new Date(item.publishedAt).getTime() >= earliest)
    .map((item) => ({ ...item, similarity: titleSimilarity(primary.title, item.title) }))
    .filter((item) => item.similarity >= automationDefaults.similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, automationDefaults.relatedLimit);
}

export function canAutoPublish(input: {
  enabled: boolean;
  confidence: number;
  contentChars: number;
  sourceCount: number;
  hasConflict: boolean;
  isRumor: boolean;
  isDuplicate: boolean;
  categoryValid: boolean;
}) {
  return input.enabled &&
    input.confidence >= automationDefaults.autoPublishConfidence &&
    input.contentChars >= automationDefaults.minimumArticleChars &&
    input.sourceCount >= 1 &&
    !input.hasConflict &&
    !input.isRumor &&
    !input.isDuplicate &&
    input.categoryValid;
}

export function buildDraftPrompt(primary: FeedCandidate, related: FeedCandidate[]) {
  const sources = [primary, ...related];
  return `你是 TIMIU 游戏资讯的中文编辑。只根据下列资料写稿，不使用模型记忆补充日期、价格、平台、销量、引语或玩家反应。

要求：
- 使用自然简体中文，说明核心事实、可靠背景、对玩家或行业的影响、后续关注点。
- 目标 800 至 1200 字；素材不足可以更短，但必须在结果中设置 requires_review=true。
- 传闻必须明确标注；来源矛盾必须设置 requires_review=true 并说明原因。
- 不得虚构，不得为凑字数重复。
- 输出 JSON：title, subtitle, description, content_html, category, tags, confidence, requires_review, review_reason, used_source_urls。

资料：
${sources.map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\n发布时间: ${source.publishedAt ?? "未知"}\n摘要: ${source.summary || "无有效摘要"}`).join("\n\n")}`;
}
