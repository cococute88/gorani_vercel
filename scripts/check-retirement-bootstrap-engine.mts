import assert from "node:assert/strict";

import { buildRetirementBootstrapInput } from "../lib/retirement-bootstrap-adapter.ts";
import {
  MAX_CENTERED_ANNUAL_RETURN_PCT,
  MIN_CENTERED_ANNUAL_RETURN_PCT,
  createSeededPrng,
  geometricMeanRatePct,
  recenterHistoricalRatesPct,
  recenterHistoricalRatesPctWithDiagnostics,
  sampleMarketPatternBlocks,
} from "../lib/retirement-bootstrap-data.ts";
import {
  buildRetirementBootstrapCheckpoints,
  classifyFinalRealAssetRetentionBucket,
  compileRetirementBootstrapModel,
  meetsRetirementFundingRatioThreshold,
  nearestRankPercentile,
  runRetirementBootstrap,
  simulateRetirementBootstrapPath,
} from "../lib/retirement-bootstrap-engine.ts";
import {
  ETF_PATTERN_MAPPINGS,
  resolveEtfPatternMapping,
  resolveDistributionPaymentMultiplier,
} from "../lib/retirement-bootstrap-mapping.ts";
import type {
  DistributionStressContext,
  DistributionStressPolicy,
  MarketPatternDatasetV1,
  RetirementBootstrapAnnualRecord,
  RetirementBootstrapInput,
} from "../lib/retirement-bootstrap-types.ts";
import {
  RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
  RETIREMENT_BOOTSTRAP_SUSTAINABILITY_MIN_FUNDING_RATIO,
} from "../lib/retirement-bootstrap-types.ts";
import {
  RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE,
  buildRetirementBootstrapSyntheticInput,
} from "./fixtures/retirement-bootstrap-synthetic.ts";

function approx(actual: number, expected: number, tolerance = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}

const TEST_DISTRIBUTION_CONTEXT: DistributionStressContext = {
  ticker: "JEPQ",
  assetClass: "us_large_growth",
  distributionPolicy: "income_strategy",
  rawAssetClassPricePatternPct: -25,
  sourceObservationYear: 2008,
  pathYearNumber: 3,
};

const TEST_ONLY_INCOME_STRESS_POLICY: DistributionStressPolicy = {
  policyId: "test-only-income-downturn-10pct",
  paymentMultiplier(context) {
    return context.distributionPolicy === "income_strategy"
      && context.rawAssetClassPricePatternPct <= -20
      ? 0.9
      : 1;
  },
};

assert.equal(ETF_PATTERN_MAPPINGS.SPY.assetClass, "us_large_cap");
assert.equal(ETF_PATTERN_MAPPINGS.QQQ.assetClass, "us_large_growth");
assert.equal(ETF_PATTERN_MAPPINGS.SCHD.assetClass, "us_dividend_value");
assert.equal(ETF_PATTERN_MAPPINGS.JEPQ.assetClass, "us_large_growth");
assert.equal(ETF_PATTERN_MAPPINGS.JEPQ.distributionPolicy, "income_strategy");
assert.throws(() => resolveEtfPatternMapping("UNKNOWN"), /승인된 자산군 패턴 매핑이 없습니다/);
assert.equal(
  resolveDistributionPaymentMultiplier(undefined, TEST_DISTRIBUTION_CONTEXT),
  1,
  "JEPQ형 인컴전략도 production 기본 지급 배수는 중립값",
);
assert.equal(
  resolveDistributionPaymentMultiplier(TEST_ONLY_INCOME_STRESS_POLICY, TEST_DISTRIBUTION_CONTEXT),
  0.9,
  "임의 haircut은 테스트 전용 정책을 명시적으로 주입할 때만 적용",
);
assert.throws(
  () => resolveDistributionPaymentMultiplier({ policyId: "invalid", paymentMultiplier: () => Number.NaN }, TEST_DISTRIBUTION_CONTEXT),
  /유한한 숫자/,
);
assert.throws(
  () => runRetirementBootstrap(buildRetirementBootstrapSyntheticInput(), RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
    seed: 1,
    iterations: 1,
    allowTestFixture: true,
    distributionStressPolicy: { policyId: "", paymentMultiplier: () => 1 },
  }),
  /정책 ID가 비어/,
);

const historical = [20, -35, 8, 15, -5, 30, 4];
const centered7 = recenterHistoricalRatesPct(historical, 7);
const centered11 = recenterHistoricalRatesPct(historical, 11);
approx(geometricMeanRatePct(centered7), 7, 1e-10);
approx(geometricMeanRatePct(centered11), 11, 1e-10);
assert.ok(centered11.every((value, index) => value > centered7[index]), "사용자 CAGR 상승은 같은 역사 편차의 전체 경로를 상향 이동");
assert.ok(centered11.every((value) => value >= MIN_CENTERED_ANNUAL_RETURN_PCT && value <= MAX_CENTERED_ANNUAL_RETURN_PCT));
assert.throws(() => recenterHistoricalRatesPct([-100, 5], 7), /-100%보다 커야/);

