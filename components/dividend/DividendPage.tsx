"use client";

import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import TopNav from "@/components/TopNav";
import { usePortfolioSnapshots, latestOf } from "@/lib/portfolio-store";
import {
  buildMonthlyDividendsFromRows,
  DIVIDEND_PERFORMANCE_SERIES,
  type DividendHoldingRow,
} from "@/lib/mock-dividend-data";
import {
  buildDividendEstimateForHolding,
  computeConvertedAnnualDividendKRW,
  isKrwTicker,
  type DividendEstimateWarning,
} from "@/lib/dividend-estimates";
import { formatPercent } from "@/lib/format";
import type { Holding } from "@/lib/portfolio-types";
import { buildDividendHoldingGroupsFromSnapshot } from "@/lib/dividend-holdings-from-portfolio";
import { quoteDividendsPath, quoteFxPath, quoteLastPath } from "@/lib/quote-client";
import type { QuoteDividendsResponse, QuoteFxResponse, QuoteLastResponse } from "@/lib/quote-types";
import DividendSummaryCards from "./DividendSummaryCards";
import MonthlyDividendChart from "./MonthlyDividendChart";
import DividendHoldingsTable from "./DividendHoldingsTable";
import DividendPerformanceSection from "./DividendPerformanceSection";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";

type DividendMarketDataState = {
  loading: boolean;
  tickerKey: string;
  quotes: Record<string, QuoteLastResponse | undefined>;
  dividends: Record<string, QuoteDividendsResponse | undefined>;
  fx?: QuoteFxResponse;
  warnings: string[];
};

const EMPTY_MARKET_DATA: DividendMarketDataState = {
  loading: false,
  tickerKey: "",
  quotes: {},
  dividends: {},
  warnings: [],
};

async function fetchQuoteJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function dividendNoteFromWarnings(warnings: DividendEstimateWarning[]): string {
  if (warnings.some((warning) => warning.code === "quote_missing" || warning.code === "quote_sample")) {
    return "현재가 없음";
  }
  if (warnings.some((warning) => warning.code === "fx_missing" || warning.code === "fx_sample")) {
    return "환율 없음";
  }
  if (warnings.some((warning) => warning.code === "dividend_missing" || warning.code === "dividend_sample")) {
    return "배당 데이터 없음";
  }
  return "데이터 없음";
}

