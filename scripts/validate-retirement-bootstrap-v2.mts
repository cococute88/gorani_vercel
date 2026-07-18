import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { runRetirementBootstrap } from "../lib/retirement-bootstrap-engine.ts";
import { resolveEtfPatternMapping } from "../lib/retirement-bootstrap-mapping.ts";
import { PRODUCTION_MARKET_PATTERN_DATA_ADAPTER } from "../lib/retirement-bootstrap-production-adapter.ts";
import {
  RETIREMENT_BOOTSTRAP_PERIODS,
  RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
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
const startedAt = performance.now();
const result = runRetirementBootstrap(input, dataset, {
  iterations: ITERATIONS,
  blockLength: 5,
  periods: RETIREMENT_BOOTSTRAP_PERIODS,
  seed: FIXED_SEED,
});
const elapsedMs = performance.now() - startedAt;
const repeated = runRetirementBootstrap(input, dataset, {
  iterations: ITERATIONS,
  blockLength: 5,
  periods: RETIREMENT_BOOTSTRAP_PERIODS,
  seed: FIXED_SEED,
});

assert.deepEqual(repeated, result, "V2 production fixed-seed 결과 재현");
assert.equal(result.schemaVersion, RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION);
for (const period of result.periods) {
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
}

console.log(JSON.stringify({
  purpose: "PR #216 저장 가정·월생활비 60만원 V2 production fixed-seed 검증",
  seed: FIXED_SEED,
  iterations: ITERATIONS,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  resultPayloadKiB: Number((Buffer.byteLength(JSON.stringify(result), "utf8") / 1024).toFixed(2)),
  schemaVersion: result.schemaVersion,
  periods: result.periods.map((period) => ({
    periodYears: period.periodYears,
    previous100PctSuccessRate: period.successRate,
    sustainabilitySuccessRate85: period.sustainabilitySuccessRate85,
    fullFundingSuccessRate100: period.fullFundingSuccessRate100,
    finalRealAssetRetention: period.finalRealAssetRetention,
    livingExpenseRisk: period.livingExpenseRisk,
    realAfterTaxDividendCashflowRisk: period.realAfterTaxDividendCashflowRisk,
  })),
}));
