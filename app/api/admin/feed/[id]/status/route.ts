import { getAdminUser } from "@/app/admin-auth";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  low_relevance: ["translation_required"],
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "无效的 RSS 记录" }, { status: 400 });
  const body = await request.json().catch(() => ({})) as { status?: string };
  const targetStatus = String(body.status ?? "");
  const { env } = await import("cloudflare:workers");
  const item = await env.DB.prepare(
    "SELECT id, processing_status FROM feed_items WHERE id = ?"
  ).bind(id).first<{ id: number; processing_status: string }>();
  if (!item) return Response.json({ error: "RSS 记录不存在" }, { status: 404 });
  if (!ALLOWED_TRANSITIONS[item.processing_status]?.includes(targetStatus)) {
    return Response.json({ error: "该 RSS 状态不能这样调整" }, { status: 409 });
  }
  await env.DB.prepare(
    "UPDATE feed_items SET processing_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(targetStatus, id).run();
  return Response.json({ id, status: targetStatus });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