const requestedCagrTargets = [-20, 0, 3, 8, 15, 30];
for (const target of requestedCagrTargets) {
  const centered = recenterHistoricalRatesPct(historical, target);
  approx(geometricMeanRatePct(centered), target, 1e-10);
  assert.ok(centered.every(Number.isFinite), `${target}% 재중심화 결과는 모두 유한`);
  assert.ok(centered.every((value) => value >= MIN_CENTERED_ANNUAL_RETURN_PCT && value <= MAX_CENTERED_ANNUAL_RETURN_PCT));
}

const extremeHistorical = [-99.999, -98, -75, -20, 0, 80, 500, 1_000_000];
const clippedDetails = recenterHistoricalRatesPctWithDiagnostics(extremeHistorical, 8);
const clipped = clippedDetails.ratesPct;
approx(geometricMeanRatePct(clipped), 8, 1e-9);
assert.equal(clippedDetails.clippedLowCount, 1);
assert.equal(clippedDetails.clippedHighCount, 5);
assert.ok(clippedDetails.logStandardDeviationAfter < clippedDetails.logStandardDeviationBefore, "clipping 분산 압축을 진단값에 노출");
assert.ok(clipped.some((value) => Math.abs(value - MIN_CENTERED_ANNUAL_RETURN_PCT) < 1e-9), "하한 clipping 발동");
assert.ok(clipped.some((value) => Math.abs(value - MAX_CENTERED_ANNUAL_RETURN_PCT) < 1e-9), "상한 clipping 발동");
for (let left = 0; left < extremeHistorical.length; left += 1) {
  for (let right = left + 1; right < extremeHistorical.length; right += 1) {
    if (extremeHistorical[left] < extremeHistorical[right]) {
      assert.ok(clipped[left] <= clipped[right], "clipping은 역사적 상대 순서를 역전하지 않음");
    }
  }
}
approx(geometricMeanRatePct(recenterHistoricalRatesPct(extremeHistorical, MIN_CENTERED_ANNUAL_RETURN_PCT)), MIN_CENTERED_ANNUAL_RETURN_PCT, 1e-9);
approx(geometricMeanRatePct(recenterHistoricalRatesPct(extremeHistorical, MAX_CENTERED_ANNUAL_RETURN_PCT)), MAX_CENTERED_ANNUAL_RETURN_PCT, 1e-9);
assert.throws(() => recenterHistoricalRatesPct(historical, -100), /-100%보다 커야/);
assert.throws(() => recenterHistoricalRatesPct(historical, 300.01), /범위/);
assert.throws(() => recenterHistoricalRatesPct(historical, Number.NaN), /유한한 숫자/);

const sampled = sampleMarketPatternBlocks(
  RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE,
  13,
  5,
  createSeededPrng(12345),
);
assert.equal(sampled.observations.length, 13);
for (let offset = 0; offset < sampled.observationIndices.length; offset += 5) {
  const block = sampled.observationIndices.slice(offset, offset + 5);
  for (let index = 1; index < block.length; index += 1) {
    assert.equal(block[index], block[index - 1] + 1, "5년 블록 내부 순서 보존");
    assert.equal(
      sampled.observations[offset + index].year,
      sampled.observations[offset + index - 1].year + 1,
      "원래 역사 연도 순서 보존",
    );
  }
}
sampled.observations.forEach((observation, index) => {
  assert.equal(
    observation,
    RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE.observations[sampled.observationIndices[index]],
    "자산군 편차·배당·인플레이션이 같은 연도 행으로 함께 이동",
  );
});

const input = buildRetirementBootstrapSyntheticInput();
const compiled = compileRetirementBootstrapModel(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, 5, true);
const compiledJepq = compiled.brokerageHoldings.find((holding) => holding.ticker === "JEPQ")!;
approx(geometricMeanRatePct(compiledJepq.centeredPriceReturnsPct), 2, 1e-10);
approx(geometricMeanRatePct(compiledJepq.centeredDividendGrowthPct), 1, 1e-10);
assert.equal(compiledJepq.initialDividendYieldPct, 9, "JEPQ 사용자 분배율을 역사 평균으로 덮어쓰지 않음");
assert.throws(
  () => runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, { seed: 1, iterations: 1 }),
  /production 시뮬레이션에 사용할 수 없습니다/,
  "synthetic fixture production 사용 차단",
);
assert.throws(
  () => runRetirementBootstrap(input, null, { seed: 1, iterations: 1 }),
  /production 시장 패턴 데이터가 연결되지 않았습니다/,
  "production dataset 미연결 상태는 명시적 오류",
);

const path70 = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 70,
  periods: [30, 40, 50, 60, 70],
  blockLength: 5,
  seed: 20260717,
  allowTestFixture: true,
});
const path70Repeat = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 70,
  periods: [30, 40, 50, 60, 70],
  blockLength: 5,
  seed: 20260717,
  allowTestFixture: true,
});
assert.deepEqual(path70Repeat, path70, "동일 데이터·입력·시드 완전 재현");
assert.equal(path70.records.length, 70);
assert.equal(path70.sampledBlockStarts.length, 14, "70년은 5년 블록 14개");
assert.equal(path70.checkpoints.length, 5);

