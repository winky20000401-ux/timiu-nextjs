import { getAdminUser } from "@/app/admin-auth";
import { prepareFeedItems } from "@/lib/feed";

const DEFAULT_JSON_FEED = "https://www.inoreader.com/stream/user/1003743197/tag/%E6%B8%B8%E6%88%8F%E6%96%B0%E9%97%BB/view/json";

export async function POST() {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const { env } = await import("cloudflare:workers");
  const authorization = process.env.FEED_AUTHORIZATION;
  const headers: HeadersInit = { accept: "application/json" };
  if (authorization) headers.authorization = authorization;
  const feedUrl = process.env.FEED_URL ?? DEFAULT_JSON_FEED;
  const job = await env.DB.prepare(
    "INSERT INTO automation_jobs (type, status, input_count, output_count, attempt, started_at) VALUES (?, ?, 0, 0, 1, CURRENT_TIMESTAMP)"
  ).bind("rss_ingest", "running").run();
  const jobId = Number(job.meta.last_row_id);
  try {
    const response = await fetch(feedUrl, { headers });
    if (!response.ok) throw new Error(`RSS_HTTP_${response.status}`);
    const data = await response.json() as { items?: Array<Record<string, unknown>> };
    const items = await prepareFeedItems(data.items ?? [], 100);
    const statements = items.map((item) => env.DB.prepare(
      `INSERT OR IGNORE INTO feed_items
       (external_id, feed_url, title, url, summary, published_at, fingerprint, processing_status, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      item.externalId, feedUrl, item.title, item.url, item.summary,
      item.publishedAt, item.fingerprint, item.status, item.rawJson,
    ));
    const results = statements.length ? await env.DB.batch(statements) : [];
    const imported = results.reduce((total, result) => total + Number(result.meta.changes ?? 0), 0);
    await env.DB.prepare(
      "UPDATE automation_jobs SET status = ?, input_count = ?, output_count = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind("succeeded", items.length, imported, jobId).run();
    return Response.json({
      imported,
      duplicates: items.filter((item) => item.status === "duplicate").length,
      requiresTranslation: items.filter((item) => item.status === "translation_required").length,
      review: items.filter((item) => item.status === "review").length,
      limit: 100,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "RSS_UNKNOWN_ERROR";
    await env.DB.prepare(
      "UPDATE automation_jobs SET status = ?, error_message = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind("failed", message, jobId).run();
    return Response.json({ error: "RSS 入库失败，错误已记录" }, { status: 502 });
  }
}
