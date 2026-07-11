import assert from "node:assert/strict";
import {
  calculateRetirementSafety,
  safetyGradeFromScore,
  scorePreservationRatio,
} from "../lib/asset-simulator-safety.ts";
import { buildExitYearPlans, calculateAssetSimulatorPreview, normalizeInputs } from "../lib/asset-simulator.ts";
import { DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type { RetirementSafetyResult, SimulatorProjection } from "../lib/asset-simulator-types.ts";

type Series = number | number[];

type FixtureOptions = {
  taxAssets?: number[];
  brokerageAssets?: number[];
  combinedAssets?: number[];
  requiredMonthlyReal?: Series;
  taxMonthlyReal?: Series;
  brokerageMonthlyReal?: Series;
  dividendsReal?: number[];
};

function seriesLength(value: Series | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

function at(value: Series | undefined, index: number, fallback: number): number {
  if (!Array.isArray(value)) return value ?? fallback;
  return value[index] ?? value.at(-1) ?? fallback;
}

function assetAt(values: number[] | undefined, index: number, fallback: number): number {
  return values?.[index] ?? values?.at(-1) ?? fallback;
}

function fixture(options: FixtureOptions = {}): SimulatorProjection {
  const years = Math.max(
    3,
    options.taxAssets?.length ?? 0,
    options.brokerageAssets?.length ?? 0,
    options.combinedAssets?.length ?? 0,
    options.dividendsReal?.length ?? 0,
    seriesLength(options.requiredMonthlyReal),
    seriesLength(options.taxMonthlyReal),
    seriesLength(options.brokerageMonthlyReal),
  );
  const inputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, years });
  const base = calculateAssetSimulatorPreview(inputs, buildExitYearPlans(inputs), true);

  return {
    ...base,
    chartRows: base.chartRows.map((row, index) => {
      const taxAssets = assetAt(options.taxAssets, index, 100);
      const brokerageAssets = assetAt(options.brokerageAssets, index, 100);
      return {
        ...row,
        realTaxSavingBalance: taxAssets,
        taxableDividendBalanceReal: brokerageAssets,
        combinedRealBalance: assetAt(options.combinedAssets, index, taxAssets + brokerageAssets),
      };
    }),
    totalWithdrawRows: base.totalWithdrawRows.map((row, index) => {
      const requiredMonthlyReal = at(options.requiredMonthlyReal, index, 100);
      const taxMonthlyReal = at(options.taxMonthlyReal, index, requiredMonthlyReal);
      const brokerageMonthlyReal = at(options.brokerageMonthlyReal, index, 10);
      return {
        ...row,
        isWithdraw: index > 0,
        realWithdraw: index > 0 ? requiredMonthlyReal * 12 : 0,
        taxSavingMonthlyReal: index > 0 ? taxMonthlyReal : 0,
        taxableMonthlyDividendReal: index > 0 ? brokerageMonthlyReal : 0,
        totalMonthlyIncomeReal: index > 0 ? taxMonthlyReal + brokerageMonthlyReal : 0,
      };
    }),
    dividendRows: base.dividendRows.map((row, index) => {
      const brokerageMonthlyReal = at(options.brokerageMonthlyReal, index, 10);
      const dividendReal = options.dividendsReal?.[index] ?? (index > 0 ? brokerageMonthlyReal * 12 : 0);
      return {
        ...row,
        afterTaxAnnualDividendReal: dividendReal,
        afterTaxMonthlyDividendReal: dividendReal / 12,
      };
    }),
  };
}

function assertScoreRange(result: RetirementSafetyResult, label: string): void {
  for (const [account, safety] of Object.entries(result)) {
    assert.ok(safety.score >= 0 && safety.score <= 100, `${label}.${account} 점수는 0~100`);
  }
}

const scoreBoundaries = [
  { score: 90, grade: "S" },
  { score: 80, grade: "A" },
  { score: 65, grade: "B" },
  { score: 50, grade: "C" },
  { score: 35, grade: "D" },
  { score: 34.999, grade: "F" },
] as const;

for (const { score, grade } of scoreBoundaries) {
  assert.equal(safetyGradeFromScore(score), grade, `${score}점 등급 경계`);
}
assert.equal(safetyGradeFromScore(100, true), "F", "hard failure는 점수와 무관하게 F");

assert.equal(scorePreservationRatio(0.3), 0, "보존율 30%는 hard failure 보존 점수 0");
assert.equal(scorePreservationRatio(0.5), 55, "보존율 50%는 허용 하한 점수 55");
assert.equal(scorePreservationRatio(0.8), 82, "보존율 80%는 높은 보존 점수");
assert.equal(scorePreservationRatio(1), 100, "보존율 100%는 보존 점수 만점");

