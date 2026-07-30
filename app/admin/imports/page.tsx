import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";
import { GuideImportForm } from "@/components/GuideImportForm";

export const dynamic = "force-dynamic";

type ImportStats = {
  jobs: number;
  total_items: number;
  pending_items: number;
  failed_items: number;
  created_articles: number;
};

type ImportJob = {
  id: number;
  name: string;
  status: string;
  default_status: string;
  total_items: number;
  processed_items: number;
  created_articles: number;
  duplicate_items: number;
  failed_items: number;
  package_location: string;
  manifest_filename: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

type ImportItem = {
  id: number;
  job_id: number;
  title: string;
  game_name: string;
  content_file: string;
  cover_image: string;
  status: string;
  error_message: string;
};

export default async function GuideImportsPage() {
  await requireAdminUser("/admin/imports");
  const { env } = await import("cloudflare:workers");
  const [stats, jobs, items] = await Promise.all([
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM guide_import_jobs) AS jobs,
        (SELECT COALESCE(SUM(total_items), 0) FROM guide_import_jobs) AS total_items,
        (SELECT COUNT(*) FROM guide_import_items WHERE status = 'pending') AS pending_items,
        (SELECT COUNT(*) FROM guide_import_items WHERE status = 'failed') AS failed_items,
        (SELECT COALESCE(SUM(created_articles), 0) FROM guide_import_jobs) AS created_articles`
    ).first<ImportStats>(),
    env.DB.prepare(
      `SELECT id, name, status, default_status, total_items, processed_items,
              created_articles, duplicate_items, failed_items, package_location,
              manifest_filename, created_by_email, created_at, updated_at
       FROM guide_import_jobs
       ORDER BY id DESC
       LIMIT 20`
    ).all<ImportJob>(),
    env.DB.prepare(
      `SELECT id, job_id, title, game_name, content_file, cover_image, status, error_message
       FROM guide_import_items
       ORDER BY id DESC
       LIMIT 80`
    ).all<ImportItem>(),
  ]);
  const groupedItems = new Map<number, ImportItem[]>();
  for (const item of items.results) {
    groupedItems.set(item.job_id, [...(groupedItems.get(item.job_id) ?? []), item]);
  }

  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin"><strong>TIMIU</strong><span>攻略导入中心</span></Link><Link className="admin-user" href="/admin">返回工作台</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading">
        <div>
          <h1>攻略批量导入</h1>
          <p>为上千到上万篇游戏攻略建立导入任务；先预登记资源包与 manifest，后续按批次生成草稿并进入人工审核。</p>
          <div className="admin-actions"><Link className="secondary-button" href="/admin/articles">文章管理 →</Link><Link className="secondary-button" href="/admin">工作台 →</Link></div>
        </div>
        <span className="status-pill">不会自动发布 · 适合大批量资源包</span>
      </div>
      <div className="feed-stats-grid import-stats-grid" aria-label="攻略导入统计">
        <div><span>导入任务</span><strong>{(stats?.jobs ?? 0).toLocaleString()}</strong></div>
        <div><span>预登记文章</span><strong>{(stats?.total_items ?? 0).toLocaleString()}</strong></div>
        <div><span>待处理</span><strong>{(stats?.pending_items ?? 0).toLocaleString()}</strong></div>
        <div><span>失败</span><strong>{(stats?.failed_items ?? 0).toLocaleString()}</strong></div>
        <div><span>已成稿</span><strong>{(stats?.created_articles ?? 0).toLocaleString()}</strong></div>
      </div>
      <ol className="feed-usage-guide">
        <li><strong>1. 整理资源包</strong><span>推荐 ZIP 内包含 manifest.csv、articles/*.md 和 images/*，图片来源与版权写入 CSV。</span></li>
        <li><strong>2. 创建导入任务</strong><span>上传或粘贴 manifest，系统先登记条目、检查标题和文件路径，不直接发布。</span></li>
        <li><strong>3. 分批处理</strong><span>一万篇以上请拆成多个任务；后续执行器会按批次创建草稿，失败项可单独重试。</span></li>
      </ol>
      <div className="admin-grid import-grid">
        <section className="admin-card">
          <h2>新建导入任务</h2>
          <p className="muted">第一版用于建立大型资源包队列。Manifest 至少需要 title 列；建议包含 id、game、tags、content_file、cover_image、source、copyright。</p>
          <GuideImportForm />
        </section>
        <aside className="admin-card">
          <h2>推荐目录结构</h2>
          <pre className="import-sample">{`guides-import.zip
├─ manifest.csv
├─ articles/
│  ├─ guide-000001.md
│  └─ guide-000002.md
└─ images/
   ├─ guide-000001-cover.jpg
   └─ guide-000002-cover.jpg`}</pre>
          <p className="muted">真正的大包建议先放对象存储，后台保存路径，再由分批任务慢慢处理。这样不会因为浏览器关闭或请求超时而丢任务。</p>
        </aside>
      </div>
      <section className="admin-card">
        <h2>最近导入任务</h2>
        {jobs.results.length === 0 ? <p className="muted">还没有攻略导入任务。可以先用 CSV 示例创建一个小任务试跑。</p> :
          <div className="import-job-list">{jobs.results.map((job) => <article className="import-job" key={job.id}>
            <div className="import-job-head">
              <div><strong>#{job.id} {job.name}</strong><small>{job.manifest_filename || "未上传 CSV 文件"} · {job.created_by_email || "未知创建人"}</small></div>
              <span className="badge">{jobStatusLabel(job.status)}</span>
            </div>
            <div className="import-progress" aria-label={`任务 ${job.id} 处理进度`}>
              <span style={{ width: `${progressPercent(job)}%` }} />
            </div>
            <dl className="import-job-meta">
              <div><dt>总数</dt><dd>{job.total_items.toLocaleString()}</dd></div>
              <div><dt>已处理</dt><dd>{job.processed_items.toLocaleString()}</dd></div>
              <div><dt>已成稿</dt><dd>{job.created_articles.toLocaleString()}</dd></div>
              <div><dt>重复</dt><dd>{job.duplicate_items.toLocaleString()}</dd></div>
              <div><dt>失败</dt><dd>{job.failed_items.toLocaleString()}</dd></div>
              <div><dt>默认状态</dt><dd>{job.default_status === "draft" ? "草稿" : "需审核"}</dd></div>
            </dl>
            {job.package_location && <p className="muted">资源包：<code>{job.package_location}</code></p>}
            {(groupedItems.get(job.id) ?? []).length > 0 && <table className="admin-table compact-table">
              <thead><tr><th>预登记文章</th><th>游戏</th><th>正文文件</th><th>封面</th><th>状态</th></tr></thead>
              <tbody>{(groupedItems.get(job.id) ?? []).slice(0, 8).map((item) => <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.game_name || "未填"}</td>
                <td>{item.content_file || "未填"}</td>
                <td>{item.cover_image || "未填"}</td>
                <td>{itemStatusLabel(item.status)}</td>
              </tr>)}</tbody>
            </table>}
          </article>)}</div>}
      </section>
    </div>
  </main>;
}

function progressPercent(job: ImportJob) {
  if (!job.total_items) return 0;
  return Math.min(100, Math.round((job.processed_items / job.total_items) * 100));
}

function jobStatusLabel(status: string) {
  return ({ created: "已创建", running: "处理中", completed: "已完成", failed: "失败", paused: "已暂停" } as Record<string, string>)[status] ?? status;
}

function itemStatusLabel(status: string) {
  return ({ pending: "待处理", imported: "已成稿", duplicate: "重复", failed: "失败" } as Record<string, string>)[status] ?? status;
}
