import type { Metadata } from "next";
import { Suspense } from "react";
import CalculatorPage from "@/components/calculator/CalculatorPage";

export const metadata: Metadata = {
  title: "티커MDD 계산기",
  description: "티커별 일봉 기반 최대 낙폭과 회복기간을 계산합니다.",
};

export default function Page() {
  // CalculatorPage 가 useSearchParams 를 사용하므로 Suspense 로 감싼다.
  return (
    <Suspense fallback={null}>
      <CalculatorPage />
    </Suspense>
  );
}
