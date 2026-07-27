import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://timiu.com"),
  title: {
    default: "TIMIU 游戏资讯｜游戏新闻、硬件与攻略",
    template: "%s｜TIMIU 游戏资讯",
  },
  description:
    "TIMIU 游戏资讯关注单机、主机、PC、电竞、游戏产业与硬件，为中文玩家提供清晰、可靠、可追溯的报道与攻略。",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "TIMIU 游戏资讯",
    title: "TIMIU 游戏资讯",
    description: "看见游戏世界的下一步。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "TIMIU 游戏资讯" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TIMIU 游戏资讯",
    description: "看见游戏世界的下一步。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
