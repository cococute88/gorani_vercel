"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Target } from "lucide-react";
import TopNav from "@/components/TopNav";
import { buildMonthlyDividendsFromRows } from "@/lib/mock-dividend-data";
import { formatPercent } from "@/lib/format";
import { quoteHistoryPath } from "@/lib/quote-client";
import type { QuoteHistoryResponse } from "@/lib/quote-types";
import { useDividendSummary } from "@/lib/use-dividend-summary";
import { useDividendGoal, setDividendGoal } from "@/lib/dividend-goal-store";
import DividendSummaryCards from "./DividendSummaryCards";
import MonthlyDividendChart from "./MonthlyDividendChart";
import DividendHoldingsTable from "./DividendHoldingsTable";
import DividendPerformanceSection from "./DividendPerformanceSection";
import DividendAccountPerformanceSection from "./DividendAccountPerformanceSection";
import SchdAttractivenessSection from "./SchdAttractivenessSection";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { buildDividendPerformanceBackcast, type BackcastPricePoint } from "@/lib/dividend-performance-from-snapshots";
import { DEFAULT_PERFORMANCE_MONTHS } from "@/lib/performance-period";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";

async function fetchQuoteJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

const dividendTabs = [
  { key: "overview", label: "배당현황" },
  { key: "schd-attractiveness", label: "SCHD 매력도" },
] as const;

type DividendTabKey = (typeof dividendTabs)[number]["key"];

