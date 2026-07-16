import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calculateAssetSimulatorPreview } from "../lib/asset-simulator.ts";
import { calculateRetirementSafety } from "../lib/asset-simulator-safety.ts";
import {
  calibrateStressSafetyForDisplay,
  formatPreservationRatio,
} from "../lib/asset-simulator-portfolio-ui.ts";
import {
  EARLY_DOWNTURN_DIVIDEND_CUT_MULTIPLIER,
  EARLY_DOWNTURN_LOW_RETURN_PCT,
  EARLY_DOWNTURN_SHOCK_RETURN_PCT,
  buildStressSchedule,
} from "../lib/asset-simulator-stress.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type { AppliedPortfolioAssumptionsV1, AppliedPortfolioHoldingAssumption } from "../lib/asset-simulator-types.ts";

const EARLY_DOWNTURN = { version: 1 as const, preset: "early_downturn" as const };
const NONE = { version: 1 as const, preset: "none" as const };

function holding(
  holdingId: string,
  ticker: string,
  metrics: Partial<Pick<AppliedPortfolioHoldingAssumption,
    "totalReturnCagrPct" | "priceCagrPct" | "dividendYieldPct" | "dividendGrowthPct">>,
): AppliedPortfolioHoldingAssumption {
  return {
    holdingId,
    ticker,
    weightPct: 100,
    metricMode: "manual",
    totalReturnCagrPct: null,
    priceCagrPct: null,
    dividendYieldPct: null,
    dividendGrowthPct: null,
    ...metrics,
    sources: {
      totalReturnCagr: "manual",
      priceCagr: "manual",
      dividendYield: "manual",
      dividendGrowth: "manual",
    },
    statuses: {
      totalReturnCagr: "manual",
      priceCagr: "manual",
      dividendYield: "manual",
      dividendGrowth: "manual",
    },
    warnings: [],
  };
}

const portfolioAssumptions: AppliedPortfolioAssumptionsV1 = {
  version: 1,
  appliedAt: "2026-07-12T00:00:00.000Z",
  taxSaving: {
    accountType: "taxSaving",
    holdings: [holding("tax-qld", "QLD", { totalReturnCagrPct: 12 })],
  },
  brokerage: {
    accountType: "brokerage",
    holdings: [holding("broker-jepq", "JEPQ", {
      priceCagrPct: 4,
      dividendYieldPct: 8,
      dividendGrowthPct: 2,
    })],
  },
};

const inputs = {
  ...DEFAULT_SIMULATOR_INPUTS,
  initialTaxableDividend: 10_000,
};
const plans = buildDefaultYearPlans(inputs.startYear, inputs.years);
const base = calculateAssetSimulatorPreview(inputs, plans);

// stress 미지정/none 은 기존 projection 과 완전히 같아야 한다.
assert.deepEqual(calculateAssetSimulatorPreview(inputs, plans, false, {}), base, "빈 options 는 기존 projection 유지");
assert.deepEqual(
  calculateAssetSimulatorPreview(inputs, plans, false, { stressScenario: NONE }),
  base,
  "stress none 은 기존 projection 과 deep-equal",
);
assert.deepEqual(
  calculateAssetSimulatorPreview(inputs, plans, false, { stressScenario: null }),
  base,
  "stress null 은 기존 projection 과 deep-equal",
);

const stress = calculateAssetSimulatorPreview(inputs, plans, false, { stressScenario: EARLY_DOWNTURN });
assert.notDeepEqual(stress, base, "early_downturn 은 별도 projection 생성");
assert.deepEqual(stress.timeline, base.timeline, "stress 는 timeline 을 바꾸지 않음");
assert.deepEqual(stress.yearPlans, base.yearPlans, "stress 는 계획표를 바꾸지 않음");

const retirementIndex = base.timeline.retirementIndex;
assert.notEqual(retirementIndex, null, "검사 fixture 에 은퇴 시점 존재");
const retireIdx = retirementIndex!;
const firstStressIndex = retireIdx + 1;
assert.ok(firstStressIndex + 2 < base.results.length, "은퇴 후 3년 검사 구간 존재");

// 은퇴 전과 은퇴 시점까지는 모든 계좌 projection 이 동일하다.
assert.deepEqual(stress.results.slice(0, firstStressIndex), base.results.slice(0, firstStressIndex), "stress 는 은퇴 이후에만 절세계좌 반영");
assert.deepEqual(
  stress.dividendRows.slice(0, firstStressIndex),
  base.dividendRows.slice(0, firstStressIndex),
  "stress 는 은퇴 이후에만 위탁계좌 반영",
);

