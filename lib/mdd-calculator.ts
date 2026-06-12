import { getTickerHistory } from "@/lib/calculator-data-provider";
import type { MddInput, MddResult, MddSegment, MddSeriesPoint, PricePoint } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";

type MddCalculationMeta = {
  source?: QuoteSource;
  warnings?: string[];
  updatedAt?: string;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isValidClose(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export const defaultMddInput: MddInput = {
  ticker: "QQQ",
  startDate: "2025-06-10",
  endDate: "2026-06-10",
  analysisPeriod: "1y",
  currency: "USD",
  initialAmount: 10_000,
  currentPrice: 485.2,
  highPrice: 512.8,
  lowPrice: 417.6,
};

export function resolveMddDates(input: MddInput) {
  const end = input.endDate || "2026-06-10";
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (input.analysisPeriod === "custom") return { start: input.startDate, end };
  const months = input.analysisPeriod === "6m" ? 6 : input.analysisPeriod === "1y" ? 12 : input.analysisPeriod === "3y" ? 36 : 60;
  return { start: addMonths(endDate, -months).toISOString().slice(0, 10), end };
}

export function normalizeMddPrices(pricePoints: PricePoint[]) {
  const warnings: string[] = [];
  const byDate = new Map<string, PricePoint>();

  for (const point of pricePoints) {
    if (!point?.date || Number.isNaN(new Date(`${point.date}T00:00:00.000Z`).getTime()) || !isValidClose(point.close)) {
      continue;
    }
    byDate.set(point.date, { date: point.date, close: point.close });
  }

  const prices = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const dropped = pricePoints.length - prices.length;
  if (dropped > 0) warnings.push(`${dropped} invalid price point(s) were excluded before MDD calculation.`);

  return { prices, warnings };
}

function buildSamplePrices(input: MddInput, start: string, end: string) {
  return getTickerHistory(input.ticker, start, end, input.currentPrice).map((point, index, arr) => {
    if (index === 0 && input.highPrice > 0) return { ...point, close: Math.min(input.highPrice, Math.max(point.close, input.lowPrice)) };
    if (index === Math.floor(arr.length * 0.45) && input.lowPrice > 0) return { ...point, close: input.lowPrice };
    if (index === arr.length - 1 && input.currentPrice > 0) return { ...point, close: input.currentPrice };
    return point;
  });
}

function emptyMddResult(input: MddInput, source: QuoteSource, warnings: string[], updatedAt?: string): MddResult {
  const { start, end } = resolveMddDates(input);
  const fallbackDate = end || start;
  return {
    series: [],
    segments: [],
    source,
    warnings,
    updatedAt,
    currentPrice: 0,
    peakPrice: 0,
    currentDrawdown: 0,
    maxDrawdown: 0,
    highDate: fallbackDate,
    lowDate: fallbackDate,
    recoveryDate: null,
    recoveryDays: null,
    warning: warnings.join(" "),
  };
}

export function calculateMddFromPrices(input: MddInput, rawPrices: PricePoint[], meta: MddCalculationMeta = {}): MddResult {
  const warnings = [...(meta.warnings ?? [])];
  const normalized = normalizeMddPrices(rawPrices);
  warnings.push(...normalized.warnings);

  const prices = normalized.prices;
  if (prices.length < 2) {
    warnings.push("At least two valid close prices are required for MDD calculation.");
    return emptyMddResult(input, meta.source ?? "sample", warnings, meta.updatedAt);
  }

  let peak = prices[0].close;
  let peakDate = prices[0].date;
  let maxDrawdown = 0;
  let mddHighDate = peakDate;
  let mddLowDate = peakDate;

  const series: MddSeriesPoint[] = prices.map((point) => {
    if (point.close >= peak) {
      peak = point.close;
      peakDate = point.date;
    }

    const drawdown = point.close / peak - 1;
    if (drawdown * 100 < maxDrawdown) {
      maxDrawdown = drawdown * 100;
      mddHighDate = peakDate;
      mddLowDate = point.date;
    }

    return {
      ...point,
      peak: round(peak),
      drawdown: round(drawdown * 100, 2),
      value: round((point.close / Math.max(prices[0].close, 0.01)) * input.initialAmount),
    };
  });

  const mddPeakPrice = series.find((point) => point.date === mddHighDate)?.close ?? Infinity;
  const recovery = series.find((point) => point.date > mddLowDate && point.close >= mddPeakPrice);
  const current = series.at(-1);
  const peakPoint = series.reduce((best, point) => (point.close > best.close ? point : best), series[0]);

  const segments: MddSegment[] = [];
  let segmentHigh = series[0];
  let segmentLow = series[0];

  for (const point of series) {
    if (point.close >= segmentHigh.close) {
      const segmentMdd = ((segmentLow.close - segmentHigh.close) / segmentHigh.close) * 100;
      if (segmentLow.date !== segmentHigh.date && segmentMdd <= -5) {
        const recovered = series.find((candidate) => candidate.date > segmentLow.date && candidate.close >= segmentHigh.close);
        segments.push({
          period: `${segmentHigh.date} ~ ${recovered?.date ?? point.date}`,
          highDate: segmentHigh.date,
          lowDate: segmentLow.date,
          mdd: round(segmentMdd, 2),
          recoveryDate: recovered?.date ?? null,
          recoveryDays: recovered ? daysBetween(segmentLow.date, recovered.date) : null,
        });
      }
      segmentHigh = point;
      segmentLow = point;
    } else if (point.close < segmentLow.close) {
      segmentLow = point;
    }
  }

  if (segments.length === 0) {
    const lastDate = series.at(-1)?.date ?? mddLowDate;
    segments.push({
      period: `${mddHighDate} ~ ${recovery?.date ?? lastDate}`,
      highDate: mddHighDate,
      lowDate: mddLowDate,
      mdd: round(maxDrawdown, 2),
      recoveryDate: recovery?.date ?? null,
      recoveryDays: recovery ? daysBetween(mddLowDate, recovery.date) : null,
    });
  }

  const source = meta.source ?? "sample";
  if (source === "sample" && !warnings.some((warning) => warning.toLowerCase().includes("sample"))) {
    warnings.push("Sample fallback is being used for this MDD result.");
  }

  return {
    series,
    segments: segments.slice(-5),
    source,
    warnings,
    updatedAt: meta.updatedAt,
    currentPrice: round(current?.close ?? 0),
    peakPrice: round(peakPoint.close),
    currentDrawdown: round(current?.drawdown ?? 0, 2),
    maxDrawdown: round(maxDrawdown, 2),
    highDate: mddHighDate,
    lowDate: mddLowDate,
    recoveryDate: recovery?.date ?? null,
    recoveryDays: recovery ? daysBetween(mddLowDate, recovery.date) : null,
    warning: warnings.join(" "),
  };
}

export function calculateMdd(input: MddInput, externalPrices?: PricePoint[], meta: MddCalculationMeta = {}): MddResult {
  const { start, end } = resolveMddDates(input);
  const hasExternalPrices = Array.isArray(externalPrices);
  const requestedSource = meta.source ?? (hasExternalPrices ? "yahoo" : "sample");
  const normalized = normalizeMddPrices(externalPrices ?? []);

  if (hasExternalPrices && normalized.prices.length >= 2) {
    return calculateMddFromPrices(input, externalPrices, { ...meta, source: requestedSource });
  }

  const sampleWarnings = [
    ...(meta.warnings ?? []),
    ...(hasExternalPrices ? normalized.warnings : []),
    hasExternalPrices
      ? "Live price history had fewer than two valid close points; sample fallback was used."
      : "Sample fallback is being used until live quote history is loaded.",
  ];

  return calculateMddFromPrices(input, buildSamplePrices(input, start, end), {
    ...meta,
    source: "sample",
    warnings: sampleWarnings,
  });
}
