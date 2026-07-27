import { getChatGPTUser } from "@/app/chatgpt-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  hashAuthValue,
  isAllowedAdminEmail,
  safeAdminReturnTo,
} from "@/lib/admin-auth-crypto";

export async function getAdminUser() {
  const allowlist = process.env.ADMIN_EMAILS ?? "";
  const chatGPTUser = await getChatGPTUser();
  if (chatGPTUser && isAllowedAdminEmail(chatGPTUser.email, allowlist)) return chatGPTUser;

  const secret = process.env.AUTH_SESSION_SECRET;
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!secret || !token) return null;

  const sessionHash = await hashAuthValue(secret, `session:${token}`);
  try {
    const { env } = await import("cloudflare:workers");
    const session = await env.DB.prepare(
      "SELECT email FROM admin_sessions WHERE id = ? AND expires_at > unixepoch()"
    ).bind(sessionHash).first<{ email: string }>();
    if (!session || !isAllowedAdminEmail(session.email, allowlist)) return null;
    return {
      email: session.email,
      displayName: session.email.split("@")[0],
      fullName: null,
    };
  } catch {
    return null;
  }
}

export async function requireAdminUser(returnTo: string) {
  const user = await getAdminUser();
  if (user) return user;
  redirect(`/admin/login?return_to=${encodeURIComponent(safeAdminReturnTo(returnTo))}`);
}
