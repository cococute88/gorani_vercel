import assert from "node:assert/strict";

import {
  ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES,
  createSeededPrng,
  recenterHistoricalRatesPct,
  sampleMarketPatternBlocks,
  validateMarketPatternDataset,
} from "../lib/retirement-bootstrap-data.ts";
import {
  compileRetirementBootstrapModel,
  runRetirementBootstrap,
  simulateRetirementBootstrapPath,
} from "../lib/retirement-bootstrap-engine.ts";
import {
  PRODUCTION_MARKET_PATTERN_DATA_ADAPTER,
  PRODUCTION_MARKET_PATTERN_DATASET_VERSION,
  assertMarketPatternDatasetIntegrity,
} from "../lib/retirement-bootstrap-production-adapter.ts";
import type {
  RetirementBootstrapPeriodResult,
  RetirementBootstrapResult,
} from "../lib/retirement-bootstrap-types.ts";
import { buildRetirementBootstrapProductionRepresentativeInput } from "./fixtures/retirement-bootstrap-production-representative.ts";

const BLOCK_LENGTH = 5;
const PERIODS = [30, 40, 50, 60, 70] as const;
const SEEDS = [730_401, 730_402, 730_403] as const;
const ITERATIONS = 10_000;
const REFERENCE_ITERATIONS = 50_000;
const STABILITY_TOLERANCE = 0.02;

function probabilitySnapshot(period: RetirementBootstrapPeriodResult) {
  return {
    periodYears: period.periodYears,
    successRate: period.successRate,
    reachedRealPrincipal50PctProbability: period.reachedRealPrincipal50PctProbability,
    reachedRealPrincipal25PctProbability: period.reachedRealPrincipal25PctProbability,
  };
}

function assertEconomicallySane(result: RetirementBootstrapResult): void {
  for (let index = 1; index < result.periods.length; index += 1) {
    assert.ok(
      result.periods[index].successRate <= result.periods[index - 1].successRate,
      "동일 경로 checkpoint의 장기 성공률은 단기 성공률보다 높을 수 없습니다.",
    );
    assert.ok(
      result.periods[index].reachedRealPrincipal50PctProbability
        >= result.periods[index - 1].reachedRealPrincipal50PctProbability,
      "기간이 길수록 실질원금 50% 이하 도달 누적확률은 감소할 수 없습니다.",
    );
    assert.ok(
      result.periods[index].reachedRealPrincipal25PctProbability
        >= result.periods[index - 1].reachedRealPrincipal25PctProbability,
      "기간이 길수록 실질원금 25% 이하 도달 누적확률은 감소할 수 없습니다.",
    );
  }
  const probabilities = result.periods.flatMap((row) => [
    row.successRate,
    row.reachedRealPrincipal50PctProbability,
    row.reachedRealPrincipal25PctProbability,
  ]);
  assert.ok(probabilities.some((value) => value > 0 && value < 1), "대표 결과가 전부 0% 또는 100%이면 안 됩니다.");
}

const dataset = await PRODUCTION_MARKET_PATTERN_DATA_ADAPTER.loadDataset();
assert.equal(dataset.datasetVersion, PRODUCTION_MARKET_PATTERN_DATASET_VERSION);
assert.equal(dataset.periodStartYear, 1971);
assert.equal(dataset.periodEndYear, 2025);
assert.equal(dataset.observations.length, 55);
assert.equal(dataset.observations.length - BLOCK_LENGTH + 1, 51);
assert.deepEqual(dataset.observations.slice(0, BLOCK_LENGTH).map((row) => row.year), [1971, 1972, 1973, 1974, 1975]);
assert.deepEqual(dataset.observations.slice(-BLOCK_LENGTH).map((row) => row.year), [2021, 2022, 2023, 2024, 2025]);
validateMarketPatternDataset(dataset, ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES, BLOCK_LENGTH);
await assertMarketPatternDatasetIntegrity(dataset);

const missingAssetClass = structuredClone(dataset);
delete missingAssetClass.observations[0].assetClasses.us_large_growth;
assert.throws(
  () => validateMarketPatternDataset(missingAssetClass, ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES, BLOCK_LENGTH),
  /자산군 패턴이 없습니다/,
  "production 필수 자산군 누락은 fallback 없이 명시적 오류",
);

