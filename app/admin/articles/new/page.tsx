import Link from "next/link";
import { requireAdminUser } from "@/app/admin-auth";
import { ArticleEditor } from "@/components/ArticleEditor";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  await requireAdminUser("/admin/articles/new");
  const { env } = await import("cloudflare:workers");
  const categories = await env.DB.prepare(
    "SELECT id, name FROM categories ORDER BY sort_order, name"
  ).all<{ id: number; name: string }>();

  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin"><strong>TIMIU</strong><span>新建文章</span></Link><Link className="admin-user" href="/admin/articles">返回文章列表</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading"><div><h1>新建文章</h1><p>手动创建草稿，不依赖 RSS；保存后再进行审核和发布。</p></div><span className="status-pill">新草稿</span></div>
      <ArticleEditor article={{
        id: null,
        title: "",
        subtitle: "",
        slug: "",
        seoTitle: "",
        description: "",
        contentText: "",
        categoryId: categories.results[0]?.id ?? null,
        tags: "",
        status: "draft",
        sourceUrl: "",
        sourceTitle: "",
      }} categories={categories.results} />
    </div>
  </main>;
}
