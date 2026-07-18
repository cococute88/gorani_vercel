import {
  createSeededPrng,
  recenterHistoricalRatesPctWithDiagnostics,
  sampleMarketPatternBlocks,
  validateMarketPatternDataset,
} from "./retirement-bootstrap-data";
import {
  requiredAssetClasses,
  resolveDistributionPaymentMultiplier,
} from "./retirement-bootstrap-mapping";
import {
  DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
  DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
  RETIREMENT_BOOTSTRAP_PERIODS,
  type BootstrapBrokerageHolding,
  type BootstrapTaxSavingHolding,
  type DistributionStressPolicy,
  type MarketPatternDatasetV1,
  type RecenteringDiagnostics,
  type RetirementBootstrapAnnualRecord,
  type RetirementBootstrapInput,
  type RetirementBootstrapPathCheckpoint,
  type RetirementBootstrapPathResult,
  type RetirementBootstrapPeriodResult,
  type RetirementBootstrapResult,
  type RetirementBootstrapRunOptions,
  type SampledMarketPath,
} from "./retirement-bootstrap-types";

const ISA_TAX_RATE_AFTER_2051 = 0.099;
const PENSION_TAX_RATE_AFTER_2051 = 0.055;
const DIVIDEND_TAX_KEEP_RATE = 0.85;
const EPSILON = 1e-9;
const WEIGHT_TOLERANCE = 1e-6;
const MAX_PATH_YEARS = 70;

type CompiledTaxHolding = BootstrapTaxSavingHolding & { centeredTotalReturnsPct: number[] };
type CompiledBrokerageHolding = BootstrapBrokerageHolding & {
  centeredPriceReturnsPct: number[];
  centeredDividendGrowthPct: number[];
};

