import assert from "node:assert/strict";
import { computeDailyReturnCorrelation, MIN_CORRELATION_OBSERVATIONS } from "../lib/stock-compare/correlation";
import type { TrLevels } from "../lib/stock-compare/total-return";

const DAY_MS = 86_400_000;
const approx = (left: number | null, right: number, tolerance = 1e-10) =>
  left != null && Math.abs(left - right) <= tolerance;

function dates(count: number, start = "2024-01-01"): string[] {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  return Array.from({ length: count }, (_, index) => new Date(startMs + index * DAY_MS).toISOString().slice(0, 10));
}

function levelsFromReturns(ticker: string, returns: number[], inputDates = dates(returns.length + 1)): TrLevels {
  let level = 100;
  const levels: Array<[string, number]> = [[inputDates[0], level]];
  returns.forEach((dailyReturn, index) => {
    level *= 1 + dailyReturn;
    levels.push([inputDates[index + 1], level]);
  });
  return { ticker, levels };
}

function compute(a: TrLevels, b: TrLevels, periodDays = Infinity) {
  return computeDailyReturnCorrelation(a, b, periodDays);
}

const symmetricReturns = Array.from({ length: 20 }, (_, index) => {
  const value = index < 10 ? index - 10 : index - 9;
  return value / 1_000;
});
const identicalA = levelsFromReturns("A", symmetricReturns);
const identicalB = levelsFromReturns("B", symmetricReturns);
const identical = compute(identicalA, identicalB);
assert.equal(identical.status, "ok");
assert.equal(identical.observations, MIN_CORRELATION_OBSERVATIONS);
assert.ok(approx(identical.correlation, 1), `동일 수익률은 1이어야 함: ${identical.correlation}`);

const opposite = compute(identicalA, levelsFromReturns("B", symmetricReturns.map((value) => -value)));
assert.equal(opposite.status, "ok");
assert.ok(approx(opposite.correlation, -1), `반대 수익률은 -1이어야 함: ${opposite.correlation}`);

const nonlinearReturns = symmetricReturns.map((value) => value * value * 10);
const uncorrelated = compute(identicalA, levelsFromReturns("B", nonlinearReturns));
assert.equal(uncorrelated.status, "ok");
assert.ok(approx(uncorrelated.correlation, 0, 1e-9), `대칭 선형/제곱 배열은 0이어야 함: ${uncorrelated.correlation}`);

const swapped = compute(identicalB, identicalA);
assert.ok(approx(swapped.correlation, identical.correlation!), "A/B 순서 교환 결과가 같아야 함");

const constant = compute(levelsFromReturns("A", Array(20).fill(0.01)), identicalB);
assert.equal(constant.status, "zero-variance");
assert.equal(constant.correlation, null);

const empty = compute({ ticker: "A", levels: [] }, { ticker: "B", levels: [] });
assert.equal(empty.status, "insufficient-data");
assert.equal(empty.observations, 0);

const nineteen = compute(
  levelsFromReturns("A", symmetricReturns.slice(0, 19)),
  levelsFromReturns("B", symmetricReturns.slice(0, 19)),
);
assert.equal(nineteen.status, "insufficient-data");
assert.equal(nineteen.observations, 19);

const twenty = compute(identicalA, identicalB);
assert.equal(twenty.status, "ok");
assert.equal(twenty.observations, 20);

// 서로 다른 시작/종료, 한쪽 휴장일, 내림차순, 중복 날짜, ISO 시간 입력을 한 번에 검증한다.
const calendarDates = dates(26);
const rawA = levelsFromReturns("US", Array.from({ length: 25 }, (_, index) => (index % 5 - 2) / 1_000), calendarDates);
const rawB = levelsFromReturns("KR", Array.from({ length: 25 }, (_, index) => (index % 7 - 3) / 1_200), calendarDates);
rawA.levels = rawA.levels
  .filter(([date]) => date !== calendarDates[4])
  .map(([date, level]) => [`${date}T21:00:00-05:00`, level])
  .reverse();
rawB.levels = rawB.levels
  .filter(([date]) => date !== calendarDates[8])
  .map(([date, level]) => [`${date}T15:30:00+09:00`, level]);
rawB.levels.push([`${calendarDates[10]}T23:59:00+09:00`, rawB.levels.find(([date]) => date.startsWith(calendarDates[10]))![1]]);
rawB.levels.push([`${calendarDates[11]}T15:30:00+09:00`, Number.NaN]);
rawB.levels.push([`${calendarDates[12]}T15:30:00+09:00`, Number.POSITIVE_INFINITY]);
const normalizedDates = compute(rawA, rawB);
assert.equal(normalizedDates.status, "ok");
assert.equal(normalizedDates.observations, 23, "양쪽에 모두 있는 날짜만 사용하고 유효 중복 날짜는 하나로 정규화");

const sameTicker = compute(identicalA, identicalA);
assert.equal(sameTicker.correlation?.toFixed(3), "1.000");

const shortPeriod = compute(
  levelsFromReturns("A", Array.from({ length: 40 }, (_, index) => (index % 5 - 2) / 1_000)),
  levelsFromReturns("B", Array.from({ length: 40 }, (_, index) => (index % 4 - 1.5) / 1_000)),
  10,
);
assert.equal(shortPeriod.status, "insufficient-data");
assert.equal(shortPeriod.observations, 10, "선택 기간 컷오프 안의 수익률만 계산");

console.log("Stock-compare daily-return correlation regression passed.");
console.table([
  { case: "identical", correlation: identical.correlation, observations: identical.observations },
  { case: "opposite", correlation: opposite.correlation, observations: opposite.observations },
  { case: "uncorrelated", correlation: uncorrelated.correlation, observations: uncorrelated.observations },
  { case: "mixed calendars", correlation: normalizedDates.correlation, observations: normalizedDates.observations },
]);
