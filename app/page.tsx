import Link from "next/link";
import { PageFrame } from "@/components/SiteChrome";
import { MiniGames } from "@/components/MiniGames";
import { categoryMeta, formatDate, type CategoryKey } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { getVisibleArticles } from "@/lib/published-articles";
import { trendingTags } from "@/lib/trending-tags";

export const dynamic = "force-dynamic";

function CategoryTag({ category, label }: { category: CategoryKey; label: string }) {
  const cls =
    category === "news"
      ? "gs-tag gs-tag-news"
      : category === "hardware"
        ? "gs-tag gs-tag-hardware"
        : category === "guides"
          ? "gs-tag gs-tag-guides"
          : "gs-tag gs-tag-default";
  return <span className={cls}>{label}</span>;
}

export default async function Home() {
  const visibleArticles = await getVisibleArticles();
  const lead = visibleArticles[0];
  const secondary = visibleArticles.slice(1, 4);
  const latest = visibleArticles.slice(4, 14);
  const trending = trendingTags.slice(0, 10);

  if (!lead) {
    return (
      <PageFrame>
        <main className="gs-home">
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--gs-muted)" }}>
            暂无可显示的文章。
          </div>
        </main>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <main className="gs-home">
        {/* Hero spotlight */}
        <section className="gs-hero" aria-label="头条">
          <Link className="gs-hero-art" href={`/article/${lead.slug}`} aria-label={lead.title}>
            {lead.coverObjectKey ? (
              <img src={mediaUrl(lead.coverObjectKey)} alt="" />
            ) : (
              <div className={`gs-hero-fallback cover-${lead.tone}`} />
            )}
          </Link>
          <div className="gs-hero-copy">
            <CategoryTag category={lead.category} label="头条" />
            <h1 className="gs-hero-title">
              <Link href={`/article/${lead.slug}`}>{lead.title}</Link>
            </h1>
            <div className="gs-hero-meta">
              {lead.kicker} · {lead.readingMinutes} MIN READ · {formatDate(lead.publishedAt)}
            </div>
          </div>
        </section>

        {/* Secondary 3-card grid */}
        <section className="gs-secondary-grid" aria-label="精选">
          {secondary.map((article) => (
            <article key={article.slug} className="gs-secondary-card">
              <Link className="gs-secondary-cover" href={`/article/${article.slug}`}>
                {article.coverObjectKey ? (
                  <img src={mediaUrl(article.coverObjectKey)} alt="" />
                ) : (
                  <div className={`gs-cover-fallback cover-${article.tone}`} />
                )}
              </Link>
              <div className="gs-secondary-copy">
                <CategoryTag category={article.category} label={categoryMeta[article.category].name} />
                <h3 className="gs-secondary-title">
                  <Link href={`/article/${article.slug}`}>{article.title}</Link>
                </h3>
                <div className="gs-secondary-meta">
                  {formatDate(article.publishedAt)} · {article.readingMinutes} 分钟
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Trending tags ticker */}
        <section className="gs-trending-bar" aria-label="热门标签">
          <div className="gs-trending-track">
            <strong>TRENDING</strong>
            {trending.map((tag) => (
              <Link href={`/tag/${encodeURIComponent(tag.name)}`} key={tag.name}>
                #{tag.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Latest news vertical list */}
        <section className="gs-latest-list" aria-label="最新资讯">
          <div className="gs-section-head">
            <h2 className="gs-section-title">最新资讯</h2>
            <Link className="gs-section-link" href="/search">
              浏览全部 →
            </Link>
          </div>
          <div className="gs-latest-vertical">
            {latest.map((article) => (
              <article key={article.slug} className="gs-latest-item">
                <Link className="gs-latest-thumb" href={`/article/${article.slug}`}>
                  {article.coverObjectKey ? (
                    <img src={mediaUrl(article.coverObjectKey)} alt="" />
                  ) : (
                    <div className={`gs-thumb-fallback cover-${article.tone}`} />
                  )}
                </Link>
                <div className="gs-latest-copy">
                  <CategoryTag category={article.category} label={categoryMeta[article.category].name} />
                  <h3 className="gs-latest-title">
                    <Link href={`/article/${article.slug}`}>{article.title}</Link>
                  </h3>
                  <div className="gs-latest-meta">
                    {formatDate(article.publishedAt)} · 人工审核 · {article.readingMinutes} 分钟阅读
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Channel picks */}
        <section className="gs-channels" aria-label="频道精选">
          <div className="gs-channels-inner">
            <div className="gs-channels-head">
              <h2>频道精选</h2>
              <span>编辑挑选 · 每日更新</span>
            </div>
            <div className="gs-channel-grid">
              {Object.entries(categoryMeta).map(([key, meta]) => {
                const picks = visibleArticles.filter((a) => a.category === key).slice(0, 3);
                return (
                  <div className="gs-channel-col" key={key}>
                    <h3>
                      {meta.name}
                      <Link href={meta.href}>进入频道 →</Link>
                    </h3>
                    {picks.length === 0 ? (
                      <div className="gs-channel-item">
                        <small>暂无文章</small>
                      </div>
                    ) : (
                      picks.map((article) => (
                        <div className="gs-channel-item" key={article.slug}>
                          <Link href={`/article/${article.slug}`}>{article.title}</Link>
                          <small>{article.kicker} · {article.readingMinutes} 分钟</small>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Mini-games playable section */}
        <MiniGames />

        {/* Newsletter / RSS band */}
        <section className="gs-newsletter" aria-label="订阅 RSS">
          <div className="gs-newsletter-inner">
            <span>TIMIU DAILY</span>
            <h2>重要的，不该被信息流淹没。</h2>
            <p>RSS 已准备好。正式内容接入后，你可以通过阅读器直接订阅。</p>
            <Link className="gs-newsletter-btn" href="/rss.xml">
              订阅 RSS ↗
            </Link>
          </div>
        </section>
      </main>
    </PageFrame>
  );
}
