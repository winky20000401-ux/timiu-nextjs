import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";
import { ArticleBulkManager } from "@/components/ArticleBulkManager";

export const dynamic = "force-dynamic";

type ArticleRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  confidence: number;
  updated_at: string;
  requires_review: number;
};

type ArticleStats = {
  all_count: number;
  draft_count: number;
  review_count: number;
  published_count: number;
  archived_count: number;
};

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; review?: string; q?: string }>;
}) {
  const filters = await searchParams;
  const allowedStatuses = new Set(["draft", "review", "published", "failed", "archived"]);
  const status = allowedStatuses.has(filters.status ?? "") ? filters.status! : "";
  const reviewRequired = filters.review === "required";
  const query = String(filters.q ?? "").trim().slice(0, 80);
  const search = new URLSearchParams();
  if (status) search.set("status", status);
  if (reviewRequired) search.set("review", "required");
  if (query) search.set("q", query);
  const returnTo = `/admin/articles${search.toString() ? `?${search.toString()}` : ""}`;
  await requireAdminUser(returnTo);
  const { env } = await import("cloudflare:workers");
  const conditions: string[] = [];
  const bindings: string[] = [];
  if (status) {
    conditions.push("status = ?");
    bindings.push(status);
  } else if (reviewRequired) {
    conditions.push("requires_review = 1 AND status != 'archived'");
  }
  if (query) {
    conditions.push("(title LIKE ? OR description LIKE ? OR slug LIKE ?)");
    const like = `%${query}%`;
    bindings.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [result, stats] = await Promise.all([
    (async () => {
      const statement = env.DB.prepare(
        `SELECT a.id, a.title, a.slug, a.status, c.name AS category, a.confidence,
                a.updated_at, a.requires_review
         FROM articles a
         LEFT JOIN categories c ON c.id = a.category_id
         ${where}
         ORDER BY a.updated_at DESC LIMIT 100`
      );
      return bindings.length ? statement.bind(...bindings).all<ArticleRow>() : statement.all<ArticleRow>();
    })(),
    env.DB.prepare(
      `SELECT
        COUNT(*) AS all_count,
        COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft_count,
        COALESCE(SUM(CASE WHEN requires_review = 1 AND status != 'archived' THEN 1 ELSE 0 END), 0) AS review_count,
        COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published_count,
        COALESCE(SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END), 0) AS archived_count
       FROM articles`
    ).first<ArticleStats>(),
  ]);
  const activeLabel = `${status ? statusLabel(status) : reviewRequired ? "需要人工审核" : "全部文章"}${query ? ` · 搜索“${query}”` : ""}`;
  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin"><strong>TIMIU</strong><span>文章管理</span></Link><Link className="admin-user" href="/admin">返回工作台</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading"><div><h1>文章列表</h1><p>编辑、审核、发布、撤回与归档。</p><div className="admin-actions"><Link className="primary-button admin-create-button" href="/admin/articles/new">＋ 新建文章</Link></div></div><span className="status-pill">{activeLabel} · {result.results.length} 篇</span></div>
      <div className="article-stats-strip" aria-label="文章状态统计">
        <Link className={!status && !reviewRequired ? "active" : ""} href={articleFilterHref("", false, query)}><span>全部</span><strong>{stats?.all_count ?? 0}</strong></Link>
        <Link className={status === "draft" ? "active" : ""} href={articleFilterHref("draft", false, query)}><span>草稿</span><strong>{stats?.draft_count ?? 0}</strong></Link>
        <Link className={reviewRequired ? "active" : ""} href={articleFilterHref("", true, query)}><span>需审核</span><strong>{stats?.review_count ?? 0}</strong></Link>
        <Link className={status === "published" ? "active" : ""} href={articleFilterHref("published", false, query)}><span>已发布</span><strong>{stats?.published_count ?? 0}</strong></Link>
        <Link className={status === "archived" ? "active" : ""} href={articleFilterHref("archived", false, query)}><span>已归档</span><strong>{stats?.archived_count ?? 0}</strong></Link>
      </div>
      <nav className="article-filters" aria-label="文章筛选">
        <Link className={!status && !reviewRequired ? "active" : ""} href={articleFilterHref("", false, query)}>全部</Link>
        <Link className={status === "draft" ? "active" : ""} href={articleFilterHref("draft", false, query)}>草稿</Link>
        <Link className={reviewRequired ? "active" : ""} href={articleFilterHref("", true, query)}>需审核</Link>
        <Link className={status === "published" ? "active" : ""} href={articleFilterHref("published", false, query)}>已发布</Link>
        <Link className={status === "archived" ? "active" : ""} href={articleFilterHref("archived", false, query)}>已归档</Link>
      </nav>
      <form className="admin-search-form" action="/admin/articles">
        {status && <input type="hidden" name="status" value={status} />}
        {reviewRequired && <input type="hidden" name="review" value="required" />}
        <input name="q" defaultValue={query} placeholder="搜索标题、摘要或 Slug" />
        <button type="submit">搜索</button>
        {query && <Link href={articleFilterHref(status, reviewRequired, "")}>清除</Link>}
      </form>
      <section className="admin-card">
        <ArticleBulkManager articles={result.results} />
      </section>
    </div>
  </main>;
}

function statusLabel(status: string) {
  return ({ draft: "草稿", review: "审核中", published: "已发布", failed: "失败", archived: "已归档" } as Record<string, string>)[status] ?? status;
}

function articleFilterHref(status: string, reviewRequired: boolean, query: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (reviewRequired) params.set("review", "required");
  if (query) params.set("q", query);
  return `/admin/articles${params.toString() ? `?${params.toString()}` : ""}`;
}
