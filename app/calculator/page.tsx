import type { Metadata } from "next";
import { Suspense } from "react";
import CalculatorPage from "@/components/calculator/CalculatorPage";

export const metadata: Metadata = {
  title: "금융 계산기",
  description: "티커 MDD, 종목 및 포트폴리오 성과 비교 등 금융 계산기를 제공합니다.",
};

export default function Page() {
  // CalculatorPage 가 useSearchParams 를 사용하므로 Suspense 로 감싼다.
  return (
    <Suspense fallback={null}>
      <CalculatorPage />
    </Suspense>
  );
}
