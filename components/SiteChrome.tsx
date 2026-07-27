import Link from "next/link";
import { allTags, categoryMeta } from "@/lib/content";

export function SiteHeader() {
  return (
    <>
      <div className="signal-bar">
        <div className="shell signal-inner">
          <span><i /> 编辑演示版 · 自动发布保持关闭</span>
          <span className="signal-right">事实优先 · 来源可追溯</span>
        </div>
      </div>
      <header className="site-header">
        <div className="shell nav-row">
          <Link className="brand" href="/" aria-label="TIMIU 游戏资讯首页">
            <strong>TIMIU</strong>
            <span>游戏资讯</span>
          </Link>
          <nav className="desktop-nav" aria-label="主导航">
            {Object.entries(categoryMeta).map(([key, meta]) => (
              <Link href={meta.href} key={key}>{meta.name}</Link>
            ))}
            <Link href="/about">关于</Link>
          </nav>
          <div className="nav-actions">
            <Link className="search-link" href="/search" aria-label="搜索文章">
              <span aria-hidden="true">⌕</span> 搜索
            </Link>
            <details className="mobile-menu">
              <summary aria-label="打开移动端菜单">菜单</summary>
              <nav>
                {Object.entries(categoryMeta).map(([key, meta]) => (
                  <Link href={meta.href} key={key}>{meta.name}</Link>
                ))}
                <Link href="/search">搜索</Link>
                <Link href="/about">关于我们</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            <strong>TIMIU</strong><span>游戏资讯</span>
          </Link>
          <p>面向中文玩家的游戏新闻、产业动态、硬件资讯与实用攻略。</p>
          <p className="muted">第一版内容用于编辑流程与页面演示，正式新闻将在人工审核后发布。</p>
        </div>
        <div>
          <h2>频道</h2>
          {Object.values(categoryMeta).map((meta) => <Link href={meta.href} key={meta.href}>{meta.name}</Link>)}
        </div>
        <div>
          <h2>站点</h2>
          <Link href="/about">关于我们</Link>
          <Link href="/privacy">隐私政策</Link>
          <Link href="/rss.xml">RSS 订阅</Link>
          <Link href="/admin">编辑工作台</Link>
        </div>
        <div>
          <h2>热门标签</h2>
          <div className="tag-cloud">
            {allTags.slice(0, 8).map((tag) => <Link href={`/tag/${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 TIMIU 游戏资讯</span>
        <span>timiu.com · 独立项目</span>
      </div>
    </footer>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return <><SiteHeader />{children}<SiteFooter /></>;
}
