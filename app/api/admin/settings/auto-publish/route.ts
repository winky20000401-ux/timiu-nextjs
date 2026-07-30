import { getAdminUser } from "@/app/admin-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const input = await request.json().catch(() => null) as { enabled?: unknown; limit?: unknown } | null;
  if (typeof input?.enabled !== "boolean") return Response.json({ error: "自动发布开关参数无效" }, { status: 400 });
  const limit = Number(input.limit ?? 5);
  if (![5, 10, 20, 50, 100].includes(limit)) {
    return Response.json({ error: "自动发布数量只能选择 5、10、20、50 或 100 篇" }, { status: 400 });
  }

  const { env } = await import("cloudflare:workers");
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO site_settings (key, value, is_secret, updated_at)
       VALUES ('auto_publish_enabled', ?, false, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_secret = false, updated_at = CURRENT_TIMESTAMP`
    ).bind(input.enabled ? "true" : "false"),
    env.DB.prepare(
      `INSERT INTO site_settings (key, value, is_secret, updated_at)
       VALUES ('auto_publish_limit', ?, false, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_secret = false, updated_at = CURRENT_TIMESTAMP`
    ).bind(String(limit)),
  ]);

  return Response.json({
    enabled: input.enabled,
    limit,
    message: input.enabled
      ? `自动发布开关已开启；每次最多 ${limit} 篇，发布任务仍必须满足安全保护条件。`
      : `自动发布已关闭；每次数量设置为 ${limit} 篇。`,
  });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
