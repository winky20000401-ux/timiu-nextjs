"use client";

import { useState } from "react";

export function AutoPublishToggle({ enabled }: { enabled: boolean }) {
  const [value, setValue] = useState(enabled);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function toggle() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings/auto-publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !value }),
      });
      const result = await response.json() as { enabled?: boolean; error?: string };
      if (!response.ok || result.error) {
        setMessage(result.error ?? "自动发布设置保存失败");
        return;
      }
      setValue(Boolean(result.enabled));
      setMessage(Boolean(result.enabled)
        ? "已开启开关；后续仍需满足高置信度、来源和非重复等保护条件"
        : "已关闭自动发布");
    } catch {
      setMessage("自动发布设置保存失败");
    } finally {
      setLoading(false);
    }
  }

  return <div className="setting-toggle">
    <button className={`toggle-button ${value ? "on" : ""}`} type="button" onClick={toggle} disabled={loading}>
      自动发布：{value ? "开启" : "关闭"}
    </button>
    {message && <small role="status">{message}</small>}
  </div>;
}
