import { timingSafeEqual } from "node:crypto";

const MAX_BODY_BYTES = 256 * 1024;
const MODEL_PATH = /^\/v1beta\/models\/[A-Za-z0-9._-]+:generateContent$/;

export function isAllowedPath(pathname) {
  return MODEL_PATH.test(pathname);
}

export function isAuthorized(header, expected) {
  if (!expected || typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const received = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

export async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new RelayError(413, "请求内容过大");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    JSON.parse(raw);
  } catch {
    throw new RelayError(400, "请求内容不是有效 JSON");
  }
  return raw;
}

export class RelayError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
