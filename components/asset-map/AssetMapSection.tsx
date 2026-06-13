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
  const warningText = usePortfolioExposure && exposure.warnings.length > 0
    ? ` ${exposure.warnings.slice(0, 2).join(" ")}`
    : "";
  const coverageText = usePortfolioExposure
    ? `ETF 평가액 ${formatCompactKrw(exposure.etfValueKRW)} · 투시 커버리지 ${exposure.coveragePct.toFixed(2)}%`
    : "목업 ETF 35개 · 커버리지 91%";
  const analyzedText = usePortfolioExposure
    ? `분석금액 ${formatCompactKrw(exposure.analyzedValueKRW)}`
    : null;

  return (
    <section className="mt-8 border-t border-[#242938] pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-[20px] font-extrabold text-white">자산 맵</h2>
          <span className="text-[12.5px] text-slate-500">포트폴리오 관리 하단</span>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200">
        {statusText}{warningText}
      </div>

      <div className="mb-5 rounded-xl border border-[#2a3336] bg-[#191f20] px-4 py-3">
        <span className="text-[13px] font-medium text-slate-300">
          {coverageText}
          {analyzedText ? (
            <>
              {" "}· <b className="text-white">{analyzedText}</b>
            </>
          ) : null}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
          <div className="-m-5">
            <DonutChartCard
              title="섹터 비중"
              data={sectorAllocation}
              theme="dark"
              size={150}
              centerLabel="섹터"
              centerValue={`${sectorAllocation.length}개`}
            />
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
