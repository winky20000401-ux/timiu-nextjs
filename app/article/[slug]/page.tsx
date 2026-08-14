import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/SiteChrome";
import { articles, categoryMeta, formatDate, getArticle } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { SITE_URL, absoluteSiteUrl } from "@/lib/site";

type PublishedArticle = {
  id: number;
  title: string;
  subtitle: string;
  slug: string;
  seo_title: string;
  description: string;
  content_html: string;
  canonical_url: string;
  published_at: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
  cover_object_key: string | null;
  cover_source: string | null;
  cover_copyright: string | null;
};

type ArticleTag = { name: string; slug: string };
type ArticleSource = { title: string; publisher: string; url: string };

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (article) {
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
  const published = await getPublishedArticle(slug);
  if (!published) return {};
  const tags = await getArticleTags(published.id);
  const canonical = published.canonical_url || absoluteSiteUrl(`/article/${published.slug}`);
  return {
    title: published.seo_title || published.title,
    description: published.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: published.seo_title || published.title,
      description: published.description,
      publishedTime: published.published_at,
      modifiedTime: published.updated_at,
      tags: tags.map((tag) => tag.name),
      url: canonical,
      images: published.cover_object_key ? [{ url: mediaUrl(published.cover_object_key), alt: published.title }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    const published = await getPublishedArticle(slug);
    if (!published) notFound();
    return <PublishedArticlePage article={published} />;
  }
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
    mainEntityOfPage: absoluteSiteUrl(`/article/${article.slug}`),
    author: { "@type": "Organization", name: "TIMIU 编辑部" },
    publisher: { "@type": "Organization", name: "TIMIU 游戏资讯", url: SITE_URL },
  };
  return (
    <PageFrame>
      <main className="article-page">
        <header className="article-header">
          <div className="shell article-header-inner">
            <div className="breadcrumbs"><Link href="/">首页</Link> / <Link href={categoryMeta[article.category].href}>{categoryMeta[article.category].name}</Link> / 正文</div>
            <div className="article-title-grid">
              <div>
                <h1>{article.title}</h1>
                <p className="article-dek">{article.dek}</p>
              </div>
              <aside className="article-info-card" aria-label="稿件信息">
                <span>ARTICLE STATUS</span>
                <strong>编辑演示稿</strong>
                <dl>
                  <div><dt>频道</dt><dd>{categoryMeta[article.category].name}</dd></div>
                  <div><dt>阅读</dt><dd>{article.readingMinutes} 分钟</dd></div>
                  <div><dt>来源</dt><dd>演示素材</dd></div>
                </dl>
              </aside>
            </div>
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
            <div className="rail-card">
              <span className="section-label">CONTINUE</span>
              <Link href={categoryMeta[article.category].href}>返回{categoryMeta[article.category].name} →</Link>
            </div>
            <h2>相关报道</h2>
            {related.map((item) => <Link className="rail-link" href={`/article/${item.slug}`} key={item.slug}><strong>{item.title}</strong><span>{item.kicker} · {item.readingMinutes} 分钟</span></Link>)}
          </aside>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </main>
    </PageFrame>
  );
}

