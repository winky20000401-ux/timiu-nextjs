import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";
import { FeedQueueAction } from "@/components/FeedQueueAction";
import { sanitizeGeminiErrorMessage } from "@/lib/gemini-translation";

export const dynamic = "force-dynamic";

type QueueItem = {
  id: number;
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  processing_status: string;
};

type FailedTranslationJob = {
  id: number;
  model: string | null;
  error_message: string | null;
  finished_at: string | null;
};

export default async function FeedQueuePage() {
  await requireAdminUser("/admin/feed");
  const { env } = await import("cloudflare:workers");
  const [result, failedJobs] = await Promise.all([
    env.DB.prepare(
      `SELECT id, title, url, summary, published_at, processing_status
       FROM feed_items ORDER BY created_at DESC LIMIT 100`
    ).all<QueueItem>(),
    env.DB.prepare(
      `SELECT id, model, error_message, finished_at
       FROM automation_jobs
       WHERE type = 'rss_translation' AND status = 'failed'
       ORDER BY id DESC LIMIT 10`
    ).all<FailedTranslationJob>(),
  ]);
  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin"><strong>TIMIU</strong><span>RSS 审核队列</span></Link><Link className="admin-user" href="/admin">返回工作台</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading"><div><h1>RSS 审核队列</h1><p>查看 RSS 原始标题、摘要与来源，再生成待人工编辑的草稿；这里不会自动公开发布。</p></div><span className="status-pill">{result.results.length} 条记录</span></div>
      <ol className="feed-usage-guide">
        <li><strong>1. 查看线索</strong><span>阅读标题与摘要，点击原始来源核对全文。</span></li>
        <li><strong>2. 生成草稿</strong><span>中文线索生成短讯草稿；外文线索可用 Gemini 生成中文草稿。</span></li>
        <li><strong>3. 人工编辑</strong><span>补充自然中文、栏目、标签、封面和来源后再手动发布。</span></li>
      </ol>
      <section className="admin-card">
        {result.results.length === 0 ? <p className="muted">队列为空，请先返回工作台读取最新 RSS。</p> :
          <table className="admin-table queue-table">
            <thead><tr><th>新闻线索</th><th>状态</th><th>来源</th><th>操作</th></tr></thead>
            <tbody>{result.results.map((item) => <tr key={item.id}>
              <td><strong>{item.title}</strong>{item.summary && <small>{item.summary.slice(0, 150)}</small>}</td>
              <td><span className="badge">{statusLabel(item.processing_status)}</span></td>
              <td><a href={item.url} target="_blank" rel="noreferrer">查看原始来源 ↗</a></td>
              <td><FeedQueueAction
                id={item.id}
                disabled={!["review", "translation_required"].includes(item.processing_status)}
                needsTranslation={item.processing_status === "translation_required"}
              /></td>
            </tr>)}</tbody>
          </table>}
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

function statusLabel(status: string) {
  return ({
    review: "待审核",
    translation_required: "需人工翻译",
    duplicate: "重复",
    drafted: "已生成草稿",
  } as Record<string, string>)[status] ?? status;
}
