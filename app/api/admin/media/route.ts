import { getAdminUser } from "@/app/admin-auth";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "请选择图片文件" }, { status: 400 });
  }
  const extension = IMAGE_EXTENSIONS.get(file.type);
  if (!extension) {
    return Response.json({ error: "仅支持 JPEG、PNG 或 WebP 图片" }, { status: 415 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "封面图片不能超过 5MB" }, { status: 413 });
  }

  const now = new Date();
  const key = `covers/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${extension}`;
  const { env } = await import("cloudflare:workers");
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { uploadedBy: user.email },
  });
  return Response.json({ ok: true, key, url: `/media/${key}` }, { status: 201 });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
