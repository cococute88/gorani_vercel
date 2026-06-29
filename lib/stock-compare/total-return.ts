// =============================================================
// Total Return 시계열 + "비중 반영 중복 제거" 성과 계산.
//
// Total Return(TR) 정의
//   - Yahoo adjClose(배당+분할 조정 종가) = 배당 재투자를 가정한 총수익 대용치.
//   - TR 옵션 OFF 시에는 단순 종가(close) = 가격수익률을 사용한다.
//
// 중복 제거(핵심 — 단순 종목 삭제 금지)
//   ETF 수익에서 "공통 종목 바스켓"의 기여를 비중까지 반영해 제거한 "고유(비공통)
//   성과"를 산출한다. 정적 비중을 누적 인덱스(level)에 직접 차감하던 과거 방식은
//   장기 구간에서 수치적으로 불안정했으므로(−99%/−79%, 중간 끊김),
//   "일별 수익률(return-space)" 분해 후 복리 누적으로 전환했다.
//
//     r_self(t)   = ETF 본체의 일별 수익률
//     r_common(t) = 공통 종목 바스켓(ETF 내 비중으로 정규화)의 일별 수익률
//     wFund       = 펀드 내 공통 종목 비중 합(예: SPY 안 공통주 31.6% → 0.316)
//     r_unique(t) = (r_self(t) − wFund · r_common(t)) / (1 − wFund)
//     uniqueIdx(t) = Π (1 + r_unique(t))   (기준일 = 1.0)
//
//   → Apple 이 SPY 6%, QQQ 8% 처럼 비중이 다르면 각 ETF 의 r_common 가중이
//     달라지므로 비중 차이가 성과에 반영된다.
//   → 일별 수익률은 유계라 장기에도 인덱스가 음수로 폭주하지 않고, 결측 스텝은
//     직전 누적값을 이어붙여 끊김 없이 연속성을 유지한다.
//   → 비중 미고려(옵션 OFF) 시에는 공통 바스켓을 동일 가중으로 두고 wFund 를
//     공통 종목 "개수 비율"로 근사한다(설명용 비교 모드).
// =============================================================

import type { LongSeriesPoint } from "@/lib/market-series";
import type { CompareSeries, IndexPoint, OverlapResult } from "@/lib/stock-compare/types";
import { SERIES_STYLE, seriesLabel } from "@/lib/stock-compare/constants";
import { rebaseCompareSeries } from "@/lib/stock-compare/rebase";

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

