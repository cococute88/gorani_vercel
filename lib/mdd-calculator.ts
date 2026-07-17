import { getTickerHistory } from "@/lib/calculator-data-provider";
import type {
  ComparisonReturnRow,
  DrawdownComparePoint,
  MddEpisode,
  MddInput,
  MddResult,
  MddSegment,
  MddSeriesPoint,
  PricePoint,
  VolatilityStats,
  YearlyReturn,
} from "@/lib/calculator-types";
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
  ticker: "",
  market: "US",
  startDate: "2025-06-10",
  endDate: "2026-06-10",
  // 간소화된 MDD 계산기는 티커 + 시작일/종료일만 입력받으므로 기간 모드는 custom 고정 (#7-3).
  analysisPeriod: "custom",
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
  if (dropped > 0) warnings.push(`MDD 계산 전에 유효하지 않은 가격 데이터 ${dropped}개를 제외했습니다.`);

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
    peakPrice2: 0,
    troughPrice: 0,
    recoveryDate: null,
    recoveryDays: null,
    recovered: false,
    warning: warnings.join(" "),
  };
}

export function calculateMddFromPrices(input: MddInput, rawPrices: PricePoint[], meta: MddCalculationMeta = {}): MddResult {
  const warnings = [...(meta.warnings ?? [])];
  const normalized = normalizeMddPrices(rawPrices);
  warnings.push(...normalized.warnings);

  const prices = normalized.prices;
  if (prices.length < 2) {
    warnings.push("MDD를 계산하려면 유효한 종가 데이터가 2개 이상 필요합니다.");
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
  const mddTroughPrice = series.find((point) => point.date === mddLowDate)?.close ?? 0;
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
    peakPrice2: round(mddPeakPrice === Infinity ? 0 : mddPeakPrice),
    troughPrice: round(mddTroughPrice),
    recoveryDate: recovery?.date ?? null,
    recoveryDays: recovery ? daysBetween(mddLowDate, recovery.date) : null,
    recovered: Boolean(recovery),
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

// ──────────────────────────────────────────────
// Streamlit 7_mdd_calculator.py 풀 포팅용 추가 순수 계산 함수
// (MDD-CALCULATOR-STREAMLIT-FULL-PORT-1)
// ──────────────────────────────────────────────

export type PeriodKey = "3m" | "1y" | "3y" | "5y" | "10y" | "max";

const PERIOD_MONTHS: Record<PeriodKey, number | null> = {
  "3m": 3,
  "1y": 12,
  "3y": 36,
  "5y": 60,
  "10y": 120,
  max: null,
};

// 티커 MDD 계산기 기간 버튼: 1년 / 3년 / 5년 / 최대.
// (커스텀 기간은 컴포넌트에서 시작일/종료일 Date Picker 로 별도 처리한다.)
// resolvePeriodWindow / PERIOD_MONTHS 는 3m·10y 도 계속 지원하므로
// 다른 화면(회귀 테스트/스크립트)의 기존 동작에는 영향이 없다.
export const MDD_PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "1y", label: "1년" },
  { key: "3y", label: "3년" },
  { key: "5y", label: "5년" },
  { key: "max", label: "최대" },
];

/**
 * 선택한 기간 버튼을 실제 데이터에 맞춰 시작/종료일로 변환한다.
 * 요청 기간이 보유 데이터 기간보다 길면(예: 10년 버튼인데 데이터가 5년치뿐) 자동으로
 * 전체(최대) 기간으로 clamp 한다.
 */
export function resolvePeriodWindow(
  prices: PricePoint[],
  period: PeriodKey,
): { start: string; end: string; clampedToMax: boolean } {
  if (prices.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: today, clampedToMax: false };
  }

  const firstDate = prices[0].date;
  const lastDate = prices[prices.length - 1].date;
  const months = PERIOD_MONTHS[period];

  if (months === null) {
    return { start: firstDate, end: lastDate, clampedToMax: false };
  }

  const desiredStart = addMonths(new Date(`${lastDate}T00:00:00.000Z`), -months).toISOString().slice(0, 10);
  // 요청 시작일이 데이터 시작일보다 이르면 = 보유 데이터가 요청 기간보다 짧음 → 최대 기간으로 clamp.
  if (desiredStart <= firstDate) {
    return { start: firstDate, end: lastDate, clampedToMax: true };
  }
  return { start: desiredStart, end: lastDate, clampedToMax: false };
}

/** 시작/종료일(포함) 구간으로 가격 배열을 자른다. */
export function slicePrices(prices: PricePoint[], start: string, end: string): PricePoint[] {
  return prices.filter((point) => point.date >= start && point.date <= end);
}

/**
 * 역대 최대 낙폭/회복기간 리스트.
 * 고점 갱신 시점을 기준으로 drawdown 구간을 분리하고, 저점 이후 직전 고점가를
 * 회복한 날을 회복일로 본다. 미회복 구간도 포함한다.
 * 심한 낙폭(최솟값) 순으로 정렬해 상위 limit 개를 반환한다.
 */
