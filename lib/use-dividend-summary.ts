"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortfolioSnapshots, latestOf } from "@/lib/portfolio-store";
import type { DividendHoldingRow } from "@/lib/mock-dividend-data";
import {
  buildDividendEstimateForHolding,
  computeConvertedAnnualDividendKRW,
  computeSchdEquivalentGoalProgress,
  isKrwTicker,
  type DividendEstimateWarning,
  type SchdGoalProgress,
} from "@/lib/dividend-estimates";
import type { Holding, PortfolioSnapshot } from "@/lib/portfolio-types";
import {
  buildDividendHoldingGroupsFromSnapshot,
  type DividendHoldingGroupResult,
} from "@/lib/dividend-holdings-from-portfolio";
import { quoteDividendsPath, quoteFxPath, quoteLastPath } from "@/lib/quote-client";
import type {
  QuoteDividendsResponse,
  QuoteFxResponse,
  QuoteLastResponse,
} from "@/lib/quote-types";

// 배당 요약 계산은 배당현황 페이지와 투자현황 카드가 완전히 동일한 값을 쓰도록
// 이 훅 하나에서만 수행한다(중복 계산·별도 계산식 금지). 배당현황 페이지와 투자현황
// 카드는 이 훅을 호출해 같은 데이터 소스/같은 공식으로 계산된 결과만 표시한다.