// 한 ETF 의 "고유(중복 제거) 성과" 시계열을 계산한다.
//
// ── 왜 일별 수익률(return-space) 분해인가 ───────────────────────────────
// 과거 구현은 누적 인덱스(level-space)를 정적 비중으로 직접 차감했다:
//     uniqueIdx(t) = (I_self(t) − wFund · commonIdx(t)) / (1 − wFund)
// 이 방식은 (a) 오늘 기준 비중(wFund)을 과거 전 구간에 고정 적용하고,
// (b) 누적 인덱스가 지수적으로 벌어지는 장기 구간에서 공통 바스켓(대형 기술주)
// 이 ETF 본체보다 훨씬 더 커지면 분자가 음수에 가까워지며, 1/(1−wFund) 증폭까지
// 겹쳐 −99% / −79% 같은 비현실적 값과 중간 끊김(uniqueIdx ≤ 0 → null)을 만든다.
//
// 본 구현은 "일별 수익률" 공간에서 분해 후 복리로 누적한다:
//     r_unique(t) = (r_self(t) − wFund · r_common(t)) / (1 − wFund)
//     uniqueIdx(t) = uniqueIdx(t−1) · (1 + r_unique(t)),  uniqueIdx(0) = 1
// 일별 수익률은 유계(bounded)이므로 장기에도 안정적이며, 누적 인덱스가 음수로
// 폭주하지 않는다. 또한 결측 스텝은 직전 값을 이어붙여(끊김 없이) 연속성을 보장한다.
//
// 반환: 기준일=0% 인 누적 수익률 시계열(IndexPoint[]). 계산 불가 시 빈 배열.
function computeUniqueIndex(args: {
  selfWin: Array<[string, number]>; // 기간 윈도(>= commonStart)로 자른 본체 레벨, 오름차순
  commonStart: string;
  commonTickers: string[];
  weightByTicker: Map<string, number>; // 이 ETF 내 공통 종목 비중(%)
  totalHoldingsCount: number;
  commonLevels: Map<string, TrLevels>;
  weighted: boolean;
}): { points: IndexPoint[]; available: boolean; wFund: number } {
  const {
    selfWin,
    commonStart,
    commonTickers,
    weightByTicker,
    totalHoldingsCount,
    commonLevels,
    weighted,
  } = args;

  if (selfWin.length < 2) return { points: [], available: false, wFund: 0 };

  // 기준일(commonStart) 시점 가격이 존재하는 공통 종목만 사용한다.
  // → 전 구간에 동일 바스켓이 유지되어 비중 재정규화로 인한 인위적 점프를 막는다.
  const usable = commonTickers.filter((t) => {
    const lv = commonLevels.get(t)?.levels;
    return lv && lv.length > 0 && asOf(lv, commonStart) != null;
  });
  if (usable.length === 0) return { points: [], available: false, wFund: 0 };

  // 바스켓 정규화 가중치 + 펀드 내 공통 비중 wFund.
  let normWeights: Map<string, number>;
  let wFund: number;
  if (weighted) {
    const sumW = usable.reduce((s, t) => s + (weightByTicker.get(t) ?? 0), 0);
    if (sumW <= 0) return { points: [], available: false, wFund: 0 };
    normWeights = new Map(usable.map((t) => [t, (weightByTicker.get(t) ?? 0) / sumW]));
    wFund = sumW / 100; // 펀드 내 공통 종목 비중 합(절대 비중).
  } else {
    // 비중 미고려: 공통 바스켓 동일 가중, wFund = 공통 종목 개수 비율.
    const eq = 1 / usable.length;
    normWeights = new Map(usable.map((t) => [t, eq]));
    wFund = totalHoldingsCount > 0 ? usable.length / totalHoldingsCount : 0;
  }

  // 고유(비공통) 비중이 거의 없으면 의미 있는 분해 불가.
  if (!(wFund > 0) || wFund >= 0.95) {
    return { points: [], available: false, wFund };
  }

  // 공통 종목별 기준일 가격.
  const commonBase = new Map<string, number>();
  for (const t of usable) {
    const base = asOf(commonLevels.get(t)!.levels, commonStart);
    if (isPos(base)) commonBase.set(t, base);
  }
  if (commonBase.size === 0) return { points: [], available: false, wFund };

  // 특정 시점의 공통 바스켓 정규화 인덱스(기준일 = 1.0). 결측 종목은 보정 정규화.
  const commonIdxAt = (date: string): number | null => {
    let acc = 0;
    let weightSeen = 0;
    for (const t of usable) {
      const base = commonBase.get(t);
      const lv = commonLevels.get(t)?.levels;
      if (!isPos(base) || !lv) continue;
      const level = asOf(lv, date);
      if (!isPos(level)) continue;
      const w = normWeights.get(t) ?? 0;
      acc += w * (level / base);
      weightSeen += w;
    }
    if (weightSeen <= 0) return null;
    return acc / weightSeen;
  };

  const denom = 1 - wFund;
  const points: IndexPoint[] = [];
  let uniqueIdx = 1;
  let prevSelf = selfWin[0][1];
  let prevCommon = commonIdxAt(selfWin[0][0]);
  points.push({ date: selfWin[0][0], value: 0 }); // 기준일 = 0%.

  for (let i = 1; i < selfWin.length; i += 1) {
    const [date, selfLevel] = selfWin[i];
    const curCommon = commonIdxAt(date);

    // 결측 스텝: 직전 누적값을 이어붙여 끊김 없이 연속성 유지.
    if (!isPos(selfLevel) || !isPos(prevSelf) || prevCommon == null || curCommon == null || !(prevCommon > 0)) {
      points.push({ date, value: Number(((uniqueIdx - 1) * 100).toFixed(4)) });
      if (isPos(selfLevel)) prevSelf = selfLevel;
      if (curCommon != null && curCommon > 0) prevCommon = curCommon;
      continue;
    }

    const rSelf = selfLevel / prevSelf - 1;
    const rCommon = curCommon / prevCommon - 1;
    let rUnique = (rSelf - wFund * rCommon) / denom;
    // 단일 스텝에서의 비정상적 전손 방지(데이터 이상치 가드).
    if (rUnique <= -0.95) rUnique = -0.95;

    uniqueIdx *= 1 + rUnique;
    if (!Number.isFinite(uniqueIdx) || uniqueIdx <= 0) uniqueIdx = 1e-6;

    points.push({ date, value: Number(((uniqueIdx - 1) * 100).toFixed(4)) });
    prevSelf = selfLevel;
    prevCommon = curCommon;
  }

  return { points, available: points.length >= 2, wFund };
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
      selfWin: aWin,
      commonStart,
      commonTickers: overlap.commonTickers,
      weightByTicker: weightA,
      totalHoldingsCount: overlap.holdingsA.length,
      commonLevels,
      weighted: options.weighted,
    });
    const exB = computeUniqueIndex({
      selfWin: bWin,
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

    if (aExAvailable) {
      series.push({
        key: "aEx",
        label: seriesLabel("aEx", tickerA, tickerB),
        color: SERIES_STYLE.aEx.color,
        points: exA.points,
        overlapAdjusted: true,
        available: true,
      });
    }
    if (bExAvailable) {
      series.push({
        key: "bEx",
        label: seriesLabel("bEx", tickerA, tickerB),
        color: SERIES_STYLE.bEx.color,
        points: exB.points,
        overlapAdjusted: true,
        available: true,
      });
    }
  }

  return { series, axis, exMeta: { aAvailable: aExAvailable, bAvailable: bExAvailable, aWFund, bWFund } };
}

