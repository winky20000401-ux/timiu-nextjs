import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { PageFrame } from "@/components/SiteChrome";
import { articles } from "@/lib/content";

export const metadata: Metadata = { title: "搜索", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim().toLowerCase();
  const results = term ? articles.filter((item) => `${item.title} ${item.dek} ${item.tags.join(" ")}`.toLowerCase().includes(term)) : articles;
  return (
    <PageFrame>
      <main>
        <header className="page-hero"><div className="shell page-hero-inner"><div><span className="section-label">SEARCH / TIMIU</span><h1>搜索文章</h1><p>从新闻、硬件与攻略演示内容中查找关键词。</p></div></div></header>
        <section className="shell listing">
          <div className="search-panel">
            <form className="search-form" action="/search">
              <input name="q" defaultValue={q} placeholder="输入游戏、平台、公司或关键词" aria-label="搜索关键词" />
              <button type="submit">搜索</button>
            </form>
          </div>
          <div className="section-head"><div><span className="section-index">RESULTS</span><h2>{term ? `“${q}”的结果` : "全部文章"}</h2></div><span>{results.length} 篇</span></div>
          {results.length ? <div className="listing-grid">{results.map((article) => <ArticleCard article={article} key={article.slug} />)}</div> : <div className="listing-note">没有找到相关文章，请尝试更短的关键词。</div>}
        </section>
      </main>
    </PageFrame>
  );
}
