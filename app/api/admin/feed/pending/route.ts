import { getAdminUser } from "@/app/admin-auth";

type PendingFeedItem = {
  id: number;
  title: string;
};

export async function GET(request: Request) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = [3, 5, 10, 20, 50, 100].includes(requestedLimit) ? requestedLimit : 20;
  const excludeIds = parseExcludedIds(url.searchParams.get("exclude"));
  const { env } = await import("cloudflare:workers");
  const statusWhere = `(processing_status = 'translation_required'
        OR (processing_status = 'translation_running' AND updated_at < datetime('now', '-30 minutes')))`;
  const excludeWhere = excludeIds.length ? ` AND id NOT IN (${excludeIds.map(() => "?").join(", ")})` : "";
  const [result, total] = await Promise.all([
    env.DB.prepare(
      `SELECT id, title
       FROM feed_items
       WHERE ${statusWhere}${excludeWhere}
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`
    ).bind(...excludeIds, limit).all<PendingFeedItem>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM feed_items
       WHERE ${statusWhere}`
    ).first<{ count: number }>(),
  ]);
  return Response.json({
    ids: result.results.map((item) => item.id),
    items: result.results,
    limit,
    total: total?.count ?? 0,
    excluded: excludeIds.length,
  });
}

function parseExcludedIds(value: string | null) {
  if (!value) return [];
  return Array.from(new Set(value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
  )).slice(0, 500);
}
