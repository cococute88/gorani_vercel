import type { Metadata } from "next";
import MoneyLevelForest from "@/components/money-level/MoneyLevelForest";

export const metadata: Metadata = {
  title: "곰라니 머니레벨",
  description: "포트폴리오 현금흐름과 자산 단계를 숲으로 보는 곰라니 머니레벨",
};

export default function MoneyLevelPage() {
  return <MoneyLevelForest />;
}