export type CompiledRetirementBootstrapModel = {
  input: RetirementBootstrapInput;
  dataset: MarketPatternDatasetV1;
  centeredInflationPct: number[];
  taxSavingHoldings: CompiledTaxHolding[];
  brokerageHoldings: CompiledBrokerageHolding[];
  recenteringDiagnostics: RecenteringDiagnostics[];
};

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} 값이 유한한 숫자가 아닙니다.`);
}

function assertRate(value: number, label: string, minExclusive = -100): void {
  assertFinite(value, label);
  if (value <= minExclusive) throw new Error(`${label} 값은 ${minExclusive}%보다 커야 합니다.`);
}

function validateWeights(holdings: ReadonlyArray<{ weightPct: number }>, label: string): void {
  if (holdings.length === 0) throw new Error(`${label} 종목 가정이 없습니다.`);
  const total = holdings.reduce((sum, holding) => {
    assertFinite(holding.weightPct, `${label} 비중`);
    if (holding.weightPct <= 0 || holding.weightPct > 100) throw new Error(`${label} 비중은 0보다 크고 100 이하여야 합니다.`);
    return sum + holding.weightPct;
  }, 0);
  if (Math.abs(total - 100) > WEIGHT_TOLERANCE) throw new Error(`${label} 비중 합계는 100%여야 합니다.`);
}

function validateDistributionStressPolicy(policy: DistributionStressPolicy | undefined): void {
  if (!policy) return;
  if (typeof policy.policyId !== "string" || !policy.policyId.trim()) {
    throw new Error("분배 스트레스 정책 ID가 비어 있습니다.");
  }
  if (typeof policy.paymentMultiplier !== "function") {
    throw new Error(`${policy.policyId} 분배 스트레스 정책 함수가 없습니다.`);
  }
}

function validateInput(input: RetirementBootstrapInput): void {
  if (!Number.isInteger(input.startYear)) throw new Error("시작 연도는 정수여야 합니다.");
  for (const [label, value] of [
    ["초기 ISA", input.initialIsa],
    ["초기 연금", input.initialPension],
    ["초기 위탁계좌", input.initialBrokerage],
  ] as const) {
    assertFinite(value, label);
    if (value < 0) throw new Error(`${label} 금액은 음수일 수 없습니다.`);
  }
  if (input.initialIsa + input.initialPension + input.initialBrokerage <= 0) {
    throw new Error("초기 전체 투자자산은 0보다 커야 합니다.");
  }
  assertRate(input.expectedInflationPct, "기대 인플레이션");
  assertRate(input.withdrawalGrowthRatePct, "인출 증가율");
  assertFinite(input.withdrawalRatePct, "인출률");
  if (input.withdrawalRatePct < 0 || input.withdrawalRatePct > 100) throw new Error("인출률은 0%~100% 범위여야 합니다.");
  if (!Number.isInteger(input.withdrawalDelayYears) || input.withdrawalDelayYears < 0) {
    throw new Error("인출 지연 연수는 0 이상의 정수여야 합니다.");
  }
  assertFinite(input.annualRequiredWithdrawalReal, "연간 필수 인출액");
  if (input.annualRequiredWithdrawalReal <= 0) throw new Error("연간 필수 인출액은 0보다 커야 합니다.");

  if (input.taxSavingHoldings.length > 0) validateWeights(input.taxSavingHoldings, "절세계좌");
  else if (input.initialIsa + input.initialPension > 0) throw new Error("절세계좌 종목 가정이 없습니다.");
  if (input.brokerageHoldings.length > 0) validateWeights(input.brokerageHoldings, "위탁계좌");
  else if (input.initialBrokerage > 0) throw new Error("위탁계좌 종목 가정이 없습니다.");
  for (const holding of input.taxSavingHoldings) {
    assertRate(holding.expectedTotalReturnCagrPct, `${holding.ticker} 기대 총수익 CAGR`);
  }
  for (const holding of input.brokerageHoldings) {
    assertRate(holding.expectedPriceCagrPct, `${holding.ticker} 기대 가격 CAGR`);
    assertFinite(holding.initialDividendYieldPct, `${holding.ticker} 초기 배당률`);
    if (holding.initialDividendYieldPct < 0 || holding.initialDividendYieldPct > 100) {
      throw new Error(`${holding.ticker} 초기 배당률은 0%~100% 범위여야 합니다.`);
    }
    assertRate(holding.expectedDividendGrowthPct, `${holding.ticker} 기대 배당성장률`);
  }
}

function blendHoldingReturns(
  holdings: ReadonlyArray<{ weightPct: number }>,
  rateAt: (holdingIndex: number) => number,
): number {
  return holdings.reduce((sum, holding, index) => sum + holding.weightPct * rateAt(index), 0) / 100;
}

export function compileRetirementBootstrapModel(
  input: RetirementBootstrapInput,
  dataset: MarketPatternDatasetV1 | null,
  blockLength = DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
  allowTestFixture = false,
): CompiledRetirementBootstrapModel {
  validateInput(input);
  const mappings = [...input.taxSavingHoldings, ...input.brokerageHoldings].map((holding) => holding.mapping);
  const assetClasses = requiredAssetClasses(mappings);
  validateMarketPatternDataset(dataset, assetClasses, blockLength, allowTestFixture);

  const recenteringDiagnostics: RecenteringDiagnostics[] = [];
  const centerSeries = (seriesId: string, historicalRatesPct: number[], targetGeometricRatePct: number): number[] => {
    const centered = recenterHistoricalRatesPctWithDiagnostics(historicalRatesPct, targetGeometricRatePct);
    const { ratesPct, ...diagnostics } = centered;
    recenteringDiagnostics.push({ seriesId, ...diagnostics });
    return ratesPct;
  };

  const centeredInflationPct = centerSeries(
    "inflation",
    dataset.observations.map((row) => row.inflationPct),
    input.expectedInflationPct,
  );
  const taxSavingHoldings = input.taxSavingHoldings.map((holding): CompiledTaxHolding => {
    const methodology = dataset.assetClassMethodology[holding.mapping.assetClass];
    const usesSourceTotalReturn = methodology.totalReturnPolicy === "source_total_return";
    const sourceField = usesSourceTotalReturn ? "totalReturnPct" : "priceReturnPct";
    const sourceLabel = usesSourceTotalReturn ? "source_total_return" : "price_return_proxy";
    return {
      ...holding,
      centeredTotalReturnsPct: centerSeries(
        `tax_total_return_target_from_${sourceLabel}:${holding.ticker}`,
        dataset.observations.map((row) => row.assetClasses[holding.mapping.assetClass]![sourceField]),
        holding.expectedTotalReturnCagrPct,
      ),
    };
  });
  const brokerageHoldings = input.brokerageHoldings.map((holding): CompiledBrokerageHolding => {
    const methodology = dataset.assetClassMethodology[holding.mapping.assetClass];
    const priceSourceLabel = methodology.sourceReturnType === "price_return_proxy"
      ? "price_return_proxy"
      : "source_price_return";
    const historicalDividendGrowth = dataset.observations.map(
      (row) => row.assetClasses[holding.mapping.assetClass]!.dividendGrowthPct,
    );
    return {
      ...holding,
      centeredPriceReturnsPct: centerSeries(
        `brokerage_price_return_target_from_${priceSourceLabel}:${holding.ticker}`,
        dataset.observations.map((row) => row.assetClasses[holding.mapping.assetClass]!.priceReturnPct),
        holding.expectedPriceCagrPct,
      ),
      centeredDividendGrowthPct: historicalDividendGrowth.every((value) => value !== undefined)
        ? centerSeries(
          `brokerage_dividend_growth:${holding.ticker}`,
          historicalDividendGrowth as number[],
          holding.expectedDividendGrowthPct,
        )
        : dataset.observations.map(() => holding.expectedDividendGrowthPct),
    };
  });

  return { input, dataset, centeredInflationPct, taxSavingHoldings, brokerageHoldings, recenteringDiagnostics };
}

export function toStartPurchasingPower(nominalAmount: number, cumulativeInflation: number): number {
  assertFinite(nominalAmount, "명목금액");
  assertFinite(cumulativeInflation, "누적 인플레이션");
  if (cumulativeInflation <= 0) throw new Error("누적 인플레이션 지수는 0보다 커야 합니다.");
  return nominalAmount / cumulativeInflation;
}

function principalWithdrawalSchedule(
  principal: number,
  eligiblePathIndices: number[],
  centeredInflationPathPct: number[],
  withdrawalGrowthRatePct: number,
): Map<number, number> {
  const schedule = new Map<number, number>();
  if (principal <= 0 || eligiblePathIndices.length === 0) return schedule;
  const growth = 1 + withdrawalGrowthRatePct / 100;
  const factors = [1];
  for (let index = 1; index < eligiblePathIndices.length; index += 1) {
    const pathIndex = eligiblePathIndices[index];
    factors.push(factors[index - 1] * growth * (1 + centeredInflationPathPct[pathIndex] / 100));
  }
  const factorSum = factors.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(factorSum) || factorSum <= 0) {
    throw new Error("원금 인출 일정이 유한한 값으로 계산되지 않았습니다.");
  }
  eligiblePathIndices.forEach((pathIndex, index) => schedule.set(pathIndex, principal * factors[index] / factorSum));
  return schedule;
}

function createCheckpoints(
  records: RetirementBootstrapAnnualRecord[],
  periods: readonly number[],
  initialRealPrincipal: number,
): RetirementBootstrapPathCheckpoint[] {
  return periods.map((periodYears) => {
    const rows = records.slice(0, periodYears);
    const ending = rows.at(-1);
    if (!ending || rows.length !== periodYears) throw new Error(`${periodYears}년 경로 결과가 완성되지 않았습니다.`);
    const firstDepleted = rows.find((row) => row.depleted);
    const firstShortfall = rows.find((row) => !row.withdrawalSatisfied);
    return {
      periodYears,
      success: !firstDepleted && !firstShortfall && ending.nominalAssets > EPSILON,
      reachedRealPrincipal50Pct: rows.some((row) => row.realAssets <= initialRealPrincipal * 0.5),
      reachedRealPrincipal25Pct: rows.some((row) => row.realAssets <= initialRealPrincipal * 0.25),
      firstDepletionYear: firstDepleted?.calendarYear ?? null,
      firstWithdrawalShortfallYear: firstShortfall?.calendarYear ?? null,
      endingRealAssets: ending.realAssets,
    };
  });
}

export function buildRetirementBootstrapCheckpoints(
  records: RetirementBootstrapAnnualRecord[],
  periods: readonly number[],
  initialRealPrincipal: number,
): RetirementBootstrapPathCheckpoint[] {
  return createCheckpoints(records, periods, initialRealPrincipal);
}

function simulateCompiledPath(
  model: CompiledRetirementBootstrapModel,
  sampledPath: SampledMarketPath,
  periods: readonly number[],
  distributionStressPolicy?: DistributionStressPolicy,
): RetirementBootstrapPathResult {
  const { input, dataset } = model;
  const pathYears = sampledPath.observations.length;
  const inflationPathPct = sampledPath.observationIndices.map((index) => model.centeredInflationPct[index]);
  const withdrawalStartYearNumber = Math.max(1, input.withdrawalDelayYears);
  const eligiblePre2050Indices = Array.from({ length: pathYears }, (_, index) => index).filter((index) => (
    index + 1 >= withdrawalStartYearNumber && input.startYear + index + 1 <= 2050
  ));
  const isaPrincipalSchedule = principalWithdrawalSchedule(
    input.initialIsa,
    eligiblePre2050Indices,
    inflationPathPct,
    input.withdrawalGrowthRatePct,
  );
  const pensionPrincipalSchedule = principalWithdrawalSchedule(
    input.initialPension,
    eligiblePre2050Indices,
    inflationPathPct,
    input.withdrawalGrowthRatePct,
  );

  let isaBalance = input.initialIsa;
  let pensionBalance = input.initialPension;
  let brokerageBalance = input.initialBrokerage;
  let remainingIsaPrincipal = input.initialIsa;
  let remainingPensionPrincipal = input.initialPension;
  let cumulativeInflation = 1;
  let isaPost2050Base: number | null = null;
  let pensionPost2050Base: number | null = null;
  let post2050WithdrawalIndex = 0;
  // 가격 평가잔고와 배당 현금흐름을 분리한다. 최초 배당 기준액은 사용자
  // 입력 yield로 만들고, 이후에는 배당성장 패턴으로만 갱신한다.
  const annualDividendNominal = model.brokerageHoldings.map((holding) => {
    const amount = input.initialBrokerage * (holding.weightPct / 100) * (holding.initialDividendYieldPct / 100);
    assertFinite(amount, `${holding.ticker} 최초 연간 배당 기준액`);
    return amount;
  });
  const records: RetirementBootstrapAnnualRecord[] = [];

  for (let pathIndex = 0; pathIndex < pathYears; pathIndex += 1) {
    const observationIndex = sampledPath.observationIndices[pathIndex];
    const observation = dataset.observations[observationIndex];
    const yearNumber = pathIndex + 1;
    const calendarYear = input.startYear + yearNumber;
    const isWithdrawalYear = yearNumber >= withdrawalStartYearNumber;
    const inflationPct = inflationPathPct[pathIndex];
    cumulativeInflation *= 1 + inflationPct / 100;
    assertFinite(cumulativeInflation, `${yearNumber}년 차 누적 인플레이션`);

    const taxReturnPct = model.taxSavingHoldings.length === 0 ? 0 : blendHoldingReturns(
      model.taxSavingHoldings,
      (holdingIndex) => model.taxSavingHoldings[holdingIndex].centeredTotalReturnsPct[observationIndex],
    );
    const brokeragePriceReturnPct = model.brokerageHoldings.length === 0 ? 0 : blendHoldingReturns(
      model.brokerageHoldings,
      (holdingIndex) => model.brokerageHoldings[holdingIndex].centeredPriceReturnsPct[observationIndex],
    );

    isaBalance = Math.max(0, isaBalance * (1 + taxReturnPct / 100));
    pensionBalance = Math.max(0, pensionBalance * (1 + taxReturnPct / 100));
    brokerageBalance = Math.max(0, brokerageBalance * (1 + brokeragePriceReturnPct / 100));
    assertFinite(isaBalance, `${yearNumber}년 차 ISA 잔액`);
    assertFinite(pensionBalance, `${yearNumber}년 차 연금 잔액`);
    assertFinite(brokerageBalance, `${yearNumber}년 차 위탁계좌 잔액`);

    let grossDividend = 0;
    if (isWithdrawalYear && brokerageBalance > 0) {
      grossDividend = model.brokerageHoldings.reduce((sum, holding, holdingIndex) => {
        const rawPricePattern = observation.assetClasses[holding.mapping.assetClass]!.priceReturnPct;
        const paymentMultiplier = distributionStressPolicy
          ? resolveDistributionPaymentMultiplier(distributionStressPolicy, {
            ticker: holding.ticker,
            assetClass: holding.mapping.assetClass,
            distributionPolicy: holding.mapping.distributionPolicy,
            rawAssetClassPricePatternPct: rawPricePattern,
            sourceObservationYear: observation.year,
            pathYearNumber: yearNumber,
          })
          : 1;
        return sum + annualDividendNominal[holdingIndex] * paymentMultiplier;
      }, 0);
    }
    assertFinite(grossDividend, `${yearNumber}년 차 총배당`);
    const netDividend = grossDividend * DIVIDEND_TAX_KEEP_RATE;

    let isaGross = 0;
    let pensionGross = 0;
    let isaTaxRate = 0;
    let pensionTaxRate = 0;
    if (isWithdrawalYear && calendarYear <= 2050) {
      isaGross = Math.min(isaPrincipalSchedule.get(pathIndex) ?? 0, remainingIsaPrincipal, isaBalance);
      pensionGross = Math.min(pensionPrincipalSchedule.get(pathIndex) ?? 0, remainingPensionPrincipal, pensionBalance);
      remainingIsaPrincipal = Math.max(0, remainingIsaPrincipal - isaGross);
      remainingPensionPrincipal = Math.max(0, remainingPensionPrincipal - pensionGross);
    } else if (isWithdrawalYear) {
      isaTaxRate = ISA_TAX_RATE_AFTER_2051;
      pensionTaxRate = PENSION_TAX_RATE_AFTER_2051;
      if (isaPost2050Base === null) {
        isaPost2050Base = isaBalance * (input.withdrawalRatePct / 100);
        pensionPost2050Base = pensionBalance * (input.withdrawalRatePct / 100);
        post2050WithdrawalIndex = 0;
      }
      const withdrawalGrowth = Math.pow(1 + input.withdrawalGrowthRatePct / 100, post2050WithdrawalIndex);
      isaGross = Math.min(isaBalance, isaPost2050Base * withdrawalGrowth);
      pensionGross = Math.min(pensionBalance, (pensionPost2050Base ?? 0) * withdrawalGrowth);
      post2050WithdrawalIndex += 1;
    }

    isaBalance = Math.max(0, isaBalance - isaGross);
    pensionBalance = Math.max(0, pensionBalance - pensionGross);
    const suppliedWithdrawalNet = isaGross * (1 - isaTaxRate) + pensionGross * (1 - pensionTaxRate) + netDividend;
    const requiredWithdrawalNominal = isWithdrawalYear
      ? input.annualRequiredWithdrawalReal * cumulativeInflation
      : 0;
    assertFinite(suppliedWithdrawalNet, `${yearNumber}년 차 세후 공급액`);
    assertFinite(requiredWithdrawalNominal, `${yearNumber}년 차 필수 인출액`);
    const withdrawalSatisfied = suppliedWithdrawalNet + EPSILON >= requiredWithdrawalNominal;
    const nominalAssets = isaBalance + pensionBalance + brokerageBalance;
    const realAssets = toStartPurchasingPower(nominalAssets, cumulativeInflation);
    assertFinite(nominalAssets, `${yearNumber}년 차 명목자산`);
    assertFinite(realAssets, `${yearNumber}년 차 실질자산`);
    const depleted = nominalAssets <= EPSILON;

    records.push({
      yearNumber,
      calendarYear,
      sourceObservationYear: observation.year,
      nominalAssets,
      realAssets,
      cumulativeInflation,
      requiredWithdrawalNominal,
      suppliedWithdrawalNet,
      withdrawalSatisfied,
      depleted,
    });

    for (let holdingIndex = 0; holdingIndex < model.brokerageHoldings.length; holdingIndex += 1) {
      const dividendGrowthPct = model.brokerageHoldings[holdingIndex].centeredDividendGrowthPct[observationIndex];
      annualDividendNominal[holdingIndex] = Math.max(
        0,
        annualDividendNominal[holdingIndex] * (1 + dividendGrowthPct / 100),
      );
      assertFinite(annualDividendNominal[holdingIndex], `${yearNumber}년 차 ${model.brokerageHoldings[holdingIndex].ticker} 배당 기준액`);
    }
  }

  const initialRealPrincipal = input.initialIsa + input.initialPension + input.initialBrokerage;
  return {
    initialRealPrincipal,
    records,
    checkpoints: createCheckpoints(records, periods, initialRealPrincipal),
    sampledObservationIndices: sampledPath.observationIndices,
    sampledBlockStarts: sampledPath.blockStarts,
  };
}

function validatePeriods(periods: readonly number[]): number[] {
  if (periods.length === 0) throw new Error("분석 기간이 없습니다.");
  const normalized = Array.from(new Set(periods)).sort((left, right) => left - right);
  for (const period of normalized) {
    if (!Number.isInteger(period) || period <= 0 || period > MAX_PATH_YEARS) {
      throw new Error(`분석 기간은 1년~${MAX_PATH_YEARS}년 정수 범위여야 합니다.`);
    }
  }
  return normalized;
}

export function simulateRetirementBootstrapPath(
  input: RetirementBootstrapInput,
  dataset: MarketPatternDatasetV1 | null,
  options: {
    years: number;
    periods?: readonly number[];
    blockLength?: number;
    seed: number;
    allowTestFixture?: boolean;
    distributionStressPolicy?: DistributionStressPolicy;
  },
): RetirementBootstrapPathResult {
  validateDistributionStressPolicy(options.distributionStressPolicy);
  const periods = validatePeriods(options.periods ?? [options.years]);
  if (Math.max(...periods) > options.years) throw new Error("경로 길이보다 긴 집계 기간을 요청했습니다.");
  const blockLength = options.blockLength ?? DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH;
  const model = compileRetirementBootstrapModel(input, dataset, blockLength, options.allowTestFixture);
  const random = createSeededPrng(options.seed);
  const sampled = sampleMarketPatternBlocks(model.dataset, options.years, blockLength, random);
  return simulateCompiledPath(model, sampled, periods, options.distributionStressPolicy);
}

export function runRetirementBootstrap(
  input: RetirementBootstrapInput,
  dataset: MarketPatternDatasetV1 | null,
  options: RetirementBootstrapRunOptions,
): RetirementBootstrapResult {
  validateDistributionStressPolicy(options.distributionStressPolicy);
  const iterations = options.iterations ?? DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS;
  const blockLength = options.blockLength ?? DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH;
  const periods = validatePeriods(options.periods ?? RETIREMENT_BOOTSTRAP_PERIODS);
  if (!Number.isInteger(iterations) || iterations <= 0) throw new Error("시뮬레이션 횟수는 양의 정수여야 합니다.");
  const maxYears = Math.max(...periods);
  const model = compileRetirementBootstrapModel(input, dataset, blockLength, options.allowTestFixture);
  const random = createSeededPrng(options.seed);
  const aggregates = new Map<number, {
    successCount: number;
    reached50Count: number;
    reached25Count: number;
    endingRealAssetsTotal: number;
  }>(periods.map((period) => [period, {
    successCount: 0,
    reached50Count: 0,
    reached25Count: 0,
    endingRealAssetsTotal: 0,
  }]));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sampled = sampleMarketPatternBlocks(model.dataset, maxYears, blockLength, random);
    const path = simulateCompiledPath(model, sampled, periods, options.distributionStressPolicy);
    for (const checkpoint of path.checkpoints) {
      const aggregate = aggregates.get(checkpoint.periodYears)!;
      if (checkpoint.success) aggregate.successCount += 1;
      if (checkpoint.reachedRealPrincipal50Pct) aggregate.reached50Count += 1;
      if (checkpoint.reachedRealPrincipal25Pct) aggregate.reached25Count += 1;
      aggregate.endingRealAssetsTotal += checkpoint.endingRealAssets;
      assertFinite(aggregate.endingRealAssetsTotal, `${checkpoint.periodYears}년 종료 실질자산 집계`);
    }
  }

  const periodResults: RetirementBootstrapPeriodResult[] = periods.map((periodYears) => {
    const aggregate = aggregates.get(periodYears)!;
    return {
      periodYears,
      simulationCount: iterations,
      successCount: aggregate.successCount,
      successRate: aggregate.successCount / iterations,
      reachedRealPrincipal50PctCount: aggregate.reached50Count,
      reachedRealPrincipal50PctProbability: aggregate.reached50Count / iterations,
      reachedRealPrincipal25PctCount: aggregate.reached25Count,
      reachedRealPrincipal25PctProbability: aggregate.reached25Count / iterations,
      averageEndingRealAssets: aggregate.endingRealAssetsTotal / iterations,
    };
  });

  return {
    method: "five_year_block_bootstrap_recentered",
    iterations,
    blockLength,
    seed: options.seed,
    distributionStressPolicyId: options.distributionStressPolicy?.policyId ?? null,
    datasetId: model.dataset.datasetId,
    datasetVersion: model.dataset.datasetVersion,
    datasetUsage: model.dataset.usage,
    dataPeriod: { startYear: model.dataset.periodStartYear, endYear: model.dataset.periodEndYear },
    datasetUpdatedAt: model.dataset.updatedAt,
    realValueBasis: "simulation_start_purchasing_power",
    recenteringDiagnostics: model.recenteringDiagnostics,
    periods: periodResults,
  };
}