{
  const ideal = calculateRetirementSafety(fixture());
  assert.equal(ideal.taxSaving.grade, "S", "안정적인 절세계좌 종합 점수는 S");
  assert.equal(ideal.brokerage.grade, "S", "안정적인 위탁계좌 종합 점수는 S");
  assertScoreRange(ideal, "ideal");
}

{
  const result = calculateRetirementSafety(fixture({
    taxAssets: [100, 100, 100, 100, 100],
    taxMonthlyReal: [0, 10, 10, 10, 100],
  })).taxSaving;
  assert.notEqual(result.grade, "S", "보존율 100%여도 현금흐름이 약하면 무조건 S가 아님");
  assert.equal(result.metrics.failed, false, "일부 현금흐름 약화만으로 hard failure 처리하지 않음");
}

{
  const result = calculateRetirementSafety(fixture({ taxAssets: [100, 75, 50] })).taxSaving;
  assert.ok(result.grade === "B" || result.grade === "C", "보존율 50%는 B 또는 C 허용 구간");
  assert.equal(result.metrics.failed, false, "보존율 50%는 즉시 실패가 아님");
  assert.equal(result.metrics.preservationScore, 55, "보존율 50% 보존 점수");
  assert.ok(result.positives.some((message) => message.includes("허용 범위")), "보존율 50% 사용자 문구");
}

{
  const result = calculateRetirementSafety(fixture({ taxAssets: [100, 60, 40] })).taxSaving;
  assert.equal(result.metrics.failed, false, "보존율 30% 초과 50% 미만은 hard failure가 아님");
  assert.ok(result.warnings.some((message) => message.includes("권장 범위")), "낮은 보존율은 부드러운 점검 문구로 안내");
}

{
  const result = calculateRetirementSafety(fixture({ taxAssets: [100, 60, 30] })).taxSaving;
  assert.equal(result.grade, "F", "보존율 30%는 hard failure F");
  assert.equal(result.metrics.failed, true, "보존율 30% hard failure");
  assert.equal(result.metrics.failureReason, "LOW_ASSET", "보존율 hard failure 코드");
}

{
  const result = calculateRetirementSafety(fixture({
    taxMonthlyReal: [0, 99.5, 99.5],
    requiredMonthlyReal: 100,
  })).taxSaving;
  assert.equal(result.metrics.shortfallYears, 0, "1% 미만의 미세 부족은 부족 연도로 계산하지 않음");
  assert.equal(result.metrics.livingExpensesCovered, true, "미세 부족 허들 적용 후 생활비 충당");
}

{
  const result = calculateRetirementSafety(fixture({
    combinedAssets: [200, 200, 200, 200, 200],
    requiredMonthlyReal: 100,
    taxMonthlyReal: [0, 50, 100, 100, 100],
    brokerageMonthlyReal: 0,
  })).combined;
  assert.equal(result.metrics.shortfallYears, 1, "생활비 부족 1개 연도 감지");
  assert.equal(result.metrics.consecutiveShortfallYears, 1, "최장 연속 부족 1년");
  assert.equal(result.metrics.failed, false, "생활비 부족 1년은 hard failure가 아님");
  assert.ok(result.warnings.some((message) => message.includes("일부 연도")), "생활비 부족 1년 경고 문구");
}

{
  const result = calculateRetirementSafety(fixture({
    combinedAssets: [200, 200, 200, 200, 200],
    requiredMonthlyReal: 100,
    taxMonthlyReal: [0, 50, 50, 100, 100],
    brokerageMonthlyReal: 0,
  })).combined;
  assert.equal(result.metrics.consecutiveShortfallYears, 2, "생활비 부족 2년 연속 감지");
  assert.equal(result.metrics.failed, true, "장기간 통합 생활비 부족은 hard failure");
  assert.equal(result.metrics.failureReason, "INCOME_SHORTAGE", "장기간 부족 실패 코드");
  assert.equal(result.grade, "F", "장기간 통합 생활비 부족은 F");
}

{
  const result = calculateRetirementSafety(fixture({ taxMonthlyReal: 0 })).taxSaving;
  assert.equal(result.metrics.failed, true, "절세계좌 핵심 현금흐름 완전 중단은 hard failure");
  assert.equal(result.metrics.failureReason, "INCOME_SHORTAGE", "절세계좌 현금흐름 중단 실패 코드");
  assert.equal(result.grade, "F", "절세계좌 현금흐름 완전 중단은 F");
}

