import { getAdminUser } from "@/app/admin-auth";
import { automationDefaults, FeedCandidate } from "@/lib/automation";
import { feedUrlWithLimit } from "@/lib/feed";

const DEFAULT_JSON_FEED = "https://www.inoreader.com/stream/user/1003743197/tag/%E6%B8%B8%E6%88%8F%E6%96%B0%E9%97%BB/view/json";

export async function POST() {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const headers: HeadersInit = { accept: "application/json" };
  if (process.env.FEED_AUTHORIZATION) headers.authorization = process.env.FEED_AUTHORIZATION;
  const feedUrl = feedUrlWithLimit(process.env.FEED_URL ?? DEFAULT_JSON_FEED, automationDefaults.feedLimit);
  const response = await fetch(feedUrl, { headers });
  if (!response.ok) return Response.json({ error: "RSS 读取失败", status: response.status }, { status: 502 });
  const data = await response.json() as { items?: Array<Record<string, unknown>> };
  const items: FeedCandidate[] = (data.items ?? []).slice(0, automationDefaults.feedLimit).map((item, index) => ({
    id: String(item.id ?? index),
    title: String(item.title ?? "").trim(),
    url: String((item.canonical as Array<{ href?: string }> | undefined)?.[0]?.href ?? (item.alternate as Array<{ href?: string }> | undefined)?.[0]?.href ?? ""),
    summary: String((item.summary as { content?: string } | undefined)?.content ?? "").slice(0, automationDefaults.supportingMaxChars),
    publishedAt: item.published ? new Date(Number(item.published) * 1000).toISOString() : undefined,
  })).filter((item) => item.title && item.url);
  return Response.json({ count: items.length, limit: automationDefaults.feedLimit, items });
}
