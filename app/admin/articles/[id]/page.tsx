import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/app/admin-auth";
import { ArticleEditor } from "@/components/ArticleEditor";

export const dynamic = "force-dynamic";

type ArticleRow = {
  id: number; title: string; subtitle: string; slug: string; seo_title: string;
  description: string; content_html: string; category_id: number | null; status: string;
};

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminUser(`/admin/articles/${id}`);
  const articleId = Number(id);
  if (!Number.isInteger(articleId)) notFound();
  const { env } = await import("cloudflare:workers");
  const article = await env.DB.prepare(
    "SELECT id, title, subtitle, slug, seo_title, description, content_html, category_id, status FROM articles WHERE id = ?"
  ).bind(articleId).first<ArticleRow>();
  if (!article) notFound();
  const [categories, tags] = await Promise.all([
    env.DB.prepare("SELECT id, name FROM categories ORDER BY sort_order, name").all<{ id: number; name: string }>(),
    env.DB.prepare("SELECT t.name FROM tags t JOIN article_tags at ON at.tag_id = t.id WHERE at.article_id = ? ORDER BY t.name").bind(articleId).all<{ name: string }>(),
  ]);
  return <main className="admin-shell">
    <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/admin/articles"><strong>TIMIU</strong><span>文章编辑</span></Link><Link className="admin-user" href="/admin/articles">返回文章列表</Link></div></header>
    <div className="shell admin-page">
      <div className="admin-heading"><div><h1>编辑文章</h1><p>保存不会公开；只有“人工审核并发布”会改变公开状态。</p></div><span className="status-pill">{article.status}</span></div>
      <ArticleEditor article={{
        id: article.id, title: article.title, subtitle: article.subtitle, slug: article.slug,
        seoTitle: article.seo_title, description: article.description,
        contentText: htmlToText(article.content_html), categoryId: article.category_id,
        tags: tags.results.map((tag) => tag.name).join(", "), status: article.status,
      }} categories={categories.results} />
    </div>
  </main>;
}

function htmlToText(value: string) {
  return value
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}
