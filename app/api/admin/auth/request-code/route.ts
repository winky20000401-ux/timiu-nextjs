import { createLoginCode, hashAuthValue, isAllowedAdminEmail, normalizeEmail } from "@/lib/admin-auth-crypto";

const GENERIC_MESSAGE = "如果该邮箱具有管理员权限，验证码将发送到邮箱。";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { email?: string };
  const email = normalizeEmail(body.email ?? "");
  if (!email || !isAllowedAdminEmail(email, process.env.ADMIN_EMAILS ?? "")) {
    return Response.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const secret = process.env.AUTH_SESSION_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  if (!secret || secret.length < 32 || !apiKey || !from) {
    return Response.json({ error: "邮件登录服务尚未完成配置" }, { status: 503 });
  }

  const { env } = await import("cloudflare:workers");
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await hashAuthValue(secret, `ip:${ip}`);
  const [emailRate, ipRate] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM admin_login_codes WHERE email = ? AND created_at > unixepoch() - 600"
    ).bind(email).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM admin_login_codes WHERE request_ip_hash = ? AND created_at > unixepoch() - 600"
    ).bind(ipHash).first<{ count: number }>(),
  ]);
  if ((emailRate?.count ?? 0) >= 3 || (ipRate?.count ?? 0) >= 10) {
    return Response.json({ error: "请求过于频繁，请十分钟后重试" }, { status: 429 });
  }

  const code = createLoginCode();
  const codeHash = await hashAuthValue(secret, `code:${email}:${code}`);
  const result = await env.DB.prepare(
    `INSERT INTO admin_login_codes (email, code_hash, request_ip_hash, expires_at)
     VALUES (?, ?, ?, unixepoch() + 600)`
  ).bind(email, codeHash, ipHash).run();
  const codeId = result.meta.last_row_id;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "TIMIU 管理后台登录验证码",
      text: `你的 TIMIU 管理后台验证码是：${code}\n\n验证码将在 10 分钟后失效。如果不是你本人操作，请忽略此邮件。`,
    }),
  });
  if (!response.ok) {
    await env.DB.prepare("DELETE FROM admin_login_codes WHERE id = ?").bind(codeId).run();
    return Response.json({ error: "验证码邮件发送失败，请稍后重试" }, { status: 502 });
  }

  return Response.json({ ok: true, message: GENERIC_MESSAGE });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