export default function DividendPage() {
  const theme = useResolvedTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: DividendTabKey = tabParam === "schd-attractiveness" ? "schd-attractiveness" : "overview";
  const [afterTax, setAfterTax] = useState(true);
  // 성과분석 그래프(위탁/절세/전체합산)가 공유하는 표시 기간. 세 그래프가 항상 같은 구간을 유지한다.
  const [performanceMonths, setPerformanceMonths] = useState<number>(DEFAULT_PERFORMANCE_MONTHS);
  const [includeTaxAdvantagedInSummary, setIncludeTaxAdvantagedInSummary] = useState(false);
  const [chartIncludesTaxable, setChartIncludesTaxable] = useState(true);
  const [chartIncludesTaxAdvantaged, setChartIncludesTaxAdvantaged] = useState(false);
  // 목표 티커·목표 주수는 투자현황 카드와 공유하는 단일 소스에서 읽고/쓴다.
  const goal = useDividendGoal();
  const targetTicker = goal.ticker;
  const targetQty = goal.qty;
  const [performanceHistories, setPerformanceHistories] = useState<{ prices: Record<string, BackcastPricePoint[]>; schd: BackcastPricePoint[] | null; sp500: BackcastPricePoint[] | null; fx: BackcastPricePoint[] | null }>({ prices: {}, schd: null, sp500: null, fx: null });

  // 배당 요약(평가금액·예상배당·목표달성률 등)은 투자현황 카드와 동일한 단일 훅에서 계산한다.
  const summary = useDividendSummary({
    afterTax,
    includeTaxAdvantaged: includeTaxAdvantagedInSummary,
    targetTicker,
    targetQty,
  });
  const {
    snapshots,
    latestSnapshot,
    hasSnapshotHoldings,
    dividendGroups,
    dividendTickers,
    estimatedTaxableHoldings,
    estimatedTaxAdvantagedHoldings,
    evaluationKRW,
    annualDividendKRW,
    monthlyAvgKRW,
    convertedAnnualDividendKRW,
    dividendDataAvailable,
    goalProgress,
    achievementPct,
    goalProgressLabel,
    marketData,
  } = summary;

  function toBackcastSeries(response: QuoteHistoryResponse | undefined): BackcastPricePoint[] | null {
    if (!response || response.source === "sample") return null;
    const points = response.prices.filter((price) => Number.isFinite(price.close) && price.close > 0).map((price) => ({ date: price.date, close: price.close }));
    return points.length > 0 ? points : null;
  }

  useEffect(() => {
    const tickers = dividendTickers;
    if (tickers.length === 0) {
      setPerformanceHistories({ prices: {}, schd: null, sp500: null, fx: null });
      return;
    }
    let active = true;
    async function loadPerformanceHistories() {
      async function fetchHistory(ticker: string): Promise<QuoteHistoryResponse | undefined> {
        try {
          return await fetchQuoteJson<QuoteHistoryResponse>(quoteHistoryPath({ ticker, range: "3y" }));
        } catch {
          return undefined;
        }
      }
      const entries = await Promise.all(tickers.map(async (ticker) => [ticker, toBackcastSeries(await fetchHistory(ticker)) ?? []] as const));
      // 비교 대상을 SCHD 로 통일한다(기존 ^KS11/KOSPI 제거). SCHD 는 USD 라 환율(KRW=X)로 KRW 환산한다.
      const [schd, sp500, fx] = await Promise.all([fetchHistory("SCHD"), fetchHistory("SPY"), fetchHistory("KRW=X")]);
      if (!active) return;
      setPerformanceHistories({
        prices: Object.fromEntries(entries),
        schd: toBackcastSeries(schd),
        sp500: toBackcastSeries(sp500),
        fx: toBackcastSeries(fx),
      });
    }
    void loadPerformanceHistories();
    return () => { active = false; };
  }, [dividendTickers]);

  const chartRows = useMemo(
    () => [
      ...(chartIncludesTaxable ? estimatedTaxableHoldings : []),
      ...(chartIncludesTaxAdvantaged ? estimatedTaxAdvantagedHoldings : []),
    ],
    [
      chartIncludesTaxAdvantaged,
      chartIncludesTaxable,
      estimatedTaxAdvantagedHoldings,
      estimatedTaxableHoldings,
    ],
  );
  const monthlyComposition = useMemo(() => buildMonthlyDividendsFromRows(chartRows), [chartRows]);

  const accountBackcastHoldings = useMemo(() => ({
    위탁: estimatedTaxableHoldings,
    절세: estimatedTaxAdvantagedHoldings,
  }), [estimatedTaxableHoldings, estimatedTaxAdvantagedHoldings]);

  const dividendPerformance = useMemo(() => buildDividendPerformanceBackcast({
    holdings: [...estimatedTaxableHoldings, ...estimatedTaxAdvantagedHoldings],
    priceHistories: performanceHistories.prices,
    benchmarkHistories: { schd: performanceHistories.schd, sp500: performanceHistories.sp500 },
    fxHistory: performanceHistories.fx,
    latestDate: latestSnapshot?.snapshotDate,
    months: 24,
  }), [estimatedTaxAdvantagedHoldings, estimatedTaxableHoldings, latestSnapshot?.snapshotDate, performanceHistories]);

  function setChartTaxable(checked: boolean) {
    if (!checked && !chartIncludesTaxAdvantaged) return;
    setChartIncludesTaxable(checked);
  }

  function setChartTaxAdvantaged(checked: boolean) {
    if (!checked && !chartIncludesTaxable) return;
    setChartIncludesTaxAdvantaged(checked);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-extrabold text-slate-900 dark:text-white">배당</h1>
          {activeTab === "overview" && !hasSnapshotHoldings && (
            <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-[12px] text-amber-400">
              등록된 스냅샷이 없어 보유 배당 그룹이 비어 있습니다
            </span>
          )}
        </div>

        <div className="no-scrollbar my-5 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#273032] dark:bg-[#171d1e] sm:gap-2 sm:p-2">
          {dividendTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => router.push(`/dividends?tab=${tab.key}`)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[12.5px] font-bold transition-colors sm:px-4 sm:text-[13px] ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "schd-attractiveness" ? (
          <SchdAttractivenessSection />
        ) : (
          <>
        <DividendSummaryCards
          evaluationKRW={evaluationKRW}
          annualDividendKRW={annualDividendKRW}
          monthlyAvgKRW={monthlyAvgKRW}
          convertedAnnualDividendKRW={convertedAnnualDividendKRW}
          achievementPct={goalProgress.achievementPct}
          goalProgressLabel={goalProgressLabel}
          goalProgressCalculable={goalProgress.calculable}
          afterTax={afterTax}
          includeTaxAdvantaged={includeTaxAdvantagedInSummary}
          dividendDataAvailable={dividendDataAvailable}
          onToggleTax={setAfterTax}
          onToggleGroup={setIncludeTaxAdvantagedInSummary}
        />
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12.5px] text-slate-600 dark:border-[#2a3336] dark:bg-white/[0.03] dark:text-slate-400">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            수량은 평가금액과 현재가로 역산한 추정치입니다.
          </div>
          <div className="mt-1 leading-relaxed">
            배당은 최근 12개월 실제 배당 이력 기준입니다. 배당 이력이 없거나 quote/fx 조회가 실패한 종목은 예상 배당을 계산하지 않습니다.
            {marketData.loading ? " 현재가·배당 데이터를 불러오는 중입니다." : ""}
          </div>
          {marketData.warnings.length > 0 && (
            <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-500">
              {marketData.warnings.slice(0, 3).join(" · ")}
              {marketData.warnings.length > 3 ? ` 외 ${marketData.warnings.length - 3}건` : ""}
            </div>
          )}
        </div>

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
          rows={estimatedTaxableHoldings}
          totalKRW={dividendGroups.taxableTotalKRW}
          loading={marketData.loading}
        />
        <DividendHoldingsTable
          title="보유 배당(절세)"
          rows={estimatedTaxAdvantagedHoldings}
          totalKRW={dividendGroups.taxAdvantagedTotalKRW}
          loading={marketData.loading}
        />

        {/* 목표 설정 카드 */}
        <section className="mb-6">
          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <Target size={16} className="text-blue-400" />
              <h2 className="text-[15px] font-bold text-slate-700 dark:text-slate-300">배당 목표 설정</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-[12.5px] text-slate-400">목표 티커</span>
                <input
                  value={targetTicker}
                  onChange={(e) => setDividendGoal({ ticker: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-500 dark:border-[#2a3336] dark:bg-[#11181a] dark:text-white"
                />
              </label>
              <label className="block">
                <span className="text-[12.5px] text-slate-400">목표 수량 (주)</span>
                <input
                  type="number"
                  value={targetQty}
                  onChange={(e) => setDividendGoal({ qty: Number(e.target.value) || 0 })}
                  className="num mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-500 dark:border-[#2a3336] dark:bg-[#11181a] dark:text-white"
                />
              </label>
              <div className="flex flex-col justify-center rounded-lg bg-[#11181a] px-4 py-2">
                <span className="text-[12.5px] text-slate-400">현재 달성률</span>
                <span className="num text-[18px] font-extrabold text-blue-400">
                  {goalProgress.calculable ? formatPercent(achievementPct, 1) : "계산 불가"}
                </span>
                <span className="num text-[11.5px] text-slate-500">
                  {goalProgressLabel}
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
        <DividendAccountPerformanceSection
          snapshots={snapshots}
          latestBackcastHoldings={accountBackcastHoldings}
          periodMonths={performanceMonths}
          onPeriodMonthsChange={setPerformanceMonths}
        />
        <DividendPerformanceSection
          result={dividendPerformance}
          periodMonths={performanceMonths}
          onPeriodMonthsChange={setPerformanceMonths}
        />
          </>
        )}
      </main>
    </div>
  );
}

function progressStyle(pct: number): { width: string } {
  const w = Math.max(0, Math.min(100, pct));
  return { width: `${w}%` };
}
