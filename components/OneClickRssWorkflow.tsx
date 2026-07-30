"use client";

import { useState } from "react";

type StepState = {
  label: string;
  detail: string;
  status: "idle" | "running" | "done" | "failed";
};

type TranslateResult = {
  id: number;
  title?: string;
  articleId?: number;
  error?: string;
};

export function OneClickRssWorkflow({ autoPublishEnabled, limit }: { autoPublishEnabled: boolean; limit: number }) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(initialSteps());
  const [translations, setTranslations] = useState<TranslateResult[]>([]);
  const [summary, setSummary] = useState("");

  function updateStep(index: number, patch: Partial<StepState>) {
    setSteps((current) => current.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step));
  }

  async function runWorkflow() {
    if (!autoPublishEnabled) {
      setSummary("请先开启自动发布开关，再运行一键处理。");
      return;
    }
    setRunning(true);
    setSteps(initialSteps());
    setTranslations([]);
    setSummary("");
    let createdDrafts = 0;
    try {
      updateStep(0, { status: "running", detail: "正在读取 Inoreader RSS…" });
      const ingestResponse = await fetch("/api/automation/ingest", { method: "POST" });
      const ingest = await ingestResponse.json() as { fetched?: number; imported?: number; alreadyStored?: number; requiresTranslation?: number; error?: string };
      if (!ingestResponse.ok || ingest.error) throw new Error(ingest.error ?? "RSS 读取失败");
      updateStep(0, {
        status: "done",
        detail: `读取 ${ingest.fetched ?? 0} 条，新增 ${ingest.imported ?? 0} 条，已存在 ${ingest.alreadyStored ?? 0} 条，待翻译 ${ingest.requiresTranslation ?? 0} 条。`,
      });

      updateStep(1, { status: "running", detail: "正在获取待翻译 RSS 队列…" });
      const pendingResponse = await fetch(`/api/admin/feed/pending?limit=${Math.min(limit, 20)}`);
      const pending = await pendingResponse.json() as { ids?: number[]; error?: string };
      if (!pendingResponse.ok || pending.error) throw new Error(pending.error ?? "待翻译队列读取失败");
      const ids = (pending.ids ?? []).slice(0, Math.min(limit, 20));
      if (ids.length === 0) {
        updateStep(1, { status: "done", detail: "没有待翻译 RSS，已跳过 Gemini 生成。" });
      } else {
        const nextResults: TranslateResult[] = [];
        for (const id of ids) {
          updateStep(1, { status: "running", detail: `正在生成 Gemini 草稿 ${nextResults.length + 1}/${ids.length}…` });
          try {
            const response = await fetch(`/api/admin/feed/${id}/translate`, { method: "POST" });
            const result = await response.json() as { id?: number; title?: string; error?: string };
            if (response.ok && result.id) {
              createdDrafts += 1;
              nextResults.push({ id, articleId: result.id, title: result.title });
            } else {
              nextResults.push({ id, error: result.error ?? "生成失败" });
            }
          } catch {
            nextResults.push({ id, error: "请求失败" });
          }
          setTranslations([...nextResults]);
        }
        updateStep(1, { status: "done", detail: `已生成 ${createdDrafts}/${ids.length} 篇 Gemini 草稿。` });
      }

      updateStep(2, { status: "running", detail: "正在执行自动发布检查…" });
      const publishResponse = await fetch("/api/admin/automation/auto-publish", { method: "POST" });
      const publish = await publishResponse.json() as { checked?: number; published?: number; skipped?: number; error?: string };
      if (!publishResponse.ok || publish.error) throw new Error(publish.error ?? "自动发布检查失败");
      updateStep(2, {
        status: "done",
        detail: `检查 ${publish.checked ?? 0} 篇，发布 ${publish.published ?? 0} 篇，跳过 ${publish.skipped ?? 0} 篇。`,
      });
      setSummary("一键处理完成。页面即将刷新，你可以在文章列表查看新草稿和已发布文章。");
      setTimeout(() => window.location.reload(), 2200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "一键处理失败";
      setSummary(message);
      setSteps((current) => current.map((step) => step.status === "running" ? { ...step, status: "failed", detail: message } : step));
    } finally {
      setRunning(false);
    }
  }

  return <section className="one-click-panel" aria-label="一键处理 RSS">
    <div>
      <strong>一键处理 RSS</strong>
      <span>读取 RSS → 生成 Gemini 草稿 → 自动发布检查</span>
    </div>
    <button className="primary-button" type="button" disabled={running || !autoPublishEnabled} onClick={runWorkflow}>
      {running ? "正在处理…" : "开始一键处理"}
    </button>
    <ol>
      {steps.map((step) => <li className={`workflow-step ${step.status}`} key={step.label}>
        <b>{step.label}</b><small>{step.detail}</small>
      </li>)}
    </ol>
    {translations.length > 0 && <details>
      <summary>Gemini 生成明细</summary>
      <ul>{translations.slice(0, 20).map((item) => <li key={item.id}>
        #{item.id} {item.articleId ? `已生成：${item.title ?? item.articleId}` : `失败：${item.error}`}
      </li>)}</ul>
    </details>}
    {summary && <p role="status">{summary}</p>}
  </section>;
}

function initialSteps(): StepState[] {
  return [
    { label: "1. 读取 RSS", detail: "等待开始", status: "idle" },
    { label: "2. 生成草稿", detail: "等待开始", status: "idle" },
    { label: "3. 自动发布", detail: "等待开始", status: "idle" },
  ];
}