const taxPath70 = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 70,
  periods: [30, 40, 50, 60, 70],
  blockLength: 5,
  seed: 20260717,
  allowTestFixture: true,
  analysisScope: "tax",
});
const brokeragePath70 = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 70,
  periods: [30, 40, 50, 60, 70],
  blockLength: 5,
  seed: 20260717,
  allowTestFixture: true,
  analysisScope: "brokerage",
});
assert.deepEqual(taxPath70.sampledObservationIndices, path70.sampledObservationIndices, "절세 scope도 동일 sampled path 공유");
assert.deepEqual(brokeragePath70.sampledObservationIndices, path70.sampledObservationIndices, "위탁 scope도 동일 sampled path 공유");
assert.equal(taxPath70.initialRealPrincipal, input.initialIsa + input.initialPension, "절세 시작 원금 denominator");
assert.equal(brokeragePath70.initialRealPrincipal, input.initialBrokerage, "위탁 시작 원금 denominator");
assert.equal(path70.initialRealPrincipal, input.initialIsa + input.initialPension + input.initialBrokerage, "종합 시작 원금 denominator");
taxPath70.records.forEach((taxRow, index) => {
  const brokerageRow = brokeragePath70.records[index];
  const combinedRow = path70.records[index];
  approx(combinedRow.nominalAssets, taxRow.nominalAssets + brokerageRow.nominalAssets, 1e-8);
  approx(combinedRow.realAssets, taxRow.realAssets + brokerageRow.realAssets, 1e-8);
  approx(combinedRow.suppliedAfterTaxCashflow, taxRow.suppliedAfterTaxCashflow + brokerageRow.suppliedAfterTaxCashflow, 1e-8);
  assert.equal(taxRow.realNetBrokerageDividendCashflow, null, "절세 scope 배당 MDD 입력은 해당 없음");
  assert.equal(taxRow.grossBrokerageDividend, 0, "절세 scope에서 위탁 배당 공급 제외");
  assert.equal(brokerageRow.grossIsaWithdrawal + brokerageRow.grossPensionWithdrawal, 0, "위탁 scope에서 절세계좌 인출 제외");
  assert.equal(brokerageRow.realNetBrokerageDividendCashflow, combinedRow.realNetBrokerageDividendCashflow);
});
for (let offset = 0; offset < path70.sampledObservationIndices.length; offset += 5) {
  const block = path70.sampledObservationIndices.slice(offset, offset + 5);
  assert.equal(block.length, 5, "70년 경로는 불완전한 마지막 블록이 없음");
  for (let index = 1; index < block.length; index += 1) {
    assert.equal(block[index], block[index - 1] + 1, "70년 경로의 모든 블록 내부 순서 보존");
  }
}

const path70DifferentSeed = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 70,
  periods: [30, 40, 50, 60, 70],
  blockLength: 5,
  seed: 20260718,
  allowTestFixture: true,
});
assert.notDeepEqual(path70DifferentSeed.sampledObservationIndices, path70.sampledObservationIndices, "시드 변경 시 시장 경로 변경");

const direct30 = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 30,
  periods: [30],
  blockLength: 5,
  seed: 20260717,
  allowTestFixture: true,
});
assert.deepEqual(path70.records.slice(0, 30), direct30.records, "같은 70년 경로의 30년 시점과 직접 30년 경로 일치");
assert.deepEqual(path70.checkpoints[0], direct30.checkpoints[0]);

const neutralJepqPath = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 70,
  seed: 20260717,
  allowTestFixture: true,
});
const stressedJepqPath = simulateRetirementBootstrapPath(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  years: 70,
  seed: 20260717,
  allowTestFixture: true,
  distributionStressPolicy: TEST_ONLY_INCOME_STRESS_POLICY,
});
assert.ok(
  stressedJepqPath.records.some((row, index) => row.suppliedWithdrawalNet < neutralJepqPath.records[index].suppliedWithdrawalNet),
  "명시적으로 주입한 테스트 정책만 JEPQ 분배 현금흐름을 조정",
);

const higherCagrInput = {
  ...input,
  taxSavingHoldings: input.taxSavingHoldings.map((holding) => ({
    ...holding,
    expectedTotalReturnCagrPct: holding.expectedTotalReturnCagrPct + 3,
  })),
};
const baseDistribution = runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 991,
  iterations: 500,
  periods: [30],
  allowTestFixture: true,
});
const higherDistribution = runRetirementBootstrap(higherCagrInput, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 991,
  iterations: 500,
  periods: [30],
  allowTestFixture: true,
});
assert.ok(
  higherDistribution.periods[0].averageEndingRealAssets > baseDistribution.periods[0].averageEndingRealAssets,
  "동일 블록·시드에서 사용자 CAGR 상승 시 분포 중심이 상승",
);

