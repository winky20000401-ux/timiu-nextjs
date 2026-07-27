import type { Metadata } from "next";
import { CategoryPage } from "@/components/CategoryPage";

export const metadata: Metadata = {
  title: "科技硬件",
  description: "TIMIU 科技硬件：PC、主机、显示与外设的实用观察。",
  alternates: { canonical: "/hardware" },
};

export default function HardwarePage() { return <CategoryPage category="hardware" />; }
