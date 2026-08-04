import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";
import { BatchTranslateAction } from "@/components/BatchTranslateAction";
import { FeedQueueAction } from "@/components/FeedQueueAction";
import { formatDate } from "@/lib/content";
import { formatMicrousd, sanitizeGeminiErrorMessage } from "@/lib/gemini-translation";

export const dynamic = "force-dynamic";

type QueueItem = {
  id: number;
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  created_at: string;
  last_seen_at: string | null;
  processing_status: string;
};

type FailedTranslationJob = {
  id: number;
  model: string | null;
  error_message: string | null;
  finished_at: string | null;
};

type TranslationUsage = {
  jobs: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_microusd: number;
};

type FeedStats = {
  total: number;
  translation_required: number;
  review: number;
  low_relevance: number;
  duplicate: number;
  drafted: number;
  translation_failed: number;
  translation_running: number;
};

const FEED_FILTERS = [
  { status: "", label: "全部" },
  { status: "translation_required", label: "待翻译" },
  { status: "drafted", label: "已成稿" },
  { status: "translation_failed", label: "翻译失败" },
  { status: "translation_running", label: "处理中" },
  { status: "low_relevance", label: "低相关" },
  { status: "duplicate", label: "重复" },
  { status: "review", label: "待审核" },
];

export default async function FeedQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const allowedStatuses = new Set(FEED_FILTERS.map((item) => item.status).filter(Boolean));
  const status = allowedStatuses.has(filters.status ?? "") ? filters.status! : "";
  const query = String(filters.q ?? "").trim().slice(0, 80);
  const currentPage = parsePositivePage(filters.page);
  const pageSize = 100;
  const offset = (currentPage - 1) * pageSize;
  const returnTo = feedFilterHref(status, query, currentPage);
  await requireAdminUser(returnTo);
  const { env } = await import("cloudflare:workers");
  const conditions: string[] = [];
  const bindings: string[] = [];
  if (status) {
    conditions.push("processing_status = ?");
    bindings.push(status);
  }
  if (query) {
    conditions.push("(title LIKE ? OR summary LIKE ? OR url LIKE ?)");
    const like = `%${query}%`;
    bindings.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const queueStatement = env.DB.prepare(
    `SELECT id, title, url, summary, published_at, created_at, last_seen_at, processing_status
     FROM feed_items ${where} ORDER BY COALESCE(last_seen_at, created_at) DESC LIMIT ? OFFSET ?`
  );
  const countStatement = env.DB.prepare(`SELECT COUNT(*) AS total FROM feed_items ${where}`);
  const queueBindings = [...bindings, pageSize, offset];
  const [result, filteredCount, failedJobs, usage, feedStats] = await Promise.all([
    queueStatement.bind(...queueBindings).all<QueueItem>(),
    bindings.length ? countStatement.bind(...bindings).first<{ total: number }>() : countStatement.first<{ total: number }>(),
    env.DB.prepare(
      `SELECT id, model, error_message, finished_at
       FROM automation_jobs
       WHERE type = 'rss_translation' AND status = 'failed'
       ORDER BY id DESC LIMIT 10`
    ).all<FailedTranslationJob>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS jobs,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost_microusd), 0) AS estimated_cost_microusd
       FROM automation_jobs
       WHERE type = 'rss_translation' AND status = 'succeeded'
         AND finished_at >= datetime('now', '-30 days')`
    ).first<TranslationUsage>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN processing_status = 'translation_required' THEN 1 ELSE 0 END), 0) AS translation_required,
              COALESCE(SUM(CASE WHEN processing_status = 'review' THEN 1 ELSE 0 END), 0) AS review,
              COALESCE(SUM(CASE WHEN processing_status = 'low_relevance' THEN 1 ELSE 0 END), 0) AS low_relevance,
              COALESCE(SUM(CASE WHEN processing_status = 'duplicate' THEN 1 ELSE 0 END), 0) AS duplicate,
              COALESCE(SUM(CASE WHEN processing_status = 'drafted' THEN 1 ELSE 0 END), 0) AS drafted,
              COALESCE(SUM(CASE WHEN processing_status = 'translation_failed' THEN 1 ELSE 0 END), 0) AS translation_failed,
              COALESCE(SUM(CASE WHEN processing_status = 'translation_running' THEN 1 ELSE 0 END), 0) AS translation_running
       FROM feed_items`
    ).first<FeedStats>(),
  ]);
  const totalFiltered = filteredCount?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const batchTranslationIds = result.results
    .filter((item) => item.processing_status === "translation_required")
    .slice(0, 20)
    .map((item) => item.id);
  const activeLabel = `${status ? statusLabel(status) : "全部线索"}${query ? ` · 搜索“${query}”` : ""}`;
  const visibleStart = totalFiltered === 0 ? 0 : offset + 1;
  const visibleEnd = Math.min(offset + result.results.length, totalFiltered);
  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin"><strong>TIMIU</strong><span>RSS 审核队列</span></Link><Link className="admin-user" href="/admin">返回工作台</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading"><div><h1>RSS 审核队列</h1><p>查看 RSS 原始标题、摘要与来源，再生成待人工编辑的草稿；这里不会自动公开发布。</p></div><span className="status-pill">{activeLabel} · {visibleStart}-{visibleEnd} / {totalFiltered.toLocaleString()} 条 · 总收录 {(feedStats?.total ?? 0).toLocaleString()} 条</span></div>
      <div className="feed-stats-grid" aria-label="RSS 收录统计">
        <Link className={!status ? "active" : ""} href={feedFilterHref("", query)}><span>总收录</span><strong>{(feedStats?.total ?? 0).toLocaleString()}</strong><small>查看全部 →</small></Link>
        <Link className={status === "translation_required" ? "active" : ""} href={feedFilterHref("translation_required", query)}><span>待翻译</span><strong>{(feedStats?.translation_required ?? 0).toLocaleString()}</strong><small>进入待翻译 →</small></Link>
        <Link className={status === "review" ? "active" : ""} href={feedFilterHref("review", query)}><span>待审核</span><strong>{(feedStats?.review ?? 0).toLocaleString()}</strong><small>查看待审核 →</small></Link>
        <Link className={status === "low_relevance" ? "active" : ""} href={feedFilterHref("low_relevance", query)}><span>低相关</span><strong>{(feedStats?.low_relevance ?? 0).toLocaleString()}</strong><small>查看低相关 →</small></Link>
        <Link className={status === "duplicate" ? "active" : ""} href={feedFilterHref("duplicate", query)}><span>重复</span><strong>{(feedStats?.duplicate ?? 0).toLocaleString()}</strong><small>查看重复 →</small></Link>
        <Link className={status === "drafted" ? "active" : ""} href={feedFilterHref("drafted", query)}><span>已成稿</span><strong>{(feedStats?.drafted ?? 0).toLocaleString()}</strong><small>查看已成稿 →</small></Link>
        <Link className={status === "translation_failed" ? "active" : ""} href={feedFilterHref("translation_failed", query)}><span>翻译失败</span><strong>{(feedStats?.translation_failed ?? 0).toLocaleString()}</strong><small>排查失败 →</small></Link>
        <Link className={status === "translation_running" ? "active" : ""} href={feedFilterHref("translation_running", query)}><span>处理中</span><strong>{(feedStats?.translation_running ?? 0).toLocaleString()}</strong><small>查看处理中 →</small></Link>
      </div>
      <ol className="feed-usage-guide">
        <li><strong>1. 查看线索</strong><span>阅读标题与摘要，点击原始来源核对全文。</span></li>
        <li><strong>2. 生成草稿</strong><span>明显低相关的影视/泛娱乐线索会被标记出来；外文游戏线索可用 Gemini 结合相关 RSS 生成更接近正式资讯的中文草稿。</span></li>
        <li><strong>3. 人工编辑</strong><span>补充自然中文、栏目、标签、封面和来源后再手动发布。</span></li>
      </ol>
      <section className="admin-card">
        <h2>近 30 天 Gemini 用量</h2>
        <p className="muted">
          已完成 {usage?.jobs ?? 0} 篇 · 输入 {(usage?.input_tokens ?? 0).toLocaleString()} Token ·
          输出 {(usage?.output_tokens ?? 0).toLocaleString()} Token ·
          估算费用 {formatMicrousd(usage?.estimated_cost_microusd ?? 0)}
        </p>
        <p className="muted">费用按当前模型公开单价估算，最终金额以 Google 账单为准。</p>
      </section>
      <section className="admin-card">
        <h2>批量生成草稿</h2>
        <BatchTranslateAction ids={batchTranslationIds} />
      </section>
      <nav className="article-filters feed-filters" aria-label="RSS 状态筛选">
        {FEED_FILTERS.map((filter) => <Link
          key={filter.status || "all"}
          className={status === filter.status ? "active" : ""}
          href={feedFilterHref(filter.status, query)}
        >{filter.label}</Link>)}
      </nav>
      <form className="admin-search-form" action="/admin/feed">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={query} placeholder="搜索 RSS 标题、摘要或来源链接" />
        <button type="submit">搜索 RSS</button>
        {query && <Link href={feedFilterHref(status, "")}>清除</Link>}
      </form>
      <section className="admin-card">
        {result.results.length === 0 ? <p className="muted">当前筛选没有匹配的 RSS 线索。可以切换到“全部”或返回工作台读取最新 RSS。</p> :
          <table className="admin-table queue-table">
            <thead><tr><th>新闻线索</th><th>最近读取</th><th>状态</th><th>来源</th><th>操作</th></tr></thead>
            <tbody>{result.results.map((item) => <tr key={item.id}>
              <td><strong>{item.title}</strong>{item.summary && <small>{item.summary.slice(0, 150)}</small>}</td>
              <td className="rss-time">
                <strong>{formatQueueTime(item.last_seen_at ?? item.created_at)}</strong>
                <small>原文 {item.published_at ? formatDate(item.published_at) : "未记录"}</small>
                <small>首次入库 {formatQueueTime(item.created_at)}</small>
              </td>
              <td><span className="badge">{statusLabel(item.processing_status)}</span></td>
              <td><a href={item.url} target="_blank" rel="noreferrer">查看原始来源 ↗</a></td>
              <td><FeedQueueAction
                id={item.id}
                disabled={!["review", "translation_required", "translation_failed"].includes(item.processing_status)}
                needsTranslation={["translation_required", "translation_failed"].includes(item.processing_status)}
                status={item.processing_status}
              /></td>
            </tr>)}</tbody>
          </table>}
        {totalPages > 1 && <nav className="pagination-nav" aria-label="RSS 队列分页">
          {currentPage > 1 ? <Link href={feedFilterHref(status, query, currentPage - 1)}>← 上一页</Link> : <span>← 上一页</span>}
          <strong>第 {Math.min(currentPage, totalPages)} / {totalPages} 页</strong>
          {currentPage < totalPages ? <Link href={feedFilterHref(status, query, currentPage + 1)}>下一页 →</Link> : <span>下一页 →</span>}
        </nav>}
      </section>
      {failedJobs.results.length > 0 && <section className="admin-card">
        <h2>最近 Gemini 失败记录</h2>
        <p className="muted">以下内容来自 Google API，已自动遮盖可能的密钥或长令牌。</p>
        <table className="admin-table">
          <thead><tr><th>任务</th><th>模型</th><th>Google 错误详情</th><th>时间</th></tr></thead>
          <tbody>{failedJobs.results.map((job) => <tr key={job.id}>
            <td>#{job.id}</td>
            <td>{job.model ?? "未记录"}</td>
            <td><code>{sanitizeGeminiErrorMessage(job.error_message ?? "未记录错误详情")}</code></td>
            <td>{job.finished_at ?? "未记录"}</td>
          </tr>)}</tbody>
        </table>
      </section>}
    </div>
  </main>;
}

function formatQueueTime(value: string | null) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(/\//g, "-");
}

function statusLabel(status: string) {
  return ({
    review: "待审核",
    translation_required: "需人工翻译",
    translation_failed: "翻译失败",
    translation_running: "处理中",
    low_relevance: "低相关",
    duplicate: "重复",
    drafted: "已生成草稿",
  } as Record<string, string>)[status] ?? status;
}

function feedFilterHref(status: string, query: string, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/admin/feed${params.toString() ? `?${params.toString()}` : ""}`;
}

function parsePositivePage(value: string | undefined) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0 ? Math.min(page, 9999) : 1;
}