const lowerBrokeragePriceInput = {
  ...input,
  initialIsa: 0,
  initialPension: 0,
  taxSavingHoldings: [],
  brokerageHoldings: input.brokerageHoldings.map((holding) => ({
    ...holding,
    expectedPriceCagrPct: -5,
  })),
};
const higherBrokeragePriceInput = {
  ...lowerBrokeragePriceInput,
  brokerageHoldings: lowerBrokeragePriceInput.brokerageHoldings.map((holding) => ({
    ...holding,
    expectedPriceCagrPct: 12,
  })),
};
const lowerBrokeragePricePath = simulateRetirementBootstrapPath(
  lowerBrokeragePriceInput,
  RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE,
  { years: 10, seed: 551, allowTestFixture: true },
);
const higherBrokeragePricePath = simulateRetirementBootstrapPath(
  higherBrokeragePriceInput,
  RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE,
  { years: 10, seed: 551, allowTestFixture: true },
);
assert.deepEqual(
  lowerBrokeragePricePath.records.map((row) => row.suppliedWithdrawalNet),
  higherBrokeragePricePath.records.map((row) => row.suppliedWithdrawalNet),
  "가격 CAGR 변경만으로 배당 현금흐름을 같은 비율로 흔들지 않음",
);
assert.notDeepEqual(
  lowerBrokeragePricePath.records.map((row) => row.nominalAssets),
  higherBrokeragePricePath.records.map((row) => row.nominalAssets),
  "가격 CAGR은 위탁계좌 평가잔고에는 반영",
);

const zeroInflationDataset: MarketPatternDatasetV1 = {
  ...RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE,
  datasetId: "synthetic-zero-inflation",
  observations: RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE.observations.map((row) => ({ ...row, inflationPct: 0 })),
};
const zeroInflationPath = simulateRetirementBootstrapPath(
  { ...input, expectedInflationPct: 0 },
  zeroInflationDataset,
  { years: 30, seed: 44, allowTestFixture: true },
);
zeroInflationPath.records.forEach((row) => {
  assert.equal(row.cumulativeInflation, 1);
  assert.equal(row.nominalAssets, row.realAssets, "인플레이션 0%에서 명목·실질 일치");
});

function flatDataset(inflationPct: number): MarketPatternDatasetV1 {
  return {
    ...RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE,
    datasetId: `test-only-flat-${inflationPct}`,
    datasetVersion: "test-only-v1",
    usage: "test_fixture",
    periodStartYear: 2000,
    periodEndYear: 2004,
    observations: Array.from({ length: 5 }, (_, index) => ({
      year: 2000 + index,
      inflationPct,
      assetClasses: {
        us_large_cap: { totalReturnPct: 0, priceReturnPct: 0, dividendGrowthPct: 0 },
        us_large_growth: { totalReturnPct: 0, priceReturnPct: 0, dividendGrowthPct: 0 },
        us_dividend_value: { totalReturnPct: 0, priceReturnPct: 0, dividendGrowthPct: 0 },
      },
    })),
  };
}

const brokerageOnlyInput: RetirementBootstrapInput = {
  ...input,
  initialIsa: 0,
  initialPension: 0,
  initialBrokerage: 30_000,
  expectedInflationPct: 10,
  withdrawalDelayYears: 10,
  annualRequiredWithdrawalReal: 1,
  taxSavingHoldings: [],
  brokerageHoldings: [{
    ticker: "JEPQ",
    weightPct: 100,
    expectedPriceCagrPct: 0,
    initialDividendYieldPct: 0,
    expectedDividendGrowthPct: 0,
    mapping: ETF_PATTERN_MAPPINGS.JEPQ,
  }],
};
const tenPctInflationPath = simulateRetirementBootstrapPath(
  brokerageOnlyInput,
  flatDataset(10),
  { years: 3, periods: [1, 2, 3], seed: 10, allowTestFixture: true },
);
assert.equal(tenPctInflationPath.initialRealPrincipal, 30_000, "시작 시점 원금은 할인하지 않음");
tenPctInflationPath.records.forEach((row, index) => {
  const cumulative = Math.pow(1.1, index + 1);
  approx(row.cumulativeInflation, cumulative, 1e-12);
  approx(row.realAssets, 30_000 / cumulative, 1e-9);
});

const highInflationPath = simulateRetirementBootstrapPath(
  { ...brokerageOnlyInput, expectedInflationPct: 300, withdrawalDelayYears: 100 },
  flatDataset(300),
  { years: 70, seed: 300, allowTestFixture: true },
);
assert.ok(highInflationPath.records.every((row) => (
  Number.isFinite(row.cumulativeInflation)
  && Number.isFinite(row.nominalAssets)
  && Number.isFinite(row.realAssets)
)), "고인플레이션 70년 경로에도 NaN·Infinity 없음");

