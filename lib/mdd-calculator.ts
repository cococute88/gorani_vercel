import { getTickerHistory } from "@/lib/calculator-data-provider";
import type { MddInput, MddResult, MddSegment, MddSeriesPoint, PricePoint } from "@/lib/calculator-types";

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
  const endDate = new Date(end);
  if (input.analysisPeriod === "custom") return { start: input.startDate, end };
  const months = input.analysisPeriod === "6m" ? 6 : input.analysisPeriod === "1y" ? 12 : input.analysisPeriod === "3y" ? 36 : 60;
  return { start: addMonths(endDate, -months).toISOString().slice(0, 10), end };
}

export function calculateMdd(input: MddInput, externalPrices?: PricePoint[]): MddResult {
  const { start, end } = resolveMddDates(input);
  const generated = getTickerHistory(input.ticker, start, end, input.currentPrice);
  const prices = (externalPrices && externalPrices.length > 0 ? externalPrices : generated).map((point, index, arr) => {
    if (index === 0 && input.highPrice > 0) return { ...point, close: Math.min(input.highPrice, Math.max(point.close, input.lowPrice)) };
    if (index === Math.floor(arr.length * 0.45) && input.lowPrice > 0) return { ...point, close: input.lowPrice };
    if (index === arr.length - 1 && input.currentPrice > 0) return { ...point, close: input.currentPrice };
    return point;
  });

  let peak = 0;
  let peakDate = prices[0]?.date ?? start;
  let maxDrawdown = 0;
  let mddHighDate = peakDate;
  let mddLowDate = peakDate;
  const series: MddSeriesPoint[] = prices.map((point) => {
    if (point.close >= peak) {
      peak = point.close;
      peakDate = point.date;
    }
    const drawdown = ((point.close - peak) / Math.max(peak, 0.01)) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      mddHighDate = peakDate;
      mddLowDate = point.date;
    }
    return {
      ...point,
      peak: round(peak),
      drawdown: round(drawdown, 2),
      value: round((point.close / Math.max(prices[0]?.close ?? point.close, 0.01)) * input.initialAmount),
    };
  });

  const recovery = series.find((point) => point.date > mddLowDate && point.close >= (series.find((p) => p.date === mddHighDate)?.close ?? Infinity));
  const current = series.at(-1);
  const peakPoint = series.reduce((best, point) => (point.close > best.close ? point : best), series[0] ?? { date: start, close: 0, peak: 0, drawdown: 0, value: 0 });

  const segments: MddSegment[] = [];
  let segmentHigh = series[0];
  let segmentLow = series[0];
  for (const point of series) {
    if (!segmentHigh || point.close >= segmentHigh.close) {
      if (segmentLow && segmentHigh && segmentLow.date !== segmentHigh.date && ((segmentLow.close - segmentHigh.close) / segmentHigh.close) * 100 <= -5) {
        const recovered = series.find((candidate) => candidate.date > segmentLow.date && candidate.close >= segmentHigh.close);
        segments.push({
          period: `${segmentHigh.date} ~ ${recovered?.date ?? point.date}`,
          highDate: segmentHigh.date,
          lowDate: segmentLow.date,
          mdd: round(((segmentLow.close - segmentHigh.close) / segmentHigh.close) * 100, 2),
          recoveryDate: recovered?.date ?? null,
          recoveryDays: recovered ? daysBetween(segmentLow.date, recovered.date) : null,
        });
      }
      segmentHigh = point;
      segmentLow = point;
    } else if (point.close < (segmentLow?.close ?? Infinity)) {
      segmentLow = point;
    }
  }

  if (segments.length === 0 && series.length > 0) {
    segments.push({
      period: `${mddHighDate} ~ ${recovery?.date ?? end}`,
      highDate: mddHighDate,
      lowDate: mddLowDate,
      mdd: round(maxDrawdown, 2),
      recoveryDate: recovery?.date ?? null,
      recoveryDays: recovery ? daysBetween(mddLowDate, recovery.date) : null,
    });
  }

  return {
    series,
    segments: segments.slice(-5),
    currentPrice: round(current?.close ?? input.currentPrice),
    peakPrice: round(peakPoint.close),
    currentDrawdown: round(current?.drawdown ?? 0, 2),
    maxDrawdown: round(maxDrawdown, 2),
    highDate: mddHighDate,
    lowDate: mddLowDate,
    recoveryDate: recovery?.date ?? null,
    recoveryDays: recovery ? daysBetween(mddLowDate, recovery.date) : null,
    warning: "현재는 입력값/샘플 데이터 기준 계산입니다. 실시간 시세 연결은 이후 단계에서 확장합니다.",
  };
}
