import type { Metadata } from "next";
import { CategoryPage } from "@/components/CategoryPage";

export const metadata: Metadata = {
  title: "游戏新闻",
  description: "TIMIU 游戏新闻：新作、发行、更新与游戏产业动态。",
  alternates: { canonical: "/news" },
};

export default function NewsPage() { return <CategoryPage category="news" />; }
