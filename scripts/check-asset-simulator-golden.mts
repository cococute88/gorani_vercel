import assert from "node:assert/strict";
import { calculateAssetSimulatorPreview, normalizeInputs } from "../lib/asset-simulator.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type { SimulatorInputs, SimulatorProjection, YearPlanRow } from "../lib/asset-simulator-types.ts";

// LEGACY GOLDEN BASELINE:
// 현재 금융 계산에는 알려진 문제가 있지만 이 검사는 이번 기반 PR 이전의 숫자를 고정한다.
// 후속 계산 교정 PR에서는 원인이 확인된 필드만 의도적으로 갱신해야 한다.
const ABSOLUTE_TOLERANCE = 1e-6;
const RELATIVE_TOLERANCE = 1e-10;

type GoldenMetrics = {
  rowCount: number;
  retirementYear: number | null;
  actualWithdrawalStartYear: number | null;
  lastIsaBalance: number;
  lastPensionBalance: number;
  finalReserveBalance: number;
  finalNominalBalance: number;
  finalRealBalance: number;
  finalTaxableNominalBalance: number;
  finalTaxableRealBalance: number;
  finalCombinedNominalBalance: number;
  finalCombinedRealBalance: number;
  lastAfterTaxTaxAccountWithdrawal: number;
  lastAfterTaxTaxableDividend: number;
};

function metrics(projection: SimulatorProjection): GoldenMetrics {
  const result = projection.results.at(-1);
  const chart = projection.chartRows.at(-1);
  const tax = projection.taxWithdrawRows.at(-1);
  const dividend = projection.dividendRows.at(-1);
  return {
    rowCount: projection.results.length,
    retirementYear: projection.summary.retirementYear,
    actualWithdrawalStartYear: projection.summary.actualWithdrawalStartYear,
    lastIsaBalance: tax?.isaBalanceNominal ?? result?.isaNominal ?? 0,
    lastPensionBalance: tax?.pensionBalanceNominal ?? result?.pensionNominal ?? 0,
    finalReserveBalance: result?.reserveNominal ?? 0,
    finalNominalBalance: projection.summary.finalNominalWithoutWithdrawal,
    finalRealBalance: projection.summary.finalRealWithoutWithdrawal,
    finalTaxableNominalBalance: dividend?.taxableDividendBalanceNominal ?? 0,
    finalTaxableRealBalance: dividend?.taxableDividendBalanceReal ?? 0,
    finalCombinedNominalBalance: chart?.combinedNominalBalance ?? 0,
    finalCombinedRealBalance: chart?.combinedRealBalance ?? 0,
    lastAfterTaxTaxAccountWithdrawal: tax?.totalNet ?? 0,
    lastAfterTaxTaxableDividend: dividend?.afterTaxAnnualDividendNominal ?? 0,
  };
}

function assertGolden(name: string, actual: GoldenMetrics, expected: GoldenMetrics) {
  for (const key of Object.keys(expected) as Array<keyof GoldenMetrics>) {
    const actualValue = actual[key];
    const expectedValue = expected[key];
    if (typeof expectedValue === "number" && typeof actualValue === "number") {
      const tolerance = Math.max(ABSOLUTE_TOLERANCE, Math.abs(expectedValue) * RELATIVE_TOLERANCE);
      assert.ok(
        Math.abs(actualValue - expectedValue) <= tolerance,
        `${name}.${key}: expected ${expectedValue} ± ${tolerance}, got ${actualValue}`,
      );
    } else {
      assert.equal(actualValue, expectedValue, `${name}.${key}`);
    }
  }
}

