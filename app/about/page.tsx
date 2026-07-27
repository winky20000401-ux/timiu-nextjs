import type { Metadata } from "next";
import { PageFrame } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "关于我们",
  description: "了解 TIMIU 游戏资讯的定位、编辑原则与来源规范。",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PageFrame>
      <main className="shell text-page">
        <span className="section-label">ABOUT / TIMIU</span>
        <h1>关于 TIMIU</h1>
        <p className="lede">TIMIU 游戏资讯是一个从零建立的独立中文游戏媒体项目，关注单机、主机、PC、电竞、游戏产业与科技硬件。</p>
        <h2>我们的编辑原则</h2>
        <p>事实与来源优先于发布速度。RSS 是选题线索，不是未经核验即可发布的正文。正式文章会保留实际使用的来源链接；传闻必须清楚标注，冲突信息进入人工审核。</p>
        <h2>AI 如何参与</h2>
        <p>AI 用于整理素材、寻找关联报道和生成中文草稿，不拥有发布权限。第一阶段固定采用“AI 草稿 → 人工审核 → 手动发布”，自动发布保持关闭。</p>
        <h2>图片与版权</h2>
        <p>网站不直接复制来源媒体的新闻图片。可用范围包括获授权的公开图片、官方宣传素材、管理员上传素材、许可图库和站内自有视觉；每个文件都应记录来源与版权信息。</p>
        <h2>联系与更正</h2>
        <p>第一版尚未启用公开联系邮箱。正式上线前会补充更正、投诉与版权联络方式，并在隐私政策中同步说明。</p>
      </main>
    </PageFrame>
  );
}
