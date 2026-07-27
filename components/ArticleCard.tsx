import Link from "next/link";
import { Article, categoryMeta, formatDate } from "@/lib/content";

export function ArticleCard({ article, compact = false }: { article: Article; compact?: boolean }) {
  return (
    <article className={`article-card ${compact ? "compact" : ""}`}>
      {!compact && <Link href={`/article/${article.slug}`} className={`cover cover-${article.tone}`} aria-label={article.title}>
        <span>{article.kicker}</span><b aria-hidden="true">T</b>
      </Link>}
      <div className="card-copy">
        <div className="eyebrow">
          <Link href={categoryMeta[article.category].href}>{categoryMeta[article.category].name}</Link>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <h3><Link href={`/article/${article.slug}`}>{article.title}</Link></h3>
        {!compact && <p>{article.dek}</p>}
        <div className="card-footer">
          <span>{article.readingMinutes} 分钟阅读</span>
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </article>
  );
}
