"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/media";

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
  coverObjectKey: string;
  coverSource: string;
  coverCopyright: string;
};

export function ArticleEditor({ article, categories }: { article: ArticleForm; categories: Category[] }) {
  const [form, setForm] = useState(article);
  const [message, setMessage] = useState("");
  const [savingMode, setSavingMode] = useState<"draft" | "publish" | null>(null);
  const [uploading, setUploading] = useState(false);
  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  function field(name: keyof ArticleForm, value: string | number) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  async function uploadCover(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("封面仅支持 JPEG、PNG 或 WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("封面图片不能超过 5MB");
      return;
    }
    setUploading(true);
    setMessage("");
    const data = new FormData();
    data.set("file", file);
    try {
      const response = await fetch("/api/admin/media", { method: "POST", body: data });
      const result = await response.json() as { error?: string; key?: string };
      if (!response.ok || !result.key) {
        setMessage(result.error ?? "封面上传失败");
        return;
      }
      setForm((current) => ({ ...current, coverObjectKey: result.key ?? "" }));
      setMessage("封面已上传，请继续填写图片来源和版权说明并保存文章");
    } catch {
      setMessage("封面上传失败，请稍后重试");
    } finally {
      setUploading(false);
    }
  }
  async function save(mode: "draft" | "publish") {
    if (form.coverObjectKey && (!form.coverSource.trim() || !form.coverCopyright.trim())) {
      setMessage("使用封面时必须填写图片来源和版权/授权说明");
      return;
    }
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
      <fieldset className="cover-editor">
        <legend>文章封面</legend>
        <div className="cover-editor-grid">
          <div className="cover-preview">
            {form.coverObjectKey
              ? <img src={mediaUrl(form.coverObjectKey)} alt="当前文章封面预览" />
              : <span>尚未上传封面</span>}
          </div>
          <div>
            <label className="cover-upload">上传图片（JPEG / PNG / WebP，最大 5MB）
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  void uploadCover(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {form.coverObjectKey && <button className="cover-clear" type="button" onClick={() => field("coverObjectKey", "")}>移除当前封面</button>}
          </div>
        </div>
        <div className="editor-row">
          <label>图片来源<input value={form.coverSource} onChange={(event) => field("coverSource", event.target.value)} placeholder="例如：游戏官方网站 / 管理员拍摄" /></label>
          <label>版权/授权说明<input value={form.coverCopyright} onChange={(event) => field("coverCopyright", event.target.value)} placeholder="例如：官方宣传素材，仅用于报道" /></label>
        </div>
        <p className="editor-help">封面会存入本站对象存储。使用封面时，来源与版权说明必须同时填写；移除只会解除文章引用，不会立即删除已上传文件。</p>
      </fieldset>
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
