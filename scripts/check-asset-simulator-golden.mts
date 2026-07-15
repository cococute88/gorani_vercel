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
    expected: { rowCount: 70, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 25690.567998849056, lastPensionBalance: 71075.26256611626, finalReserveBalance: 0, finalNominalBalance: 1598861.0811136342, finalRealBalance: 201931.93265257272, finalTaxableNominalBalance: 886138.9526843723, finalTaxableRealBalance: 115274.52011361539, finalCombinedNominalBalance: 982904.7832493377, finalCombinedRealBalance: 127862.4270643043, lastAfterTaxTaxAccountWithdrawal: 8669.555940560482, lastAfterTaxTaxableDividend: 24870.409285245358 },
  },
  {
    name: "legacy default inputs EXIT mode",
    inputs: baseInputs,
    plans: buildDefaultYearPlans(baseInputs.startYear, baseInputs.years),
    exitMode: true,
    expected: { rowCount: 70, retirementYear: 2026, actualWithdrawalStartYear: 2027, lastIsaBalance: 0, lastPensionBalance: 42077.831890766174, finalReserveBalance: 0, finalNominalBalance: 703003.5691296043, finalRealBalance: 88787.49445644191, finalTaxableNominalBalance: 886138.9526843723, finalTaxableRealBalance: 115274.52011361539, finalCombinedNominalBalance: 928216.7845751385, finalCombinedRealBalance: 120748.26874404843, lastAfterTaxTaxAccountWithdrawal: 3817.070530711402, lastAfterTaxTaxableDividend: 24870.409285245358 },
  },
  ...([
    [20, { rowCount: 20, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 11539.081070491215, lastPensionBalance: 32808.32386709621, finalReserveBalance: 0, finalNominalBalance: 86799.54886612222, finalRealBalance: 48058.805681483806, finalTaxableNominalBalance: 48107.03208319268, finalTaxableRealBalance: 27434.768188437738, finalCombinedNominalBalance: 92454.43702078011, finalCombinedRealBalance: 52725.47354971399, lastAfterTaxTaxAccountWithdrawal: 3049.052116016769, lastAfterTaxTaxableDividend: 1350.1737778065872 }],
    [30, { rowCount: 30, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 20222.268016103673, lastPensionBalance: 55946.71978413745, finalReserveBalance: 0, finalNominalBalance: 155444.77214785392, finalRealBalance: 64041.187960882744, finalTaxableNominalBalance: 86152.36759369877, finalTaxableRealBalance: 36558.44379203767, finalCombinedNominalBalance: 162321.35539393988, finalCombinedRealBalance: 68880.47668524846, lastAfterTaxTaxAccountWithdrawal: 2657.711680050006, lastAfterTaxTaxableDividend: 2417.9555999174895 }],
    [40, { rowCount: 40, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 24614.24061227093, lastPensionBalance: 68097.50623112296, finalReserveBalance: 0, finalNominalBalance: 278377.912140613, finalRealBalance: 85338.65328703455, finalTaxableNominalBalance: 154285.76905688865, finalTaxableRealBalance: 48716.27867658997, finalCombinedNominalBalance: 246997.51590028254, finalCombinedRealBalance: 77990.34149796967, lastAfterTaxTaxAccountWithdrawal: 3571.742258393389, lastAfterTaxTaxableDividend: 4330.190216455129 }],
    [50, { rowCount: 50, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 28489.902732445564, lastPensionBalance: 78819.87339798761, finalReserveBalance: 0, finalNominalBalance: 498532.442725426, finalRealBalance: 113718.77969054945, finalTaxableNominalBalance: 276302.31412487174, finalTaxableRealBalance: 64917.309434600924, finalCombinedNominalBalance: 383612.09025530494, finalCombinedRealBalance: 90129.7726905864, lastAfterTaxTaxAccountWithdrawal: 4800.122923850442, lastAfterTaxTaxableDividend: 7754.71117473107 }],
    [60, { rowCount: 60, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 30068.81103752912, lastPensionBalance: 83188.06495983496, finalReserveBalance: 0, finalNominalBalance: 892795.6767067118, finalRealBalance: 151536.96896072847, finalTaxableNominalBalance: 494815.36279998656, finalTaxableRealBalance: 86506.13673110538, finalCombinedNominalBalance: 608072.2387973507, finalCombinedRealBalance: 106306.27944560334, lastAfterTaxTaxAccountWithdrawal: 6450.9638202278065, lastAfterTaxTaxableDividend: 13887.506644622266 }],
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
  expected: { rowCount: 20, retirementYear: null, actualWithdrawalStartYear: null, lastIsaBalance: 0, lastPensionBalance: 82307.6215635898, finalReserveBalance: 0, finalNominalBalance: 82307.6215635898, finalRealBalance: 45571.734444503985, finalTaxableNominalBalance: 48107.03208319268, finalTaxableRealBalance: 27434.768188437738, finalCombinedNominalBalance: 130414.65364678248, finalCombinedRealBalance: 74373.65466627685, lastAfterTaxTaxAccountWithdrawal: 0, lastAfterTaxTaxableDividend: 0 },
});

const delayedInputs = normalizeInputs({ ...baseInputs, withdrawalDelayYears: 5 });
scenarios.push({
  name: "legacy withdrawal delay of five years",
  inputs: delayedInputs,
  plans: buildDefaultYearPlans(delayedInputs.startYear, delayedInputs.years),
  expected: { rowCount: 70, retirementYear: 2031, actualWithdrawalStartYear: 2036, lastIsaBalance: 27585.53050556405, lastPensionBalance: 75475.78660948735, finalReserveBalance: 0, finalNominalBalance: 1598861.0811136342, finalRealBalance: 201931.93265257272, finalTaxableNominalBalance: 886138.9526843723, finalTaxableRealBalance: 115274.52011361539, finalCombinedNominalBalance: 989200.2697994238, finalCombinedRealBalance: 128681.38349178614, lastAfterTaxTaxAccountWithdrawal: 9232.644173694378, lastAfterTaxTaxableDividend: 24870.409285245358 },
});

const brokerageInputs = normalizeInputs({ ...baseInputs, initialTaxableDividend: 5000 });
scenarios.push({
  name: "brokerage dividends remain separate from valuation balance",
  inputs: brokerageInputs,
  plans: buildDefaultYearPlans(brokerageInputs.startYear, brokerageInputs.years),
  expected: { rowCount: 70, retirementYear: 2031, actualWithdrawalStartYear: 2032, lastIsaBalance: 25690.567998849056, lastPensionBalance: 71075.26256611626, finalReserveBalance: 0, finalNominalBalance: 1598861.0811136342, finalRealBalance: 201931.93265257272, finalTaxableNominalBalance: 295379.65089479066, finalTaxableRealBalance: 38424.840037871785, finalCombinedNominalBalance: 392145.481459756, finalCombinedRealBalance: 51012.746988560684, lastAfterTaxTaxAccountWithdrawal: 8669.555940560482, lastAfterTaxTaxableDividend: 8290.136428415115 },
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
  { retirementIndex: 5, withdrawalStartIndex: 6, yearsBeforeRetirement: 5, yearsAfterRetirement: 64 },
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
