"use client";

import Link from "next/link";
import { useState } from "react";

export function QuickArticleActions({ id, status, returnTo = "dashboard" }: { id: number; status: string; returnTo?: "dashboard" | "current" }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function transition(action: "publish" | "unpublish" | "archive") {
    const label = action === "publish" ? "发布" : action === "unpublish" ? "撤回" : "归档";
    if (!window.confirm(`确认${label}这篇文章？`)) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/articles/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? `${label}失败`);
      return;
    }
    if (returnTo === "current") {
      window.location.reload();
      return;
    }
    if (action === "publish") {
      window.location.assign("/admin");
      return;
    }
    window.location.reload();
  }

  return <div className="quick-actions">
    <Link href={`/admin/articles/${id}`}>快速编辑</Link>
    {status === "published"
      ? <button type="button" disabled={busy} onClick={() => transition("unpublish")}>撤回</button>
      : status !== "archived" && <button type="button" disabled={busy} onClick={() => transition("publish")}>快速发布</button>}
    {status !== "archived" && <button type="button" disabled={busy} onClick={() => transition("archive")}>归档</button>}
    {message && <small role="status">{message}</small>}
  </div>;
}