const afterTaxCashflowInput: RetirementBootstrapInput = {
  ...input,
  startYear: 2050,
  initialIsa: 1_000,
  initialPension: 0,
  initialBrokerage: 1_000,
  expectedInflationPct: 0,
  withdrawalRatePct: 10,
  withdrawalGrowthRatePct: 0,
  withdrawalDelayYears: 1,
  annualRequiredWithdrawalReal: 180,
  taxSavingHoldings: [{
    ticker: "SPY",
    weightPct: 100,
    expectedTotalReturnCagrPct: 0,
    mapping: ETF_PATTERN_MAPPINGS.SPY,
  }],
  brokerageHoldings: [{
    ticker: "JEPQ",
    weightPct: 100,
    expectedPriceCagrPct: 0,
    initialDividendYieldPct: 10,
    expectedDividendGrowthPct: 0,
    mapping: ETF_PATTERN_MAPPINGS.JEPQ,
  }],
};
const afterTaxCashflowPath = simulateRetirementBootstrapPath(
  afterTaxCashflowInput,
  flatDataset(0),
  { years: 1, seed: 2051, allowTestFixture: true },
);
const afterTaxCashflowYear = afterTaxCashflowPath.records[0];
approx(afterTaxCashflowYear.suppliedWithdrawalNet, 100 * (1 - 0.099) + 100 * 0.85, 1e-12);
assert.equal(afterTaxCashflowYear.nominalAssets, 1_900, "배당 지급액을 위탁 평가잔액에서 이중 차감하지 않음");
assert.equal(afterTaxCashflowYear.withdrawalSatisfied, false, "세전 공급액이 충분해도 세후 필수 인출 미충족은 실패");
assert.equal(afterTaxCashflowPath.checkpoints[0].success, false);
assert.equal(afterTaxCashflowPath.checkpoints[0].firstWithdrawalShortfallYear, 2051);

const exactAfterTaxSupply = afterTaxCashflowYear.suppliedWithdrawalNet;
const exactAfterTaxPath = simulateRetirementBootstrapPath(
  { ...afterTaxCashflowInput, annualRequiredWithdrawalReal: exactAfterTaxSupply },
  flatDataset(0),
  { years: 1, seed: 2051, allowTestFixture: true },
);
assert.equal(exactAfterTaxPath.records[0].withdrawalSatisfied, true, "세후 공급액과 필요액이 정확히 같으면 성공");
const oneWonShortPath = simulateRetirementBootstrapPath(
  { ...afterTaxCashflowInput, annualRequiredWithdrawalReal: exactAfterTaxSupply + 0.0001 },
  flatDataset(0),
  { years: 1, seed: 2051, allowTestFixture: true },
);
assert.equal(oneWonShortPath.records[0].withdrawalSatisfied, false, "만원 내부 단위에서 1원 부족도 실패");

const dividendOnlyExactInput: RetirementBootstrapInput = {
  ...afterTaxCashflowInput,
  initialIsa: 0,
  initialPension: 0,
  taxSavingHoldings: [],
  annualRequiredWithdrawalReal: 85,
};
const dividendOnlyExactPath = simulateRetirementBootstrapPath(
  dividendOnlyExactInput,
  flatDataset(0),
  { years: 1, seed: 2051, allowTestFixture: true },
);
assert.equal(dividendOnlyExactPath.records[0].grossBrokerageDividend, 100, "위탁 배당 세전 공급");
assert.equal(dividendOnlyExactPath.records[0].netBrokerageDividend, 85, "배당세 15% 차감 후 공급");
assert.equal(dividendOnlyExactPath.checkpoints[0].success, true, "세후 배당만으로 생활비를 정확히 충족");

const delayedBoundaryPath = simulateRetirementBootstrapPath(
  { ...dividendOnlyExactInput, withdrawalDelayYears: 2 },
  flatDataset(0),
  { years: 3, periods: [1, 2, 3], seed: 2051, allowTestFixture: true },
);
assert.equal(delayedBoundaryPath.records[0].requiredWithdrawalNominal, 0, "인출 시작 전년도에는 필수 생활비 판정 없음");
assert.equal(delayedBoundaryPath.records[0].withdrawalSatisfied, true, "인출 전 축적기간은 실패 처리하지 않음");
assert.equal(delayedBoundaryPath.records[1].requiredWithdrawalNominal, 85, "인출 시작연도부터 필수 생활비 판정");
assert.equal(delayedBoundaryPath.records[2].requiredWithdrawalNominal, 85, "인출 시작 다음 연도에도 판정 유지");

const allShortDiagnostics = runRetirementBootstrap(
  { ...dividendOnlyExactInput, annualRequiredWithdrawalReal: 86 },
  flatDataset(0),
  { iterations: 25, periods: [1], seed: 2051, allowTestFixture: true },
);
assert.equal(allShortDiagnostics.periods[0].successCount, 0, "첫 인출연도 부족 fixture는 0% 가능");
assert.equal(allShortDiagnostics.failureDiagnostics.periods[0].withdrawalShortfallOnlyCount, 25);
assert.equal(allShortDiagnostics.failureDiagnostics.periods[0].depletionOnlyCount, 0);
assert.deepEqual(allShortDiagnostics.failureDiagnostics.periods[0].firstFailureYears, [
  { yearNumber: 1, calendarYear: 2051, count: 25 },
]);
assert.equal(allShortDiagnostics.failureDiagnostics.firstWithdrawalCashflow?.shortfallCount, 25);
assert.equal(allShortDiagnostics.failureDiagnostics.firstWithdrawalCashflow?.averageRequiredWithdrawalNominal, 86);
assert.equal(allShortDiagnostics.failureDiagnostics.firstWithdrawalCashflow?.averageSuppliedWithdrawalNet, 85);

