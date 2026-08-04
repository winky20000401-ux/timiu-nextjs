"use client";

import { useEffect, useState } from "react";

type BatchResult = {
  id: number;
  title?: string;
  articleId?: number;
  error?: string;
};

export function BatchTranslateAction({ ids }: { ids: number[] }) {
  const options = [3, 5, 10, 20];
  const [requestedCount, setRequestedCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const fallbackBatchCount = Math.min(ids.length, requestedCount, 20);
  const successCount = results.filter((result) => result.articleId).length;
  const failedCount = results.filter((result) => result.error).length;
  const finished = !loading && results.length > 0;
  const activeBatchCount = Math.min(selectedCount > 0 ? selectedCount : fallbackBatchCount, 20);

  useEffect(() => {
    function refreshSelectedCount() {
      setSelectedCount(document.querySelectorAll<HTMLInputElement>("[data-rss-batch-id]:checked").length);
    }
    refreshSelectedCount();
    document.addEventListener("change", refreshSelectedCount);
    return () => document.removeEventListener("change", refreshSelectedCount);
  }, []);

  function resolveBatchIds() {
    const selectedIds = Array.from(document.querySelectorAll<HTMLInputElement>("[data-rss-batch-id]:checked"))
      .map((input) => Number(input.value))
      .filter((id) => Number.isInteger(id) && ids.includes(id));
    return (selectedIds.length ? selectedIds : ids.slice(0, Math.min(requestedCount, 20))).slice(0, 20);
  }

  function setVisibleSelection(checked: boolean) {
    document.querySelectorAll<HTMLInputElement>("[data-rss-batch-id]:not(:disabled)").forEach((input) => {
      input.checked = checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function runBatch() {
    const batchIds = resolveBatchIds();
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
      <button className="primary-button" type="button" onClick={runBatch} disabled={loading || ids.length === 0}>
        {loading ? `正在生成 ${results.length}…` : "批量生成 Gemini 草稿"}
      </button>
    </div>
    <div className="batch-selection-tools" aria-label="RSS 批量选择">
      <button type="button" onClick={() => setVisibleSelection(true)} disabled={loading || ids.length === 0}>全选本页待翻译</button>
      <button type="button" onClick={() => setVisibleSelection(false)} disabled={loading || selectedCount === 0}>清空选择</button>
      <span>已选 {selectedCount} 条</span>
    </div>
    <p className="muted">可以先在下方勾选指定 RSS；未勾选时会按当前顺序处理 {fallbackBatchCount} 篇。系统只处理“需人工翻译”的 RSS，最多 20 篇，生成后全部进入人工审核，不会自动发布。</p>
    {finished && <div className="batch-summary" role="status">
      <strong>批量生成完成：成功 {successCount} 篇，失败 {failedCount} 篇</strong>
      {successCount > 0 && <a href="/admin/articles?review=required">进入待审核文章队列 →</a>}
    </div>}
    {results.length > 0 && <ol>
      {results.map((result) => <li key={result.id}>
        #{result.id}：
        {result.articleId
          ? <a href={`/admin/articles/${result.articleId}`} target="_blank" rel="noreferrer">{result.title ?? `草稿 ${result.articleId}`} →</a>
          : <span>{result.error}</span>}
      </li>)}
    </ol>}
    {(selectedCount > 0 || loading) && <div className="batch-sticky-bar" role="region" aria-label="已选择 RSS 批量操作">
      <span>{loading ? `正在处理 ${results.length} / ${activeBatchCount} 条` : `已选择 ${selectedCount} 条 RSS，最多处理 ${activeBatchCount} 条`}</span>
      <button type="button" onClick={runBatch} disabled={loading}>生成选中 Gemini 草稿</button>
      <button type="button" onClick={() => setVisibleSelection(false)} disabled={loading}>清空选择</button>
    </div>}
  </div>;
}