// =============================================================
// MAX 시리즈 → 기간 윈도(누적수익률 재기준화). API/재계산 최소화 핵심.
//
// buildCompareSeries 를 periodDays 마다 다시 호출하면 (중복 제거) 고유 인덱스까지
// 전부 재계산된다. 대신 "MAX(전체) 시리즈를 한 번만" 만든 뒤, 카드/지표가 필요한
// 기간 구간만 잘라(slice) 그 구간 시작일을 0% 로 재기준화하면 동일한 결과를 얻는다.
//
// 동치성: MAX 시리즈의 값 v(t) 는 ratio(t)=1+v/100 = level(t)/level(MAX시작).
// 구간 시작일 s 로 재기준화하면 ratio(t)/ratio(s)=level(t)/level(s) 이며, 이는
// buildCompareSeries(periodDays) 가 그 구간을 직접 0% 로 만들 때와 정확히 같다.
// (복리는 곱셈이므로 일별 수익률·중복 제거 인덱스도 그대로 보존된다.)
//
// → 기간 변경 시 무거운 buildCompareSeries 대신 가벼운 slice + 선형 재기준화만 수행.
// =============================================================
export function windowCompareSeries(maxSeries: CompareSeries[], periodDays: number): CompareSeries[] {
  if (!Number.isFinite(periodDays)) return maxSeries; // MAX → 그대로.
  if (maxSeries.length === 0) return maxSeries;

  // 전 시리즈 통틀어 가장 최근 거래일.
  let lastMs = -Infinity;
  for (const s of maxSeries) {
    const last = s.points[s.points.length - 1];
    if (last) {
      const ms = parseMs(last.date);
      if (ms > lastMs) lastMs = ms;
    }
  }
  if (!Number.isFinite(lastMs)) return maxSeries;
  const cutoffMs = lastMs - periodDays * DAY_MS;

  // 윈도 시작일 = 원본 A·B 가 모두 존재하는, cutoff 이상의 가장 늦은 첫 거래일.
  // (buildCompareSeries 의 commonStart 규칙과 동일하게 두 본체 기준으로 정렬.)
  let windowStart = "";
  for (const s of maxSeries) {
    if (s.key !== "a" && s.key !== "b") continue;
    const first = s.points.find((p) => parseMs(p.date) >= cutoffMs);
    if (first && first.date > windowStart) windowStart = first.date;
  }
  if (!windowStart) return maxSeries; // cutoff 이 전체 범위를 덮음 → MAX 와 동일.

  const sliced = maxSeries.map((s) => ({
    ...s,
    points: s.points.filter((p) => p.date >= windowStart),
  }));
  return rebaseCompareSeries(sliced, windowStart);
}
