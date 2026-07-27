import Link from "next/link";
import { articles } from "@/lib/content";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const rows = articles.slice(0, 5);
  return (
    <main className="admin-shell">
      <header className="admin-top"><div className="shell admin-top-inner"><Link className="brand" href="/"><strong>TIMIU</strong><span>编辑工作台</span></Link><div className="admin-user">{user.displayName} · <a href={chatGPTSignOutPath("/")}>退出</a></div></div></header>
      <div className="shell admin-page">
        <div className="admin-heading"><div><h1>内容工作台</h1><p>处理 RSS 线索、AI 草稿、人工审核与发布记录。</p></div><span className="status-pill">自动发布：关闭</span></div>
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
              <ol className="workflow"><li><b>1</b>读取最多 100 条 RSS</li><li><b>2</b>匹配 14 天内最多 4 条来源</li><li><b>3</b>排除版本数字冲突与重复选题</li><li><b>4</b>生成草稿并保存来源</li><li><b>5</b>人工审核后手动发布</li></ol>
              <div className="config-list">AI_PROVIDER=gemini<br />MODEL=gemini-3.6-flash<br />SIMILARITY=0.45<br />AUTO_PUBLISH=false</div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
