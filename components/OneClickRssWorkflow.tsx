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

type PendingResponse = {
  ids?: number[];
  total?: number;
  excluded?: number;
  error?: string;
};

type AutoPublishResponse = {
  checked?: number;
  published?: number;
  skipped?: number;
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
    let failedDrafts = 0;
    let checkedArticles = 0;
    let publishedArticles = 0;
    let skippedArticles = 0;
    let batchCount = 0;
    const processedFeedIds = new Set<number>();
    const allTranslationResults: TranslateResult[] = [];
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

      updateStep(1, { status: "running", detail: `正在获取待翻译 RSS 队列，每批最多 ${translationLimit} 篇…` });
      while (true) {
        const pending = await fetchPendingBatch(translationLimit, processedFeedIds);
        if (stopRequestedRef.current) return stopWorkflowUi("已停止：未继续生成 Gemini 草稿。");
        const totalRemaining = pending.total ?? 0;
        const ids = (pending.ids ?? []).slice(0, translationLimit);
        if (ids.length === 0) {
          const detail = totalRemaining > 0
            ? `本轮已尝试过剩余待翻译项，仍有 ${totalRemaining} 条保留在队列中；请查看失败明细或稍后重试。`
            : createdDrafts + failedDrafts === 0
            ? "没有待翻译 RSS，已跳过 Gemini 生成。"
            : `待翻译队列已清空。本次生成 ${createdDrafts} 篇，失败 ${failedDrafts} 篇。`;
          updateStep(1, { status: "done", detail });
          break;
        }
        batchCount += 1;
        for (const id of ids) {
          processedFeedIds.add(id);
          const batchDone = ids.indexOf(id);
          if (stopRequestedRef.current) return stopWorkflowUi(`已停止：已处理 ${processedFeedIds.size} 条 RSS，已生成 ${createdDrafts} 篇 Gemini 草稿。`);
          updateStep(1, {
            status: "running",
            detail: `第 ${batchCount} 批：正在生成 Gemini 草稿 ${batchDone + 1}/${ids.length}，队列剩余约 ${totalRemaining} 条…`,
          });
          try {
            const response = await controlledFetch(`/api/admin/feed/${id}/translate`, { method: "POST" });
            if (stopRequestedRef.current) return stopWorkflowUi(`已停止：已处理 ${processedFeedIds.size} 条 RSS，已生成 ${createdDrafts} 篇 Gemini 草稿。`);
            const result = await response.json() as { id?: number; title?: string; error?: string };
            if (response.ok && result.id) {
              createdDrafts += 1;
              allTranslationResults.push({ id, articleId: result.id, title: result.title });
            } else {
              failedDrafts += 1;
              allTranslationResults.push({ id, error: result.error ?? "生成失败" });
            }
          } catch {
            failedDrafts += 1;
            allTranslationResults.push({ id, error: "请求失败" });
          }
          setTranslations(allTranslationResults.slice(-100));
        }

        updateStep(1, {
          status: "running",
          detail: `第 ${batchCount} 批已完成。累计生成 ${createdDrafts} 篇，失败 ${failedDrafts} 篇，继续检查下一批…`,
        });

        if (stopRequestedRef.current) return stopWorkflowUi("已停止：未执行自动发布检查。");
        updateStep(2, { status: "running", detail: `第 ${batchCount} 批完成，正在执行自动发布检查…` });
        const publish = await runAutoPublishCheck();
        checkedArticles += publish.checked ?? 0;
        publishedArticles += publish.published ?? 0;
        skippedArticles += publish.skipped ?? 0;
        updateStep(2, {
          status: "running",
          detail: `已检查 ${checkedArticles} 篇，发布 ${publishedArticles} 篇，跳过 ${skippedArticles} 篇。继续处理剩余 RSS…`,
        });
      }

      updateStep(2, {
        status: "done",
        detail: `累计检查 ${checkedArticles} 篇，发布 ${publishedArticles} 篇，跳过 ${skippedArticles} 篇。`,
      });
      setSummary(`一键处理完成：共处理 ${processedFeedIds.size} 条 RSS，生成 ${createdDrafts} 篇草稿，发布 ${publishedArticles} 篇。进度已保留，可按需刷新页面。`);
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

  async function fetchPendingBatch(batchLimit: number, processedFeedIds: Set<number>) {
    const params = new URLSearchParams({ limit: String(batchLimit) });
    if (processedFeedIds.size > 0) params.set("exclude", Array.from(processedFeedIds).join(","));
    const pendingResponse = await controlledFetch(`/api/admin/feed/pending?${params.toString()}`);
    const pending = await pendingResponse.json() as PendingResponse;
    if (!pendingResponse.ok || pending.error) throw new Error(pending.error ?? "待翻译队列读取失败");
    return pending;
  }

  async function runAutoPublishCheck() {
    const publishResponse = await controlledFetch("/api/admin/automation/auto-publish", { method: "POST" });
    if (stopRequestedRef.current) throw new DOMException("自动发布检查请求已中断", "AbortError");
    const publish = await publishResponse.json() as AutoPublishResponse;
    if (!publishResponse.ok || publish.error) throw new Error(publish.error ?? "自动发布检查失败");
    return publish;
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
      <summary>Gemini 生成明细{translations.length >= 100 ? "（最近 100 条）" : ""}</summary>
      <ul>{translations.slice(0, 20).map((item) => <li key={item.id}>
        #{item.id} {item.articleId ? `已生成：${item.title ?? item.articleId}` : `失败：${item.error}`}
      </li>)}</ul>
    </details>}
    {summary && <p role="status">{summary}</p>}
    {!running && summary.includes("一键处理完成") && <button className="secondary-inline-button" type="button" onClick={() => window.location.reload()}>刷新工作台</button>}
  </section>;
}

function initialSteps(): StepState[] {
  return [
    { label: "1. 读取 RSS", detail: "等待开始", status: "idle" },
    { label: "2. 生成草稿", detail: "等待开始", status: "idle" },
    { label: "3. 自动发布", detail: "等待开始", status: "idle" },
  ];
}
