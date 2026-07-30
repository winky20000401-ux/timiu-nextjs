"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { QuickArticleActions } from "@/components/QuickArticleActions";

type ArticleRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  updated_at: string;
  requires_review: number;
};

type BulkResult = {
  id: number;
  ok?: boolean;
  status?: string;
  error?: string;
};

export function ArticleBulkManager({ articles }: { articles: ArticleRow[] }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleIds = articles.map((article) => article.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  function toggleAll() {
    setSelected(allSelected ? [] : visibleIds);
  }

  function toggleOne(id: number) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function run(action: "publish" | "unpublish" | "archive") {
    if (selected.length === 0) return;
    const label = action === "publish" ? "发布" : action === "unpublish" ? "撤回" : "归档";
    if (!window.confirm(`确认批量${label}选中的 ${selected.length} 篇文章？`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/articles/bulk-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ids: selected }),
      });
      const result = await response.json() as { updated?: number; failed?: number; results?: BulkResult[]; error?: string };
      if (!response.ok || result.error) {
        setMessage(result.error ?? `批量${label}失败`);
        return;
      }
      const failedText = (result.results ?? [])
        .filter((item) => item.error)
        .slice(0, 3)
        .map((item) => `#${item.id} ${item.error}`)
        .join("；");
      setMessage(`批量${label}完成：成功 ${result.updated ?? 0} 篇，失败 ${result.failed ?? 0} 篇。${failedText ? `失败示例：${failedText}` : ""}`);
      setSelected([]);
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setMessage(`批量${label}失败，请稍后重试`);
    } finally {
      setBusy(false);
    }
  }

  if (articles.length === 0) return <p className="muted">此筛选条件下没有文章，可以新建文章或切换其他筛选。</p>;

  return <div className="bulk-manager">
    <div className="bulk-toolbar">
      <span>已选择 {selected.length} 篇</span>
      <button type="button" disabled={busy || selected.length === 0} onClick={() => void run("publish")}>批量发布</button>
      <button type="button" disabled={busy || selected.length === 0} onClick={() => void run("unpublish")}>批量撤回</button>
      <button type="button" disabled={busy || selected.length === 0} onClick={() => void run("archive")}>批量归档</button>
    </div>
    {message && <p className="editor-message" role="status">{message}</p>}
    <table className="admin-table">
      <thead><tr><th><input aria-label="选择全部文章" type="checkbox" checked={allSelected} onChange={toggleAll} /></th><th>标题</th><th>状态</th><th>审核</th><th>更新</th><th>操作</th></tr></thead>
      <tbody>{articles.map((article) => <tr key={article.id}>
        <td><input aria-label={`选择 ${article.title}`} type="checkbox" checked={selectedSet.has(article.id)} onChange={() => toggleOne(article.id)} /></td>
        <td>{article.status === "published"
          ? <a className="article-row-link" href={`/article/${article.slug}`}>{article.title}</a>
          : <Link className="article-row-link" href={`/admin/articles/${article.id}`}>{article.title}</Link>}</td>
        <td><span className={`badge ${article.status === "published" ? "published" : ""}`}>{statusLabel(article.status)}</span></td>
        <td>{article.requires_review ? "需要" : "已完成"}</td>
        <td>{article.updated_at}</td>
        <td><QuickArticleActions id={article.id} status={article.status} /></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function statusLabel(status: string) {
  return ({ draft: "草稿", review: "审核中", published: "已发布", failed: "失败", archived: "已归档" } as Record<string, string>)[status] ?? status;
}
