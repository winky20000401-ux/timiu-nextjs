import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { PageFrame } from "@/components/SiteChrome";
import { CategoryKey, categoryMeta } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { getVisibleArticles } from "@/lib/published-articles";

export async function CategoryPage({ category }: { category: CategoryKey }) {
  const meta = categoryMeta[category];
  const list = (await getVisibleArticles()).filter((article) => article.category === category);
  const lead = list[0];
  const latest = list.slice(1, 7);
  const tags = Array.from(new Set(list.flatMap((article) => article.tags))).slice(0, 10);
  return (
    <PageFrame>
      <main>
        <header className="page-hero channel-hero">
          <div className="shell page-hero-inner">
            <div>
              <span className="section-label">TIMIU / CHANNEL</span>
              <h1>{meta.name}</h1>
              <p>{meta.description}。正式文章经过人工审核后发布到本板块，方便你按频道持续追踪。</p>
              <div className="channel-actions">
                <Link href="/search">搜索本类内容 →</Link>
                <Link href="/rss.xml">订阅 RSS ↗</Link>
              </div>
            </div>
            <aside className="channel-count-card" aria-label={`${meta.name}统计`}>
              <span>频道稿件</span>
              <strong>{String(list.length).padStart(2, "0")}</strong>
              <small>{lead ? `最新更新：${lead.kicker}` : "等待首篇正式稿件"}</small>
            </aside>
          </div>
        </header>
        <section className="shell listing">
          <div className="listing-note">人工审核发布的正式文章会优先显示；演示内容继续保留并清楚标示。</div>
          {lead ? <div className="channel-layout">
            <article className="channel-feature">
              <Link className={`channel-feature-art cover-${lead.tone}`} href={`/article/${lead.slug}`}>
                {lead.coverObjectKey
                  ? <img className="article-cover-image" src={mediaUrl(lead.coverObjectKey)} alt="" />
                  : <><span>FEATURE</span><b>{meta.name.slice(0, 1)}</b></>}
              </Link>
              <div className="channel-feature-copy">
                <div className="eyebrow"><span>{lead.kicker}</span><span>{lead.readingMinutes} MIN READ</span></div>
                <h2><Link href={`/article/${lead.slug}`}>{lead.title}</Link></h2>
                <p>{lead.dek}</p>
                <div className="lead-tags">
                  {lead.tags.slice(0, 5).map((tag) => <Link href={`/tag/${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}
                </div>
              </div>
            </article>
            <aside className="channel-side">
              <h2>频道最新</h2>
              {(latest.length ? latest : list.slice(0, 1)).map((article) => <ArticleCard article={article} compact key={article.slug} />)}
            </aside>
          </div> : <div className="empty-channel">
            <strong>{meta.name}正在整理中</strong>
            <p>这里会显示人工审核后的正式稿件。你也可以先回到首页查看其他频道内容。</p>
            <Link className="primary-button" href="/">返回首页 <span>→</span></Link>
          </div>}
          {tags.length > 0 && <section className="channel-tags" aria-label={`${meta.name}常见标签`}>
            <span className="section-label">CHANNEL TAGS</span>
            <div>{tags.map((tag) => <Link href={`/tag/${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}</div>
          </section>}
        </section>
      </main>
    </PageFrame>
  );
}
