import { normalizeTitle, titleSimilarity } from "./automation.ts";

export type InoreaderItem = Record<string, unknown>;

export type PreparedFeedItem = {
  externalId: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  fingerprint: string;
  language: "zh" | "other";
  status: "review" | "translation_required" | "duplicate";
  duplicateOfExternalId: string | null;
  rawJson: string;
};

export function feedUrlWithLimit(value: string, limit = 100) {
  try {
    const url = new URL(value);
    if (url.hostname === "inoreader.com" || url.hostname.endsWith(".inoreader.com")) {
      url.searchParams.set("n", String(Math.max(1, Math.min(limit, 100))));
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLanguage(value: string): "zh" | "other" {
  const compact = value.replace(/\s/g, "");
  if (!compact) return "other";
  const chinese = (compact.match(/[\u3400-\u9fff]/g) ?? []).length;
  return chinese / compact.length >= 0.18 ? "zh" : "other";
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function itemUrl(item: InoreaderItem) {
  const canonical = item.canonical as Array<{ href?: string }> | { href?: string } | undefined;
  const alternate = item.alternate as Array<{ href?: string }> | { href?: string } | undefined;
  const link = item.link as string | { href?: string } | undefined;
  const candidates = [
    item.url,
    item.external_url,
    Array.isArray(canonical) ? canonical[0]?.href : canonical?.href,
    Array.isArray(alternate) ? alternate[0]?.href : alternate?.href,
    typeof link === "string" ? link : link?.href,
  ];
  return candidates.map((value) => String(value ?? "").trim()).find((value) => /^https?:\/\//i.test(value)) ?? "";
}

function itemSummary(item: InoreaderItem) {
  const summary = item.summary as { content?: string } | string | undefined;
  const content = item.content as { content?: string } | undefined;
  return stripHtml(String(
    (typeof summary === "string" ? summary : summary?.content) ??
    content?.content ??
    item.content_html ??
    item.content_text ??
    ""
  )).slice(0, 6_000);
}

function itemTitle(item: InoreaderItem) {
  const title = item.title as string | { content?: string } | undefined;
  return stripHtml(String(typeof title === "string" ? title : title?.content ?? "")).slice(0, 300);
}

function itemPublishedAt(item: InoreaderItem) {
  const epochSeconds = Number(item.published);
  if (Number.isFinite(epochSeconds) && epochSeconds > 0) return new Date(epochSeconds * 1_000).toISOString();
  for (const value of [item.date_published, item.date_modified]) {
    const date = new Date(String(value ?? ""));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const timestampUsec = Number(item.timestampUsec);
  if (Number.isFinite(timestampUsec) && timestampUsec > 0) return new Date(timestampUsec / 1_000).toISOString();
  const crawlTimeMsec = Number(item.crawlTimeMsec);
  if (Number.isFinite(crawlTimeMsec) && crawlTimeMsec > 0) return new Date(crawlTimeMsec).toISOString();
  return null;
}

export function feedRejectionSummary(items: InoreaderItem[], limit = 100) {
  const summary = { missingTitle: 0, missingUrl: 0, invalidUrl: 0 };
  for (const item of items.slice(0, limit)) {
    if (!itemTitle(item)) {
      summary.missingTitle += 1;
      continue;
    }
    const url = itemUrl(item);
    if (!url) summary.missingUrl += 1;
    else if (!/^https?:\/\//i.test(url)) summary.invalidUrl += 1;
  }
  return summary;
}

export async function prepareFeedItems(items: InoreaderItem[], limit = 100): Promise<PreparedFeedItem[]> {
  const prepared: PreparedFeedItem[] = [];
  for (const [index, item] of items.slice(0, limit).entries()) {
    const title = itemTitle(item);
    const url = itemUrl(item);
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const externalId = String(item.id ?? `${url}#${index}`).slice(0, 500);
    const summary = itemSummary(item);
    const normalized = normalizeTitle(title);
    const fingerprint = await sha256(normalized);
    const duplicate = prepared.find((candidate) =>
      candidate.fingerprint === fingerprint ||
      titleSimilarity(candidate.title, title) >= 0.82
    );
    const language = detectLanguage(`${title} ${summary}`);
    prepared.push({
      externalId,
      title,
      url,
      summary,
      publishedAt: itemPublishedAt(item),
      fingerprint,
      language,
      status: duplicate ? "duplicate" : language === "zh" ? "review" : "translation_required",
      duplicateOfExternalId: duplicate?.externalId ?? null,
      rawJson: JSON.stringify(item).slice(0, 40_000),
    });
  }
  return prepared;
}