export default function DividendPage() {
  const theme = useResolvedTheme();
  const snapshots = usePortfolioSnapshots();
  const [afterTax, setAfterTax] = useState(true);
  const [includeTaxAdvantagedInSummary, setIncludeTaxAdvantagedInSummary] = useState(false);
  const [chartIncludesTaxable, setChartIncludesTaxable] = useState(true);
  const [chartIncludesTaxAdvantaged, setChartIncludesTaxAdvantaged] = useState(false);
  const [targetTicker, setTargetTicker] = useState("SCHD");
  const [targetQty, setTargetQty] = useState(3300);
  const [marketData, setMarketData] = useState<DividendMarketDataState>(EMPTY_MARKET_DATA);

  const latestSnapshot = useMemo(() => latestOf(snapshots), [snapshots]);
  const holdings: Holding[] = useMemo(() => latestSnapshot?.holdings ?? [], [latestSnapshot]);

  const hasSnapshotHoldings = holdings.length > 0;

  const dividendGroups = useMemo(
    () => buildDividendHoldingGroupsFromSnapshot(latestSnapshot, afterTax),
    [latestSnapshot, afterTax],
  );
  const dividendTickers = useMemo(
    () =>
      Array.from(
        new Set(
          [...dividendGroups.taxableHoldings, ...dividendGroups.taxAdvantagedHoldings]
            .map((row) => row.ticker.trim().toUpperCase())
            .filter(Boolean),
        ),
      ).sort(),
    [dividendGroups.taxAdvantagedHoldings, dividendGroups.taxableHoldings],
  );
  const dividendTickerKey = dividendTickers.join("|");

  useEffect(() => {
    if (!dividendTickerKey) {
      setMarketData(EMPTY_MARKET_DATA);
      return;
    }

    let active = true;
    const tickers = dividendTickers;
    const needsUsdKrw = tickers.some((ticker) => !isKrwTicker(ticker));
    setMarketData((current) => ({
      ...current,
      loading: true,
      tickerKey: dividendTickerKey,
      warnings: [],
    }));

    async function load() {
      const warnings: string[] = [];
      const quoteEntries = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const quote = await fetchQuoteJson<QuoteLastResponse>(quoteLastPath({ ticker }));
            return [ticker, quote] as const;
          } catch (error) {
            warnings.push(`${ticker}: 현재가 요청 실패 (${error instanceof Error ? error.message : String(error)})`);
            return [ticker, undefined] as const;
          }
        }),
      );
      const dividendEntries = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const dividends = await fetchQuoteJson<QuoteDividendsResponse>(quoteDividendsPath({ ticker, range: "1y" }));
            return [ticker, dividends] as const;
          } catch (error) {
            warnings.push(`${ticker}: 배당 요청 실패 (${error instanceof Error ? error.message : String(error)})`);
            return [ticker, undefined] as const;
          }
        }),
      );

      let fx: QuoteFxResponse | undefined;
      if (needsUsdKrw) {
        try {
          fx = await fetchQuoteJson<QuoteFxResponse>(quoteFxPath());
        } catch (error) {
          warnings.push(`USDKRW: 환율 요청 실패 (${error instanceof Error ? error.message : String(error)})`);
        }
      }

      if (!active) return;
      setMarketData({
        loading: false,
        tickerKey: dividendTickerKey,
        quotes: Object.fromEntries(quoteEntries),
        dividends: Object.fromEntries(dividendEntries),
        fx,
        warnings,
      });
    }

    void load();
    return () => {
      active = false;
    };
  }, [dividendTickerKey, dividendTickers]);

  const enrichRows = useMemo(
    () =>
      (rows: DividendHoldingRow[]): DividendHoldingRow[] =>
        rows.map((row) => {
          const ticker = row.ticker.trim().toUpperCase();
          const estimate = buildDividendEstimateForHolding(
            {
              ticker,
              valueKRW: row.valueKRW,
              principalKRW: row.principalKRW,
            },
            {
              quote: marketData.quotes[ticker],
              dividends: marketData.dividends[ticker],
              fx: marketData.fx,
            },
            { afterTax },
          );
          const annualDividendKRW = estimate.annualDividendKRW ?? 0;
          const hasDividendEstimate = annualDividendKRW > 0;

          return {
            ...row,
            quantity: estimate.estimatedQuantity ?? row.quantity,
            quantityEstimated: estimate.estimatedQuantity !== undefined,
            averageCost: estimate.estimatedAverageCost ?? row.averageCost,
            averageCostCurrency: estimate.estimatedAverageCostCurrency ?? row.averageCostCurrency,
            averageCostEstimated: estimate.estimatedAverageCost !== undefined,
            currentPrice: estimate.currentPrice ?? row.currentPrice,
            currentPriceCurrency: estimate.currentPriceCurrency ?? row.currentPriceCurrency,
            currentPriceKRW: estimate.currentPriceKRW,
            annualDividendKRW,
            expectedYieldPct: row.valueKRW > 0 ? (annualDividendKRW / row.valueKRW) * 100 : 0,
            myYieldPct: estimate.personalYieldPct ?? 0,
            myYieldBasis: estimate.personalYieldBasis,
            ttmDividendPerShare: estimate.ttmDividendPerShare,
            ttmDividendCurrency: estimate.ttmDividendCurrency,
            dividendMonths: estimate.dividendMonths,
            estimateSource: estimate.estimateSource,
            estimateWarnings: estimate.warnings,
            isEstimated: estimate.isEstimated,
            dividendDataStatus: hasDividendEstimate ? "available" : "unavailable",
            dividendDataNote: hasDividendEstimate ? undefined : dividendNoteFromWarnings(estimate.warnings),
          };
        }),
    [afterTax, marketData.dividends, marketData.fx, marketData.quotes],
  );
  const estimatedTaxableHoldings = useMemo(
    () => enrichRows(dividendGroups.taxableHoldings),
    [dividendGroups.taxableHoldings, enrichRows],
  );
  const estimatedTaxAdvantagedHoldings = useMemo(
    () => enrichRows(dividendGroups.taxAdvantagedHoldings),
    [dividendGroups.taxAdvantagedHoldings, enrichRows],
  );
  const dividendDataAvailable = useMemo(
    () => [...estimatedTaxableHoldings, ...estimatedTaxAdvantagedHoldings].some((row) => row.dividendDataStatus === "available"),
    [estimatedTaxAdvantagedHoldings, estimatedTaxableHoldings],
  );
  const summaryRows = useMemo(
    () =>
      includeTaxAdvantagedInSummary
        ? [...estimatedTaxableHoldings, ...estimatedTaxAdvantagedHoldings]
        : estimatedTaxableHoldings,
    [estimatedTaxAdvantagedHoldings, estimatedTaxableHoldings, includeTaxAdvantagedInSummary],
  );
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

  const evaluationKRW = summaryRows.reduce((s, r) => s + r.valueKRW, 0);
  const annualDividendKRW = summaryRows.reduce((s, r) => s + r.annualDividendKRW, 0);
  const monthlyAvgKRW = annualDividendKRW / 12;
  // 환산 예상 배당: 현재 선택된 범위(위탁만/절세합산)의 평가금액을 연 3.5%로 인출한다고 가정.
  const convertedAnnualDividendKRW = computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax });

  const targetRows = [...estimatedTaxableHoldings, ...estimatedTaxAdvantagedHoldings]
    .filter((row) => row.ticker.toUpperCase() === targetTicker.toUpperCase());
  const currentShares = targetRows.reduce((sum, row) => (
    Number.isFinite(row.quantity) && row.quantity && row.quantity > 0
      ? sum + row.quantity
      : sum
  ), 0);
  const hasTargetQuantity = currentShares > 0;
  const achievementPct = hasTargetQuantity && targetQty > 0 ? (currentShares / targetQty) * 100 : 0;

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
          convertedAnnualDividendKRW={convertedAnnualDividendKRW}
          achievementPct={achievementPct}
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
                  onChange={(e) => setTargetTicker(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-500 dark:border-[#2a3336] dark:bg-[#11181a] dark:text-white"
                />
              </label>
              <label className="block">
                <span className="text-[12.5px] text-slate-400">목표 수량 (주)</span>
                <input
                  type="number"
                  value={targetQty}
                  onChange={(e) => setTargetQty(Number(e.target.value) || 0)}
                  className="num mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-500 dark:border-[#2a3336] dark:bg-[#11181a] dark:text-white"
                />
              </label>
              <div className="flex flex-col justify-center rounded-lg bg-[#11181a] px-4 py-2">
                <span className="text-[12.5px] text-slate-400">현재 달성률</span>
                <span className="num text-[18px] font-extrabold text-blue-400">
                  {hasTargetQuantity ? formatPercent(achievementPct, 1) : "수량 정보 없음"}
                </span>
                <span className="num text-[11.5px] text-slate-500">
                  {hasTargetQuantity
                    ? `추정 ${currentShares.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} / ${targetQty.toLocaleString("ko-KR")}주`
                    : "평가금액 기준 추정수량이 필요합니다"}
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