const tampered = structuredClone(dataset);
tampered.observations[0].inflationPct += 0.01;
await assert.rejects(() => assertMarketPatternDatasetIntegrity(tampered), /checksum/);
assert.ok(
  dataset.observations.every((row) => ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES.every(
    (assetClass) => row.assetClasses[assetClass]?.dividendGrowthPct === undefined,
  )),
  "근거 없는 production 배당성장 패턴을 생성하지 않습니다.",
);
assert.equal(dataset.assetClassMethodology.us_large_growth.sourceReturnType, "price_return_proxy");
assert.equal(dataset.assetClassMethodology.us_dividend_value.sourceReturnType, "price_return_proxy");
assert.equal(dataset.assetClassMethodology.us_large_cap.totalReturnPolicy, "source_total_return");
assert.equal(
  dataset.assetClassMethodology.us_large_growth.totalReturnPolicy,
  "price_pattern_recentered_to_user_total_return_cagr",
);
assert.ok(dataset.assetClassMethodology.us_large_growth.notes.includes("JEPQ 옵션 overlay의 낮은 변동성은 재현하지 않습니다"));
assert.ok(dataset.assetClassMethodology.us_dividend_value.notes.includes("SCHD 실제 역사나 배당·가치 지수가 아니며"));
assert.ok(dataset.observations.every((row) => (
  row.assetClasses.us_large_growth!.totalReturnPct === row.assetClasses.us_large_growth!.priceReturnPct
  && row.assetClasses.us_dividend_value!.totalReturnPct === row.assetClasses.us_dividend_value!.priceReturnPct
)), "price-return proxy의 호환 totalReturnPct slot은 원천 priceReturnPct와 같아야 합니다.");
assert.notDeepEqual(
  dataset.observations.map((row) => row.assetClasses.us_large_cap!.priceReturnPct),
  dataset.observations.map((row) => row.assetClasses.us_large_growth!.priceReturnPct),
  "대형주와 성장주 pattern은 동일 series가 아닙니다.",
);

const sampled = sampleMarketPatternBlocks(dataset, 70, BLOCK_LENGTH, createSeededPrng(20260718));
assert.equal(sampled.blockStarts.length, 14, "70년 경로는 5년 블록 14개를 복원추출합니다.");
sampled.observations.forEach((observation, index) => {
  assert.equal(observation, dataset.observations[sampled.observationIndices[index]], "같은 연도 행 전체가 함께 이동");
});
for (let offset = 0; offset < sampled.observationIndices.length; offset += BLOCK_LENGTH) {
  const block = sampled.observationIndices.slice(offset, offset + BLOCK_LENGTH);
  for (let index = 1; index < block.length; index += 1) {
    assert.equal(block[index], block[index - 1] + 1, "5년 블록 내부 연도 순서 유지");
  }
}
const repeatedBlockSample = sampleMarketPatternBlocks(dataset, 10, BLOCK_LENGTH, () => 0);
assert.deepEqual(repeatedBlockSample.blockStarts, [0, 0], "같은 역사 블록을 한 경로에서 복원추출할 수 있어야 합니다.");

const input = buildRetirementBootstrapProductionRepresentativeInput();
const compiled = compileRetirementBootstrapModel(input, dataset, BLOCK_LENGTH);
for (const diagnostics of compiled.recenteringDiagnostics) {
  assert.ok(
    Math.abs(diagnostics.targetGeometricRatePct - diagnostics.resultingGeometricRatePct) <= 1e-9,
    `${diagnostics.seriesId} 사용자 중심값 유지`,
  );
  const clippingCount = diagnostics.clippedLowCount + diagnostics.clippedHighCount;
  assert.ok(clippingCount / diagnostics.observationCount <= 0.01, `${diagnostics.seriesId} clipping 비율 1% 이하`);
}
assert.ok(
  compiled.brokerageHoldings.every((holding) => holding.centeredDividendGrowthPct.every(
    (rate) => rate === holding.expectedDividendGrowthPct,
  )),
  "배당성장 pattern 부재 시 사용자 배당성장률 중심 정책을 그대로 유지",
);

