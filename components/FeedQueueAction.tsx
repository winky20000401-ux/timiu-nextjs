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
  const [loading, setLoading] = useState(false);
  async function createDraft() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/feed/${id}/draft`, { method: "POST" });
      const result = await response.json() as { error?: string; title?: string; id?: number };
      if (!response.ok || !result.id) {
        setMessage(result.error ?? "草稿创建失败");
        return;
      }
      window.location.assign(`/admin/articles/${result.id}`);
    } catch {
      setMessage("操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }
  return <div className="queue-action">
    <button type="button" onClick={createDraft} disabled={disabled || loading}>
      {loading ? "处理中…" : needsTranslation ? "生成待翻译草稿" : "生成短讯草稿"}
    </button>
    {message && <small role="status">{message}</small>}
  </div>;
}
