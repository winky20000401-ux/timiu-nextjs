import { getAdminUser } from "@/app/admin-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const { env } = await import("cloudflare:workers");
  const result = await env.DB.prepare(
    `UPDATE automation_jobs
     SET status = 'cleared', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'failed'`
  ).run();
  return Response.json({ ok: true, cleared: result.meta.changes ?? 0 });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