{
  const stable = calculateRetirementSafety(fixture({
    brokerageAssets: [100, 100, 100, 100, 100],
    dividendsReal: [0, 120, 120, 120, 120],
  })).brokerage;
  const weakening = calculateRetirementSafety(fixture({
    brokerageAssets: [100, 100, 100, 100, 100],
    dividendsReal: [0, 120, 120, 60, 60],
  })).brokerage;
  assert.equal(stable.metrics.incomeCoverageScore, 100, "지속 배당 점수 만점");
  assert.ok(weakening.metrics.incomeCoverageScore < stable.metrics.incomeCoverageScore, "배당 약화 시 지속성 점수 감점");
  assert.equal(weakening.metrics.failed, false, "배당 약화는 hard failure가 아님");
  assert.ok(weakening.warnings.some((message) => message.includes("배당 현금흐름")), "배당 약화 경고 문구");

  const stopped = calculateRetirementSafety(fixture({ dividendsReal: [0, 0, 0, 0, 0] })).brokerage;
  assert.equal(stopped.metrics.failed, true, "배당 현금흐름 완전 중단은 hard failure");
  assert.equal(stopped.metrics.failureReason, "DIVIDEND_STOPPED", "배당 중단 실패 코드");
  assert.equal(stopped.grade, "F", "배당 중단은 F");
}

{
  const result = calculateRetirementSafety(fixture({
    taxAssets: [100, 100, 100, 100, 100, 90, 70, 50],
    taxMonthlyReal: 100,
  })).taxSaving;
  assert.equal(result.metrics.latePeriodDecline, true, "마지막 25% 연속 자산 감소 감지");
  assert.ok(result.metrics.stabilityScore < 70, "후반부 급격한 감소는 중립 점수보다 낮음");
  assert.ok(result.warnings.some((message) => message.includes("후반부 자산 감소")), "후반부 감소 경고 문구");
}

{
  const result = calculateRetirementSafety(fixture({
    taxAssets: [100, 40, 0],
    brokerageAssets: [100, 100, 100],
    combinedAssets: [200, 140, 100],
  }));
  assert.equal(result.taxSaving.metrics.failed, true, "절세계좌 고갈 독립 감지");
  assert.equal(result.brokerage.metrics.failed, false, "절세계좌 실패가 위탁계좌에 전파되지 않음");
  assert.equal(result.combined.metrics.failed, false, "절세계좌 실패가 통합 평가에 직접 전파되지 않음");
  assertScoreRange(result, "independent");
}

{
  const source = fixture();
  const before = JSON.stringify(source);
  calculateRetirementSafety(source);
  assert.equal(JSON.stringify(source), before, "Safety Engine은 입력 projection을 변경하지 않는 순수 함수");
}

{
  const result = calculateRetirementSafety(fixture()).combined;
  const metricKeys = [
    "startingRealAssets",
    "endingRealAssets",
    "preservationRatio",
    "yearsEvaluated",
    "failed",
    "failureReason",
    "preservationScore",
    "incomeCoverageScore",
    "depletionScore",
    "stabilityScore",
    "shortfallYears",
    "consecutiveShortfallYears",
    "latePeriodDecline",
  ];
  for (const key of metricKeys) assert.ok(key in result.metrics, `UI용 metrics.${key} 제공`);
  assert.ok([...result.positives, ...result.warnings].every((message) => !/(망함|파산)/.test(message)), "과도하게 단정적인 문구 없음");
}

{
  const inputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, years: 3 });
  const noRetirement = calculateAssetSimulatorPreview(
    inputs,
    buildExitYearPlans(inputs).map((row) => ({ ...row, monthlyContribution: 100 })),
  );
  const result = calculateRetirementSafety(noRetirement);
  for (const account of Object.values(result)) {
    assert.equal(account.metrics.failureReason, "DATA_INSUFFICIENT", "은퇴 데이터 부족 코드");
    assert.equal(account.metrics.failed, false, "은퇴 데이터 부족을 hard failure로 확정하지 않음");
    assert.equal(account.metrics.yearsEvaluated, 0, "은퇴 데이터 없으면 평가기간 0");
    assert.equal(account.grade, "F", "은퇴 데이터 없으면 안전 등급을 확정하지 않음");
  }
}

console.log("asset simulator retirement safety checks passed (composite scores + hard failures + tolerance + stability + isolation)");