function record(
  yearNumber: number,
  realAssets: number,
  withdrawalSatisfied = true,
  depleted = false,
): RetirementBootstrapAnnualRecord {
  const supplied = withdrawalSatisfied ? 1 : 0.5;
  return {
    yearNumber,
    calendarYear: 2030 + yearNumber,
    sourceObservationYear: 2000 + yearNumber,
    nominalAssets: realAssets,
    realAssets,
    cumulativeInflation: 1,
    requiredAfterTaxCashflow: 1,
    suppliedAfterTaxCashflow: supplied,
    fundingRatio: supplied,
    realAssetsBeforeWithdrawal: realAssets,
    realNetBrokerageDividendCashflow: 0,
    requiredWithdrawalNominal: 1,
    grossIsaWithdrawal: withdrawalSatisfied ? 1 : 0.5,
    netIsaWithdrawal: withdrawalSatisfied ? 1 : 0.5,
    grossPensionWithdrawal: 0,
    netPensionWithdrawal: 0,
    grossBrokerageDividend: 0,
    netBrokerageDividend: 0,
    suppliedWithdrawalNet: supplied,
    withdrawalSatisfied,
    depleted,
  };
}

const recovered = buildRetirementBootstrapCheckpoints(
  [record(1, 40), record(2, 120)],
  [2],
  100,
)[0];
assert.equal(recovered.reachedRealPrincipal50Pct, true, "50% 이하 도달 뒤 회복해도 이력 유지");
assert.equal(recovered.reachedRealPrincipal25Pct, false);
const recoveredFrom25 = buildRetirementBootstrapCheckpoints(
  [record(1, 20), record(2, 120)],
  [2],
  100,
)[0];
assert.equal(recoveredFrom25.reachedRealPrincipal25Pct, true, "25% 이하 도달 뒤 회복해도 이력 유지");
const positiveBalanceShortfall = buildRetirementBootstrapCheckpoints(
  [record(1, 100, false, false)],
  [1],
  100,
)[0];
assert.equal(positiveBalanceShortfall.success, false, "잔액 양수여도 필수 인출 일부 지급은 실패");
assert.equal(positiveBalanceShortfall.firstWithdrawalShortfallYear, 2031);

assert.equal(
  meetsRetirementFundingRatioThreshold(85, 100),
  true,
  "정확히 85%는 지속 성공 threshold를 충족",
);
assert.equal(
  meetsRetirementFundingRatioThreshold(84.999, 100),
  false,
  "84.999%는 floating-point tolerance로 상향하지 않음",
);
assert.equal(RETIREMENT_BOOTSTRAP_SUSTAINABILITY_MIN_FUNDING_RATIO, 0.85, "85% 기준은 단일 상수 계약");

const exact85Record: RetirementBootstrapAnnualRecord = {
  ...record(1, 100, false, false),
  requiredAfterTaxCashflow: 100,
  suppliedAfterTaxCashflow: 85,
  fundingRatio: 0.85,
  requiredWithdrawalNominal: 100,
  suppliedWithdrawalNet: 85,
  realAssetsBeforeWithdrawal: 200,
};
const exact85Checkpoint = buildRetirementBootstrapCheckpoints([exact85Record], [1], 1_000)[0];
assert.equal(exact85Checkpoint.sustainabilitySuccess85, true, "정확히 85%이며 미고갈이면 지속 성공");
assert.equal(exact85Checkpoint.fullFundingSuccess100, false, "85% 공급은 100% 완전 충족이 아님");
assert.equal(exact85Checkpoint.success, false, "legacy success는 기존 100% 계약 유지");

const below85Checkpoint = buildRetirementBootstrapCheckpoints([{
  ...exact85Record,
  suppliedAfterTaxCashflow: 84.999,
  suppliedWithdrawalNet: 84.999,
  fundingRatio: 0.84999,
}], [1], 1_000)[0];
assert.equal(below85Checkpoint.sustainabilitySuccess85, false, "85% 미만 경로 실패");

const depletedAt85Checkpoint = buildRetirementBootstrapCheckpoints([{
  ...exact85Record,
  nominalAssets: 0,
  realAssets: 0,
  depleted: true,
}], [1], 1_000)[0];
assert.equal(depletedAt85Checkpoint.sustainabilitySuccess85, false, "85% 충족이어도 자산 고갈이면 실패");

const preWithdrawalRecord: RetirementBootstrapAnnualRecord = {
  ...record(1, 150, true, false),
  requiredAfterTaxCashflow: 0,
  suppliedAfterTaxCashflow: 0,
  fundingRatio: null,
  requiredWithdrawalNominal: 0,
  suppliedWithdrawalNet: 0,
};
const delayed85Checkpoint = buildRetirementBootstrapCheckpoints([
  preWithdrawalRecord,
  { ...exact85Record, yearNumber: 2, calendarYear: 2032 },
], [2], 1_000)[0];
assert.equal(delayed85Checkpoint.sustainabilitySuccess85, true, "인출 시작 전 연도는 85% 성공 판정에서 제외");

