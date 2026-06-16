import type {
  DividendCaptureDividendPoint,
  DividendCaptureInput,
  DividendCapturePricePoint,
  DividendCaptureResult,
  DividendCaptureRow,
  OhlcPoint,
} from "@/lib/calculator-types";
import { getTickerDividends, getTickerOhlcHistory } from "@/lib/calculator-data-provider";
import type { QuoteSource } from "@/lib/quote-types";

type DividendCaptureHistoryInput = {
  prices?: DividendCapturePricePoint[];
  dividends?: DividendCaptureDividendPoint[];
};

type DividendCaptureCalculationMeta = {
  source?: QuoteSource;
  warnings?: string[];
  updatedAt?: string;
};

type NormalizedDividend = {
  exDate: string;
  amount: number;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function buyPriceFor(history: OhlcPoint[], index: number, buyType: DividendCaptureInput["buyType"]) {
  const offset = buyType.startsWith("D-2") ? 2 : 1;
  const source = history[Math.max(0, index - offset)];
  return buyType.endsWith("시가") ? source.open : source.close;
}

export const defaultDividendCaptureInput: DividendCaptureInput = {
  ticker: "ARCC",
  investmentAmount: 10_000,
  buyType: "D-1 종가",
  sellWindow: 0,
  taxRate: 15,
  recent5yOnly: false,
  dividendPerShare: 0.48,
  commissionRate: 0,
  slippageRate: 0,
  analysisMonths: 36,
  referenceBuyPrice: 20.5,
  referenceExOpenPrice: 20.05,
};

export function resolveDividendCaptureDates(input: DividendCaptureInput) {
  const end = new Date().toISOString().slice(0, 10);
  const start = input.recent5yOnly ? addDays(end, -365 * 5) : "1900-01-01";
  return { start, end };
}

function normalizePrices(points: DividendCapturePricePoint[]) {
  const byDate = new Map<string, OhlcPoint>();
  let dropped = 0;
  let repaired = 0;

  for (const point of points) {
    if (!point?.date || !isValidDate(point.date) || !isPositiveNumber(point.close)) {
      dropped += 1;
      continue;
    }

    const open = isPositiveNumber(point.open) ? point.open : point.close;
    const rawHigh = isPositiveNumber(point.high) ? point.high : Math.max(open, point.close);
    const rawLow = isPositiveNumber(point.low) ? point.low : Math.min(open, point.close);
    const high = Math.max(rawHigh, open, point.close);
    const low = Math.min(rawLow, open, point.close);
    if (!isPositiveNumber(point.open) || !isPositiveNumber(point.high) || !isPositiveNumber(point.low)) repaired += 1;

    byDate.set(point.date, { date: point.date, open, high, low, close: point.close });
  }

  const prices = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const warnings: string[] = [];
  const duplicateOrInvalid = points.length - prices.length;
  if (dropped > 0 || duplicateOrInvalid > 0) warnings.push(`${Math.max(dropped, duplicateOrInvalid)} invalid or duplicate price point(s) were excluded before dividend capture calculation.`);
  if (repaired > 0) warnings.push(`${repaired} price point(s) had missing open/high/low values repaired from close prices.`);

  return { prices, warnings };
}

function normalizeDividends(points: DividendCaptureDividendPoint[]) {
  const byDate = new Map<string, NormalizedDividend>();
  let dropped = 0;

  for (const point of points) {
    if (!point?.date || !isValidDate(point.date) || !isPositiveNumber(point.amount)) {
      dropped += 1;
      continue;
    }
    byDate.set(point.date, { exDate: point.date, amount: point.amount });
  }

  const dividends = Array.from(byDate.values()).sort((a, b) => a.exDate.localeCompare(b.exDate));
  const warnings: string[] = [];
  const duplicateOrInvalid = points.length - dividends.length;
  if (dropped > 0 || duplicateOrInvalid > 0) warnings.push(`${Math.max(dropped, duplicateOrInvalid)} invalid or duplicate dividend event(s) were excluded before dividend capture calculation.`);

  return { dividends, warnings };
}

function buildSampleHistory(input: DividendCaptureInput, start: string, end: string): Required<DividendCaptureHistoryInput> {
  return {
    prices: getTickerOhlcHistory(input.ticker, start, end, input.referenceBuyPrice),
    dividends: getTickerDividends(input.ticker, start, end, input.dividendPerShare).map((point) => ({ date: point.exDate, amount: point.amount })),
  };
}

function emptyDividendCaptureResult(
  input: DividendCaptureInput,
  source: QuoteSource,
  warnings: string[],
  usedStartDate: string,
  usedEndDate: string,
  updatedAt?: string,
): DividendCaptureResult {
  const taxMultiplier = Math.max(0, 1 - input.taxRate / 100);
  const totalCostRate = Math.max(0, input.commissionRate + input.slippageRate) / 100;
  const shares = Math.max(0, Math.floor(input.investmentAmount / Math.max(input.referenceBuyPrice, 0.01)));

  return {
    rows: [],
    source,
    warnings,
    updatedAt,
    usedStartDate,
    usedEndDate,
    successRate: 0,
    totalNetProfit: 0,
    averageProfitPct: 0,
    averageRecoveryDays: 0,
    successAverageReturnPct: 0,
    failureAverageLossPct: 0,
    rewardRiskRatio: null,
    expectedReturnPct: 0,
    taxSavingPerTrade: 0,
    breakevenPrice: round(input.referenceBuyPrice - input.dividendPerShare * taxMultiplier + input.referenceBuyPrice * totalCostRate * 2, 4),
    shares,
    netDividend: round(shares * input.dividendPerShare * taxMultiplier),
    expectedDrop: round(Math.max(0, input.referenceBuyPrice - input.referenceExOpenPrice)),
    warning: warnings.join(" "),
  };
}

export function simulateDividendCaptureFromHistory(
  input: DividendCaptureInput,
  history: Required<DividendCaptureHistoryInput>,
  meta: DividendCaptureCalculationMeta = {},
): DividendCaptureResult {
  const source = meta.source ?? "sample";
  const warnings = [...(meta.warnings ?? [])];
  const normalizedPrices = normalizePrices(history.prices);
  const normalizedDividends = normalizeDividends(history.dividends);
  warnings.push(...normalizedPrices.warnings, ...normalizedDividends.warnings);

  const prices = normalizedPrices.prices;
  const dividends = normalizedDividends.dividends;
  const usedStartDate = prices[0]?.date ?? resolveDividendCaptureDates(input).start;
  const usedEndDate = prices.at(-1)?.date ?? resolveDividendCaptureDates(input).end;

  if (prices.length < 3) {
    warnings.push("At least three valid price rows are required for D-1/D-2 dividend capture calculation.");
    return emptyDividendCaptureResult(input, source, warnings, usedStartDate, usedEndDate, meta.updatedAt);
  }

  if (dividends.length === 0) {
    warnings.push("No valid dividend events were available for dividend capture calculation.");
    return emptyDividendCaptureResult(input, source, warnings, usedStartDate, usedEndDate, meta.updatedAt);
  }

  const dateToIndex = new Map(prices.map((point, index) => [point.date, index]));
  const taxMultiplier = Math.max(0, 1 - input.taxRate / 100);
  const totalCostRate = Math.max(0, input.commissionRate + input.slippageRate) / 100;

  let skippedForInsufficientRows = 0;

  const rows = dividends.flatMap<DividendCaptureRow>((dividend) => {
    let index = dateToIndex.get(dividend.exDate);
    if (index === undefined) {
      index = prices.findIndex((point) => point.date >= dividend.exDate);
    }
    if (index < 2 || index < 0 || index + input.sellWindow >= prices.length) {
      skippedForInsufficientRows += 1;
      return [];
    }

    const buyPrice = buyPriceFor(prices, index, input.buyType);
    const shares = Math.max(0, Math.floor(input.investmentAmount / Math.max(buyPrice, 0.01)));
    const afterTaxDividend = dividend.amount * taxMultiplier;
    const roundTripCostPerShare = buyPrice * totalCostRate * 2;
    const breakevenPrice = buyPrice - afterTaxDividend + roundTripCostPerShare;
    const windowData = prices.slice(index, index + input.sellWindow + 1);
    const maxHigh = Math.max(...windowData.map((point) => point.high));
    const isSuccess = maxHigh >= breakevenPrice;
    const sellPrice = windowData.at(-1)?.close ?? prices[index].close;
    const futureRecovery = prices.slice(index).find((point) => point.high >= breakevenPrice);
    const recoveryDate = isSuccess ? undefined : futureRecovery?.date;
    const grossDividend = shares * dividend.amount;
    const netDividend = shares * afterTaxDividend;
    const costs = shares * buyPrice * totalCostRate * 2;
    const pricePnL = (sellPrice - buyPrice) * shares;
    const streamlitProfitPct = isSuccess
      ? (afterTaxDividend / buyPrice) * 100
      : ((sellPrice + afterTaxDividend - buyPrice) / buyPrice) * 100;
    const totalPnL = (streamlitProfitPct / 100) * shares * buyPrice - costs;
    const recoveryTradingDays = recoveryDate ? Math.max(0, prices.findIndex((point) => point.date === recoveryDate) - index) : null;

    return [{
      round: `${dividend.exDate.slice(2, 4)}.${dividend.exDate.slice(5, 7)}`,
      exDate: dividend.exDate,
      buyPrice: round(buyPrice),
      afterTaxDividend: round(afterTaxDividend, 4),
      breakevenPrice: round(breakevenPrice, 4),
      maxHigh: round(maxHigh),
      sellPrice: round(sellPrice),
      shares,
      grossDividend: round(grossDividend),
      netDividend: round(netDividend),
      pricePnL: round(pricePnL),
      totalPnL: round(totalPnL),
      profitPct: round(streamlitProfitPct - totalCostRate * 100 * 2, 2),
      result: isSuccess ? "성공" : "실패",
      recoveryDate: isSuccess ? "-" : recoveryDate ?? "회복불가",
      recoveryDays: recoveryTradingDays ?? 0,
      recoveryTradingDays: isSuccess ? "-" : recoveryTradingDays === null ? "회복불가" : `${recoveryTradingDays}거래일`,
      recoveryCalendarDays: isSuccess ? "-" : recoveryDate ? `${daysBetween(dividend.exDate, recoveryDate)}일` : "회복불가",
      note: isSuccess ? "매도허용기간 안에 손익분기점을 회복" : "허용기간 내 손익분기점 미회복",
    }];
  });

  if (skippedForInsufficientRows > 0) {
    warnings.push(`${skippedForInsufficientRows} dividend event(s) were skipped because matching D-1/D-2 price rows or sell-window rows were unavailable.`);
  }

  if (rows.length === 0) {
    warnings.push("No dividend capture rounds could be calculated after price/dividend date matching.");
    return emptyDividendCaptureResult(input, source, warnings, usedStartDate, usedEndDate, meta.updatedAt);
  }

  const successRows = rows.filter((row) => row.result === "성공");
  const failureRows = rows.filter((row) => row.result === "실패");
  const successAverageReturnPct = successRows.length ? round(successRows.reduce((sum, row) => sum + row.profitPct, 0) / successRows.length, 2) : 0;
  const failureAverageLossPct = failureRows.length ? round(failureRows.reduce((sum, row) => sum + row.profitPct, 0) / failureRows.length, 2) : 0;
  const rewardRiskRatio = failureRows.length && failureAverageLossPct !== 0 ? round(Math.abs(successAverageReturnPct / failureAverageLossPct), 2) : null;
  const expectedReturnPct = rows.length ? round(rows.reduce((sum, row) => sum + row.profitPct, 0) / rows.length, 2) : 0;
  const taxSavingPerTrade = round((successAverageReturnPct / 100) * input.investmentAmount * 0.22, 2);
  const numericRecoveryDays = rows.map((row) => Number.parseFloat(row.recoveryTradingDays)).filter(Number.isFinite);
  const firstBuyPrice = rows.at(-1)?.buyPrice ?? input.referenceBuyPrice;
  const firstShares = Math.max(0, Math.floor(input.investmentAmount / Math.max(firstBuyPrice, 0.01)));
  const latestDividendPerShare = rows.at(-1)?.afterTaxDividend ?? input.dividendPerShare * taxMultiplier;
  const netDividend = firstShares * latestDividendPerShare;

  if (source === "sample" && !warnings.some((warning) => warning.toLowerCase().includes("sample"))) {
    warnings.push("Sample fallback is being used for this dividend capture result.");
  }

  return {
    rows,
    source,
    warnings,
    updatedAt: meta.updatedAt,
    usedStartDate,
    usedEndDate,
    successRate: rows.length ? round((successRows.length / rows.length) * 100, 1) : 0,
    totalNetProfit: round(rows.reduce((sum, row) => sum + row.totalPnL, 0)),
    averageProfitPct: rows.length ? round(rows.reduce((sum, row) => sum + row.profitPct, 0) / rows.length, 2) : 0,
    averageRecoveryDays: numericRecoveryDays.length ? round(numericRecoveryDays.reduce((sum, day) => sum + day, 0) / numericRecoveryDays.length, 1) : 0,
    successAverageReturnPct,
    failureAverageLossPct,
    rewardRiskRatio,
    expectedReturnPct,
    taxSavingPerTrade,
    breakevenPrice: round(firstBuyPrice - latestDividendPerShare + firstBuyPrice * totalCostRate * 2, 4),
    shares: firstShares,
    netDividend: round(netDividend),
    expectedDrop: round(Math.max(0, input.referenceBuyPrice - input.referenceExOpenPrice)),
    warning: warnings.length ? warnings.join(" ") : "Live quote history and dividend events were used for this dividend capture result.",
  };
}

export function simulateDividendCapture(
  input: DividendCaptureInput,
  history?: DividendCaptureHistoryInput,
  meta: DividendCaptureCalculationMeta = {},
): DividendCaptureResult {
  const { start, end } = resolveDividendCaptureDates(input);
  const hasExternalHistory = Array.isArray(history?.prices) && Array.isArray(history?.dividends);

  if (hasExternalHistory) {
    const normalizedPrices = normalizePrices(history.prices ?? []);
    const normalizedDividends = normalizeDividends(history.dividends ?? []);

    if (normalizedPrices.prices.length >= 3 && normalizedDividends.dividends.length > 0) {
      const result = simulateDividendCaptureFromHistory(
        input,
        { prices: history.prices ?? [], dividends: history.dividends ?? [] },
        { ...meta, source: meta.source ?? "yahoo" },
      );

      if (result.rows.length > 0) return result;
    }

    return simulateDividendCaptureFromHistory(
      input,
      { prices: history.prices ?? [], dividends: history.dividends ?? [] },
      {
        ...meta,
        source: meta.source ?? "yahoo",
        warnings: [
          ...(meta.warnings ?? []),
          ...normalizedPrices.warnings,
          ...normalizedDividends.warnings,
          "Live price/dividend data was insufficient; no sample dividend-capture result was generated.",
        ],
      },
    );
  }

  return simulateDividendCaptureFromHistory(input, buildSampleHistory(input, start, end), {
    ...meta,
    source: "sample",
    warnings: [...(meta.warnings ?? []), "Sample fallback is being used until live quote history and dividend events are loaded."],
  });
}
