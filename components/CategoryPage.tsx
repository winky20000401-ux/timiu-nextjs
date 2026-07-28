import { ArticleCard } from "@/components/ArticleCard";
import { PageFrame } from "@/components/SiteChrome";
import { CategoryKey, categoryMeta } from "@/lib/content";
import { getVisibleArticles } from "@/lib/published-articles";

export async function CategoryPage({ category }: { category: CategoryKey }) {
  const meta = categoryMeta[category];
  const list = (await getVisibleArticles()).filter((article) => article.category === category);
  return (
    <PageFrame>
      <main>
        <header className="page-hero">
          <div className="shell page-hero-inner">
            <div><span className="section-label">TIMIU / CHANNEL</span><h1>{meta.name}</h1><p>{meta.description}。正式文章经过人工审核后发布到本板块。</p></div>
            <div className="page-count">{String(list.length).padStart(2, "0")}</div>
          </div>
        </header>
        <section className="shell listing">
          <div className="listing-note">人工审核发布的正式文章会优先显示；演示内容继续保留并清楚标示。</div>
          <div className="listing-grid">
            {list.map((article) => <ArticleCard article={article} key={article.slug} />)}
          </div>
        </section>
      </main>
    </PageFrame>
  );
}
