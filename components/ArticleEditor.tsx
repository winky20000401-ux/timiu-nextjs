"use client";

import { useState } from "react";

type Category = { id: number; name: string };
type ArticleForm = {
  id: number | null;
  title: string;
  subtitle: string;
  slug: string;
  seoTitle: string;
  description: string;
  contentText: string;
  categoryId: number | null;
  tags: string;
  status: string;
  sourceUrl: string;
  sourceTitle: string;
};

export function ArticleEditor({ article, categories }: { article: ArticleForm; categories: Category[] }) {
  const [form, setForm] = useState(article);
  const [message, setMessage] = useState("");
  const [savingMode, setSavingMode] = useState<"draft" | "publish" | null>(null);
  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  function field(name: keyof ArticleForm, value: string | number) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  async function save(mode: "draft" | "publish") {
    if (mode === "publish") {
      if (!form.sourceUrl.trim()) {
        setMessage("直接发布前必须填写有效的主要来源链接");
        return;
      }
      if (!window.confirm(`确认完成审核，并发布到“${selectedCategory?.name ?? "所选板块"}”？`)) return;
    }
    setSavingMode(mode);
    setMessage("");
    const response = await fetch(article.id === null ? "/api/admin/articles" : `/api/admin/articles/${article.id}`, {
      method: article.id === null ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, publishNow: article.id === null && mode === "publish" }),
    });
    const result = await response.json() as { error?: string; id?: number; slug?: string; status?: string };
    if (!response.ok) {
      setMessage(result.error ?? "草稿保存失败");
      setSavingMode(null);
      return;
    }
    if (article.id === null && result.id) {
      window.location.assign(result.status === "published" && result.slug
        ? `/article/${result.slug}`
        : `/admin/articles/${result.id}`);
      return;
    }
    setMessage("草稿已保存");
    setSavingMode(null);
  }
  async function transition(action: "publish" | "unpublish" | "archive") {
    if (article.id === null) {
      setMessage("请先创建草稿，再进行发布操作");
      return;
    }
    if (action === "publish" && !window.confirm("确认人工审核完成并公开发布这篇文章？")) return;
    const response = await fetch(`/api/admin/articles/${article.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json() as { error?: string; status?: string };
    if (result.error) setMessage(result.error);
    else {
      setForm((current) => ({ ...current, status: result.status ?? current.status }));
      setMessage(`状态已更新为 ${result.status}`);
    }
  }
  return <div className="editor-layout">
    <section className="admin-card editor-form">
      <label>标题<input value={form.title} onChange={(event) => field("title", event.target.value)} /></label>
      <label>副标题<input value={form.subtitle} onChange={(event) => field("subtitle", event.target.value)} /></label>
      <div className="editor-row">
        <label>URL Slug<input value={form.slug} onChange={(event) => field("slug", event.target.value)} /></label>
        <label>发布板块<select value={form.categoryId ?? ""} onChange={(event) => field("categoryId", Number(event.target.value))}><option value="">请选择</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      </div>
      <div className="publish-target"><span>发布位置</span><strong>{selectedCategory?.name ?? "尚未选择板块"}</strong><small>发布后会进入网站顶部导航中的对应板块。</small></div>
      <label>SEO 标题<input value={form.seoTitle} onChange={(event) => field("seoTitle", event.target.value)} /></label>
      <label>Meta Description<textarea rows={3} value={form.description} onChange={(event) => field("description", event.target.value)} /></label>
      <label>标签（用逗号分隔）<input value={form.tags} onChange={(event) => field("tags", event.target.value)} /></label>
      <div className="editor-row">
        <label>主要来源链接<input type="url" value={form.sourceUrl} onChange={(event) => field("sourceUrl", event.target.value)} placeholder="https://example.com/source" /></label>
        <label>来源名称<input value={form.sourceTitle} onChange={(event) => field("sourceTitle", event.target.value)} placeholder="官方公告或媒体名称" /></label>
      </div>
      <p className="editor-help">草稿可以暂时不填来源，但公开发布前必须至少填写一个有效来源链接。</p>
      <label>正文<textarea rows={18} value={form.contentText} onChange={(event) => field("contentText", event.target.value)} /></label>
      <div className="editor-buttons">
        <button className="primary-button" type="button" onClick={() => save("draft")} disabled={savingMode !== null}>{savingMode === "draft" ? "保存中…" : article.id === null ? "保存为草稿" : "保存草稿"}</button>
        {article.id === null && <button className="publish-button" type="button" onClick={() => save("publish")} disabled={savingMode !== null}>{savingMode === "publish" ? "发布中…" : `审核并发布到${selectedCategory ? `「${selectedCategory.name}」` : "所选板块"}`}</button>}
        {article.id !== null && (form.status !== "published" ? <button type="button" onClick={() => transition("publish")}>人工审核并发布</button> : <button type="button" onClick={() => transition("unpublish")}>撤回文章</button>)}
        {article.id !== null && <button type="button" onClick={() => transition("archive")}>归档</button>}
      </div>
      {message && <p className="editor-message" role="status">{message}</p>}
    </section>
    <aside className="admin-card seo-preview">
      <h2>搜索预览</h2>
      <strong>{form.seoTitle || form.title || "文章标题"}</strong>
      <span>https://timiu.com/article/{form.slug || "article-slug"}</span>
      <p>{form.description || "Meta Description 将显示在这里。"}</p>
      <dl><dt>当前状态</dt><dd>{form.status}</dd><dt>字数</dt><dd>{form.contentText.replace(/\s/g, "").length}</dd></dl>
    </aside>
  </div>;
}
