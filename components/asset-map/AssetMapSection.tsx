"use client";

import { useMemo, type ReactNode } from "react";
import DonutChartCard from "@/components/DonutChartCard";
import HoldingsTable from "@/components/HoldingsTable";
import type { AssetMapHoldingRow } from "@/components/HoldingsTable";
import { buildAssetMapExposureFromHoldings } from "@/lib/asset-map-exposure";
import { formatCompactKrw } from "@/lib/format";
import type { Slice } from "@/lib/mockData";
import { latestOf, usePortfolioSnapshots } from "@/lib/portfolio-store";
import { filterAggregateHoldings } from "@/lib/portfolio-summary-row";
import type { Holding } from "@/lib/portfolio-types";
import { SECTOR_ALLOCATION, SECTOR_FILTERS } from "@/lib/mockData";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

const SECTOR_COLORS = [
  "#2563eb",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#6366f1",
  "#d946ef",
  "#0ea5e9",
  "#eab308",
  "#fb7185",
  "#34d399",
];

interface Props {
  // 좌측 컬럼(섹터 비중 도넛) 하단에 상하로 배치할 "자산군 비중" 도넛 카드.
  // 페이지에서 데이터/계산 로직을 그대로 유지한 채 이 위치로 이동 렌더링한다.
  assetClassDonut?: ReactNode;
  // 현재 활성/선택 스냅샷의 보유종목. 주면 ETF 투시(섹터 비중/유효 보유)가 이 단일
  // 소스를 따른다(스냅샷 선택 시 모든 차트가 동일 스냅샷 사용). 없으면 기존처럼
  // localStorage 최신 스냅샷으로 폴백한다.
  holdings?: Holding[];
}

// 포트폴리오 관리 하단의 자산 맵 / ETF 투시 섹션.
export default function AssetMapSection({ assetClassDonut, holdings }: Props) {
  const theme = useResolvedTheme();
  const snapshots = usePortfolioSnapshots();
  const latestSnapshot = useMemo(() => latestOf(snapshots), [snapshots]);
  const portfolioHoldings = useMemo(
    () =>
      // 활성/선택 스냅샷 보유종목이 주어지면 그것을 단일 소스로(localStorage 전용 분기 제거),
      // 없을 때만 localStorage 최신 스냅샷으로 폴백한다.
      holdings !== undefined
        ? filterAggregateHoldings(holdings)
        : filterAggregateHoldings(latestSnapshot?.holdings ?? []),
    [holdings, latestSnapshot],
  );
  const exposure = useMemo(
    () =>
      buildAssetMapExposureFromHoldings(
        portfolioHoldings.map((holding) => ({
          ticker: holding.ticker,
          name: holding.cleanName ?? holding.productName,
          valueKRW: holding.valueKRW,
          assetType: holding.assetType,
        })),
      ),
    [portfolioHoldings],
  );
  const usePortfolioExposure = exposure.source === "portfolio";

  const sectorAllocation: Slice[] = useMemo(
    () =>
      usePortfolioExposure
        ? exposure.sectorAllocation.map((row, index) => ({
            name: row.sector,
            value: row.weightPct,
            color: SECTOR_COLORS[index % SECTOR_COLORS.length],
            amountKRW: row.amountKRW,
          }))
        : SECTOR_ALLOCATION,
    [exposure.sectorAllocation, usePortfolioExposure],
  );
  const effectiveHoldings: AssetMapHoldingRow[] = useMemo(
    () =>
      usePortfolioExposure
        ? exposure.effectiveHoldingsTop.map((row, index) => ({
            rank: index + 1,
            name: row.name,
            ticker: row.ticker,
            sector: row.sector,
            weight: row.weightPct,
          }))
        : [],
    [exposure.effectiveHoldingsTop, usePortfolioExposure],
  );
  const sectorFilters = useMemo(
    () =>
      usePortfolioExposure
        ? ["전체", ...exposure.sectorAllocation.map((row) => row.sector)]
        : SECTOR_FILTERS,
    [exposure.sectorAllocation, usePortfolioExposure],
  );

  const coverageText = usePortfolioExposure
    ? `ETF 평가액 ${formatCompactKrw(exposure.etfValueKRW)} · 투시 커버리지 ${exposure.coveragePct.toFixed(2)}%`
    : "목업 ETF 35개 · 커버리지 91%";
  const analyzedText = usePortfolioExposure
    ? `분석금액 ${formatCompactKrw(exposure.analyzedValueKRW)}`
    : null;
  const excludedText = usePortfolioExposure && exposure.excludedHoldings.length > 0
    ? `제외금액 ${formatCompactKrw(exposure.uncoveredEtfValueKRW + exposure.excludedHoldings.filter((row) => row.reason !== "constituents_unavailable").reduce((sum, row) => sum + row.amountKRW, 0))}`
    : null;

  return (
    <section className="mt-8 border-t border-slate-200 pt-6 dark:border-[#242938]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-[20px] font-extrabold text-slate-900 dark:text-white">자산 맵</h2>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-[#2a3336] dark:bg-[#191f20]">
        <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
          {coverageText}
          {analyzedText ? (
            <>
              {" "}· <b className="text-slate-900 dark:text-white">{analyzedText}</b>
            </>
          ) : null}
          {excludedText ? <> · {excludedText}</> : null}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* 좌측 컬럼: 섹터 비중 도넛 ↓ 자산군 비중 도넛 (상하 배치, 간격 16px). */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]">
            <div className="-m-5">
              <DonutChartCard
                title="섹터 비중"
                data={sectorAllocation}
                theme={theme}
                size={150}
                centerLabel="섹터"
                centerValue={`${sectorAllocation.length}개`}
                expandedLegend
              />
            </div>
          </div>
          {assetClassDonut}
        </div>
        <HoldingsTable
          holdings={usePortfolioExposure ? effectiveHoldings : undefined}
          sectorFilters={sectorFilters}
        />
      </div>
    </section>
  );
}
