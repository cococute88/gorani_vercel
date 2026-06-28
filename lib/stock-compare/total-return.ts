// =============================================================
// Total Return 시계열 + "비중 반영 중복 제거" 성과 계산.
//
// Total Return(TR) 정의
//   - Yahoo adjClose(배당+분할 조정 종가) = 배당 재투자를 가정한 총수익 대용치.
//   - TR 옵션 OFF 시에는 단순 종가(close) = 가격수익률을 사용한다.
//
// 중복 제거(핵심 — 단순 종목 삭제 금지)
//   ETF 수익 인덱스를 "공통 종목 바스켓"과 "고유(비공통) 바스켓"의 비중 가중합으로
//   선형 분해한다(모두 기준일 = 1.0).
//
//     I_A(t) = wA · commonIdx_A(t) + (1 − wA) · uniqueIdx_A(t)
//
//   여기서
//     wA           = A 펀드 내 공통 종목 비중 합(예: SPY 안 공통주 30% → 0.30)
//     commonIdx_A  = 공통 종목들을 "A의 비중으로 정규화"해 가중한 바스켓 인덱스
//                    (각 공통 종목은 자기 TR 시계열로 기준일=1 재정규화)
//     uniqueIdx_A  = 위 식을 풀어 역산한 "공통 종목 제거 후" 인덱스
//                    = (I_A(t) − wA · commonIdx_A(t)) / (1 − wA)
//
//   → Apple 이 SPY 6%, QQQ 9% 처럼 비중이 다르면 각 ETF 의 commonIdx 가
//     서로 다른 가중으로 계산되므로 비중 차이가 성과에 반영된다.
//   → 비중 미고려(옵션 OFF) 시에는 공통 바스켓을 동일 가중으로 두고 wA 를
//     공통 종목 "개수 비율"로 근사한다(설명용 비교 모드).
// =============================================================

import type { LongSeriesPoint } from "@/lib/market-series";
import type { CompareSeries, IndexPoint, OverlapResult } from "@/lib/stock-compare/types";
import { SERIES_STYLE, seriesLabel } from "@/lib/stock-compare/constants";

const DAY_MS = 86_400_000;

export type TrLevels = {
  ticker: string;
  // 오름차순 [date, level]. level = adjClose(또는 close) 절대값(>0).
  levels: Array<[string, number]>;
};

