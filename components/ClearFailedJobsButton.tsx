"use client";

import { useState } from "react";

export function ClearFailedJobsButton({ count }: { count: number }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function clearFailedJobs() {
    if (count === 0) return;
    if (!window.confirm(`确认清理 ${count} 条失败任务？记录不会删除，只会从失败列表移出。`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/jobs/clear-failed", { method: "POST" });
      const result = await response.json() as { cleared?: number; error?: string };
      if (!response.ok || result.error) {
        setMessage(result.error ?? "失败任务清理失败");
        return;
      }
      setMessage(`已清理 ${result.cleared ?? 0} 条失败任务。`);
      setTimeout(() => window.location.reload(), 900);
    } catch {
      setMessage("失败任务清理失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return <div className="clear-failed-control">
    <button type="button" disabled={busy || count === 0} onClick={clearFailedJobs}>清理失败记录</button>
    {message && <small role="status">{message}</small>}
  </div>;
}
