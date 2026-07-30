"use client";

import { useState } from "react";

export function FeedQueueAction({
  id,
  disabled = false,
  needsTranslation = false,
}: {
  id: number;
  disabled?: boolean;
  needsTranslation?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<{ id: number; title?: string } | null>(null);
  const [loading, setLoading] = useState<"manual" | "gemini" | null>(null);
  async function createDraft(mode: "manual" | "gemini") {
    setLoading(mode);
    setMessage("");
    try {
      const response = await fetch(
        mode === "gemini" ? `/api/admin/feed/${id}/translate` : `/api/admin/feed/${id}/draft`,
        { method: "POST" },
      );
      const result = await response.json() as { error?: string; title?: string; id?: number };
      if (!response.ok || !result.id) {
        setMessage(result.error ?? "草稿创建失败");
        return;
      }
      const draftUrl = `/admin/articles/${result.id}`;
      setDraft({ id: result.id, title: result.title });
      setMessage("草稿已生成，已尝试在新分页打开");
      window.open(draftUrl, "_blank", "noopener,noreferrer");
    } catch {
      setMessage("操作失败，请稍后重试");
    } finally {
      setLoading(null);
    }
  }
  return <div className="queue-action">
    {needsTranslation && <button className="gemini-action" type="button" onClick={() => createDraft("gemini")} disabled={disabled || loading !== null}>
      {loading === "gemini" ? "Gemini 翻译中…" : "Gemini 生成中文草稿"}
    </button>}
    <button type="button" onClick={() => createDraft("manual")} disabled={disabled || loading !== null}>
      {loading === "manual" ? "处理中…" : needsTranslation ? "不翻译，生成原文草稿" : "生成短讯草稿"}
    </button>
    {message && <small role="status">{message}</small>}
    {draft && <small><a href={`/admin/articles/${draft.id}`} target="_blank" rel="noreferrer">打开草稿：{draft.title ?? `#${draft.id}`} ↗</a></small>}
  </div>;
}
