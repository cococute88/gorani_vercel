"use client";

import { useMemo } from "react";
import DonutChartCard from "@/components/DonutChartCard";
import { formatCompactKrw } from "@/lib/format";
import { buildAssetAllocationFromSnapshotLike } from "@/lib/asset-allocation-donut";
import type { FinanceAsset, Holding } from "@/lib/portfolio-types";

interface Props {
  holdings?: Holding[];
  financeAssets?: FinanceAsset[];
  theme?: "light" | "dark";
  title?: string;
  emptyMessage?: string;
  includeFinanceAssets?: boolean;
  className?: string;
  size?: number;
  // 스냅샷 권위 현금 합계(total_cash_krw). 주면 키워드를 빠져나간 투자 계좌 잔액을
  // 이 한도로 reconcile 해 도넛 총자산이 단일 기준(권위 총자산)과 일치한다.
  authoritativeCashKRW?: number | null;
  // 스냅샷 권위 총자산(total_assets_krw). 주면 도넛 중앙 "총 자산" 과 비중 분모를 이
  // 값으로 고정한다(자가합산 금지). 현금성 bucket 은 권위 remainder 에 anchor 된다.
  authoritativeTotalAssetsKRW?: number | null;
}

// 기존 Streamlit 스타일 자산군 도넛 그래프.
// /portfolio, /portfolio-manager, 스냅샷 히스토리 상세에서 공유한다.
// 동일한 holdings/financeAssets 를 넣으면 세 화면에서 동일한 결과가 나온다.
export default function AssetAllocationDonut({
  holdings,
  financeAssets,
  theme = "light",
  title = "자산군 비중",
  emptyMessage = "엑셀을 업로드하면 자산군 비중이 표시됩니다.",
  includeFinanceAssets = true,
  className = "h-full",
  size,
  authoritativeCashKRW,
  authoritativeTotalAssetsKRW,
}: Props) {
  const { slices, totalKRW } = useMemo(
    () =>
      buildAssetAllocationFromSnapshotLike(
        { holdings, financeAssets },
        { includeFinanceAssets, authoritativeCashKRW, authoritativeTotalAssetsKRW },
      ),
    [holdings, financeAssets, includeFinanceAssets, authoritativeCashKRW, authoritativeTotalAssetsKRW],
  );

  return (
    <DonutChartCard
      title={title}
      data={slices}
      theme={theme}
      size={size}
      className={className}
      centerLabel={totalKRW > 0 ? "총 자산" : undefined}
      centerValue={totalKRW > 0 ? formatCompactKrw(totalKRW) : undefined}
      emptyMessage={emptyMessage}
    />
  );
}
