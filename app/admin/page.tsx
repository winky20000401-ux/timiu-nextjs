import Link from "next/link";
import { articles } from "@/lib/content";
import { requireAdminUser } from "@/app/admin-auth";
import { IngestButton } from "@/components/IngestButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminUser("/admin");
  const rows = articles.slice(0, 5);
  return (
    <main className="admin-shell">
      <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/"><strong>TIMIU</strong><span>编辑工作台</span></Link><div className="admin-user"><span>{user.displayName}</span><form action="/api/admin/auth/logout" method="post"><button className="link-button">退出</button></form></div></div></header>
      <div className="shell admin-page">
        <div className="admin-heading"><div><h1>内容工作台</h1><p>处理 RSS 线索、短讯草稿、人工审核与发布记录。</p><div className="admin-actions"><IngestButton /><Link className="secondary-button" href="/admin/feed">RSS 审核队列 →</Link><Link className="secondary-button" href="/admin/articles">文章管理 →</Link></div></div><span className="status-pill">AI 重写与自动发布：关闭</span></div>
        <div className="stats-grid">
          <div className="stat-card"><span>草稿</span><strong>3</strong></div>
          <div className="stat-card"><span>需要人工审核</span><strong>2</strong></div>
          <div className="stat-card"><span>已发布演示稿</span><strong>{articles.length}</strong></div>
          <div className="stat-card"><span>失败任务</span><strong>0</strong></div>
        </div>
        <div className="admin-grid">
          <section className="admin-card">
            <h2>文章队列</h2>
            <table className="admin-table">
              <thead><tr><th>标题</th><th>栏目</th><th>状态</th><th>置信度</th><th>更新</th></tr></thead>
              <tbody>{rows.map((article, index) => <tr key={article.slug}><td>{article.title}</td><td>{article.category}</td><td><span className={`badge ${index > 1 ? "published" : ""}`}>{index > 1 ? "已发布" : "需审核"}</span></td><td>{index > 1 ? "演示" : "0.78"}</td><td>今天</td></tr>)}</tbody>
            </table>
          </section>
          <aside>
            <section className="admin-card">
              <h2>安全发布流程</h2>
              <ol className="workflow"><li><b>1</b>读取最多 100 条 RSS</li><li><b>2</b>识别中文或外文内容</li><li><b>3</b>排除版本冲突与重复选题</li><li><b>4</b>处理标题与短摘要，保存来源</li><li><b>5</b>人工审核后手动发布</li></ol>
              <div className="config-list">AI_REWRITE_ENABLED=false<br />FULL_ARTICLE_TRANSLATION=false<br />SIMILARITY=0.45<br />AUTO_PUBLISH=false</div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