export function computeDrawdownEpisodes(
  rawPrices: PricePoint[],
  options: { minDrawdownPct?: number; limit?: number } = {},
): MddEpisode[] {
  const minDrawdownPct = options.minDrawdownPct ?? -3;
  const limit = options.limit ?? 8;
  const { prices } = normalizeMddPrices(rawPrices);
  if (prices.length < 2) return [];

  type RawEpisode = {
    peakDate: string;
    peakClose: number;
    troughDate: string;
    troughClose: number;
    recoveryDate: string | null;
  };

  const episodes: RawEpisode[] = [];
  let peakClose = prices[0].close;
  let peakDate = prices[0].date;
  let troughClose = peakClose;
  let troughDate = peakDate;
  let inDrawdown = false;

  for (const point of prices) {
    if (point.close >= peakClose) {
      if (inDrawdown) {
        episodes.push({ peakDate, peakClose, troughDate, troughClose, recoveryDate: point.date });
        inDrawdown = false;
      }
      peakClose = point.close;
      peakDate = point.date;
      troughClose = point.close;
      troughDate = point.date;
    } else {
      inDrawdown = true;
      if (point.close < troughClose) {
        troughClose = point.close;
        troughDate = point.date;
      }
    }
  }
  if (inDrawdown) {
    episodes.push({ peakDate, peakClose, troughDate, troughClose, recoveryDate: null });
  }

  return episodes
    .map((episode) => {
      const mdd = round((episode.troughClose / episode.peakClose - 1) * 100, 2);
      return {
        peakDate: episode.peakDate,
        troughDate: episode.troughDate,
        recoveryDate: episode.recoveryDate,
        mdd,
        declineDays: daysBetween(episode.peakDate, episode.troughDate),
        recoveryDays: episode.recoveryDate ? daysBetween(episode.troughDate, episode.recoveryDate) : null,
        totalDays: episode.recoveryDate ? daysBetween(episode.peakDate, episode.recoveryDate) : null,
        recovered: episode.recoveryDate !== null,
      };
    })
    .filter((episode) => episode.mdd <= minDrawdownPct)
    .sort((a, b) => a.mdd - b.mdd)
    .slice(0, limit)
    .map((episode, index) => ({ ...episode, rank: index + 1 }));
}

/**
 * 연도별 수익률 = 해당 연도 마지막 종가 / 해당 연도 첫 종가 - 1.
 * 현재 진행 중인(데이터 마지막) 연도는 partial=true.
 */
