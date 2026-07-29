"use client";

import { useState } from "react";

type BatchResult = {
  id: number;
  title?: string;
  articleId?: number;
  error?: string;
};

export function BatchTranslateAction({ ids }: { ids: number[] }) {
  const batchIds = ids.slice(0, 3);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);

  async function runBatch() {
    setLoading(true);
    setResults([]);
    const nextResults: BatchResult[] = [];
    for (const id of batchIds) {
      try {
        const response = await fetch(`/api/admin/feed/${id}/translate`, { method: "POST" });
        const result = await response.json() as { id?: number; title?: string; error?: string };
        nextResults.push({
          id,
          title: result.title,
          articleId: result.id,
          error: response.ok && result.id ? undefined : result.error ?? "生成失败",
        });
      } catch {
        nextResults.push({ id, error: "请求失败" });
      }
      setResults([...nextResults]);
    }
    setLoading(false);
  }

  return <div className="batch-action">
    <button className="primary-button" type="button" onClick={runBatch} disabled={loading || batchIds.length === 0}>
      {loading ? "正在批量生成…" : `批量生成 ${batchIds.length || 0} 篇 Gemini 草稿`}
    </button>
    <p className="muted">一次最多处理 3 条“需人工翻译”的 RSS，生成后全部进入人工审核，不会自动发布。</p>
    {results.length > 0 && <ol>
      {results.map((result) => <li key={result.id}>
        #{result.id}：
        {result.articleId
          ? <a href={`/admin/articles/${result.articleId}`}>{result.title ?? `草稿 ${result.articleId}`} →</a>
          : <span>{result.error}</span>}
      </li>)}
    </ol>}
  </div>;
}