async function PublishedArticlePage({ article }: { article: PublishedArticle }) {
  const [tags, sources, related] = await Promise.all([
    getArticleTags(article.id),
    getArticleSources(article.id),
    getRelatedArticles(article.id, article.category_slug),
  ]);
  const categoryHref = categoryHrefFor(article.category_slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.description,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    inLanguage: "zh-CN",
    mainEntityOfPage: article.canonical_url || absoluteSiteUrl(`/article/${article.slug}`),
    author: { "@type": "Organization", name: "TIMIU 编辑部" },
    publisher: { "@type": "Organization", name: "TIMIU 游戏资讯", url: SITE_URL },
    citation: sources.map((source) => source.url),
    image: article.cover_object_key ? mediaUrl(article.cover_object_key) : undefined,
  };
  return (
    <PageFrame>
      <main className="article-page">
        <header className="article-header">
          <div className="shell article-header-inner">
            <div className="breadcrumbs"><Link href="/">首页</Link> / <Link href={categoryHref}>{article.category_name}</Link> / 正文</div>
            <div className="article-title-grid">
              <div>
                <h1>{article.title}</h1>
                {(article.subtitle || article.description) && <p className="article-dek">{article.subtitle || article.description}</p>}
              </div>
              <aside className="article-info-card" aria-label="稿件信息">
                <span>ARTICLE STATUS</span>
                <strong>人工审核发布</strong>
                <dl>
                  <div><dt>频道</dt><dd>{article.category_name}</dd></div>
                  <div><dt>来源</dt><dd>{sources.length || 1} 条记录</dd></div>
                  <div><dt>版权</dt><dd>{article.cover_object_key ? "已登记" : "无封面"}</dd></div>
                </dl>
              </aside>
            </div>
            <div className="article-meta">
              <span><strong>{article.category_name}</strong></span>
              <span>发布于 {safeFormatDate(article.published_at)}</span>
              <span>更新于 {safeFormatDate(article.updated_at)}</span>
              <span>人工审核发布</span>
            </div>
          </div>
        </header>
        <div className="shell article-body-wrap">
          <article className="article-body">
            {article.cover_object_key && <figure className="article-cover-figure">
              <img src={mediaUrl(article.cover_object_key)} alt={article.title} />
              <figcaption>
                图片来源：{article.cover_source || "未填写"} · 版权/授权：{article.cover_copyright || "未填写"}
              </figcaption>
            </figure>}
            <div className="published-notice"><strong>编辑说明：</strong>本文已完成来源核对，并由管理员手动发布。</div>
            <div dangerouslySetInnerHTML={{ __html: article.content_html }} />
            <section className="source-box">
              <h2>消息来源</h2>
              {sources.length ? (
                <ul>
                  {sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} rel="nofollow noopener" target="_blank">
                        {source.title || source.publisher || source.url}
                      </a>
                      {source.publisher && source.title && <span className="muted"> · {source.publisher}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">来源记录暂不可用。</p>}
            </section>
            <div className="article-tags">
              {tags.map((tag) => <Link href={`/tag/${encodeURIComponent(tag.slug)}`} key={tag.slug}>#{tag.name}</Link>)}
            </div>
            <nav className="article-nav article-nav-single" aria-label="继续阅读">
              <Link href={categoryHref}>← 返回{article.category_name}</Link>
              <Link href="/search">搜索更多文章 →</Link>
            </nav>
          </article>
          <aside className="article-rail">
            <div className="rail-card">
              <span className="section-label">SOURCE CHECK</span>
              <strong>{sources.length ? `${sources.length} 条来源记录` : "来源待补充"}</strong>
              <p>发布前请继续保留原始来源，方便后续核对与修订。</p>
            </div>
            <h2>相关报道</h2>
            {related.length ? related.map((item) => (
              <Link className="rail-link" href={`/article/${item.slug}`} key={item.slug}>
                <strong>{item.title}</strong>
                <span>{safeFormatDate(item.published_at)}</span>
              </Link>
            )) : <p className="muted">暂无相关报道</p>}
          </aside>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </main>
    </PageFrame>
  );
}

async function getPublishedArticle(slug: string) {
  try {
    const { env } = await import("cloudflare:workers");
    return await env.DB.prepare(
      `SELECT a.id, a.title, a.subtitle, a.slug, a.seo_title, a.description, a.content_html,
       a.canonical_url, a.published_at, a.updated_at, a.cover_object_key, a.cover_source,
       a.cover_copyright, c.name AS category_name, c.slug AS category_slug
       FROM articles a JOIN categories c ON c.id = a.category_id
       WHERE a.slug = ? AND a.status = 'published' AND a.published_at IS NOT NULL`
    ).bind(slug).first<PublishedArticle>();
  } catch {
    return null;
  }
}

async function getArticleTags(articleId: number): Promise<ArticleTag[]> {
  try {
    const { env } = await import("cloudflare:workers");
    const result = await env.DB.prepare(
      "SELECT t.name, t.slug FROM tags t JOIN article_tags at ON at.tag_id = t.id WHERE at.article_id = ? ORDER BY t.name"
    ).bind(articleId).all<ArticleTag>();
    return result.results;
  } catch {
    return [];
  }
}

async function getArticleSources(articleId: number): Promise<ArticleSource[]> {
  try {
    const { env } = await import("cloudflare:workers");
    const result = await env.DB.prepare(
      `SELECT s.title, s.publisher, s.url FROM sources s
       JOIN article_sources ars ON ars.source_id = s.id
       WHERE ars.article_id = ? AND s.is_valid = 1 ORDER BY ars.role DESC, s.id`
    ).bind(articleId).all<ArticleSource>();
    return result.results;
  } catch {
    return [];
  }
}

async function getRelatedArticles(articleId: number, categorySlug: string) {
  try {
    const { env } = await import("cloudflare:workers");
    const result = await env.DB.prepare(
      `SELECT a.title, a.slug, a.published_at FROM articles a
       JOIN categories c ON c.id = a.category_id
       WHERE a.id != ? AND a.status = 'published' AND c.slug = ?
       ORDER BY a.published_at DESC LIMIT 3`
    ).bind(articleId, categorySlug).all<{ title: string; slug: string; published_at: string }>();
    return result.results;
  } catch {
    return [];
  }
}

function categoryHrefFor(slug: string) {
  if (slug === "hardware") return "/hardware";
  if (slug === "guides") return "/guides";
  return "/news";
}

function safeFormatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : formatDate(date.toISOString());
}
