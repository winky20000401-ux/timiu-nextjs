import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";
import { IngestButton } from "@/components/IngestButton";
import { QuickArticleActions } from "@/components/QuickArticleActions";

export const dynamic = "force-dynamic";

type DashboardStats = {
  drafts: number;
  review_required: number;
  published: number;
  failed_jobs: number;
};

type QueueRow = {
  id: number;
  title: string;
  category: string | null;
  status: string;
  confidence: number;
  requires_review: number;
  updated_at: string;
};

export default async function AdminPage() {
  const user = await requireAdminUser("/admin");
  const { env } = await import("cloudflare:workers");
  const [stats, queue] = await Promise.all([
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM articles WHERE status = 'draft') AS drafts,
        (SELECT COUNT(*) FROM articles WHERE requires_review = 1 AND status != 'archived') AS review_required,
        (SELECT COUNT(*) FROM articles WHERE status = 'published') AS published,
        (SELECT COUNT(*) FROM automation_jobs WHERE status = 'failed') AS failed_jobs`
    ).first<DashboardStats>(),
    env.DB.prepare(
      `SELECT a.id, a.title, c.name AS category, a.status, a.confidence,
        a.requires_review, a.updated_at
       FROM articles a
       LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.status != 'archived'
       ORDER BY a.updated_at DESC
       LIMIT 10`
    ).all<QueueRow>(),
  ]);
  return (
    <main className="admin-shell">
      <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/"><strong>TIMIU</strong><span>编辑工作台</span></Link><div className="admin-user"><span>{user.displayName}</span><form action="/api/admin/auth/logout" method="post"><button className="link-button">退出</button></form></div></div></header>
      <div className="shell admin-page">
        <div className="admin-heading"><div><h1>内容工作台</h1><p>处理 RSS 线索、手动草稿、人工审核与发布记录。</p><div className="admin-actions"><IngestButton /><Link className="primary-button admin-create-button" href="/admin/articles/new">＋ 新建文章</Link><Link className="secondary-button" href="/admin/feed">RSS 审核队列 →</Link><Link className="secondary-button" href="/admin/articles">文章管理 →</Link></div></div><span className="status-pill">AI 重写与自动发布：关闭</span></div>
        <div className="stats-grid">
          <Link className="stat-card" href="/admin/articles?status=draft"><span>草稿</span><strong>{stats?.drafts ?? 0}</strong><small>查看草稿 →</small></Link>
          <Link className="stat-card" href="/admin/articles?review=required"><span>需要人工审核</span><strong>{stats?.review_required ?? 0}</strong><small>开始审核 →</small></Link>
          <Link className="stat-card" href="/admin/articles?status=published"><span>已发布</span><strong>{stats?.published ?? 0}</strong><small>查看文章 →</small></Link>
          <Link className="stat-card" href="/admin?view=failed#recent-activity"><span>失败任务</span><strong>{stats?.failed_jobs ?? 0}</strong><small>查看记录 →</small></Link>
        </div>
        <div className="admin-grid">
          <section className="admin-card" id="recent-activity">
            <h2>文章队列</h2>
            <table className="admin-table">
              <thead><tr><th>标题</th><th>栏目</th><th>状态</th><th>置信度</th><th>更新</th><th>操作</th></tr></thead>
              <tbody>{queue.results.map((article) => <tr key={article.id}>
                <td><Link className="article-row-link" href={`/admin/articles/${article.id}`}>{article.title}</Link></td>
                <td>{article.category ?? "未分类"}</td>
                <td><span className={`badge ${article.status === "published" ? "published" : ""}`}>{statusLabel(article.status, article.requires_review)}</span></td>
                <td><span className={`confidence confidence-${confidenceTone(article.confidence)}`}>{article.confidence.toFixed(2)}</span></td>
                <td>{article.updated_at}</td>
                <td><QuickArticleActions id={article.id} status={article.status} /></td>
              </tr>)}</tbody>
            </table>
            {queue.results.length === 0 && <p className="muted">还没有文章。点击“新建文章”即可创建第一篇草稿。</p>}
          </section>
          <aside>
            <details className="admin-card workflow-panel">
              <summary>安全发布流程与运行参数</summary>
              <ol className="workflow"><li><b>1</b>读取 RSS 或手动新建文章</li><li><b>2</b>核对标题、正文与来源</li><li><b>3</b>排除版本冲突与重复选题</li><li><b>4</b>补全栏目、摘要和标签</li><li><b>5</b>人工审核后手动发布</li></ol>
              <h3>当前系统运行参数</h3>
              <div className="config-list">AI_REWRITE_ENABLED=false<br />FULL_ARTICLE_TRANSLATION=false<br />SIMILARITY=0.45<br />AUTO_PUBLISH=false</div>
            </details>
          </aside>
        </div>
      </div>
    </main>
  );
}

function statusLabel(status: string, requiresReview: number) {
  if (requiresReview && status !== "published") return "需审核";
  return ({ draft: "草稿", review: "审核中", published: "已发布", failed: "失败" } as Record<string, string>)[status] ?? status;
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}