assert.equal(exact85Checkpoint.withdrawalStartRealAssets, 200, "실제 인출 적용 직전 실질자산 denominator 기록");
assert.equal(exact85Checkpoint.finalRealAssetRetentionRatio, 0.5, "최초 시뮬레이션 자산이 아닌 인출 시작 실질자산 기준");
assert.deepEqual(
  [1, 0.999999, 0.8, 0.799999, 0.5, 0.499999, 0.25, 0.249999].map(classifyFinalRealAssetRetentionBucket),
  ["at_least_100", "from_80_to_100", "from_80_to_100", "from_50_to_80", "from_50_to_80", "from_25_to_50", "from_25_to_50", "below_25"],
  "최종자산 bucket 경계는 중복 없이 분류",
);

const twentyPctFundingCheckpoint = buildRetirementBootstrapCheckpoints([{
  ...record(1, 100, false, false),
  requiredAfterTaxCashflow: 1_200,
  suppliedAfterTaxCashflow: 240,
  fundingRatio: 0.2,
  requiredWithdrawalNominal: 1_200,
  suppliedWithdrawalNet: 240,
}], [1], 100)[0];
assert.equal(twentyPctFundingCheckpoint.minimumFundingRatio, 0.2);
assert.equal(twentyPctFundingCheckpoint.livingExpenseMdd, -0.8, "목표 100 / 공급 20의 생활비 MDD는 -80%");
assert.equal(twentyPctFundingCheckpoint.minimumMonthlySuppliedReal, 20, "연간 계산 결과를 월 20으로 환산");
assert.equal(nearestRankPercentile([0.1, 0.2, 0.3, 0.4, 0.5], 0.05), 0.1, "하위 5% nearest-rank 정책");
assert.equal(nearestRankPercentile([0.1, 0.2, 0.3, 0.4, 0.5], 0.5), 0.3, "중앙값 nearest-rank 정책");

const dividendRows = [100, 120, 60].map((realDividend, index): RetirementBootstrapAnnualRecord => ({
  ...record(index + 1, 100, true, false),
  realNetBrokerageDividendCashflow: realDividend,
}));
const dividendMddCheckpoint = buildRetirementBootstrapCheckpoints(dividendRows, [3], 100)[0];
assert.equal(dividendMddCheckpoint.realAfterTaxDividendCashflowMdd, -0.5, "prior peak 120 대비 실질 세후 배당 60의 MDD는 -50%");

assert.throws(
  () => buildRetirementBootstrapInput({
    inputs: {
      startYear: 2026,
      years: 70,
      annualReturnRate: 6,
      inflationRate: 3,
      initialIsa: 0,
      initialPension: 1,
      reserveCash: 0,
      initialTaxableDividend: 1,
      withdrawalRate: 4,
      withdrawalGrowthRate: 2,
      withdrawalDelayYears: 1,
    },
    portfolioAssumptions: null,
    targetMonthlyExpenseReal: 100,
  }),
  /portfolioAssumptions/,
  "적용 가정 누락 시 코드 기본값 혼용 금지",
);

const tenThousand = runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 730_401,
  iterations: 10_000,
  periods: [30, 40, 50, 60, 70],
  allowTestFixture: true,
});
assert.equal(tenThousand.iterations, 10_000);
assert.equal(tenThousand.schemaVersion, RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION, "V3 result schema 노출");
assert.equal(tenThousand.analysisScope, "combined", "생략 시 기존 종합 계약 유지");
assert.equal(tenThousand.datasetUpdatedAt, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE.updatedAt);
assert.equal(tenThousand.distributionStressPolicyId, null, "기본 production 분배 정책은 중립");
assert.ok(tenThousand.recenteringDiagnostics.every((row) => row.clippedLowCount === 0 && row.clippedHighCount === 0));
assert.deepEqual(tenThousand.periods.map((row) => row.periodYears), [30, 40, 50, 60, 70]);
assert.ok(tenThousand.periods.every((row) => row.simulationCount === 10_000));
assert.ok(tenThousand.periods.every((row) => row.successCount === Math.round(row.successRate * 10_000)));
for (const period of tenThousand.periods) {
  assert.equal(period.successCount, period.fullFundingSuccessCount100, "legacy success count는 100% 완전 충족으로 보존");
  assert.equal(period.successRate, period.fullFundingSuccessRate100, "legacy success rate는 100% 완전 충족으로 보존");
  assert.ok(period.sustainabilitySuccessRate85 >= period.fullFundingSuccessRate100, "85% 지속 성공률은 100% 완전 충족률 이상");
  const distribution = period.finalRealAssetRetention;
  assert.equal(distribution.denominatorPathCount, 10_000, "모든 경로가 인출 시작 실질자산 denominator를 가짐");
  assert.equal(
    distribution.atLeast100PctCount
      + distribution.from80To100PctCount
      + distribution.from50To80PctCount
      + distribution.from25To50PctCount
      + distribution.below25PctCount,
    10_000,
    "최종자산 5개 bucket count 합계 100%",
  );
  approx(
    distribution.atLeast100PctProbability
      + distribution.from80To100PctProbability
      + distribution.from50To80PctProbability
      + distribution.from25To50PctProbability
      + distribution.below25PctProbability,
    1,
    1e-12,
  );
  assert.ok(period.livingExpenseRisk.worstLivingExpenseMdd! <= period.livingExpenseRisk.lower1PctLivingExpenseMdd!);
  assert.ok(period.livingExpenseRisk.lower1PctLivingExpenseMdd! <= period.livingExpenseRisk.lower5PctLivingExpenseMdd!);
  assert.equal(period.realAfterTaxDividendCashflowRisk.observedPathCount, 10_000);
  assert.ok(
    period.realAfterTaxDividendCashflowRisk.drop20PctOrMoreProbability
      >= period.realAfterTaxDividendCashflowRisk.drop30PctOrMoreProbability,
    "배당 MDD threshold 확률은 하락폭이 커질수록 증가하지 않음",
  );
}

