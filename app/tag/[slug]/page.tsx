import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { PageFrame } from "@/components/SiteChrome";
import { allTags, getTagArticles } from "@/lib/content";

export function generateStaticParams() { return allTags.map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tag = decodeURIComponent(slug);
  return { title: `标签：${tag}`, description: `TIMIU 游戏资讯中与${tag}相关的文章。` };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = decodeURIComponent(slug);
  const list = getTagArticles(tag);
  return (
    <PageFrame>
      <main>
        <header className="page-hero"><div className="shell page-hero-inner"><div><span className="section-label">TOPIC / TAG</span><h1>#{tag}</h1><p>与“{tag}”相关的内容集合。</p></div><div className="page-count">0{list.length}</div></div></header>
        <section className="shell listing"><div className="listing-grid">{list.map((article) => <ArticleCard article={article} key={article.slug} />)}</div></section>
      </main>
    </PageFrame>
  );
}