const baseInputs = normalizeInputs(DEFAULT_SIMULATOR_INPUTS);
const scenarios: Array<{
  name: string;
  inputs: SimulatorInputs;
  plans: YearPlanRow[];
  exitMode?: boolean;
  expected: GoldenMetrics;
}> = [
  {
    name: "legacy default inputs normal mode",
    inputs: baseInputs,
    plans: buildDefaultYearPlans(baseInputs.startYear, baseInputs.years),
    expected: { rowCount: 30, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 28018.008552419327, lastPensionBalance: 55937.71361982623, finalReserveBalance: 0, finalNominalBalance: 166914.5240201617, finalRealBalance: 68766.57386720633, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 83955.72217224556, finalCombinedRealBalance: 35626.30529817801, lastAfterTaxTaxAccountWithdrawal: 2919.9858362047194, lastAfterTaxTaxableDividend: 0 },
  },
  {
    name: "legacy default inputs EXIT mode",
    inputs: baseInputs,
    plans: buildDefaultYearPlans(baseInputs.startYear, baseInputs.years),
    exitMode: true,
    expected: { rowCount: 30, retirementYear: 2026, actualWithdrawalStartYear: 2027, lastIsaBalance: 5566.632414789372, lastPensionBalance: 33113.11291937457, finalReserveBalance: 0, finalNominalBalance: 79817.29682997554, finalRealBalance: 32883.66947430085, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 38679.74533416395, finalCombinedRealBalance: 16413.609227296383, lastAfterTaxTaxAccountWithdrawal: 1357.3609698601103, lastAfterTaxTaxableDividend: 0 },
  },
  ...([
    [20, { rowCount: 20, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 16533.54787014987, lastPensionBalance: 32802.9618731139, finalReserveBalance: 0, finalNominalBalance: 93204.1984041313, finalRealBalance: 51604.904844740144, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 49336.50974326377, finalCombinedRealBalance: 28135.9221182537, lastAfterTaxTaxAccountWithdrawal: 3150.721178213049, lastAfterTaxTaxableDividend: 0 }],
    [30, { rowCount: 30, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 28018.008552419327, lastPensionBalance: 55937.71361982623, finalReserveBalance: 0, finalNominalBalance: 166914.5240201617, finalRealBalance: 68766.57386720633, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 83955.72217224556, finalCombinedRealBalance: 35626.30529817801, lastAfterTaxTaxAccountWithdrawal: 2919.9858362047194, lastAfterTaxTaxableDividend: 0 }],
    [40, { rowCount: 40, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 34103.09879370252, lastPensionBalance: 68086.54406331993, finalReserveBalance: 0, finalNominalBalance: 298918.4908610536, finalRealBalance: 91635.50820723848, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 102189.64285702245, finalCombinedRealBalance: 32266.742096273938, lastAfterTaxTaxAccountWithdrawal: 3924.2167927283654, lastAfterTaxTaxableDividend: 0 }],
    [50, { rowCount: 50, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 39472.83943520071, lastPensionBalance: 78807.18517008875, finalReserveBalance: 0, finalNominalBalance: 535317.4908125842, finalRealBalance: 122109.70958963675, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 118280.02460528945, finalCombinedRealBalance: 27789.926340477952, lastAfterTaxTaxAccountWithdrawal: 5273.819223844908, lastAfterTaxTaxableDividend: 0 }],
    [60, { rowCount: 60, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 41660.42128111874, lastPensionBalance: 83174.67355128305, finalReserveBalance: 0, finalNominalBalance: 958672.095340817, finalRealBalance: 162718.37705471023, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 124835.09483240178, finalCombinedRealBalance: 21824.30578004792, lastAfterTaxTaxAccountWithdrawal: 7087.572036625079, lastAfterTaxTaxableDividend: 0 }],
  ] as const).map(([years, expected]) => {
    const inputs = normalizeInputs({ ...baseInputs, years });
    return { name: `legacy ${years}-year period`, inputs, plans: buildDefaultYearPlans(inputs.startYear, inputs.years), expected };
  }),
];

const noRetirementInputs = normalizeInputs({ ...baseInputs, years: 20 });
scenarios.push({
  name: "legacy plan with no retirement",
  inputs: noRetirementInputs,
  plans: buildDefaultYearPlans(noRetirementInputs.startYear, noRetirementInputs.years).map((row) => ({ ...row, monthlyContribution: 100, isaContribution: true, pensionContribution: true })),
  expected: { rowCount: 20, retirementYear: null, actualWithdrawalStartYear: null, lastIsaBalance: 6414.270944425695, lastPensionBalance: 82298.00015717316, finalReserveBalance: 0, finalNominalBalance: 88712.27110159885, finalRealBalance: 49117.8336077603, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 88712.27110159885, finalCombinedRealBalance: 50591.368615993124, lastAfterTaxTaxAccountWithdrawal: 0, lastAfterTaxTaxableDividend: 0 },
});

