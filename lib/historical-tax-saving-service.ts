import {
  DEFAULT_HISTORICAL_TAX_EFFECT_RATE,
  DEFAULT_HISTORICAL_TAX_RETENTION_RATE,
  DEFAULT_HISTORICAL_TAX_SAVING_INVESTMENT_USD,
  calculateHistoricalTaxSavingMetric,
  type HistoricalDividendPoint,
  type HistoricalPriceBar,
} from "@/lib/historical-tax-saving-calculator";
import { fetchQuoteDividends, fetchQuoteHistory } from "@/lib/calculator-data-provider";
import type { QuoteDividendsResponse, QuoteHistoryResponse } from "@/lib/quote-types";

export type HistoricalTaxSavingMetricLoadResult = {
  ticker: string;
  canCalculate: boolean;
  taxSavingUsd: number;
  avgProfitPct: number;
  totalCount: number;
  successCount: number;
  failureCount: number;
  dividendCount: number;
  priceBarCount: number;
  source: "quote-api" | "injected";
  warnings: string[];
  calculatedAt: string;
};

export type HistoricalTaxSavingDividendsFetcher = typeof fetchQuoteDividends;
export type HistoricalTaxSavingHistoryFetcher = typeof fetchQuoteHistory;

export type HistoricalTaxSavingMetricLoadOptions = {
  lookbackRange?: "5y";
  fetchDividends?: HistoricalTaxSavingDividendsFetcher;
  fetchHistory?: HistoricalTaxSavingHistoryFetcher;
};

const DEFAULT_LOOKBACK_RANGE = "5y";

function emptyLoadResult(input: {
  ticker: string;
  source: HistoricalTaxSavingMetricLoadResult["source"];
  warnings: string[];
  calculatedAt?: string;
}): HistoricalTaxSavingMetricLoadResult {
  return {
    ticker: input.ticker,
    canCalculate: false,
    taxSavingUsd: 0,
    avgProfitPct: 0,
    totalCount: 0,
    successCount: 0,
    failureCount: 0,
    dividendCount: 0,
    priceBarCount: 0,
    source: input.source,
    warnings: input.warnings,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
  };
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const isoDate = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;

  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === isoDate ? isoDate : null;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function mapQuoteDividendsToHistoricalPoints(
  dividends: QuoteDividendsResponse["dividends"],
  warnings: string[],
): HistoricalDividendPoint[] {
  const points: HistoricalDividendPoint[] = [];

  dividends.forEach((dividend, index) => {
    const date = normalizeIsoDate(dividend.date);
    const amount = Number(dividend.amount);

    if (!date) {
      warnings.push(`Dropped dividend row ${index + 1}: missing or invalid date.`);
      return;
    }

    if (!isPositiveFinite(amount)) {
      warnings.push(`Dropped dividend row ${index + 1} (${date}): amount must be positive.`);
      return;
    }

    points.push({ date, amount });
  });

  return points;
}

function mapQuoteHistoryToHistoricalPriceBars(
  prices: QuoteHistoryResponse["prices"],
  warnings: string[],
): HistoricalPriceBar[] {
  const bars: HistoricalPriceBar[] = [];

  prices.forEach((price, index) => {
    const date = normalizeIsoDate(price.date);
    const close = Number(price.close);
    const high = price.high == null ? Number.NaN : Number(price.high);

    if (!date) {
      warnings.push(`Dropped price row ${index + 1}: missing or invalid date.`);
      return;
    }

    if (!isPositiveFinite(close) || !isPositiveFinite(high)) {
      warnings.push(`Dropped price row ${index + 1} (${date}): close and high must be positive.`);
      return;
    }

    bars.push({ date, close, high });
  });

  return bars;
}

export async function loadHistoricalTaxSavingMetricForTicker(
  ticker: string,
  options: HistoricalTaxSavingMetricLoadOptions = {},
): Promise<HistoricalTaxSavingMetricLoadResult> {
  const source: HistoricalTaxSavingMetricLoadResult["source"] =
    options.fetchDividends || options.fetchHistory ? "injected" : "quote-api";
  const calculatedAt = new Date().toISOString();
  const normalizedTicker = normalizeTicker(ticker);

  if (!normalizedTicker) {
    return emptyLoadResult({
      ticker: "",
      source,
      calculatedAt,
      warnings: ["Ticker is required for historical tax-saving calculation."],
    });
  }

  const lookbackRange = options.lookbackRange ?? DEFAULT_LOOKBACK_RANGE;
  const dividendFetcher = options.fetchDividends ?? fetchQuoteDividends;
  const historyFetcher = options.fetchHistory ?? fetchQuoteHistory;
  const warnings: string[] = [];

  const [dividendsResult, historyResult] = await Promise.allSettled([
    dividendFetcher({ ticker: normalizedTicker, range: lookbackRange }),
    historyFetcher({ ticker: normalizedTicker, range: lookbackRange }),
  ]);

  const dividendResponse =
    dividendsResult.status === "fulfilled"
      ? dividendsResult.value
      : null;
  const historyResponse =
    historyResult.status === "fulfilled"
      ? historyResult.value
      : null;

  if (!dividendResponse) {
    warnings.push(
      `Dividend history request failed for ${normalizedTicker}: ${
        dividendsResult.status === "rejected" && dividendsResult.reason instanceof Error
          ? dividendsResult.reason.message
          : dividendsResult.status === "rejected"
            ? String(dividendsResult.reason)
            : "unknown error"
      }`,
    );
  }

  if (!historyResponse) {
    warnings.push(
      `Price history request failed for ${normalizedTicker}: ${
        historyResult.status === "rejected" && historyResult.reason instanceof Error
          ? historyResult.reason.message
          : historyResult.status === "rejected"
            ? String(historyResult.reason)
            : "unknown error"
      }`,
    );
  }

  if (dividendResponse) {
    warnings.push(...dividendResponse.warnings.map((warning) => `${dividendResponse.normalizedTicker} dividends: ${warning}`));
  }

  if (historyResponse) {
    warnings.push(...historyResponse.warnings.map((warning) => `${historyResponse.normalizedTicker} history: ${warning}`));
  }

  const dividends = mapQuoteDividendsToHistoricalPoints(dividendResponse?.dividends ?? [], warnings);
  const prices = mapQuoteHistoryToHistoricalPriceBars(historyResponse?.prices ?? [], warnings);

  const metric = calculateHistoricalTaxSavingMetric({
    dividends,
    prices,
    investmentAmountUsd: DEFAULT_HISTORICAL_TAX_SAVING_INVESTMENT_USD,
    taxRetentionRate: DEFAULT_HISTORICAL_TAX_RETENTION_RATE,
    taxEffectRate: DEFAULT_HISTORICAL_TAX_EFFECT_RATE,
  });

  return {
    ticker: normalizedTicker,
    canCalculate: metric.canCalculate,
    taxSavingUsd: metric.taxSavingUsd,
    avgProfitPct: metric.avgProfitPct,
    totalCount: metric.totalCount,
    successCount: metric.successCount,
    failureCount: metric.failureCount,
    dividendCount: dividends.length,
    priceBarCount: prices.length,
    source,
    warnings: [...warnings, ...metric.warnings],
    calculatedAt,
  };
}
