"use client";

import { useState } from "react";

const PUBLISH_LIMITS = [5, 10, 20, 50, 100];

export function AutoPublishToggle({ enabled, limit }: { enabled: boolean; limit: number }) {
  const [value, setValue] = useState(enabled);
  const [count, setCount] = useState(PUBLISH_LIMITS.includes(limit) ? limit : 5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function save(nextEnabled: boolean, nextCount: number) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings/auto-publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, limit: nextCount }),
      });
      const result = await response.json() as { enabled?: boolean; limit?: number; error?: string };
      if (!response.ok || result.error) {
        setMessage(result.error ?? "自动发布设置保存失败");
        return;
      }
      setValue(Boolean(result.enabled));
      setCount(Number(result.limit ?? nextCount));
      setMessage(Boolean(result.enabled)
        ? `已开启开关；每次最多 ${Number(result.limit ?? nextCount)} 篇，仍需满足高置信度、来源和非重复等保护条件`
        : `已关闭自动发布；每次数量设置为 ${Number(result.limit ?? nextCount)} 篇`);
    } catch {
      setMessage("自动发布设置保存失败");
    } finally {
      setLoading(false);
    }
  }

  return <div className="setting-toggle">
    <div className="auto-publish-controls">
      <button className={`toggle-button ${value ? "on" : ""}`} type="button" onClick={() => void save(!value, count)} disabled={loading}>
        自动发布：{value ? "开启" : "关闭"}
      </button>
      <label>每次
        <select
          value={count}
          disabled={loading}
          onChange={(event) => {
            const nextCount = Number(event.target.value);
            setCount(nextCount);
            void save(value, nextCount);
          }}
        >
          {PUBLISH_LIMITS.map((option) => <option value={option} key={option}>{option} 篇</option>)}
        </select>
      </label>
    </div>
    {message && <small role="status">{message}</small>}
  </div>;
}
