import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  constantTimeEqual,
  createSessionToken,
  hashAuthValue,
  isAllowedAdminEmail,
  normalizeEmail,
} from "@/lib/admin-auth-crypto";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { email?: string; code?: string };
  const email = normalizeEmail(body.email ?? "");
  const code = String(body.code ?? "").trim();
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || !isAllowedAdminEmail(email, process.env.ADMIN_EMAILS ?? "") || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "验证码无效或已经过期" }, { status: 401 });
  }

  const { env } = await import("cloudflare:workers");
  const loginCode = await env.DB.prepare(
    `SELECT id, code_hash FROM admin_login_codes
     WHERE email = ? AND consumed_at IS NULL AND expires_at > unixepoch() AND attempts < 5
     ORDER BY id DESC LIMIT 1`
  ).bind(email).first<{ id: number; code_hash: string }>();
  if (!loginCode) return Response.json({ error: "验证码无效或已经过期" }, { status: 401 });

  await env.DB.prepare("UPDATE admin_login_codes SET attempts = attempts + 1 WHERE id = ?").bind(loginCode.id).run();
  const suppliedHash = await hashAuthValue(secret, `code:${email}:${code}`);
  if (!constantTimeEqual(loginCode.code_hash, suppliedHash)) {
    return Response.json({ error: "验证码无效或已经过期" }, { status: 401 });
  }

  const token = createSessionToken();
  const sessionHash = await hashAuthValue(secret, `session:${token}`);
  await env.DB.batch([
    env.DB.prepare("UPDATE admin_login_codes SET consumed_at = unixepoch() WHERE id = ?").bind(loginCode.id),
    env.DB.prepare(
      `INSERT INTO admin_sessions (id, email, expires_at, last_seen_at)
       VALUES (?, ?, unixepoch() + 604800, unixepoch())`
    ).bind(sessionHash, email),
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= unixepoch()"),
    env.DB.prepare("DELETE FROM admin_login_codes WHERE created_at <= unixepoch() - 86400"),
  ]);

  (await cookies()).set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return Response.json({ ok: true });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