const delayedInputs = normalizeInputs({ ...baseInputs, withdrawalDelayYears: 5 });
scenarios.push({
  name: "legacy withdrawal delay of five years",
  inputs: delayedInputs,
  plans: buildDefaultYearPlans(delayedInputs.startYear, delayedInputs.years),
  expected: { rowCount: 30, retirementYear: 2031, actualWithdrawalStartYear: 2036, lastIsaBalance: 29675.35868673801, lastPensionBalance: 59401.078195511924, finalReserveBalance: 0, finalNominalBalance: 166914.5240201617, finalRealBalance: 68766.57386720633, finalTaxableNominalBalance: 0, finalTaxableRealBalance: 0, finalCombinedNominalBalance: 89076.43688224994, finalCombinedRealBalance: 37799.26195775156, lastAfterTaxTaxAccountWithdrawal: 3098.1694514416845, lastAfterTaxTaxableDividend: 0 },
});

const brokerageInputs = normalizeInputs({ ...baseInputs, initialTaxableDividend: 5000 });
scenarios.push({
  name: "brokerage dividends remain separate from valuation balance",
  inputs: brokerageInputs,
  plans: buildDefaultYearPlans(brokerageInputs.startYear, brokerageInputs.years),
  expected: { rowCount: 30, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 28018.008552419327, lastPensionBalance: 55937.71361982623, finalReserveBalance: 0, finalNominalBalance: 166914.5240201617, finalRealBalance: 68766.57386720633, finalTaxableNominalBalance: 28717.4558645663, finalTaxableRealBalance: 12186.1479306792, finalCombinedNominalBalance: 112673.178036812, finalCombinedRealBalance: 47812.4532288573, lastAfterTaxTaxAccountWithdrawal: 2919.9858362047194, lastAfterTaxTaxableDividend: 805.985199972497 },
});

for (const scenario of scenarios) {
  const projection = calculateAssetSimulatorPreview(scenario.inputs, scenario.plans, scenario.exitMode ?? false);
  assertGolden(scenario.name, metrics(projection), scenario.expected);
  assert.equal(projection.timeline.retirementYear, scenario.expected.retirementYear, `${scenario.name} timeline retirement year`);
  assert.equal(projection.timeline.withdrawalStartYear, scenario.expected.actualWithdrawalStartYear, `${scenario.name} timeline withdrawal start year`);
}

const normalTimeline = calculateAssetSimulatorPreview(baseInputs, buildDefaultYearPlans()).timeline;
assert.deepEqual(
  { retirementIndex: normalTimeline.retirementIndex, withdrawalStartIndex: normalTimeline.withdrawalStartIndex, yearsBeforeRetirement: normalTimeline.yearsBeforeRetirement, yearsAfterRetirement: normalTimeline.yearsAfterRetirement },
  { retirementIndex: 5, withdrawalStartIndex: 6, yearsBeforeRetirement: 5, yearsAfterRetirement: 24 },
  "legacy normal timeline boundaries",
);
const exitTimeline = calculateAssetSimulatorPreview(baseInputs, buildDefaultYearPlans(), true).timeline;
assert.equal(exitTimeline.retirementIndex, 0, "EXIT mode retires at the start index");
assert.equal(exitTimeline.retirementYear, baseInputs.startYear, "EXIT mode retirement year is startYear");
const noRetirementTimeline = calculateAssetSimulatorPreview(
  noRetirementInputs,
  buildDefaultYearPlans(noRetirementInputs.startYear, noRetirementInputs.years).map((row) => ({ ...row, monthlyContribution: 100 })),
).timeline;
assert.deepEqual(
  { retirementIndex: noRetirementTimeline.retirementIndex, withdrawalStartIndex: noRetirementTimeline.withdrawalStartIndex, yearsBeforeRetirement: noRetirementTimeline.yearsBeforeRetirement, yearsAfterRetirement: noRetirementTimeline.yearsAfterRetirement },
  { retirementIndex: null, withdrawalStartIndex: null, yearsBeforeRetirement: 20, yearsAfterRetirement: 0 },
  "no-retirement timeline is handled safely",
);