const scopeAggregates = (["tax", "brokerage", "combined"] as const).map((analysisScope) => runRetirementBootstrap(
  input,
  RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE,
  {
    seed: 330_217,
    iterations: 500,
    periods: [30, 60],
    allowTestFixture: true,
    analysisScope,
  },
));
for (const [index, result] of scopeAggregates.entries()) {
  assert.equal(result.analysisScope, (["tax", "brokerage", "combined"] as const)[index], "scope result 직렬화");
  for (const period of result.periods) {
    const distribution = period.finalRealAssetRetention;
    assert.equal(distribution.denominatorPathCount, 500, `${result.analysisScope} 최종자산 denominator`);
    assert.equal(
      distribution.atLeast100PctCount
        + distribution.from80To100PctCount
        + distribution.from50To80PctCount
        + distribution.from25To50PctCount
        + distribution.below25PctCount,
      500,
      `${result.analysisScope} 최종자산 bucket 합`,
    );
  }
}
assert.ok(scopeAggregates[0].periods.every((period) => period.realAfterTaxDividendCashflowRisk.observedPathCount === 0), "절세 배당 위험 해당 없음");
assert.ok(scopeAggregates[0].periods.every((period) => !period.realAfterTaxDividendCashflowRisk.applicable), "절세 배당 위험 applicable=false");
assert.ok(scopeAggregates[1].periods.every((period) => period.realAfterTaxDividendCashflowRisk.observedPathCount === 500), "위탁 배당 위험 집계");
assert.ok(scopeAggregates[1].periods.every((period) => period.realAfterTaxDividendCashflowRisk.applicable), "위탁 배당 위험 applicable=true");
assert.ok(scopeAggregates[2].periods.every((period) => period.realAfterTaxDividendCashflowRisk.observedPathCount === 500), "종합 배당 위험 집계");
const explicitCombined = runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 330_217,
  iterations: 500,
  periods: [30, 60],
  allowTestFixture: true,
  analysisScope: "combined",
});
assert.deepEqual(explicitCombined, scopeAggregates[2], "명시적 combined scope 기준선 일치");
const defaultCombined = runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 330_217,
  iterations: 500,
  periods: [30, 60],
  allowTestFixture: true,
});
assert.deepEqual(defaultCombined, explicitCombined, "scope 생략 시 PR #217 combined 계약 유지");

const tenThousandRepeat = runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 730_401,
  iterations: 10_000,
  periods: [30, 40, 50, 60, 70],
  allowTestFixture: true,
});
assert.deepEqual(tenThousandRepeat, tenThousand, "10,000회 결과도 동일 입력·dataset·version·seed에서 완전 재현");

const differentSeedTenThousand = runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 730_402,
  iterations: 10_000,
  periods: [30, 40, 50, 60, 70],
  allowTestFixture: true,
});
assert.notDeepEqual(differentSeedTenThousand.periods, tenThousand.periods, "집계 시드 변경 시 결과 분포 변경");

const fiftyThousand = runRetirementBootstrap(input, RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE, {
  seed: 830_401,
  iterations: 50_000,
  periods: [30, 40, 50, 60, 70],
  allowTestFixture: true,
});
for (const period of tenThousand.periods) {
  const reference = fiftyThousand.periods.find((row) => row.periodYears === period.periodYears)!;
  assert.ok(Math.abs(period.successRate - reference.successRate) <= 0.02, `${period.periodYears}년 성공률 표본 안정성`);
  assert.ok(
    Math.abs(period.reachedRealPrincipal50PctProbability - reference.reachedRealPrincipal50PctProbability) <= 0.02,
    `${period.periodYears}년 50% 임계값 확률 표본 안정성`,
  );
  assert.ok(
    Math.abs(period.reachedRealPrincipal25PctProbability - reference.reachedRealPrincipal25PctProbability) <= 0.02,
    `${period.periodYears}년 25% 임계값 확률 표본 안정성`,
  );
}

console.log("retirement bootstrap engine checks passed");