export function computeYearlyReturns(rawPrices: PricePoint[]): YearlyReturn[] {
  const { prices } = normalizeMddPrices(rawPrices);
  if (prices.length < 2) return [];

  const byYear = new Map<number, { first: number; last: number }>();
  for (const point of prices) {
    const year = Number(point.date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const existing = byYear.get(year);
    if (!existing) {
      byYear.set(year, { first: point.close, last: point.close });
    } else {
      existing.last = point.close;
    }
  }

  const lastYear = Number(prices[prices.length - 1].date.slice(0, 4));
  return Array.from(byYear.entries())
    .filter(([, value]) => value.first > 0)
    .map(([year, value]) => ({
      year,
      returnPct: round((value.last / value.first - 1) * 100, 2),
      partial: year === lastYear,
    }))
    .sort((a, b) => a.year - b.year);
}

/** label 기준일 이상에서 가장 가까운(첫) 가격 포인트를 찾는다. */
function priceOnOrAfter(prices: PricePoint[], target: string): PricePoint | undefined {
  return prices.find((point) => point.date >= target);
}

/**
 * 비교 기준년도 표: 1/3/5/7/10년 전 대비 총수익률 및 연평균(CAGR).
 * 데이터가 부족한 기간은 available=false 로 표시한다.
 */
export function computeComparisonTable(rawPrices: PricePoint[]): ComparisonReturnRow[] {
  const { prices } = normalizeMddPrices(rawPrices);
  const spans = [1, 3, 5, 7, 10];
  if (prices.length < 2) {
    return spans.map((years) => ({
      label: `${years}년전 대비`,
      years,
      available: false,
      totalReturnPct: null,
      cagrPct: null,
      baseDate: null,
    }));
  }

  const last = prices[prices.length - 1];
  const firstDate = prices[0].date;

  return spans.map((years) => {
    const targetDate = addMonths(new Date(`${last.date}T00:00:00.000Z`), -years * 12).toISOString().slice(0, 10);
    if (targetDate < firstDate) {
      return { label: `${years}년전 대비`, years, available: false, totalReturnPct: null, cagrPct: null, baseDate: null };
    }
    const base = priceOnOrAfter(prices, targetDate);
    if (!base || base.close <= 0) {
      return { label: `${years}년전 대비`, years, available: false, totalReturnPct: null, cagrPct: null, baseDate: null };
    }
    const totalReturn = last.close / base.close - 1;
    const cagr = years > 0 ? Math.pow(last.close / base.close, 1 / years) - 1 : totalReturn;
    return {
      label: `${years}년전 대비`,
      years,
      available: true,
      totalReturnPct: round(totalReturn * 100, 2),
      cagrPct: round(cagr * 100, 2),
      baseDate: base.date,
    };
  });
}

/** 주요 변동성 지표 표 (52주 고저, 1년 수익률, 현재/최대 낙폭, 연 최고/최저 수익률). */
export function computeVolatilityStats(rawPrices: PricePoint[]): VolatilityStats {
  const { prices } = normalizeMddPrices(rawPrices);
  if (prices.length < 2) {
    return {
      high52w: null,
      low52w: null,
      return1yPct: null,
      currentDrawdownPct: null,
      maxDrawdownPct: null,
      yearBestPct: null,
      yearWorstPct: null,
    };
  }

  const last = prices[prices.length - 1];
  const oneYearAgo = addMonths(new Date(`${last.date}T00:00:00.000Z`), -12).toISOString().slice(0, 10);
  const lastYearWindow = prices.filter((point) => point.date >= oneYearAgo);

  const high52w = lastYearWindow.length > 0 ? Math.max(...lastYearWindow.map((p) => p.close)) : null;
  const low52w = lastYearWindow.length > 0 ? Math.min(...lastYearWindow.map((p) => p.close)) : null;

  const base1y = priceOnOrAfter(prices, oneYearAgo);
  const return1yPct = base1y && base1y.close > 0 ? round((last.close / base1y.close - 1) * 100, 2) : null;

  // 현재/최대 낙폭은 전체 구간 종가 기준.
  let peak = prices[0].close;
  let maxDrawdown = 0;
  for (const point of prices) {
    if (point.close > peak) peak = point.close;
    const dd = (point.close / peak - 1) * 100;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }
  const runningMax = Math.max(...prices.map((p) => p.close));
  const currentDrawdownPct = runningMax > 0 ? round((last.close / runningMax - 1) * 100, 2) : null;

  // 연 최고/최저 수익률은 완결된 연도 기준 (partial 제외).
  const yearly = computeYearlyReturns(prices);
  const completed = yearly.filter((row) => !row.partial);
  const pool = completed.length > 0 ? completed : yearly;
  const yearBestPct = pool.length > 0 ? Math.max(...pool.map((row) => row.returnPct)) : null;
  const yearWorstPct = pool.length > 0 ? Math.min(...pool.map((row) => row.returnPct)) : null;

  return {
    high52w: high52w !== null ? round(high52w) : null,
    low52w: low52w !== null ? round(low52w) : null,
    return1yPct,
    currentDrawdownPct,
    maxDrawdownPct: round(maxDrawdown, 2),
    yearBestPct,
    yearWorstPct,
  };
}

/**
 * 달러 종가 + USD/KRW 환율 종가를 정렬해 원화 환산 종가 시계열을 만든다.
 * 미국 거래일과 환율일이 다를 수 있으므로 각 거래일에 대해 직전(<=) 환율을 ffill 한다.
 * 환율 데이터가 없으면 빈 배열을 반환한다 (가짜 값 생성 금지).
 */
export function alignKrwCloses(usdPrices: PricePoint[], fxPrices: PricePoint[]): PricePoint[] {
  const usd = normalizeMddPrices(usdPrices).prices;
  const fx = normalizeMddPrices(fxPrices).prices;
  if (usd.length === 0 || fx.length === 0) return [];

  const out: PricePoint[] = [];
  let fxIndex = 0;
  let lastRate: number | null = null;
  for (const point of usd) {
    while (fxIndex < fx.length && fx[fxIndex].date <= point.date) {
      lastRate = fx[fxIndex].close;
      fxIndex += 1;
    }
    if (lastRate === null) continue; // 시작 구간 환율 없음 → 환산 불가 (제외)
    out.push({ date: point.date, close: round(point.close * lastRate) });
  }
  return out;
}

/**
 * 달러 기준 / 원화 기준 drawdown 비교 시계열.
 * 두 종가의 (close / cummax - 1) 을 같은 날짜축에 정렬한다.
 * krwPrices 가 비어 있으면 모든 krw 값은 null (원화 unavailable).
 */
export function computeDrawdownCompare(usdPrices: PricePoint[], krwPrices: PricePoint[]): DrawdownComparePoint[] {
  const usd = normalizeMddPrices(usdPrices).prices;
  if (usd.length === 0) return [];

  const krwByDate = new Map<string, number>();
  let krwPeak = krwPrices.length > 0 ? normalizeMddPrices(krwPrices).prices[0]?.close ?? 0 : 0;
  for (const point of normalizeMddPrices(krwPrices).prices) {
    if (point.close > krwPeak) krwPeak = point.close;
    krwByDate.set(point.date, round((point.close / krwPeak - 1) * 100, 2));
  }

  let usdPeak = usd[0].close;
  return usd.map((point) => {
    if (point.close > usdPeak) usdPeak = point.close;
    const usdDd = round((point.close / usdPeak - 1) * 100, 2);
    return { date: point.date, usd: usdDd, krw: krwByDate.has(point.date) ? krwByDate.get(point.date)! : null };
  });
}
