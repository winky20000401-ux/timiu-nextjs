import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, hashAuthValue } from "@/lib/admin-auth-crypto";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response("Forbidden", { status: 403 });

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SESSION_SECRET;
  if (token && secret) {
    const sessionHash = await hashAuthValue(secret, `session:${token}`);
    const { env } = await import("cloudflare:workers");
    await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(sessionHash).run();
  }
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return Response.redirect(new URL("/", request.url), 303);
}
