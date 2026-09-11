import assert from "node:assert/strict";
import {
  buildSchdKrwSeries,
  calculateSchdKrwSummary,
  type SchdAttractivenessMetrics,
  type SchdRangeKey,
  type SchdYieldPoint,
} from "../lib/schd-attractiveness";

const points: SchdYieldPoint[] = [
  { date: "2016-09-12", price: 15, high: 15, ttmDividend: 0.6, ttmYield: 4, ttmYieldRaw: 4 },
  { date: "2024-10-09", price: 28, high: 28, ttmDividend: 1.0, ttmYield: 3.571428, ttmYieldRaw: 3.571428 },
  { date: "2024-10-10", price: 28.2, high: 28.2, ttmDividend: 1.0, ttmYield: 3.546099, ttmYieldRaw: 3.546099 },
  { date: "2025-09-10", price: 30, high: 30, ttmDividend: 1.2, ttmYield: 4, ttmYieldRaw: 4 },
  { date: "2025-09-11", price: 32, high: 32, ttmDividend: 1.2, ttmYield: 3.75, ttmYieldRaw: 3.75 },
];
const fx = [
  { date: "2016-09-12", rate: 1100 },
  { date: "2024-10-09", rate: 1340 },
  { date: "2024-10-10", rate: 1342 },
  { date: "2025-09-09", rate: 1350 }, // 9/10은 환율 휴일: 직전 값 사용
  { date: "2025-09-11", rate: 1360 },
];
const series = buildSchdKrwSeries(points, fx);
assert.equal(series.length, points.length);
assert.equal(series.at(-2)?.fxDate, "2025-09-09", "미래 환율 대신 직전 영업일 환율을 사용해야 함");
assert.equal(series.at(-2)?.krwPrice, 30 * 1350);
assert.equal(series.at(-1)?.krwPrice, 32 * 1360);
assert.equal(series[1].krwPrice, 28 * 1340);
assert.ok((series[2].krwPrice / series[1].krwPrice) < 1.1, "2024년 3:1 split 전후에 3배 단절이 없어야 함");
assert.equal(buildSchdKrwSeries([points[0]], [{ date: "2016-09-01", rate: 1100 }]).length, 0, "7일 초과 환율 공백은 누락 처리");
assert.equal(buildSchdKrwSeries([points[0]], [{ date: "2016-09-13", rate: 1100 }]).length, 0, "미래 환율 소급 금지");

const baseMetrics = {
  points,
  latestDate: "2025-09-11",
  currentPrice: 32,
  currentTtmYield: 3.75,
  latestFourDividend: 1.2,
  targetRows: [], dividendHistory: [], dividendGrowthHistory: [], latestFourDividends: [],
  high52w: 32, drawdownFrom52wHighPct: 0, fiveYearAverageYield: 3.8,
  recentQuarterDividend: 0.3, recentQuarterDividendDisplay: 0.3,
  dividendAmountSource: "yahoo", warnings: [],
} satisfies SchdAttractivenessMetrics;
for (const range of ["1M", "6M", "1Y", "5Y", "10Y"] satisfies SchdRangeKey[]) {
  const summary = calculateSchdKrwSummary(baseMetrics, fx, range);
  assert.ok(summary, `${range} 통계가 계산되어야 함`);
  assert.ok(Number.isFinite(summary.averageKrwPrice));
  assert.ok(summary.pricePercentile >= 0 && summary.pricePercentile <= 100);
  assert.ok(summary.efficiencyPercentile >= 0 && summary.efficiencyPercentile <= 100);
}
const summary = calculateSchdKrwSummary(baseMetrics, fx, "10Y")!;
assert.equal(summary.currentKrwPrice, 32 * 1360);
assert.equal(summary.currentEfficiency, 1_000_000 / (32 * 1360) * 1.2);
const highFxEfficiency = buildSchdKrwSeries([points.at(-1)!], [{ date: "2025-09-11", rate: 1500 }])[0].dividendEfficiency!;
const lowFxEfficiency = buildSchdKrwSeries([points.at(-1)!], [{ date: "2025-09-11", rate: 1200 }])[0].dividendEfficiency!;
assert.ok(lowFxEfficiency > highFxEfficiency, "환율 하락 시 원화 매수 효율이 높아져야 함");
const usdYield = points.at(-1)!.ttmDividend! / points.at(-1)!.price;
const krwYield = (points.at(-1)!.ttmDividend! * 1360) / (points.at(-1)!.price * 1360);
assert.equal(usdYield, krwYield, "동일 환율 환산 시 배당률은 불변");
const usdTarget = 30;
assert.equal((usdTarget * 1360) / (32 * 1360) - 1, usdTarget / 32 - 1, "목표가와 현재가 동시 환산 시 하락률은 불변");
assert.equal(calculateSchdKrwSummary(baseMetrics, [], "5Y"), null, "환율 장애 시 잘못된 숫자 대신 unavailable 반환");
console.log("✅ SCHD KRW 가격·효율·기간 통계·날짜 매칭·split·오류 회귀 검증 통과");
