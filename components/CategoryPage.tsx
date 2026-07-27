import { ArticleCard } from "@/components/ArticleCard";
import { PageFrame } from "@/components/SiteChrome";
import { CategoryKey, categoryMeta, getCategoryArticles } from "@/lib/content";

export function CategoryPage({ category }: { category: CategoryKey }) {
  const meta = categoryMeta[category];
  const list = getCategoryArticles(category);
  return (
    <PageFrame>
      <main>
        <header className="page-hero">
          <div className="shell page-hero-inner">
            <div><span className="section-label">TIMIU / CHANNEL</span><h1>{meta.name}</h1><p>{meta.description}。所有演示稿均清楚标示，正式内容需经过人工审核。</p></div>
            <div className="page-count">0{list.length}</div>
          </div>
        </header>
        <section className="shell listing">
          <div className="listing-note">当前为第一版内容与版式演示。RSS 接入后，来源核验通过的草稿才会进入人工发布流程。</div>
          <div className="listing-grid">{list.map((article) => <ArticleCard article={article} key={article.slug} />)}</div>
        </section>
      </main>
    </PageFrame>
  );
}
