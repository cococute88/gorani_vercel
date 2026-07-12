import { Suspense } from "react";
import AssetSimulatorPage from "@/components/asset-simulator/AssetSimulatorPage";

export default function Page() {
  // AssetSimulatorPage 가 useSearchParams 를 사용하므로 Suspense 로 감싼다.
  return (
    <Suspense fallback={null}>
      <AssetSimulatorPage />
    </Suspense>
  );
}
