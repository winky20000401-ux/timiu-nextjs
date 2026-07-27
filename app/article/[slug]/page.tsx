import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/SiteChrome";
import { articles, categoryMeta, formatDate, getArticle } from "@/lib/content";

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.dek,
    alternates: { canonical: `/article/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.dek,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      tags: article.tags,
      url: `/article/${article.slug}`,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const index = articles.findIndex((item) => item.slug === slug);
  const previous = articles[index - 1];
  const next = articles[index + 1];
  const related = articles.filter((item) => item.slug !== slug && (item.category === article.category || item.tags.some((tag) => article.tags.includes(tag)))).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.dek,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: "zh-CN",
    mainEntityOfPage: `https://timiu.com/article/${article.slug}`,
    author: { "@type": "Organization", name: "TIMIU 编辑部" },
    publisher: { "@type": "Organization", name: "TIMIU 游戏资讯", url: "https://timiu.com" },
  };
  return (
    <PageFrame>
      <main className="article-page">
        <header className="article-header">
          <div className="shell article-header-inner">
            <div className="breadcrumbs"><Link href="/">首页</Link> / <Link href={categoryMeta[article.category].href}>{categoryMeta[article.category].name}</Link> / 正文</div>
            <h1>{article.title}</h1>
            <p className="article-dek">{article.dek}</p>
            <div className="article-meta">
              <span><strong>{article.kicker}</strong></span>
              <span>发布于 {formatDate(article.publishedAt)}</span>
              <span>更新于 {formatDate(article.updatedAt)}</span>
              <span>{article.readingMinutes} 分钟阅读</span>
            </div>
          </div>
        </header>
        <div className="shell article-body-wrap">
          <article className="article-body">
            <div className="demo-notice"><strong>编辑演示稿：</strong>本文用于展示首版文章结构和审核规范，不是对当前突发事件的报道。</div>
            {article.content.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            <section className="source-box">
              <h2>消息来源</h2>
              <a href={article.sourceUrl}>{article.sourceName}</a>
              <p className="muted">正式稿件将在此列出所有实际使用的官方公告、媒体报道与补充资料链接。</p>
            </section>
            <div className="article-tags">{article.tags.map((tag) => <Link href={`/tag/${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}</div>
            <nav className="article-nav" aria-label="文章翻页">
              {previous ? <Link href={`/article/${previous.slug}`}>← 上一篇：{previous.title}</Link> : <span />}
              {next ? <Link href={`/article/${next.slug}`}>下一篇：{next.title} →</Link> : <span />}
            </nav>
          </article>
          <aside className="article-rail">
            <h2>相关报道</h2>
            {related.map((item) => <Link className="rail-link" href={`/article/${item.slug}`} key={item.slug}><strong>{item.title}</strong><span>{item.kicker} · {item.readingMinutes} 分钟</span></Link>)}
          </aside>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </main>
    </PageFrame>
  );
}
