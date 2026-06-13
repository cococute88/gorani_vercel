"use client";

import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import TopNav from "@/components/TopNav";
import { usePortfolioSnapshots, latestOf } from "@/lib/portfolio-store";
import {
  buildMonthlyDividendsFromRows,
  DIVIDEND_PERFORMANCE_SERIES,
} from "@/lib/mock-dividend-data";
import { formatPercent } from "@/lib/format";
import { normalizeHoldingTickerInfo } from "@/lib/holding-ticker-normalizer";
import type { Holding } from "@/lib/portfolio-types";
import { buildDividendHoldingGroupsFromSnapshot } from "@/lib/dividend-holdings-from-portfolio";
import DividendSummaryCards from "./DividendSummaryCards";
import MonthlyDividendChart from "./MonthlyDividendChart";
import DividendHoldingsTable from "./DividendHoldingsTable";
import DividendPerformanceSection from "./DividendPerformanceSection";

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 목표 달성률 계산용 주당 단가 (mock, KRW). TODO(codex): 실시세 연결.
const MOCK_SHARE_PRICE_KRW: Record<string, number> = {
  SCHD: 39_000,
  QQQ: 665_000,
  QLD: 144_000,
  TQQQ: 107_000,
  SPY: 768_000,
  JEPI: 80_000,
};

export default function DividendPage() {
  const snapshots = usePortfolioSnapshots();
  const [afterTax, setAfterTax] = useState(true);
  const [includeTaxAdvantagedInSummary, setIncludeTaxAdvantagedInSummary] = useState(false);
  const [chartIncludesTaxable, setChartIncludesTaxable] = useState(true);
  const [chartIncludesTaxAdvantaged, setChartIncludesTaxAdvantaged] = useState(false);
  const [targetTicker, setTargetTicker] = useState("SCHD");
  const [targetQty, setTargetQty] = useState(3300);

  const latestSnapshot = useMemo(() => latestOf(snapshots), [snapshots]);
  const holdings: Holding[] = useMemo(() => latestSnapshot?.holdings ?? [], [latestSnapshot]);

  const hasSnapshotHoldings = holdings.length > 0;

  const dividendGroups = useMemo(
    () => buildDividendHoldingGroupsFromSnapshot(latestSnapshot, afterTax),
    [latestSnapshot, afterTax],
  );
  const summaryRows = useMemo(
    () =>
      includeTaxAdvantagedInSummary
        ? [...dividendGroups.taxableHoldings, ...dividendGroups.taxAdvantagedHoldings]
        : dividendGroups.taxableHoldings,
    [dividendGroups.taxAdvantagedHoldings, dividendGroups.taxableHoldings, includeTaxAdvantagedInSummary],
  );
  const chartRows = useMemo(
    () => [
      ...(chartIncludesTaxable ? dividendGroups.taxableHoldings : []),
      ...(chartIncludesTaxAdvantaged ? dividendGroups.taxAdvantagedHoldings : []),
    ],
    [
      chartIncludesTaxAdvantaged,
      chartIncludesTaxable,
      dividendGroups.taxAdvantagedHoldings,
      dividendGroups.taxableHoldings,
    ],
  );
  const monthlyComposition = useMemo(() => buildMonthlyDividendsFromRows(chartRows), [chartRows]);

  const evaluationKRW = summaryRows.reduce((s, r) => s + r.valueKRW, 0);
  const annualDividendKRW = summaryRows.reduce((s, r) => s + r.annualDividendKRW, 0);
  const monthlyAvgKRW = annualDividendKRW / 12;

  // 목표 달성률: 현재 목표티커 보유주수 / 목표주수
  const price = MOCK_SHARE_PRICE_KRW[targetTicker] ?? 50_000;
  const targetValue = holdings
    .filter((h) => {
      const tickerInfo = normalizeHoldingTickerInfo(h);
      const dividendBucket = tickerInfo.dividendBucket ?? tickerInfo.quoteTicker ?? h.ticker;
      return (dividendBucket || "").toUpperCase() === targetTicker.toUpperCase();
    })
    .reduce((s, h) => s + h.valueKRW, 0);
  const currentShares = price > 0 ? targetValue / price : 0;
  const achievementPct = targetQty > 0 ? (currentShares / targetQty) * 100 : 0;

  function setChartTaxable(checked: boolean) {
    if (!checked && !chartIncludesTaxAdvantaged) return;
    setChartIncludesTaxable(checked);
  }

  function setChartTaxAdvantaged(checked: boolean) {
    if (!checked && !chartIncludesTaxable) return;
    setChartIncludesTaxAdvantaged(checked);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-extrabold text-white">배당</h1>
          {!hasSnapshotHoldings && (
            <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-[12px] text-amber-400">
              등록된 스냅샷이 없어 보유 배당 그룹이 비어 있습니다
            </span>
          )}
        </div>

        <DividendSummaryCards
          evaluationKRW={evaluationKRW}
          annualDividendKRW={annualDividendKRW}
          monthlyAvgKRW={monthlyAvgKRW}
          achievementPct={achievementPct}
          afterTax={afterTax}
          includeTaxAdvantaged={includeTaxAdvantagedInSummary}
          onToggleTax={setAfterTax}
          onToggleGroup={setIncludeTaxAdvantagedInSummary}
        />

        <MonthlyDividendChart
          data={monthlyComposition.data}
          tickers={monthlyComposition.tickers}
          afterTax={afterTax}
          includeTaxable={chartIncludesTaxable}
          includeTaxAdvantaged={chartIncludesTaxAdvantaged}
          onToggleTaxable={setChartTaxable}
          onToggleTaxAdvantaged={setChartTaxAdvantaged}
        />
        <DividendHoldingsTable
          title="보유 배당(위탁)"
          rows={dividendGroups.taxableHoldings}
          totalKRW={dividendGroups.taxableTotalKRW}
        />
        <DividendHoldingsTable
          title="보유 배당(절세)"
          rows={dividendGroups.taxAdvantagedHoldings}
          totalKRW={dividendGroups.taxAdvantagedTotalKRW}
        />

        {/* 목표 설정 카드 */}
        <section className="mb-6">
          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <Target size={16} className="text-blue-400" />
              <h2 className="text-[15px] font-bold text-slate-300">배당 목표 설정</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-[12.5px] text-slate-400">목표 티커</span>
                <input
                  value={targetTicker}
                  onChange={(e) => setTargetTicker(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-[12.5px] text-slate-400">목표 수량 (주)</span>
                <input
                  type="number"
                  value={targetQty}
                  onChange={(e) => setTargetQty(Number(e.target.value) || 0)}
                  className="num mt-1 w-full rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
                />
              </label>
              <div className="flex flex-col justify-center rounded-lg bg-[#11181a] px-4 py-2">
                <span className="text-[12.5px] text-slate-400">현재 달성률</span>
                <span className="num text-[18px] font-extrabold text-blue-400">
                  {formatPercent(achievementPct, 1)}
                </span>
                <span className="num text-[11.5px] text-slate-500">
                  보유 약 {Math.round(currentShares).toLocaleString("ko-KR")} / {targetQty.toLocaleString("ko-KR")}주
                </span>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#11181a]">
              <div
                className="h-full rounded-full bg-blue-500"
                style={progressStyle(achievementPct)}
              />
            </div>
          </div>
        </section>
        <DividendPerformanceSection series={DIVIDEND_PERFORMANCE_SERIES} />
      </main>
    </div>
  );
}

function progressStyle(pct: number): { width: string } {
  const w = Math.max(0, Math.min(100, pct));
  return { width: `${w}%` };
}
