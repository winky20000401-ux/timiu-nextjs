"use client";

import { useEffect, useRef, useState } from "react";

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
  const stopRequestedRef = useRef(false);
  const currentControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!running) return;
    const blockUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const blockAdminNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || target.getAttribute("target") === "_blank") return;
      if (href.startsWith("/admin") || href.startsWith("#")) {
        event.preventDefault();
        setSummary("一键处理正在运行。请等待完成，或点击“立刻停止”后再离开页面。");
      }
    };
    window.addEventListener("beforeunload", blockUnload);
    document.addEventListener("click", blockAdminNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", blockUnload);
      document.removeEventListener("click", blockAdminNavigation, true);
    };
  }, [running]);

  function updateStep(index: number, patch: Partial<StepState>) {
    setSteps((current) => current.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step));
  }

  async function runWorkflow() {
    setRunning(true);
    stopRequestedRef.current = false;
    setSteps(initialSteps());
    setTranslations([]);
    setSummary("");
    let createdDrafts = 0;
    try {
      const settingsResponse = await controlledFetch("/api/admin/settings/auto-publish");
      const settings = await settingsResponse.json() as { enabled?: boolean; limit?: number; error?: string };
      if (!settingsResponse.ok || settings.error) throw new Error(settings.error ?? "自动发布设置读取失败");
      if (!settings.enabled) throw new Error("请先开启自动发布开关，再运行一键处理。");
      const currentLimit = Number(settings.limit ?? limit);
      const translationLimit = Math.min(currentLimit, 20);
      updateStep(0, { status: "running", detail: "正在读取 Inoreader RSS…" });
      const ingestResponse = await controlledFetch("/api/automation/ingest", { method: "POST" });
      if (stopRequestedRef.current) return stopWorkflowUi("已停止：RSS 读取后不再继续处理。");
      const ingest = await ingestResponse.json() as { fetched?: number; imported?: number; alreadyStored?: number; requiresTranslation?: number; error?: string };
      if (!ingestResponse.ok || ingest.error) throw new Error(ingest.error ?? "RSS 读取失败");
      updateStep(0, {
        status: "done",
        detail: `读取 ${ingest.fetched ?? 0} 条，新增 ${ingest.imported ?? 0} 条，已存在 ${ingest.alreadyStored ?? 0} 条，待翻译 ${ingest.requiresTranslation ?? 0} 条。`,
      });

      updateStep(1, { status: "running", detail: `正在获取待翻译 RSS 队列，本轮最多 ${translationLimit} 篇…` });
      const pendingResponse = await controlledFetch(`/api/admin/feed/pending?limit=${translationLimit}`);
      if (stopRequestedRef.current) return stopWorkflowUi("已停止：未继续生成 Gemini 草稿。");
      const pending = await pendingResponse.json() as { ids?: number[]; error?: string };
      if (!pendingResponse.ok || pending.error) throw new Error(pending.error ?? "待翻译队列读取失败");
      const ids = (pending.ids ?? []).slice(0, translationLimit);
      if (ids.length === 0) {
        updateStep(1, { status: "done", detail: "没有待翻译 RSS，已跳过 Gemini 生成。" });
      } else {
        const nextResults: TranslateResult[] = [];
        for (const id of ids) {
          if (stopRequestedRef.current) return stopWorkflowUi(`已停止：已处理 ${nextResults.length}/${ids.length} 篇 Gemini 草稿。`);
          updateStep(1, { status: "running", detail: `正在生成 Gemini 草稿 ${nextResults.length + 1}/${ids.length}…` });
          try {
            const response = await controlledFetch(`/api/admin/feed/${id}/translate`, { method: "POST" });
            if (stopRequestedRef.current) return stopWorkflowUi(`已停止：已处理 ${nextResults.length}/${ids.length} 篇 Gemini 草稿。`);
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

      if (stopRequestedRef.current) return stopWorkflowUi("已停止：未执行自动发布检查。");
      updateStep(2, { status: "running", detail: "正在执行自动发布检查…" });
      const publishResponse = await controlledFetch("/api/admin/automation/auto-publish", { method: "POST" });
      if (stopRequestedRef.current) return stopWorkflowUi("已停止：自动发布检查请求已中断。");
      const publish = await publishResponse.json() as { checked?: number; published?: number; skipped?: number; error?: string };
      if (!publishResponse.ok || publish.error) throw new Error(publish.error ?? "自动发布检查失败");
      updateStep(2, {
        status: "done",
        detail: `检查 ${publish.checked ?? 0} 篇，发布 ${publish.published ?? 0} 篇，跳过 ${publish.skipped ?? 0} 篇。`,
      });
      setSummary(`一键处理完成。本轮按最新设置处理，Gemini 最多 ${translationLimit} 篇。页面即将刷新。`);
      setTimeout(() => window.location.reload(), 2200);
    } catch (error) {
      if (stopRequestedRef.current || (error instanceof DOMException && error.name === "AbortError")) {
        stopWorkflowUi("已停止：不会继续处理后续 RSS。");
        return;
      }
      const message = error instanceof Error ? error.message : "一键处理失败";
      setSummary(message);
      setSteps((current) => current.map((step) => step.status === "running" ? { ...step, status: "failed", detail: message } : step));
    } finally {
      setRunning(false);
      currentControllerRef.current = null;
    }
  }

  async function controlledFetch(input: string, init?: RequestInit) {
    const controller = new AbortController();
    currentControllerRef.current = controller;
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      if (currentControllerRef.current === controller) currentControllerRef.current = null;
    }
  }

  function requestStop() {
    stopRequestedRef.current = true;
    currentControllerRef.current?.abort();
    setSummary("正在停止：已中断当前请求，不会继续启动后续处理。");
  }

  function stopWorkflowUi(message: string) {
    setSummary(message);
    setSteps((current) => current.map((step) => step.status === "running" ? { ...step, status: "failed", detail: "已停止" } : step));
    setRunning(false);
  }

  return <section className="one-click-panel" aria-label="一键处理 RSS">
    <div>
      <strong>一键处理 RSS</strong>
      <span>读取 RSS → 生成 Gemini 草稿 → 自动发布检查</span>
    </div>
    <div className="one-click-actions">
      <button className="primary-button" type="button" disabled={running} onClick={runWorkflow}>
        {running ? "正在处理…" : "开始一键处理"}
      </button>
      {running && <button className="stop-button" type="button" onClick={requestStop}>立刻停止</button>}
    </div>
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
