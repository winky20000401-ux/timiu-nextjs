import type { Metadata } from "next";
import { CategoryPage } from "@/components/CategoryPage";

export const metadata: Metadata = {
  title: "游戏攻略",
  description: "TIMIU 游戏攻略：上手指南、设置建议与深度玩法解析。",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() { return <CategoryPage category="guides" />; }