const schedule = buildStressSchedule(EARLY_DOWNTURN, base.timeline);
assert.ok(schedule, "early_downturn schedule 생성");
assert.equal(schedule!.taxSavingReturnPctAt(firstStressIndex), EARLY_DOWNTURN_SHOCK_RETURN_PCT, "은퇴 직후 절세계좌 -30% shock");
assert.equal(schedule!.brokeragePriceReturnPctAt(firstStressIndex), EARLY_DOWNTURN_SHOCK_RETURN_PCT, "은퇴 직후 위탁 가격 -30% shock");
assert.equal(schedule!.taxSavingReturnPctAt(firstStressIndex + 1), EARLY_DOWNTURN_LOW_RETURN_PCT, "은퇴 후 2년차 0% 저수익");
assert.equal(schedule!.taxSavingReturnPctAt(firstStressIndex + 2), EARLY_DOWNTURN_LOW_RETURN_PCT, "은퇴 후 3년차 0% 저수익");
assert.equal(schedule!.taxSavingReturnPctAt(firstStressIndex + 3), null, "3년 이후 기본 수익률 복귀");
for (let offset = 0; offset < 3; offset += 1) {
  assert.equal(
    schedule!.brokerageDividendMultiplierAt(firstStressIndex + offset),
    EARLY_DOWNTURN_DIVIDEND_CUT_MULTIPLIER,
    `은퇴 후 ${offset + 1}년차 배당 20% 삭감`,
  );
}
assert.equal(schedule!.brokerageDividendMultiplierAt(firstStressIndex + 3), 1, "3년 이후 배당률 복귀");

assert.ok(
  stress.results[firstStressIndex].pensionNominal < base.results[firstStressIndex].pensionNominal,
  "첫해 shock 으로 연금 잔고 감소",
);
assert.ok(
  stress.dividendRows[firstStressIndex].taxableDividendBalanceNominal < base.dividendRows[firstStressIndex].taxableDividendBalanceNominal,
  "첫해 shock 으로 위탁 잔고 감소",
);
assert.equal(
  stress.results[firstStressIndex + 1].pensionNominal,
  stress.results[firstStressIndex].pensionNominal,
  "2년차 절세계좌 0% 저수익이 실제 잔고에 반영",
);
assert.equal(
  stress.results[firstStressIndex + 2].pensionNominal,
  stress.results[firstStressIndex + 1].pensionNominal,
  "3년차 절세계좌 0% 저수익이 실제 잔고에 반영",
);
assert.equal(
  stress.dividendRows[firstStressIndex + 1].taxableDividendBalanceNominal,
  stress.dividendRows[firstStressIndex].taxableDividendBalanceNominal,
  "2년차 위탁 가격 0% 저수익이 실제 잔고에 반영",
);
assert.equal(
  stress.dividendRows[firstStressIndex + 2].taxableDividendBalanceNominal,
  stress.dividendRows[firstStressIndex + 1].taxableDividendBalanceNominal,
  "3년차 위탁 가격 0% 저수익이 실제 잔고에 반영",
);
assert.equal(
  stress.dividendRows[firstStressIndex].afterTaxAnnualDividendNominal,
  base.dividendRows[firstStressIndex].afterTaxAnnualDividendNominal * EARLY_DOWNTURN_DIVIDEND_CUT_MULTIPLIER,
  "첫 stress 연도 배당 현금흐름 20% 삭감",
);

// 같은 목표 월생활비를 기본/하락장 Safety 양쪽에 전달하고 결과를 별도로 평가한다.
const targetMonthlyExpenseReal = 300;
const baseSafety = calculateRetirementSafety(base, { targetMonthlyExpenseReal });
const stressSafety = calculateRetirementSafety(stress, { targetMonthlyExpenseReal });
assert.equal(baseSafety.combined.metrics.targetMonthlyExpenseReal, targetMonthlyExpenseReal, "기본 Safety 목표 월생활비 반영");
assert.equal(stressSafety.combined.metrics.targetMonthlyExpenseReal, targetMonthlyExpenseReal, "stress Safety 목표 월생활비 반영");
assert.notDeepEqual(stressSafety, baseSafety, "기본 Safety 와 stress Safety 별도 계산");
assert.ok(
  stressSafety.combined.metrics.endingRealAssets < baseSafety.combined.metrics.endingRealAssets,
  "stress Safety 는 하락한 통합 실질 잔고 평가",
);

