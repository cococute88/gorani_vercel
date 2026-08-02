// =============================================================
// 두 종목의 공통 거래일 일별 수익률 피어슨 상관계수.
//
// 원칙
//  - 가격 수준이 아니라 연속된 공통 관측값의 수익률을 사용한다.
//  - 한쪽에만 있는 거래일은 제외하고 0% 대체/전일 보간을 하지 않는다.
//  - 날짜는 기존 장기 시계열의 YYYY-MM-DD 기준을 유지한다. ISO 시간이
//    포함된 입력도 앞의 날짜 부분만 사용해 시간대 변환으로 하루가 밀리지 않는다.
// =============================================================

import type { ReturnCorrelationResult } from "@/lib/stock-compare/types";
import type { TrLevels } from "@/lib/stock-compare/total-return";

const DAY_MS = 86_400_000;
export const MIN_CORRELATION_OBSERVATIONS = 20;

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function dateMs(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

function normalizeLevels(series: TrLevels): Array<[string, number]> {
  const byDate = new Map<string, number>();
  for (const [rawDate, level] of series.levels) {
    const date = normalizeIsoDate(rawDate);
    if (!date || !Number.isFinite(level) || level <= 0) continue;
    byDate.set(date, level);
  }
  return Array.from(byDate.entries()).sort(([left], [right]) => left.localeCompare(right));
}

function unavailable(
  status: Exclude<ReturnCorrelationResult["status"], "ok">,
  observations: number,
): ReturnCorrelationResult {
  return { correlation: null, observations, status };
}

export function computeDailyReturnCorrelation(
  seriesA: TrLevels,
  seriesB: TrLevels,
  periodDays: number,
): ReturnCorrelationResult {
  const a = normalizeLevels(seriesA);
  const b = normalizeLevels(seriesB);
  if (a.length < 2 || b.length < 2) return unavailable("insufficient-data", 0);

  const latestMs = Math.max(dateMs(a.at(-1)![0]), dateMs(b.at(-1)![0]));
  const cutoffMs = Number.isFinite(periodDays) ? latestMs - periodDays * DAY_MS : -Infinity;
  const aWindow = a.filter(([date]) => dateMs(date) >= cutoffMs);
  const bWindow = b.filter(([date]) => dateMs(date) >= cutoffMs);
  if (aWindow.length < 2 || bWindow.length < 2) return unavailable("insufficient-data", 0);

  // 화면 시리즈와 동일하게 두 시계열의 기간 내 첫 관측일 중 늦은 날부터 시작한다.
  const commonStart = aWindow[0][0] > bWindow[0][0] ? aWindow[0][0] : bWindow[0][0];
  const aByDate = new Map(aWindow.filter(([date]) => date >= commonStart));
  const commonLevels = bWindow
    .filter(([date]) => date >= commonStart && aByDate.has(date))
    .map(([date, bLevel]) => [date, aByDate.get(date)!, bLevel] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  const returnsA: number[] = [];
  const returnsB: number[] = [];
  for (let index = 1; index < commonLevels.length; index += 1) {
    const previous = commonLevels[index - 1];
    const current = commonLevels[index];
    const returnA = current[1] / previous[1] - 1;
    const returnB = current[2] / previous[2] - 1;
    if (!Number.isFinite(returnA) || !Number.isFinite(returnB)) continue;
    returnsA.push(returnA);
    returnsB.push(returnB);
  }

  const observations = returnsA.length;
  if (observations < MIN_CORRELATION_OBSERVATIONS) {
    return unavailable("insufficient-data", observations);
  }

  const meanA = returnsA.reduce((sum, value) => sum + value, 0) / observations;
  const meanB = returnsB.reduce((sum, value) => sum + value, 0) / observations;
  let covarianceSum = 0;
  let varianceSumA = 0;
  let varianceSumB = 0;
  for (let index = 0; index < observations; index += 1) {
    const deviationA = returnsA[index] - meanA;
    const deviationB = returnsB[index] - meanB;
    covarianceSum += deviationA * deviationB;
    varianceSumA += deviationA * deviationA;
    varianceSumB += deviationB * deviationB;
  }

  // 부동소수점 복리 역산에서 생기는 1e-16 수준의 잔차도 무분산으로 본다.
  const zeroVarianceThreshold = Number.EPSILON * observations;
  if (varianceSumA <= zeroVarianceThreshold || varianceSumB <= zeroVarianceThreshold) {
    return unavailable("zero-variance", observations);
  }

  const correlation = covarianceSum / Math.sqrt(varianceSumA * varianceSumB);
  if (!Number.isFinite(correlation)) return unavailable("invalid-result", observations);

  const clamped = Math.max(-1, Math.min(1, correlation));
  return {
    correlation: Object.is(clamped, -0) ? 0 : clamped,
    observations,
    status: "ok",
  };
}