function isPos(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

// RawSeries 포인트 → TR/가격 레벨 시계열. useTotalReturn=true 면 adjClose(없으면 close).
export function toTrLevels(ticker: string, points: LongSeriesPoint[], useTotalReturn: boolean): TrLevels {
  const byDate = new Map<string, number>();
  for (const p of points) {
    if (!p?.date) continue;
    const level = useTotalReturn && isPos(p.adjClose) ? p.adjClose : p.close;
    if (isPos(level)) byDate.set(p.date, level);
  }
  const levels = Array.from(byDate.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { ticker, levels };
}

// date(포함) 이하에서 가장 최근 레벨을 반환(as-of / forward-fill). 없으면 null.
function asOf(levels: Array<[string, number]>, date: string): number | null {
  let lo = 0;
  let hi = levels.length - 1;
  let ans: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (levels[mid][0] <= date) {
      ans = levels[mid][1];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export type BuildOptions = {
  removeOverlap: boolean;
  weighted: boolean;
};

export type BuildInput = {
  tickerA: string;
  tickerB: string;
  aLevels: TrLevels;
  bLevels: TrLevels;
  overlap: OverlapResult;
  // 공통 종목 티커 → TR 레벨 시계열.
  commonLevels: Map<string, TrLevels>;
  periodDays: number; // Infinity → MAX
  options: BuildOptions;
};

// 한 ETF 의 "고유(중복 제거) 인덱스" 시계열을 계산한다.
// 반환: 날짜축(axis) 각 시점의 uniqueIdx(기준일=1). 계산 불가 시 null.
function computeUniqueIndex(args: {
  axis: string[];
  selfLevels: Array<[string, number]>;
  commonStart: string;
  commonTickers: string[];
  weightByTicker: Map<string, number>; // 이 ETF 내 공통 종목 비중(%)
  totalHoldingsCount: number;
  commonLevels: Map<string, TrLevels>;
  weighted: boolean;
}): { unique: Array<number | null>; available: boolean; wFund: number } {
  const {
    axis,
    selfLevels,
    commonStart,
    commonTickers,
    weightByTicker,
    totalHoldingsCount,
    commonLevels,
    weighted,
  } = args;

  // 공통 종목 중 기준일 시점 가격이 있는 것만 사용한다.
  const usable = commonTickers.filter((t) => {
    const lv = commonLevels.get(t)?.levels;
    return lv && lv.length > 0 && asOf(lv, commonStart) != null;
  });
  if (usable.length === 0) return { unique: axis.map(() => null), available: false, wFund: 0 };

  // 바스켓 정규화 가중치 + 펀드 내 공통 비중 wA.
  let normWeights: Map<string, number>;
  let wFund: number;
  if (weighted) {
    const sumW = usable.reduce((s, t) => s + (weightByTicker.get(t) ?? 0), 0);
    if (sumW <= 0) return { unique: axis.map(() => null), available: false, wFund: 0 };
    normWeights = new Map(usable.map((t) => [t, (weightByTicker.get(t) ?? 0) / sumW]));
    wFund = sumW / 100; // 펀드 내 공통 종목 비중 합(절대 비중).
  } else {
    // 비중 미고려: 공통 바스켓 동일 가중, wA = 공통 종목 개수 비율.
    const eq = 1 / usable.length;
    normWeights = new Map(usable.map((t) => [t, eq]));
    wFund = totalHoldingsCount > 0 ? usable.length / totalHoldingsCount : 0;
  }

  if (wFund <= 0 || wFund >= 0.98) {
    // 고유 비중이 거의 없으면(=펀드가 거의 공통주) 의미 있는 분해 불가.
    return { unique: axis.map(() => null), available: false, wFund };
  }

  const selfBase = asOf(selfLevels, commonStart);
  if (!isPos(selfBase)) return { unique: axis.map(() => null), available: false, wFund };

  // 공통 종목별 기준일 가격.
  const commonBase = new Map<string, number>();
  for (const t of usable) {
    const lv = commonLevels.get(t)!.levels;
    const base = asOf(lv, commonStart);
    if (isPos(base)) commonBase.set(t, base);
  }

  const unique = axis.map((date) => {
    const selfLevel = asOf(selfLevels, date);
    if (!isPos(selfLevel)) return null;
    const iSelf = selfLevel / selfBase;

    let commonIdx = 0;
    let weightSeen = 0;
    for (const t of usable) {
      const base = commonBase.get(t);
      const lv = commonLevels.get(t)!.levels;
      const level = asOf(lv, date);
      if (!isPos(base) || !isPos(level)) continue;
      const w = normWeights.get(t) ?? 0;
      commonIdx += w * (level / base);
      weightSeen += w;
    }
    if (weightSeen <= 0) return null;
    commonIdx /= weightSeen; // 누락 종목 보정(정규화).

    const uniqueIdx = (iSelf - wFund * commonIdx) / (1 - wFund);
    if (!Number.isFinite(uniqueIdx) || uniqueIdx <= 0) return null;
    return uniqueIdx;
  });

  const valid = unique.filter((v) => v != null).length;
  return { unique, available: valid >= 2, wFund };
}

// 4개 비교 시리즈(누적 수익률 %)를 만든다.
export function buildCompareSeries(input: BuildInput): {
  series: CompareSeries[];
  axis: string[];
  // 고유 인덱스(중복 제거) 가용 여부 + 펀드 내 공통 비중(기여도 카드 재사용).
  exMeta: {
    aAvailable: boolean;
    bAvailable: boolean;
    aWFund: number;
    bWFund: number;
  };
} {
  const { tickerA, tickerB, aLevels, bLevels, overlap, commonLevels, periodDays, options } = input;
  const a = aLevels.levels;
  const b = bLevels.levels;

  const emptyResult = () => ({
    series: [] as CompareSeries[],
    axis: [] as string[],
    exMeta: { aAvailable: false, bAvailable: false, aWFund: 0, bWFund: 0 },
  });
  if (a.length < 2 || b.length < 2) return emptyResult();

  // 1) 기간 컷오프(두 종목 통틀어 가장 최근 거래일 기준).
  const lastMsA = parseMs(a[a.length - 1][0]);
  const lastMsB = parseMs(b[b.length - 1][0]);
  const lastMs = Math.max(lastMsA, lastMsB);
  const cutoffMs = Number.isFinite(periodDays) ? lastMs - periodDays * DAY_MS : -Infinity;

  const aFilt = a.filter(([d]) => parseMs(d) >= cutoffMs);
  const bFilt = b.filter(([d]) => parseMs(d) >= cutoffMs);
  if (aFilt.length < 2 || bFilt.length < 2) return emptyResult();

  // 2) 공통 시작일 = 두 시계열의 첫 거래일 중 더 늦은 날(동일 기준 0% 보장).
  const commonStart = aFilt[0][0] > bFilt[0][0] ? aFilt[0][0] : bFilt[0][0];

  const aWin = aFilt.filter(([d]) => d >= commonStart);
  const bWin = bFilt.filter(([d]) => d >= commonStart);
  if (aWin.length < 2 || bWin.length < 2) return emptyResult();

  // 3) 날짜축 = A·B 날짜 합집합(정렬). 중복 제거 인덱스 계산에 사용.
  const axisSet = new Set<string>();
  aWin.forEach(([d]) => axisSet.add(d));
  bWin.forEach(([d]) => axisSet.add(d));
  const axis = Array.from(axisSet).sort();

  const baseA = aWin[0][1];
  const baseB = bWin[0][1];

  const pctSeries = (levels: Array<[string, number]>, base: number): IndexPoint[] =>
    levels.map(([date, level]) => ({ date, value: Number(((level / base - 1) * 100).toFixed(4)) }));

  const aPoints = pctSeries(aWin, baseA);
  const bPoints = pctSeries(bWin, baseB);

  const series: CompareSeries[] = [
    {
      key: "a",
      label: seriesLabel("a", tickerA, tickerB),
      color: SERIES_STYLE.a.color,
      points: aPoints,
      overlapAdjusted: false,
      available: true,
    },
    {
      key: "b",
      label: seriesLabel("b", tickerA, tickerB),
      color: SERIES_STYLE.b.color,
      points: bPoints,
      overlapAdjusted: false,
      available: true,
    },
  ];

  let aExAvailable = false;
  let bExAvailable = false;
  let aWFund = 0;
  let bWFund = 0;

  if (options.removeOverlap && overlap.hasHoldings && overlap.commonTickers.length > 0) {
    const weightA = new Map(overlap.holdingsA.map((h) => [h.ticker, h.weightPct]));
    const weightB = new Map(overlap.holdingsB.map((h) => [h.ticker, h.weightPct]));

    const exA = computeUniqueIndex({
      axis,
      selfLevels: a,
      commonStart,
      commonTickers: overlap.commonTickers,
      weightByTicker: weightA,
      totalHoldingsCount: overlap.holdingsA.length,
      commonLevels,
      weighted: options.weighted,
    });
    const exB = computeUniqueIndex({
      axis,
      selfLevels: b,
      commonStart,
      commonTickers: overlap.commonTickers,
      weightByTicker: weightB,
      totalHoldingsCount: overlap.holdingsB.length,
      commonLevels,
      weighted: options.weighted,
    });

    aExAvailable = exA.available;
    bExAvailable = exB.available;
    aWFund = exA.wFund;
    bWFund = exB.wFund;

    const exPoints = (unique: Array<number | null>): IndexPoint[] => {
      // 기준일=1 이므로 그대로 %로 환산.
      const out: IndexPoint[] = [];
      axis.forEach((date, i) => {
        const v = unique[i];
        if (v != null) out.push({ date, value: Number(((v - 1) * 100).toFixed(4)) });
      });
      return out;
    };

    if (aExAvailable) {
      series.push({
        key: "aEx",
        label: seriesLabel("aEx", tickerA, tickerB),
        color: SERIES_STYLE.aEx.color,
        points: exPoints(exA.unique),
        overlapAdjusted: true,
        available: true,
      });
    }
    if (bExAvailable) {
      series.push({
        key: "bEx",
        label: seriesLabel("bEx", tickerA, tickerB),
        color: SERIES_STYLE.bEx.color,
        points: exPoints(exB.unique),
        overlapAdjusted: true,
        available: true,
      });
    }
  }

  return { series, axis, exMeta: { aAvailable: aExAvailable, bAvailable: bExAvailable, aWFund, bWFund } };
}
