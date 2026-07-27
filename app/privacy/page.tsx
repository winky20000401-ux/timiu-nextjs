import type { Metadata } from "next";
import { PageFrame } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "隐私政策",
  description: "TIMIU 游戏资讯隐私政策。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageFrame>
      <main className="shell text-page">
        <span className="section-label">PRIVACY / 2026-07-28</span>
        <h1>隐私政策</h1>
        <p className="lede">本政策说明 TIMIU 第一版网站如何处理访问数据与管理员信息。正式启用其他服务时，本页会同步更新。</p>
        <h2>访问数据</h2>
        <p>网站托管服务可能为安全、稳定性与流量统计处理必要的技术信息，例如 IP 地址、浏览器类型、请求时间与访问路径。第一版不在浏览器 localStorage 中保存文章、账号或其他权威数据。</p>
        <h2>管理员身份</h2>
        <p>编辑工作台使用托管平台提供的安全登录，不建立明文密码系统。身份信息仅用于访问控制与操作归属。</p>
        <h2>密钥与环境变量</h2>
        <p>RSS 授权、Gemini 与 OpenAI 密钥仅应保存在本地或托管平台的安全环境变量中，不写入代码、网页、版本库或日志。</p>
        <h2>第三方链接</h2>
        <p>文章可能链接到游戏公司、开发商、发行商或媒体网站。访问第三方网站后，其隐私政策将独立适用。</p>
        <h2>更新</h2>
        <p>最近更新：2026 年 7 月 28 日。正式域名上线、分析服务或用户功能启用前，我们会再次审查本政策。</p>
      </main>
    </PageFrame>
  );
}