// raw Safety 결과는 보존하고, 비교 UI에 쓰는 stress 점수/등급만 같은 계정의 base 이하로 제한한다.
const invertedStressSafety = {
  ...stressSafety,
  taxSaving: {
    ...stressSafety.taxSaving,
    score: Math.min(100, baseSafety.taxSaving.score + 3.9),
    grade: "S" as const,
    metrics: {
      ...stressSafety.taxSaving.metrics,
      preservationRatio: Math.max(0, baseSafety.taxSaving.metrics.preservationRatio - 1),
    },
  },
};
const displayedStressSafety = calibrateStressSafetyForDisplay(baseSafety, invertedStressSafety);
assert.ok(
  invertedStressSafety.taxSaving.metrics.preservationRatio < baseSafety.taxSaving.metrics.preservationRatio,
  "fixture 의 stress 보존율은 base 보다 낮음",
);
assert.ok(invertedStressSafety.taxSaving.score > baseSafety.taxSaving.score, "raw stress 점수 역전 fixture");
assert.equal(displayedStressSafety.taxSaving.score, baseSafety.taxSaving.score, "표시 stress 점수는 base 점수로 cap");
assert.equal(
  displayedStressSafety.taxSaving.metrics.preservationRatio,
  invertedStressSafety.taxSaving.metrics.preservationRatio,
  "표시 보정 후에도 stress raw metric 유지",
);
assert.equal(stressSafety.taxSaving.score, calculateRetirementSafety(stress, { targetMonthlyExpenseReal }).taxSaving.score, "원본 stress Safety 불변");

assert.equal(formatPreservationRatio(67.09), "1,000% 이상", "6709% 보존율 상한 표시");
assert.equal(formatPreservationRatio(22.56), "1,000% 이상", "2256% 보존율 상한 표시");
assert.equal(formatPreservationRatio(9.99), "999%", "1000% 미만은 기존 퍼센트 표시");
assert.equal(invertedStressSafety.taxSaving.metrics.preservationRatio, Math.max(0, baseSafety.taxSaving.metrics.preservationRatio - 1), "포맷 후 raw metric 유지");

// portfolio mode에서도 동일한 effective assumptions 를 사용한 뒤 stress 를 덧씌운다.
const portfolioBase = calculateAssetSimulatorPreview(inputs, plans, false, { portfolioAssumptions });
const portfolioStress = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions,
  stressScenario: EARLY_DOWNTURN,
});
assert.deepEqual(portfolioStress.summary.portfolioSummary, portfolioBase.summary.portfolioSummary, "stress projection 에 portfolio summary 유지");
assert.deepEqual(
  portfolioStress.results.slice(0, firstStressIndex),
  portfolioBase.results.slice(0, firstStressIndex),
  "portfolio mode 도 은퇴 전 동일",
);
assert.notEqual(
  portfolioStress.results[retireIdx].pensionNominal,
  stress.results[retireIdx].pensionNominal,
  "stress projection 이 portfolio 절세계좌 assumptions 반영",
);
assert.notEqual(
  portfolioStress.dividendRows[firstStressIndex].afterTaxAnnualDividendNominal,
  stress.dividendRows[firstStressIndex].afterTaxAnnualDividendNominal,
  "stress projection 이 portfolio 위탁 배당 assumptions 반영",
);

function brokeragePriceReturnAt(projection: typeof portfolioStress, index: number): number {
  const previousBalance = projection.dividendRows[index - 1]?.taxableDividendBalanceNominal;
  const balance = projection.dividendRows[index]?.taxableDividendBalanceNominal;
  assert.ok(typeof previousBalance === "number" && previousBalance > 0, `price return index ${index} has a previous balance`);
  assert.ok(typeof balance === "number", `price return index ${index} has a balance`);
  return balance / previousBalance - 1;
}

function effectiveDividendRateAt(projection: typeof portfolioStress, index: number): number {
  const previousBalance = projection.dividendRows[index - 1]?.taxableDividendBalanceNominal;
  const afterTaxDividend = projection.dividendRows[index]?.afterTaxAnnualDividendNominal;
  assert.ok(typeof previousBalance === "number" && previousBalance > 0, `dividend rate index ${index} has a previous balance`);
  assert.ok(typeof afterTaxDividend === "number", `dividend rate index ${index} has a dividend`);
  return afterTaxDividend / previousBalance / 0.85;
}

