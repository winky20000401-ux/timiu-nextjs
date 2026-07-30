"use client";

import { useState } from "react";

type ImportResult = {
  id?: number;
  importedItems?: number;
  skippedRows?: number;
  error?: string;
};

const SAMPLE_CSV = `id,title,game,tags,content_file,cover_image,source,copyright
elden-001,艾尔登法环新手开荒路线,艾尔登法环,"RPG,魂系",articles/elden-001.md,images/elden-001.jpg,自有攻略资料,自有截图或已获授权
wukong-001,黑神话悟空全章节流程,黑神话悟空,"动作游戏,国产游戏",articles/wukong-001.md,images/wukong-001.jpg,自有攻略资料,自有截图或已获授权`;

export function GuideImportForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sampleVisible, setSampleVisible] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/imports", {
        method: "POST",
        body: form,
      });
      const result = await response.json() as ImportResult;
      if (!response.ok || result.error) {
        setMessage(result.error ?? "导入任务创建失败");
        return;
      }
      setMessage(`导入任务 #${result.id} 已创建，预登记 ${result.importedItems ?? 0} 篇，跳过 ${result.skippedRows ?? 0} 行。页面即将刷新。`);
      setTimeout(() => window.location.reload(), 900);
    } catch {
      setMessage("导入任务创建失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return <form className="guide-import-form" onSubmit={submit}>
    <div className="import-form-grid">
      <label>任务名称
        <input name="name" required maxLength={120} placeholder="例如：2026 暑期 RPG 攻略资源包" />
      </label>
      <label>资源包位置 / 对象存储路径
        <input name="packageLocation" maxLength={500} placeholder="例如：r2://guide-packs/2026-rpg-guides.zip，或先留空" />
      </label>
      <label>默认入库状态
        <select name="defaultStatus" defaultValue="review">
          <option value="review">需要人工审核</option>
          <option value="draft">草稿</option>
        </select>
      </label>
      <label>Manifest CSV 文件
        <input name="manifest" type="file" accept=".csv,text/csv" />
      </label>
    </div>
    <label>或直接粘贴 manifest CSV
      <textarea name="manifestText" rows={8} placeholder="可以先粘贴少量行测试；大量文章建议上传 CSV 文件并拆成多个任务。" />
    </label>
    <label>备注
      <textarea name="notes" rows={3} maxLength={1000} placeholder="例如：本批资源来自自有整理，图片版权待逐篇确认。" />
    </label>
    <div className="editor-buttons">
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "正在创建…" : "创建导入任务"}</button>
      <button type="button" onClick={() => setSampleVisible(!sampleVisible)}>{sampleVisible ? "隐藏示例" : "查看 CSV 示例"}</button>
    </div>
    {message && <p className="editor-message" role="status">{message}</p>}
    {sampleVisible && <pre className="import-sample">{SAMPLE_CSV}</pre>}
  </form>;
}
