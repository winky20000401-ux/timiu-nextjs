import { getChatGPTUser } from "@/app/chatgpt-auth";
import { buildDraftPrompt, FeedCandidate } from "@/lib/automation";

type DraftRequest = { primary: FeedCandidate; related?: FeedCandidate[] };

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "需要管理员登录" }, { status: 401 });
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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.25 },
      tools: [{ googleSearch: {} }],
    }),
  });
  if (!response.ok) return Response.json({ error: "Gemini 草稿生成失败", status: response.status }, { status: 502 });
  const data = await response.json();
  return Response.json({ provider, model, status: "review", raw: data });
}