export type DividendMarketDataState = {
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

// 배당현황 페이지 기본 상태(세후 · 위탁만 · 목표 SCHD 3300주)와 동일한 기준값.
// 투자현황 카드는 이 기본값으로 훅을 호출해 두 화면의 숫자가 항상 일치하도록 한다.
export const DEFAULT_DIVIDEND_SUMMARY_OPTIONS = {
  afterTax: true,
  includeTaxAdvantaged: false,
  targetTicker: "SCHD",
  targetQty: 3300,
} as const;

export type DividendSummaryOptions = {
  afterTax?: boolean;
  includeTaxAdvantaged?: boolean;
  targetTicker?: string;
  targetQty?: number;
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

function computeActualTargetShares(
  rows: DividendHoldingRow[],
  targetPriceKRW?: number,
): { shares: number; estimated: boolean } {
  let shares = 0;
  let estimated = false;
  for (const row of rows) {
    if (Number.isFinite(row.quantity) && row.quantity && row.quantity > 0) {
      shares += row.quantity;
      if (row.quantityEstimated) estimated = true;
      continue;
    }
    if (targetPriceKRW && targetPriceKRW > 0 && row.valueKRW > 0) {
      shares += row.valueKRW / targetPriceKRW;
      estimated = true;
    }
  }
  return { shares, estimated };
}

export type DividendSummaryResult = {
  loading: boolean;
  warnings: string[];
  snapshots: PortfolioSnapshot[];
  latestSnapshot: PortfolioSnapshot | null;
  hasSnapshotHoldings: boolean;
  dividendGroups: DividendHoldingGroupResult;
  dividendTickers: string[];
  estimatedTaxableHoldings: DividendHoldingRow[];
  estimatedTaxAdvantagedHoldings: DividendHoldingRow[];
  summaryRows: DividendHoldingRow[];
  evaluationKRW: number;
  annualDividendKRW: number;
  monthlyAvgKRW: number;
  convertedAnnualDividendKRW: number;
  convertedMonthlyDividendKRW: number;
  dividendDataAvailable: boolean;
  goalProgress: SchdGoalProgress;
  achievementPct: number;
  goalProgressLabel: string;
  actualTargetShares: { shares: number; estimated: boolean };
  marketData: DividendMarketDataState;
  targetPriceKRW?: number;
};

// 배당현황 페이지와 투자현황 카드가 공유하는 단일 배당 요약 계산 훅.
export function useDividendSummary(options: DividendSummaryOptions = {}): DividendSummaryResult {
  const afterTax = options.afterTax ?? DEFAULT_DIVIDEND_SUMMARY_OPTIONS.afterTax;
  const includeTaxAdvantaged =
    options.includeTaxAdvantaged ?? DEFAULT_DIVIDEND_SUMMARY_OPTIONS.includeTaxAdvantaged;
  const targetTicker = options.targetTicker ?? DEFAULT_DIVIDEND_SUMMARY_OPTIONS.targetTicker;
  const targetQty = options.targetQty ?? DEFAULT_DIVIDEND_SUMMARY_OPTIONS.targetQty;

  const snapshots = usePortfolioSnapshots();
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
  const targetTickerNormalized = targetTicker.trim().toUpperCase();
  const marketTickers = useMemo(
    () => Array.from(new Set([...dividendTickers, targetTickerNormalized].filter(Boolean))).sort(),
    [dividendTickers, targetTickerNormalized],
  );
  const marketTickerKey = marketTickers.join("|");

  useEffect(() => {
    if (!marketTickerKey) {
      setMarketData(EMPTY_MARKET_DATA);
      return;
    }

    let active = true;
    const tickers = marketTickers;
    const needsUsdKrw = tickers.some((ticker) => !isKrwTicker(ticker));
    setMarketData((current) => ({
      ...current,
      loading: true,
      tickerKey: marketTickerKey,
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
        tickerKey: marketTickerKey,
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
  }, [marketTickerKey, marketTickers]);

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
    () =>
      [...estimatedTaxableHoldings, ...estimatedTaxAdvantagedHoldings].some(
        (row) => row.dividendDataStatus === "available",
      ),
    [estimatedTaxAdvantagedHoldings, estimatedTaxableHoldings],
  );

  const summaryRows = useMemo(
    () =>
      includeTaxAdvantaged
        ? [...estimatedTaxableHoldings, ...estimatedTaxAdvantagedHoldings]
        : estimatedTaxableHoldings,
    [estimatedTaxAdvantagedHoldings, estimatedTaxableHoldings, includeTaxAdvantaged],
  );

  const evaluationKRW = summaryRows.reduce((s, r) => s + r.valueKRW, 0);
  const ttmAnnualDividendKRW = summaryRows.reduce((s, r) => s + r.annualDividendKRW, 0);
  const convertedAnnualDividendKRW = computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax });
  const annualDividendKRW = ttmAnnualDividendKRW;
  const monthlyAvgKRW = annualDividendKRW / 12;
  const convertedMonthlyDividendKRW = convertedAnnualDividendKRW / 12;

  const targetRows = [...estimatedTaxableHoldings, ...estimatedTaxAdvantagedHoldings].filter(
    (row) => row.ticker.trim().toUpperCase() === targetTickerNormalized,
  );
  const targetQuote = marketData.quotes[targetTickerNormalized];
  const targetCurrency = isKrwTicker(targetQuote?.normalizedTicker ?? targetTicker) ? "KRW" : "USD";
  const targetPriceKRW =
    targetQuote?.source !== "sample" && targetQuote?.price && targetQuote.price > 0
      ? targetCurrency === "KRW"
        ? targetQuote.price
        : marketData.fx?.source !== "sample" && marketData.fx?.rate && marketData.fx.rate > 0
          ? targetQuote.price * marketData.fx.rate
          : undefined
      : undefined;
  const actualTargetShares = computeActualTargetShares(targetRows, targetPriceKRW);
  const goalProgress = computeSchdEquivalentGoalProgress({
    targetTicker,
    targetQty,
    evaluationKRW,
    targetPriceKRW,
    actualShares: actualTargetShares.shares,
  });
  const achievementPct = goalProgress.achievementPct ?? 0;
  const actualSharesLabel = actualTargetShares.estimated
    ? `실보유 추정 ${goalProgress.actualShares.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}주`
    : `실보유 ${goalProgress.actualShares.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}주`;
  const goalProgressLabel = goalProgress.calculable
    ? `SCHD 환산 ${goalProgress.equivalentShares?.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}주 · ${actualSharesLabel} / 목표 ${targetQty.toLocaleString("ko-KR")}주`
    : (goalProgress.error ?? "계산 불가");

  return {
    loading: marketData.loading,
    warnings: marketData.warnings,
    snapshots,
    latestSnapshot,
    hasSnapshotHoldings,
    dividendGroups,
    dividendTickers,
    estimatedTaxableHoldings,
    estimatedTaxAdvantagedHoldings,
    summaryRows,
    evaluationKRW,
    annualDividendKRW,
    monthlyAvgKRW,
    convertedAnnualDividendKRW,
    convertedMonthlyDividendKRW,
    dividendDataAvailable,
    goalProgress,
    achievementPct,
    goalProgressLabel,
    actualTargetShares,
    marketData,
    targetPriceKRW,
  };
}