// CHARACTERIZATION / KNOWN BEHAVIOR: 위탁 배당 분리 동작과 이번 PR에서 건드리지 않는
// 기존 실질가치/필드 의미 차이를 함께 기록한다.
const characterizationInputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, initialTaxableDividend: 5000 });
const characterization = calculateAssetSimulatorPreview(
  characterizationInputs,
  buildDefaultYearPlans(characterizationInputs.startYear, characterizationInputs.years),
);

{
  const withdrawalIndex = characterization.results.findIndex((row) => row.status === "인출");
  assert.ok(withdrawalIndex > 0, "brokerage dividend characterization requires a withdrawal row");
  const previousBalance = characterization.dividendRows[withdrawalIndex - 1].taxableDividendBalanceNominal;
  const current = characterization.dividendRows[withdrawalIndex];
  const afterGrowth = previousBalance * (1 + characterizationInputs.annualReturnRate / 100);
  const grossDividend = previousBalance * (characterizationInputs.withdrawalRate / 100);
  const deductedBalance = afterGrowth - grossDividend;
  assert.ok(grossDividend > 0, "brokerage characterization requires a positive gross dividend");
  assert.ok(Math.abs(current.taxableDividendBalanceNominal - afterGrowth) <= ABSOLUTE_TOLERANCE, "brokerage valuation balance closes at beginning balance plus price growth");
  assert.ok(Math.abs(current.taxableDividendBalanceNominal - deductedBalance) > ABSOLUTE_TOLERANCE, "brokerage dividend is not deducted from valuation balance");
  assert.ok(Math.abs(current.afterTaxAnnualDividendNominal - grossDividend * 0.85) <= ABSOLUTE_TOLERANCE, "brokerage dividend remains a separate after-tax cashflow using the legacy withdrawalRate and 0.85 factor");
  assert.ok(current.afterTaxAnnualDividendNominal > 0, "brokerage after-tax dividend cashflow remains present");
}

{
  const result = characterization.results[0];
  const chart = characterization.chartRows[0];
  assert.ok(Math.abs(result.realTaxSavingBalance - result.nominalTaxSavingBalance / 1.03) <= ABSOLUTE_TOLERANCE, "legacy pre-withdraw real balance discounts the first year once");
  assert.ok(Math.abs(chart.realTaxSavingBalance - chart.nominalTaxSavingBalance) <= ABSOLUTE_TOLERANCE, "legacy combined path discounts the first year zero times");
  assert.notEqual(result.realTaxSavingBalance, chart.realTaxSavingBalance, "legacy known behavior: real-value paths have a first-year discount offset");
}

{
  const index = characterization.results.findIndex((row) => row.status === "인출");
  const result = characterization.results[index];
  const chart = characterization.chartRows[index];
  const tax = characterization.taxWithdrawRows.find((row) => row.year === result.year);
  assert.equal(result.nominalTaxSavingBalance, result.totalNominal, "legacy meaning: YearResult nominalTaxSavingBalance is pre-withdraw total including reserve");
  assert.ok(tax, "legacy meaning characterization requires a tax withdrawal row");
  assert.equal(chart.nominalTaxSavingBalance, tax!.isaBalanceNominal + tax!.pensionBalanceNominal, "legacy meaning: chart nominalTaxSavingBalance is post-withdraw tax-account-only balance");
  assert.notEqual(result.nominalTaxSavingBalance, chart.nominalTaxSavingBalance, "legacy known behavior: nominalTaxSavingBalance has path-dependent meanings");
}

console.log(`asset simulator legacy golden baseline passed (${scenarios.length} scenarios + 3 characterization checks)`);
