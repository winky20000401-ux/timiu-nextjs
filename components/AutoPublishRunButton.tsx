"use client";

import { useState } from "react";

type PublishResult = {
  id: number;
  title: string;
  published?: boolean;
  reasons?: string[];
};

export function AutoPublishRunButton({ enabled, limit }: { enabled: boolean; limit: number }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<PublishResult[]>([]);

  async function run() {
    if (!enabled) {
      setMessage("请先开启自动发布开关。");
      return;
    }
    setLoading(true);
    setMessage("");
    setResults([]);
    try {
      const response = await fetch("/api/admin/automation/auto-publish", { method: "POST" });
      const result = await response.json() as { published?: number; checked?: number; skipped?: number; results?: PublishResult[]; error?: string };
      if (!response.ok || result.error) {
        setMessage(result.error ?? "自动发布执行失败");
        return;
      }
      setResults(result.results ?? []);
      setMessage(`已检查 ${result.checked ?? 0} 篇，自动发布 ${result.published ?? 0} 篇，跳过 ${result.skipped ?? 0} 篇。`);
      setTimeout(() => window.location.reload(), 1800);
    } catch {
      setMessage("自动发布执行失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return <div className="auto-publish-runner">
    <button className="toggle-button on" type="button" disabled={loading || !enabled} onClick={run}>
      {loading ? "正在检查…" : `立即自动发布检查`}
    </button>
    <small>按当前设置每次最多 {limit} 篇。</small>
    {message && <small role="status">{message}</small>}
    {results.length > 0 && <ol>
      {results.slice(0, 6).map((item) => <li key={item.id}>
        #{item.id} {item.published ? "已发布" : "跳过"}：{item.title}
        {!item.published && item.reasons?.length ? `（${item.reasons.join("、")}）` : ""}
      </li>)}
    </ol>}
  </div>;
}