// Bad은 초기 3년의 충격만 적용한다. 가격 수익률은 4년 차부터, 배당성장률은
// 배당률 역산 기준으로 4년 차부터 각각 사용자의 portfolio 기본 가정으로 돌아와야 한다.
for (let offset = 0; offset < 3; offset += 1) {
  const index = firstStressIndex + offset;
  const baseDividendRate = effectiveDividendRateAt(portfolioBase, index);
  const stressedDividendRate = effectiveDividendRateAt(portfolioStress, index);
  assert.ok(
    Math.abs(stressedDividendRate - baseDividendRate * EARLY_DOWNTURN_DIVIDEND_CUT_MULTIPLIER) < 1e-12,
    `stress year ${offset + 1} dividend rate is reduced exactly once to 80%`,
  );
}

const recoveryIndex = firstStressIndex + 3;
assert.ok(
  Math.abs(brokeragePriceReturnAt(portfolioStress, recoveryIndex) - 0.04) < 1e-12,
  "stress year 4 brokerage price return returns to the 4% base assumption",
);
assert.ok(
  Math.abs(effectiveDividendRateAt(portfolioStress, recoveryIndex) - effectiveDividendRateAt(portfolioBase, recoveryIndex)) < 1e-12,
  "stress year 4 dividend rate returns to the base dividend-growth path",
);
assert.ok(
  Math.abs(
    portfolioStress.results[recoveryIndex].pensionNominal / portfolioStress.results[recoveryIndex - 1].pensionNominal - 1 - 0.12,
  ) < 1e-12,
  "stress year 4 tax-saving return returns to the 12% base assumption",
);

// UI 배선: 기본 projection 과 stress projection 을 분리하고 동일 target 으로 Safety 를 계산한다.
const page = readFileSync("components/asset-simulator/AssetSimulatorPage.tsx", "utf8");
const section = readFileSync("components/asset-simulator/RetirementSafetySection.tsx", "utf8");
assert.match(page, /const stressProjection = useMemo/, "페이지에서 stress projection 별도 계산");
assert.match(page, /stressScenario: \{ version: 1, preset: "early_downturn" \}/, "early_downturn preset 연결");
assert.doesNotMatch(page, /returnMultiplier: 0\.65/, "Bad no longer permanently reduces long-term return to 65%");
assert.doesNotMatch(page, /priceReturnMultiplier: 0\.65/, "Bad no longer permanently reduces price return to 65%");
assert.doesNotMatch(page, /dividendGrowthMultiplier: 0\.5/, "Bad no longer permanently reduces dividend growth to 50%");
assert.doesNotMatch(page, /dividendYieldMultiplier: 0\.8/, "Bad dividend cut is supplied only by the stress schedule");
assert.match(page, /stressProjection=\{stressProjection\}/, "안전성 섹션에 stress projection 전달");
assert.match(section, /calculateRetirementSafety\(projection, \{ targetMonthlyExpenseReal \}\)/, "기본 Safety 에 target 전달");
assert.match(section, /calculateRetirementSafety\(stressProjection, \{ targetMonthlyExpenseReal \}\)/, "stress Safety 에 target 전달");
assert.match(section, /calibrateStressSafetyForDisplay\(safety, stressSafety\)/, "stress 표시 점수 비교 cap 연결");
// 보존율 상한 포맷은 PR-3 에서 계좌 상세 패널(SafetyAccountDetailPanel)로 이동했다.
const detailPanel = readFileSync("components/asset-simulator/SafetyAccountDetailPanel.tsx", "utf8");
assert.match(detailPanel, /formatPreservationRatio/, "보존율 상한 포맷 연결(계좌 상세 패널)");
assert.match(page, /const normalProjection = useMemo/, "Normal projection 별도 계산");
assert.match(page, /returnMultiplier: 0\.85/, "Normal 성장률 보정 연결");
assert.match(section, /Good 시나리오/, "Good 시나리오 UI");
assert.match(section, /Bad 시나리오/, "Bad 시나리오 UI");
assert.match(section, /첫해 위험자산 가격 수익률 -30%, 2~3년 차 0%/, "stress price schedule 안내");
assert.match(section, /초기 3년 배당률 20% 삭감/, "배당 삭감 안내");
assert.match(section, /순서위험\(Sequence-of-Returns Risk\)/, "Bad sequence-of-returns-risk meaning is stated");
assert.match(section, /초기 3년 충격 이후 장기 성장률과 배당 성장률은 사용자의 기본 가정으로 복귀합니다/, "Bad recovery to base assumptions is stated");
assert.match(section, /grid-cols-1/, "모바일 단일 열 레이아웃");
assert.match(section, /dark:/, "다크모드 스타일 유지");

console.log("asset simulator stress scenario checks passed");
