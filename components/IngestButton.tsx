"use client";

import { useState } from "react";

type Result = {
  imported?: number;
  duplicates?: number;
  requiresTranslation?: number;
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
        {result.error ?? `新增 ${result.imported ?? 0} 条；重复 ${result.duplicates ?? 0} 条；待翻译 ${result.requiresTranslation ?? 0} 条`}
      </p>}
    </div>
  );
}
