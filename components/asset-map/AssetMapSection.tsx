"use client";

import { useMemo } from "react";
import DonutChartCard from "@/components/DonutChartCard";
import HoldingsTable from "@/components/HoldingsTable";
import type { AssetMapHoldingRow } from "@/components/HoldingsTable";
import { buildAssetMapExposureFromHoldings } from "@/lib/asset-map-exposure";
import { formatCompactKrw } from "@/lib/format";
import type { Slice } from "@/lib/mockData";
import { latestOf, usePortfolioSnapshots } from "@/lib/portfolio-store";
import { filterAggregateHoldings } from "@/lib/portfolio-summary-row";
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

// 포트폴리오 관리 하단의 자산 맵 / ETF 투시 섹션.
export default function AssetMapSection() {
  const theme = useResolvedTheme();
  const snapshots = usePortfolioSnapshots();
  const latestSnapshot = useMemo(() => latestOf(snapshots), [snapshots]);
  const portfolioHoldings = useMemo(
    () => filterAggregateHoldings(latestSnapshot?.holdings ?? []),
    [latestSnapshot],
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
  const hasSnapshotHoldings = portfolioHoldings.length > 0;
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

  const statusText = usePortfolioExposure
    ? `최신 스냅샷 ${latestSnapshot?.snapshotDate} · 보유종목 ${portfolioHoldings.length}개 · 실데이터 기반 자산맵으로 표시합니다.`
    : hasSnapshotHoldings
      ? `최신 스냅샷 ${latestSnapshot?.snapshotDate} · 보유종목 ${portfolioHoldings.length}개 감지 · 유효한 투시 대상이 없어 목업 데이터로 표시합니다.`
    : "저장된 스냅샷이 없어 목업 데이터로 표시합니다.";
  const visibleWarnings = usePortfolioExposure ? exposure.warnings.slice(0, 3) : [];
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]">
          <div className="-m-5">
            <DonutChartCard
              title="섹터 비중"
              data={sectorAllocation}
              theme={theme}
              size={150}
              centerLabel="섹터"
              centerValue={`${sectorAllocation.length}개`}
            />
          </div>
          {/* 도넛 하단 빈 공간에 보조 설명(상태/경고)을 작게 표시. */}
          <div className="mt-5 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500 dark:border-[#2a3336] dark:text-slate-400">
            <div>{statusText}</div>
            {visibleWarnings.length > 0 ? (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {visibleWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <HoldingsTable
          holdings={usePortfolioExposure ? effectiveHoldings : undefined}
          sectorFilters={sectorFilters}
        />
      </div>
    </section>
  );
}