const spy = compiled.taxSavingHoldings.find((holding) => holding.ticker === "SPY")!;
const qqq = compiled.taxSavingHoldings.find((holding) => holding.ticker === "QQQ")!;
const schd = compiled.brokerageHoldings.find((holding) => holding.ticker === "SCHD")!;
const jepq = compiled.brokerageHoldings.find((holding) => holding.ticker === "JEPQ")!;
assert.deepEqual(
  spy.centeredTotalReturnsPct,
  recenterHistoricalRatesPct(
    dataset.observations.map((row) => row.assetClasses.us_large_cap!.totalReturnPct),
    spy.expectedTotalReturnCagrPct,
  ),
  "SPY 절세계좌는 S&P 500 source total return을 사용자 total-return CAGR에 재중심화합니다.",
);
assert.deepEqual(
  qqq.centeredTotalReturnsPct,
  recenterHistoricalRatesPct(
    dataset.observations.map((row) => row.assetClasses.us_large_growth!.priceReturnPct),
    qqq.expectedTotalReturnCagrPct,
  ),
  "QQQ 절세계좌는 Nasdaq Composite price-return proxy를 사용자 total-return CAGR에 재중심화합니다.",
);
assert.deepEqual(
  schd.centeredPriceReturnsPct,
  recenterHistoricalRatesPct(
    dataset.observations.map((row) => row.assetClasses.us_dividend_value!.priceReturnPct),
    schd.expectedPriceCagrPct,
  ),
  "SCHD 위탁계좌는 DJIA price-return proxy를 사용자 price CAGR에 재중심화합니다.",
);
assert.deepEqual(
  jepq.centeredPriceReturnsPct,
  recenterHistoricalRatesPct(
    dataset.observations.map((row) => row.assetClasses.us_large_growth!.priceReturnPct),
    jepq.expectedPriceCagrPct,
  ),
  "JEPQ 위탁계좌는 Nasdaq Composite price-return proxy를 사용자 price CAGR에 재중심화합니다.",
);
assert.ok(compiled.recenteringDiagnostics.some(
  (row) => row.seriesId === "tax_total_return_target_from_source_total_return:SPY",
));
assert.ok(compiled.recenteringDiagnostics.some(
  (row) => row.seriesId === "tax_total_return_target_from_price_return_proxy:QQQ",
));
assert.ok(compiled.recenteringDiagnostics.some(
  (row) => row.seriesId === "brokerage_price_return_target_from_price_return_proxy:SCHD",
));
assert.ok(compiled.recenteringDiagnostics.some(
  (row) => row.seriesId === "brokerage_price_return_target_from_price_return_proxy:JEPQ",
));

const unusedSourceFieldsMutated = structuredClone(dataset);
for (const row of unusedSourceFieldsMutated.observations) {
  row.assetClasses.us_large_cap!.priceReturnPct += 25;
  row.assetClasses.us_large_growth!.totalReturnPct += 25;
  row.assetClasses.us_dividend_value!.totalReturnPct += 25;
}
const unusedSourceFieldsCompiled = compileRetirementBootstrapModel(input, unusedSourceFieldsMutated, BLOCK_LENGTH);
assert.deepEqual(
  unusedSourceFieldsCompiled.taxSavingHoldings.map((holding) => holding.centeredTotalReturnsPct),
  compiled.taxSavingHoldings.map((holding) => holding.centeredTotalReturnsPct),
  "SPY price field와 QQQ proxy total-return 호환 slot은 절세계좌 source field가 아닙니다.",
);
assert.deepEqual(
  unusedSourceFieldsCompiled.brokerageHoldings.map((holding) => holding.centeredPriceReturnsPct),
  compiled.brokerageHoldings.map((holding) => holding.centeredPriceReturnsPct),
  "위탁계좌 가격 경로는 totalReturnPct를 읽지 않습니다.",
);

