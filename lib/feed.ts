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
  const canonical = item.canonical as Array<{ href?: string }> | undefined;
  const alternate = item.alternate as Array<{ href?: string }> | undefined;
  return String(canonical?.[0]?.href ?? alternate?.[0]?.href ?? "").trim();
}

function itemSummary(item: InoreaderItem) {
  const summary = item.summary as { content?: string } | undefined;
  const content = item.content as { content?: string } | undefined;
  return stripHtml(String(summary?.content ?? content?.content ?? "")).slice(0, 6_000);
}

export async function prepareFeedItems(items: InoreaderItem[], limit = 100): Promise<PreparedFeedItem[]> {
  const prepared: PreparedFeedItem[] = [];
  for (const [index, item] of items.slice(0, limit).entries()) {
    const title = stripHtml(String(item.title ?? "")).slice(0, 300);
    const url = itemUrl(item);
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const externalId = String(item.id ?? `${url}#${index}`).slice(0, 500);
    const summary = itemSummary(item);
    const published = Number(item.published);
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
      publishedAt: Number.isFinite(published) && published > 0
        ? new Date(published * 1_000).toISOString()
        : null,
      fingerprint,
      language,
      status: duplicate ? "duplicate" : language === "zh" ? "review" : "translation_required",
      duplicateOfExternalId: duplicate?.externalId ?? null,
      rawJson: JSON.stringify(item).slice(0, 40_000),
    });
  }
  return prepared;
}
