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
  const { env } = await import("cloudflare:workers");
  const result = await env.DB.prepare(
    `SELECT id, title
     FROM feed_items
     WHERE processing_status = 'translation_required'
        OR (processing_status = 'translation_running' AND updated_at < datetime('now', '-30 minutes'))
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT ?`
  ).bind(limit).all<PendingFeedItem>();
  return Response.json({ ids: result.results.map((item) => item.id), items: result.results, limit });
}