const activeSourceFieldsMutated = structuredClone(dataset);
activeSourceFieldsMutated.observations[0].assetClasses.us_large_cap!.totalReturnPct += 1;
activeSourceFieldsMutated.observations[0].assetClasses.us_large_growth!.priceReturnPct += 1;
activeSourceFieldsMutated.observations[0].assetClasses.us_dividend_value!.priceReturnPct += 1;
const activeSourceFieldsCompiled = compileRetirementBootstrapModel(input, activeSourceFieldsMutated, BLOCK_LENGTH);
assert.notDeepEqual(activeSourceFieldsCompiled.taxSavingHoldings, compiled.taxSavingHoldings, "절세계좌 active source field 변경 탐지");
assert.notDeepEqual(activeSourceFieldsCompiled.brokerageHoldings, compiled.brokerageHoldings, "위탁계좌 active price field 변경 탐지");

const taxOnlyInput = {
  ...input,
  initialBrokerage: 0,
  brokerageHoldings: [],
  withdrawalDelayYears: 2,
  annualRequiredWithdrawalReal: 1,
};
const taxOnlyCompiled = compileRetirementBootstrapModel(taxOnlyInput, dataset, BLOCK_LENGTH);
const taxOnlyPath = simulateRetirementBootstrapPath(taxOnlyInput, dataset, { years: 1, periods: [1], seed: 20260718 });
const taxObservationIndex = taxOnlyPath.sampledObservationIndices[0];
const expectedTaxReturnPct = taxOnlyCompiled.taxSavingHoldings.reduce((sum, holding) => (
  sum + holding.weightPct * holding.centeredTotalReturnsPct[taxObservationIndex]
), 0) / 100;
assert.ok(Math.abs(
  taxOnlyPath.records[0].nominalAssets
    - (taxOnlyInput.initialIsa + taxOnlyInput.initialPension) * (1 + expectedTaxReturnPct / 100)
) <= 1e-8, "SPY·QQQ 절세계좌 잔액에는 선택된 수익 pattern을 한 번만 적용합니다.");
assert.equal(taxOnlyPath.records[0].suppliedWithdrawalNet, 0, "절세계좌에서 별도 배당 현금흐름을 생성하지 않습니다.");

const brokerageOnlyInput = {
  ...input,
  initialIsa: 0,
  initialPension: 0,
  taxSavingHoldings: [],
  annualRequiredWithdrawalReal: 1,
};
const brokerageOnlyCompiled = compileRetirementBootstrapModel(brokerageOnlyInput, dataset, BLOCK_LENGTH);
const brokerageOnlyPath = simulateRetirementBootstrapPath(brokerageOnlyInput, dataset, { years: 1, periods: [1], seed: 20260718 });
const brokerageObservationIndex = brokerageOnlyPath.sampledObservationIndices[0];
const expectedBrokeragePriceReturnPct = brokerageOnlyCompiled.brokerageHoldings.reduce((sum, holding) => (
  sum + holding.weightPct * holding.centeredPriceReturnsPct[brokerageObservationIndex]
), 0) / 100;
const expectedUserDividendNet = input.initialBrokerage * (0.9 * 0.032 + 0.1 * 0.09) * 0.85;
assert.ok(Math.abs(
  brokerageOnlyPath.records[0].nominalAssets
    - input.initialBrokerage * (1 + expectedBrokeragePriceReturnPct / 100)
) <= 1e-8, "SCHD·JEPQ 위탁 잔액에는 가격수익만 적용하고 배당을 재투자하거나 차감하지 않습니다.");
assert.ok(Math.abs(brokerageOnlyPath.records[0].suppliedWithdrawalNet - expectedUserDividendNet) <= 1e-9,
  "SCHD·JEPQ 배당 현금흐름은 사용자 배당률을 세후로 한 번만 적용합니다.");

const jepqOnlyHolding = input.brokerageHoldings.find((holding) => holding.ticker === "JEPQ")!;
const jepqOnlyInput = {
  ...brokerageOnlyInput,
  initialBrokerage: 10_000,
  brokerageHoldings: [{ ...jepqOnlyHolding, weightPct: 100 }],
};
const jepqOnlyPath = simulateRetirementBootstrapPath(jepqOnlyInput, dataset, { years: 1, periods: [1], seed: 20260718 });
assert.ok(Math.abs(jepqOnlyPath.records[0].suppliedWithdrawalNet - 10_000 * 0.09 * 0.85) <= 1e-9,
  "JEPQ production 기본 분배 배수는 haircut 없는 1.0입니다.");

