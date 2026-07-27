export const ADMIN_SESSION_COOKIE = "__Host-timiu_admin";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isAllowedAdminEmail(value: string, allowlist: string) {
  const email = normalizeEmail(value);
  return allowlist
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
    .includes(email);
}

export function createLoginCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return value.toString().padStart(6, "0");
}

export function createSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}

export async function hashAuthValue(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function safeAdminReturnTo(value: string | null | undefined) {
  if (!value?.startsWith("/admin") || value.startsWith("//")) return "/admin";
  try {
    const url = new URL(value, "https://timiu.local");
    if (url.origin !== "https://timiu.local" || url.pathname.startsWith("/admin/login")) return "/admin";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
