import { Suspense } from "react";
import DividendPage from "@/components/dividend/DividendPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DividendPage />
    </Suspense>
  );
}
