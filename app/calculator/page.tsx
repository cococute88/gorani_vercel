import { Suspense } from "react";
import CalculatorPage from "@/components/calculator/CalculatorPage";

export default function Page() {
  // CalculatorPage 가 useSearchParams 를 사용하므로 Suspense 로 감싼다.
  return (
    <Suspense fallback={null}>
      <CalculatorPage />
    </Suspense>
  );
}
