import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { runRetirementBootstrap } from "../lib/retirement-bootstrap-engine.ts";
import { resolveEtfPatternMapping } from "../lib/retirement-bootstrap-mapping.ts";
import { PRODUCTION_MARKET_PATTERN_DATA_ADAPTER } from "../lib/retirement-bootstrap-production-adapter.ts";
import {
  RETIREMENT_BOOTSTRAP_PERIODS,
  RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
  type RetirementBootstrapAnalysisScope,
  type RetirementBootstrapInput,
} from "../lib/retirement-bootstrap-types.ts";

const FIXED_SEED = 1_324_793_731;
const ITERATIONS = 10_000;

/** PR #216 검증에 사용된 저장 가정에서 목표 월생활비만 60만원으로 조정한 동일 입력. */
const input: RetirementBootstrapInput = {
  startYear: 2026,
  initialIsa: 0,
  initialPension: 11_900,
  initialBrokerage: 15_000,
  expectedInflationPct: 3.1,
  withdrawalRatePct: 3.1,
  withdrawalGrowthRatePct: 3.11,
  withdrawalDelayYears: 1,
  annualRequiredWithdrawalReal: 720,
  taxSavingHoldings: [
    {
      ticker: "QQQ",
      weightPct: 50,
      expectedTotalReturnCagrPct: 9,
      mapping: resolveEtfPatternMapping("QQQ"),
    },
    {
      ticker: "SPY",
      weightPct: 50,
      expectedTotalReturnCagrPct: 7,
      mapping: resolveEtfPatternMapping("SPY"),
    },
  ],
  brokerageHoldings: [
    {
      ticker: "SCHD",
      weightPct: 90,
      expectedPriceCagrPct: 4,
      initialDividendYieldPct: 3.2,
      expectedDividendGrowthPct: 5,
      mapping: resolveEtfPatternMapping("SCHD"),
    },
    {
      ticker: "JEPQ",
      weightPct: 10,
      expectedPriceCagrPct: 1,
      initialDividendYieldPct: 9,
      expectedDividendGrowthPct: 0,
      mapping: resolveEtfPatternMapping("JEPQ"),
    },
  ],
};

const dataset = await PRODUCTION_MARKET_PATTERN_DATA_ADAPTER.loadDataset();
const scopes: RetirementBootstrapAnalysisScope[] = ["tax", "brokerage", "combined"];
const scopeRuns = scopes.map((analysisScope) => {
  const startedAt = performance.now();
  const result = runRetirementBootstrap(input, dataset, {
    iterations: ITERATIONS,
    blockLength: 5,
    periods: RETIREMENT_BOOTSTRAP_PERIODS,
    seed: FIXED_SEED,
    analysisScope,
  });
  return { analysisScope, result, elapsedMs: performance.now() - startedAt };
});
const result = scopeRuns.find((run) => run.analysisScope === "combined")!.result;
const repeated = runRetirementBootstrap(input, dataset, {
  iterations: ITERATIONS,
  blockLength: 5,
  periods: RETIREMENT_BOOTSTRAP_PERIODS,
  seed: FIXED_SEED,
  analysisScope: "combined",
});

assert.deepEqual(repeated, result, "V3 production fixed-seed combined 결과 재현");
assert.equal(result.schemaVersion, RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION);
assert.deepEqual(result.periods.map((period) => period.sustainabilitySuccessRate85), [0.805, 0.7977, 0.7906, 0.7858, 0.7829], "PR #217 combined 85% 기준선");
assert.deepEqual(result.periods.map((period) => period.fullFundingSuccessRate100), [0.2676, 0.2666, 0.2647, 0.2634, 0.263], "PR #217 combined 100% 기준선");
for (const run of scopeRuns) {
  assert.equal(run.result.analysisScope, run.analysisScope);
  assert.equal(run.result.seed, FIXED_SEED, "scope별 동일 sampled path seed");
  for (const period of run.result.periods) {
    assert.equal(period.successRate, period.fullFundingSuccessRate100, "V1 100% success 계약 보존");
    assert.ok(period.sustainabilitySuccessRate85 >= period.fullFundingSuccessRate100);
    const distribution = period.finalRealAssetRetention;
    assert.equal(
      distribution.atLeast100PctCount
        + distribution.from80To100PctCount
        + distribution.from50To80PctCount
        + distribution.from25To50PctCount
        + distribution.below25PctCount,
      ITERATIONS,
    );
    assert.ok(Math.abs(
      distribution.atLeast100PctProbability
        + distribution.from80To100PctProbability
        + distribution.from50To80PctProbability
        + distribution.from25To50PctProbability
        + distribution.below25PctProbability
        - 1
    ) <= 1e-12);
    assert.equal(
      period.realAfterTaxDividendCashflowRisk.observedPathCount,
      run.analysisScope === "tax" ? 0 : ITERATIONS,
      `${run.analysisScope} 배당 위험 적용 여부`,
    );
    assert.equal(period.realAfterTaxDividendCashflowRisk.applicable, run.analysisScope !== "tax");
  }
}

console.log(JSON.stringify({
  purpose: "PR #217 저장 가정·월생활비 60만원 V3 scope별 production fixed-seed 검증",
  seed: FIXED_SEED,
  iterations: ITERATIONS,
  schemaVersion: result.schemaVersion,
  scopes: scopeRuns.map((run) => ({
    analysisScope: run.analysisScope,
    elapsedMs: Number(run.elapsedMs.toFixed(2)),
    resultPayloadKiB: Number((Buffer.byteLength(JSON.stringify(run.result), "utf8") / 1024).toFixed(2)),
    periods: run.result.periods.map((period) => ({
      periodYears: period.periodYears,
      sustainabilitySuccessRate85: period.sustainabilitySuccessRate85,
      fullFundingSuccessRate100: period.fullFundingSuccessRate100,
      finalRealAssetRetention: period.finalRealAssetRetention,
      livingExpenseRisk: period.livingExpenseRisk,
      realAfterTaxDividendCashflowRisk: period.realAfterTaxDividendCashflowRisk,
    })),
  })),
}));
