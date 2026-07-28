import { ArticleCard } from "@/components/ArticleCard";
import { PageFrame } from "@/components/SiteChrome";
import Link from "next/link";
import { CategoryKey, categoryMeta, formatDate, getCategoryArticles } from "@/lib/content";

type PublishedCard = {
  title: string;
  slug: string;
  description: string;
  published_at: string;
  content_chars: number;
};

export async function CategoryPage({ category }: { category: CategoryKey }) {
  const meta = categoryMeta[category];
  const published = await getPublishedArticles(category);
  const demos = getCategoryArticles(category).filter(
    (demo) => !published.some((article) => article.slug === demo.slug)
  );
  const total = published.length + demos.length;
  return (
    <PageFrame>
      <main>
        <header className="page-hero">
          <div className="shell page-hero-inner">
            <div><span className="section-label">TIMIU / CHANNEL</span><h1>{meta.name}</h1><p>{meta.description}。正式文章经过人工审核后发布到本板块。</p></div>
            <div className="page-count">{String(total).padStart(2, "0")}</div>
          </div>
        </header>
        <section className="shell listing">
          <div className="listing-note">人工审核发布的正式文章会优先显示；演示内容继续保留并清楚标示。</div>
          <div className="listing-grid">
            {published.map((article) => <PublishedCard article={article} category={category} key={article.slug} />)}
            {demos.map((article) => <ArticleCard article={article} key={article.slug} />)}
          </div>
        </section>
      </main>
    </PageFrame>
  );
}

function PublishedCard({ article, category }: { article: PublishedCard; category: CategoryKey }) {
  const meta = categoryMeta[category];
  const tone = category === "hardware" ? "cyan" : category === "guides" ? "violet" : "lime";
  const readingMinutes = Math.max(1, Math.ceil(article.content_chars / 500));
  return <article className="article-card">
    <Link href={`/article/${article.slug}`} className={`cover cover-${tone}`} aria-label={article.title}>
      <span>正式发布</span><b aria-hidden="true">T</b>
    </Link>
    <div className="card-copy">
      <div className="eyebrow"><Link href={meta.href}>{meta.name}</Link><span>{safeFormatDate(article.published_at)}</span></div>
      <h3><Link href={`/article/${article.slug}`}>{article.title}</Link></h3>
      <p>{article.description}</p>
      <div className="card-footer"><span>{readingMinutes} 分钟阅读</span><span aria-hidden="true">→</span></div>
    </div>
  </article>;
}

async function getPublishedArticles(category: CategoryKey): Promise<PublishedCard[]> {
  try {
    const { env } = await import("cloudflare:workers");
    const result = await env.DB.prepare(
      `SELECT a.title, a.slug, a.description, a.published_at,
       length(a.content_html) AS content_chars
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       WHERE a.status = 'published' AND a.published_at IS NOT NULL AND c.slug = ?
       ORDER BY a.published_at DESC
       LIMIT 100`
    ).bind(category).all<PublishedCard>();
    return result.results;
  } catch {
    return [];
  }
}

function safeFormatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : formatDate(date.toISOString());
}
