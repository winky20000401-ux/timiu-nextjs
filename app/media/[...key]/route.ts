import { safeCoverKey } from "@/lib/media";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] | string }> }) {
  const { key: rawKey } = await params;
  const key = safeCoverKey(Array.isArray(rawKey) ? rawKey.join("/") : rawKey);
  if (!key) return new Response("Not found", { status: 404 });

  const { env } = await import("cloudflare:workers");
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", headers.get("cache-control") ?? "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
