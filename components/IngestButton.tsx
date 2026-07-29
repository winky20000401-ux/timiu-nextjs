"use client";

import { useState } from "react";

type Result = {
  fetched?: number;
  valid?: number;
  imported?: number;
  alreadyStored?: number;
  duplicates?: number;
  lowRelevance?: number;
  requiresTranslation?: number;
  newestPublishedAt?: string | null;
  rejected?: { missingTitle?: number; missingUrl?: number; invalidUrl?: number };
  error?: string;
};

export function IngestButton() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  async function ingest() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/automation/ingest", { method: "POST" });
      setResult(await response.json() as Result);
    } catch {
      setResult({ error: "RSS 请求失败，请稍后重试" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="ingest-control">
      <button className="primary-button" type="button" onClick={ingest} disabled={loading}>
        {loading ? "正在读取…" : "读取最新 RSS"}
      </button>
      {result && <p role="status">
        {result.error ?? rssSummary(result)}
      </p>}
    </div>
  );
}

function rssSummary(result: Result) {
  const newest = result.newestPublishedAt
    ? `；源内最新 ${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.newestPublishedAt))}`
    : "";
  const prefix = result.imported === 0 && (result.alreadyStored ?? 0) > 0 ? "没有新条目；" : "";
  const rejected = (result.fetched ?? 0) > (result.valid ?? 0)
    ? `；过滤 ${(result.fetched ?? 0) - (result.valid ?? 0)} 条（缺标题 ${result.rejected?.missingTitle ?? 0}、缺链接 ${result.rejected?.missingUrl ?? 0}）`
    : "";
  return `${prefix}读取 ${result.fetched ?? 0} 条；有效 ${result.valid ?? 0} 条；新增 ${result.imported ?? 0} 条；已存在 ${result.alreadyStored ?? 0} 条；待翻译 ${result.requiresTranslation ?? 0} 条；低相关 ${result.lowRelevance ?? 0} 条${rejected}${newest}`;
}
