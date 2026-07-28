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
      window.location.assign(`/admin/articles/${result.id}`);
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
  </div>;
}
