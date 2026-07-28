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
  const [saving, setSaving] = useState(false);
  function field(name: keyof ArticleForm, value: string | number) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(article.id === null ? "/api/admin/articles" : `/api/admin/articles/${article.id}`, {
      method: article.id === null ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json() as { error?: string; id?: number };
    if (!response.ok) {
      setMessage(result.error ?? "草稿保存失败");
      setSaving(false);
      return;
    }
    if (article.id === null && result.id) {
      window.location.assign(`/admin/articles/${result.id}`);
      return;
    }
    setMessage("草稿已保存");
    setSaving(false);
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
        <label>栏目<select value={form.categoryId ?? ""} onChange={(event) => field("categoryId", Number(event.target.value))}><option value="">请选择</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      </div>
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
        <button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? "保存中…" : article.id === null ? "创建草稿" : "保存草稿"}</button>
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
