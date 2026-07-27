import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";

export const dynamic = "force-dynamic";

type ArticleRow = { id: number; title: string; status: string; updated_at: string; requires_review: number };

export default async function AdminArticlesPage() {
  await requireAdminUser("/admin/articles");
  const { env } = await import("cloudflare:workers");
  const result = await env.DB.prepare(
    "SELECT id, title, status, updated_at, requires_review FROM articles ORDER BY updated_at DESC LIMIT 100"
  ).all<ArticleRow>();
  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin"><strong>TIMIU</strong><span>文章管理</span></Link><Link className="admin-user" href="/admin">返回工作台</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading"><div><h1>文章列表</h1><p>编辑、审核、发布、撤回与归档。</p></div><span className="status-pill">{result.results.length} 篇</span></div>
      <section className="admin-card">
        {result.results.length === 0 ? <p className="muted">还没有数据库草稿，请先从 RSS 审核队列创建。</p> :
          <table className="admin-table"><thead><tr><th>标题</th><th>状态</th><th>审核</th><th>更新</th><th>操作</th></tr></thead>
            <tbody>{result.results.map((article) => <tr key={article.id}><td>{article.title}</td><td><span className="badge">{article.status}</span></td><td>{article.requires_review ? "需要" : "已完成"}</td><td>{article.updated_at}</td><td><Link href={`/admin/articles/${article.id}`}>编辑 →</Link></td></tr>)}</tbody>
          </table>}
      </section>
    </div>
  </main>;
}
