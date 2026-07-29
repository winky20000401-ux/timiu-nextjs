"use client";

import { useState } from "react";

type BatchResult = {
  id: number;
  title?: string;
  articleId?: number;
  error?: string;
};

export function BatchTranslateAction({ ids }: { ids: number[] }) {
  const options = [3, 5, 10, 20];
  const [requestedCount, setRequestedCount] = useState(3);
  const batchIds = ids.slice(0, Math.min(requestedCount, 20));
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
    <div className="batch-controls">
      <label>生成数量
        <select
          value={requestedCount}
          disabled={loading}
          onChange={(event) => setRequestedCount(Number(event.target.value))}
        >
          {options.map((count) => <option value={count} key={count}>{count} 篇</option>)}
        </select>
      </label>
      <button className="primary-button" type="button" onClick={runBatch} disabled={loading || batchIds.length === 0}>
        {loading ? `正在生成 ${results.length}/${batchIds.length}…` : `批量生成 ${batchIds.length || 0} 篇 Gemini 草稿`}
      </button>
    </div>
    <p className="muted">可选择 3 / 5 / 10 / 20 篇；系统只处理“需人工翻译”的 RSS，生成后全部进入人工审核，不会自动发布。</p>
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
