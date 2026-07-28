import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";
import { QuickArticleActions } from "@/components/QuickArticleActions";

export const dynamic = "force-dynamic";

type ArticleRow = { id: number; title: string; status: string; updated_at: string; requires_review: number };

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; review?: string }>;
}) {
  const filters = await searchParams;
  const allowedStatuses = new Set(["draft", "review", "published", "failed", "archived"]);
  const status = allowedStatuses.has(filters.status ?? "") ? filters.status! : "";
  const reviewRequired = filters.review === "required";
  const returnTo = status
    ? `/admin/articles?status=${encodeURIComponent(status)}`
    : reviewRequired ? "/admin/articles?review=required" : "/admin/articles";
  await requireAdminUser(returnTo);
  const { env } = await import("cloudflare:workers");
  const where = status ? "WHERE status = ?" : reviewRequired ? "WHERE requires_review = 1 AND status != 'archived'" : "";
  const statement = env.DB.prepare(
    `SELECT id, title, status, updated_at, requires_review FROM articles ${where} ORDER BY updated_at DESC LIMIT 100`
  );
  const result = status
    ? await statement.bind(status).all<ArticleRow>()
    : await statement.all<ArticleRow>();
  const activeLabel = status ? statusLabel(status) : reviewRequired ? "需要人工审核" : "全部文章";
  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin"><strong>TIMIU</strong><span>文章管理</span></Link><Link className="admin-user" href="/admin">返回工作台</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading"><div><h1>文章列表</h1><p>编辑、审核、发布、撤回与归档。</p><div className="admin-actions"><Link className="primary-button admin-create-button" href="/admin/articles/new">＋ 新建文章</Link></div></div><span className="status-pill">{activeLabel} · {result.results.length} 篇</span></div>
      <nav className="article-filters" aria-label="文章筛选">
        <Link className={!status && !reviewRequired ? "active" : ""} href="/admin/articles">全部</Link>
        <Link className={status === "draft" ? "active" : ""} href="/admin/articles?status=draft">草稿</Link>
        <Link className={reviewRequired ? "active" : ""} href="/admin/articles?review=required">需审核</Link>
        <Link className={status === "published" ? "active" : ""} href="/admin/articles?status=published">已发布</Link>
        <Link className={status === "archived" ? "active" : ""} href="/admin/articles?status=archived">已归档</Link>
      </nav>
      <section className="admin-card">
        {result.results.length === 0 ? <p className="muted">此筛选条件下没有文章，可以新建文章或切换其他筛选。</p> :
          <table className="admin-table"><thead><tr><th>标题</th><th>状态</th><th>审核</th><th>更新</th><th>操作</th></tr></thead>
            <tbody>{result.results.map((article) => <tr key={article.id}><td><Link className="article-row-link" href={`/admin/articles/${article.id}`}>{article.title}</Link></td><td><span className={`badge ${article.status === "published" ? "published" : ""}`}>{statusLabel(article.status)}</span></td><td>{article.requires_review ? "需要" : "已完成"}</td><td>{article.updated_at}</td><td><QuickArticleActions id={article.id} status={article.status} /></td></tr>)}</tbody>
          </table>}
      </section>
    </div>
  </main>;
}

function statusLabel(status: string) {
  return ({ draft: "草稿", review: "审核中", published: "已发布", failed: "失败", archived: "已归档" } as Record<string, string>)[status] ?? status;
}