const tenThousandResults = SEEDS.map((seed) => runRetirementBootstrap(input, dataset, {
  iterations: ITERATIONS,
  blockLength: BLOCK_LENGTH,
  periods: PERIODS,
  seed,
}));
tenThousandResults.forEach(assertEconomicallySane);

const repeated = runRetirementBootstrap(input, dataset, {
  iterations: ITERATIONS,
  blockLength: BLOCK_LENGTH,
  periods: PERIODS,
  seed: SEEDS[0],
});
assert.deepEqual(repeated, tenThousandResults[0], "동일 production dataset·입력·시드 결과 완전 재현");
assert.notDeepEqual(tenThousandResults[0].periods, tenThousandResults[1].periods, "다른 시드는 합리적으로 다른 결과 생성");

const fiftyThousand = runRetirementBootstrap(input, dataset, {
  iterations: REFERENCE_ITERATIONS,
  blockLength: BLOCK_LENGTH,
  periods: PERIODS,
  seed: SEEDS[0],
});
const stability = tenThousandResults[0].periods.map((period) => {
  const reference = fiftyThousand.periods.find((row) => row.periodYears === period.periodYears)!;
  const differences = {
    successRate: Math.abs(period.successRate - reference.successRate),
    reachedRealPrincipal50PctProbability: Math.abs(
      period.reachedRealPrincipal50PctProbability - reference.reachedRealPrincipal50PctProbability,
    ),
    reachedRealPrincipal25PctProbability: Math.abs(
      period.reachedRealPrincipal25PctProbability - reference.reachedRealPrincipal25PctProbability,
    ),
  };
  assert.ok(Object.values(differences).every((difference) => difference <= STABILITY_TOLERANCE));
  return { periodYears: period.periodYears, ...differences };
});

const higherInflation = runRetirementBootstrap({ ...input, expectedInflationPct: 5 }, dataset, {
  iterations: 2_000,
  blockLength: BLOCK_LENGTH,
  periods: [30],
  seed: SEEDS[0],
});
const baselineInflation = runRetirementBootstrap(input, dataset, {
  iterations: 2_000,
  blockLength: BLOCK_LENGTH,
  periods: [30],
  seed: SEEDS[0],
});
assert.notDeepEqual(higherInflation.periods, baselineInflation.periods, "인플레이션 중심값 변경은 결과에 영향을 줍니다.");

console.log(JSON.stringify({
  validationPurpose: "production 데이터 검증용 대표 가정이며 실제 사용자 결과가 아님",
  dataset: {
    datasetId: dataset.datasetId,
    datasetVersion: dataset.datasetVersion,
    updatedAt: dataset.updatedAt,
    startYear: dataset.periodStartYear,
    endYear: dataset.periodEndYear,
    observations: dataset.observations.length,
    overlappingFiveYearBlocks: dataset.observations.length - BLOCK_LENGTH + 1,
    observationsSha256: dataset.integrity.observationsSha256,
  },
  representativeInput: input,
  recenteringDiagnostics: compiled.recenteringDiagnostics.map((row) => ({
    ...row,
    clippingRate: (row.clippedLowCount + row.clippedHighCount) / row.observationCount,
  })),
  tenThousandBySeed: tenThousandResults.map((result) => ({
    seed: result.seed,
    periods: result.periods.map(probabilitySnapshot),
  })),
  fiftyThousandReference: {
    seed: fiftyThousand.seed,
    periods: fiftyThousand.periods.map(probabilitySnapshot),
  },
  tenThousandVsFiftyThousandAbsoluteDifferences: stability,
  inflationSensitivity30Year: {
    baselineExpectedInflationPct: input.expectedInflationPct,
    baseline: probabilitySnapshot(baselineInflation.periods[0]),
    higherExpectedInflationPct: 5,
    higher: probabilitySnapshot(higherInflation.periods[0]),
  },
}, null, 2));
