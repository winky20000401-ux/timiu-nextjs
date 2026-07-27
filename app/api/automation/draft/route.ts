import { getAdminUser } from "@/app/admin-auth";
import { buildDraftPrompt, FeedCandidate } from "@/lib/automation";

type DraftRequest = { primary: FeedCandidate; related?: FeedCandidate[] };

export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });
  if (process.env.AI_REWRITE_ENABLED !== "true") {
    return Response.json(
      {
        error: "AI 长文重写已关闭",
        workflow: "RSS 入库 → 标题与短摘要处理 → 人工审核 → 手动发布",
      },
      { status: 409 },
    );
  }
  const body = await request.json() as DraftRequest;
  if (!body.primary?.title || !body.primary?.url) return Response.json({ error: "缺少主来源" }, { status: 400 });
  const prompt = buildDraftPrompt(body.primary, (body.related ?? []).slice(0, 4));
  const provider = process.env.AI_PROVIDER ?? "gemini";
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "未配置 OPENAI_API_KEY" }, { status: 503 });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-5-mini", input: prompt }),
    });
    if (!response.ok) return Response.json({ error: "OpenAI 草稿生成失败", status: response.status }, { status: 502 });
    const data = await response.json();
    return Response.json({ provider, status: "review", raw: data });
  }
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "未配置 GEMINI_API_KEY" }, { status: 503 });
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: [{ type: "google_search" }],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            description: { type: "string" },
            content_html: { type: "string" },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
            requires_review: { type: "boolean" },
            review_reason: { type: "string" },
            used_source_urls: { type: "array", items: { type: "string" } },
          },
          required: [
            "title", "subtitle", "description", "content_html", "category",
            "tags", "confidence", "requires_review", "review_reason",
            "used_source_urls",
          ],
        },
      },
    }),
  });
  if (!response.ok) return Response.json({ error: "Gemini 草稿生成失败", status: response.status }, { status: 502 });
  const data = await response.json();
  return Response.json({ provider, model, status: "review", raw: data });
}
