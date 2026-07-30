import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { PageFrame } from "@/components/SiteChrome";
import { categoryMeta } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { getVisibleArticles } from "@/lib/published-articles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const visibleArticles = await getVisibleArticles();
  const lead = visibleArticles[0];
  const sideLeads = visibleArticles.slice(1, 3);
  const latestFeature = visibleArticles[3] ?? visibleArticles[0];
  const latestList = visibleArticles.slice(4, 9);
  const newsroomStats = [
    { label: "已发布稿件", value: String(visibleArticles.length).padStart(2, "0") },
    { label: "核心频道", value: "03" },
    { label: "人工审核", value: "100%" },
  ];
  return (
    <PageFrame>
      <main>
        <section className="hero shell">
          <div className="hero-heading">
            <div>
              <p className="section-label">今日焦点 / TOP STORY</p>
              <h1>读懂游戏，<br /><em>不止看见标题。</em></h1>
            </div>
            <p>从新闻事实到玩家影响，TIMIU 用清晰来源与人工审核，整理值得关注的游戏世界。</p>
          </div>
          <div className="lead-grid">
            <article className="lead-card">
              <Link className={`lead-art cover-${lead.tone}`} href={`/article/${lead.slug}`}>
                {lead.coverObjectKey
                  ? <img className="lead-cover-image" src={mediaUrl(lead.coverObjectKey)} alt="" />
                  : <>
                    <div className="grid-lines" aria-hidden="true" />
                    <span className="lead-mark">TIMIU / 01</span>
                    <strong>NEWS<br />ROOM</strong>
                    <small>编辑流程公开说明</small>
                  </>}
              </Link>
              <div className="lead-copy">
                <div className="eyebrow"><span>{lead.kicker}</span><span>6 MIN READ</span></div>
                <h2><Link href={`/article/${lead.slug}`}>{lead.title}</Link></h2>
                <p>{lead.dek}</p>
                <div className="lead-tags">{lead.tags.map((tag) => <Link href={`/tag/${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}</div>
              </div>
            </article>
            <div className="side-leads">
              <div className="newsroom-card" aria-label="TIMIU 编辑台概览">
                <span className="section-label">NEWSROOM INDEX</span>
                <strong>重点资讯<br />先读事实。</strong>
                <div>
                  {newsroomStats.map((item) => <p key={item.label}><b>{item.value}</b><span>{item.label}</span></p>)}
                </div>
              </div>
              {sideLeads.map((article, index) => (
                <article key={article.slug} className="side-lead">
                  <div className={`mini-art cover-${article.tone}`}>
                    {article.coverObjectKey
                      ? <img className="article-cover-image" src={mediaUrl(article.coverObjectKey)} alt="" />
                      : <><span>0{index + 2}</span><b>T</b></>}
                  </div>
                  <div>
                    <span className="section-label">{article.kicker}</span>
                    <h3><Link href={`/article/${article.slug}`}>{article.title}</Link></h3>
                    <p>{article.dek}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ticker" aria-label="热门标签">
          <div className="shell ticker-track">
            <strong>TRENDING</strong>
            {["PC游戏", "PlayStation", "Xbox", "Nintendo", "Steam", "独立游戏"].map((tag) => (
              <Link href={`/tag/${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>
            ))}
          </div>
        </section>

        <section className="shell section-block">
          <div className="section-head">
            <div><span className="section-index">01</span><h2>最新文章</h2></div>
            <Link href="/search">浏览全部 <span>→</span></Link>
          </div>
          <div className="latest-layout">
            <article className="latest-feature">
              <Link className={`latest-feature-art cover-${latestFeature.tone}`} href={`/article/${latestFeature.slug}`} aria-label={latestFeature.title}>
                {latestFeature.coverObjectKey
                  ? <img className="article-cover-image" src={mediaUrl(latestFeature.coverObjectKey)} alt="" />
                  : <><span>FEATURE</span><b>T</b></>}
              </Link>
              <div className="latest-feature-copy">
                <div className="eyebrow"><span>{categoryMeta[latestFeature.category].name}</span><span>{latestFeature.readingMinutes} MIN READ</span></div>
                <h3><Link href={`/article/${latestFeature.slug}`}>{latestFeature.title}</Link></h3>
                <p>{latestFeature.dek}</p>
                <div className="lead-tags">{latestFeature.tags.slice(0, 4).map((tag) => <Link href={`/tag/${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}</div>
              </div>
            </article>
            <div className="latest-stack">
              {(latestList.length ? latestList : visibleArticles.slice(0, 5)).map((article) => <ArticleCard article={article} compact key={article.slug} />)}
            </div>
          </div>
        </section>

        <section className="dark-band">
          <div className="shell section-block">
            <div className="section-head light">
              <div><span className="section-index">02</span><h2>频道精选</h2></div>
              <span>编辑挑选 · 每日更新</span>
            </div>
            <div className="channel-grid">
              {Object.entries(categoryMeta).map(([key, meta]) => {
                const picks = visibleArticles.filter((article) => article.category === key);
                return <div className="channel-column" key={key}>
                  <div className="channel-title"><h3>{meta.name}</h3><Link href={meta.href}>进入频道 →</Link></div>
                  {picks.slice(0, 2).map((article, index) => (
                    <div className="ranked" key={article.slug}>
                      <span>0{index + 1}</span>
                      <div><h4><Link href={`/article/${article.slug}`}>{article.title}</Link></h4><small>{article.kicker} · {article.readingMinutes} 分钟</small></div>
                    </div>
                  ))}
                </div>;
              })}
            </div>
          </div>
        </section>

        <section className="shell newsletter">
          <div>
            <span className="section-label">TIMIU DAILY</span>
            <h2>重要的，不该被信息流淹没。</h2>
            <p>RSS 已准备好。正式内容接入后，你可以通过阅读器直接订阅。</p>
          </div>
          <Link className="primary-button" href="/rss.xml">订阅 RSS <span>↗</span></Link>
        </section>
      </main>
    </PageFrame>
  );
}
