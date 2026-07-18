import type { AppliedPortfolioAssumptionsV1, SimulatorInputs } from "./asset-simulator-types";

export const RETIREMENT_BOOTSTRAP_PERIODS = [30, 40, 50, 60, 70] as const;
export const DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS = 10_000;
export const DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH = 5;
export const RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION = 2 as const;
export const RETIREMENT_BOOTSTRAP_SUSTAINABILITY_MIN_FUNDING_RATIO = 0.85;

export type RetirementBootstrapPeriod = (typeof RETIREMENT_BOOTSTRAP_PERIODS)[number];

export type AssetClassPatternId =
  | "us_large_cap"
  | "us_large_growth"
  | "us_dividend_value";

export type DistributionPolicyId = "standard_dividend" | "income_strategy";

export type EtfPatternMapping = {
  ticker: string;
  assetClass: AssetClassPatternId;
  distributionPolicy: DistributionPolicyId;
  rationale: string;
};

export type DistributionStressContext = {
  ticker: string;
  assetClass: AssetClassPatternId;
  distributionPolicy: DistributionPolicyId;
  rawAssetClassPricePatternPct: number;
  sourceObservationYear: number;
  pathYearNumber: number;
};

/** 기본 계산은 중립이며, 검증된 결정론적 순수 정책이 있을 때만 명시적으로 주입한다. */
export type DistributionStressPolicy = {
  policyId: string;
  paymentMultiplier(context: DistributionStressContext): number;
};

export type AssetClassAnnualPattern = {
  /**
   * 절세계좌 총수익 CAGR에 재중심화할 canonical pattern slot.
   * `source_total_return` 자산군(S&P 500)은 실제 역사 total return이고,
   * `price_pattern_recentered_to_user_total_return_cagr` 자산군은 원천 price return을
   * 호환성 때문에 복제한 값이다. 실제 source field 선택은 assetClassMethodology를 따른다.
   */
  totalReturnPct: number;
  /** 원천 자산군 연간 가격수익률. 위탁계좌 가격 편차와 price-return proxy에 사용한다. */
  priceReturnPct: number;
  /** 선택 필드. 완결된 자산군 배당성장 데이터가 있을 때만 사용한다. */
  dividendGrowthPct?: number;
};

export type AnnualMarketPatternObservation = {
  year: number;
  inflationPct: number;
  /** 같은 연도의 모든 자산군 변수와 인플레이션은 이 행 안에서 함께 이동한다. */
  assetClasses: Partial<Record<AssetClassPatternId, AssetClassAnnualPattern>>;
};

export type MarketPatternDatasetSource = {
  sourceId: string;
  name: string;
  url: string;
  role: "market_pattern" | "inflation" | "license";
  license: string;
  licenseUrl: string;
  retrievedAt: string;
  revision?: string;
  contentSha256: string;
};

export type MarketPatternAssetClassMethodology = {
  proxyName: string;
  sourceReturnType: "price_and_total_return" | "price_return_proxy";
  totalReturnPolicy: "source_total_return" | "price_pattern_recentered_to_user_total_return_cagr";
  dividendGrowthPolicy: "source_pattern" | "user_assumption_only";
  notes: string;
};

export type MarketPatternDatasetLicense = {
  name: string;
  spdxId: string;
  url: string;
  attribution: string;
  repositoryRedistribution: "allowed_with_attribution_and_share_alike" | "test_fixture_only";
};

export type MarketPatternDatasetIntegrity = {
  algorithm: "SHA-256";
  canonicalization: "JSON.stringify(observations)";
  observationsSha256: string;
};

export type MarketPatternDatasetV1 = {
  schemaVersion: 1;
  datasetId: string;
  datasetVersion: string;
  usage: "production" | "test_fixture";
  updatedAt: string;
  periodStartYear: number;
  periodEndYear: number;
  license: MarketPatternDatasetLicense;
  sources: MarketPatternDatasetSource[];
  assetClassMethodology: Record<AssetClassPatternId, MarketPatternAssetClassMethodology>;
  integrity: MarketPatternDatasetIntegrity;
  observations: AnnualMarketPatternObservation[];
};

/** 후속 production 데이터 연결부가 구현해야 하는 최소 비동기 계약. */
export interface MarketPatternDataAdapter {
  loadDataset(): Promise<MarketPatternDatasetV1>;
}

export type BootstrapTaxSavingHolding = {
  ticker: string;
  weightPct: number;
  expectedTotalReturnCagrPct: number;
  mapping: EtfPatternMapping;
};

export type BootstrapBrokerageHolding = {
  ticker: string;
  weightPct: number;
  expectedPriceCagrPct: number;
  initialDividendYieldPct: number;
  expectedDividendGrowthPct: number;
  mapping: EtfPatternMapping;
};

export type RetirementBootstrapInput = {
  startYear: number;
  initialIsa: number;
  initialPension: number;
  initialBrokerage: number;
  expectedInflationPct: number;
  withdrawalRatePct: number;
  withdrawalGrowthRatePct: number;
  withdrawalDelayYears: number;
  /** 시작 시점 구매력 기준 연간 필수 세후 인출액. 금액 단위는 초기자산과 같아야 한다. */
  annualRequiredWithdrawalReal: number;
  taxSavingHoldings: BootstrapTaxSavingHolding[];
  brokerageHoldings: BootstrapBrokerageHolding[];
};

export type BuildRetirementBootstrapInputOptions = {
  inputs: SimulatorInputs;
  portfolioAssumptions: AppliedPortfolioAssumptionsV1 | null;
  targetMonthlyExpenseReal: number | null;
};

export type RetirementBootstrapRunOptions = {
  iterations?: number;
  blockLength?: number;
  periods?: readonly number[];
  seed: number;
  distributionStressPolicy?: DistributionStressPolicy;
  /** 테스트 fixture를 production 결과로 오용하지 못하도록 기본값은 false다. */
  allowTestFixture?: boolean;
};

export type SampledMarketPath = {
  observationIndices: number[];
  observations: AnnualMarketPatternObservation[];
  blockStarts: number[];
};

export type RetirementBootstrapAnnualRecord = {
  yearNumber: number;
  calendarYear: number;
  sourceObservationYear: number;
  nominalAssets: number;
  realAssets: number;
  cumulativeInflation: number;
  /** 해당 연도 목표 세후 생활비. 인출 시작 전에는 0이다. */
  requiredAfterTaxCashflow: number;
  /** 해당 연도 실제 세후 공급 가능 현금흐름. */
  suppliedAfterTaxCashflow: number;
  /** 목표 대비 공급 비율. 인출 시작 전에는 null이다. */
  fundingRatio: number | null;
  /** 인출 적용 직전의 시작 시점 구매력 기준 총 실질자산. */
  realAssetsBeforeWithdrawal: number;
  /** 시작 시점 구매력 기준 위탁계좌 세후 배당/분배 현금흐름. */
  realNetBrokerageDividendCashflow: number;
  /** @deprecated requiredAfterTaxCashflow를 사용한다. */
  requiredWithdrawalNominal: number;
  grossIsaWithdrawal: number;
  netIsaWithdrawal: number;
  grossPensionWithdrawal: number;
  netPensionWithdrawal: number;
  grossBrokerageDividend: number;
  netBrokerageDividend: number;
  /** @deprecated suppliedAfterTaxCashflow를 사용한다. */
  suppliedWithdrawalNet: number;
  withdrawalSatisfied: boolean;
  depleted: boolean;
};

export type RetirementBootstrapPathCheckpoint = {
  periodYears: number;
  /** @deprecated V1의 100% 완전 충족 성공 계약. fullFundingSuccess100을 사용한다. */
  success: boolean;
  sustainabilitySuccess85: boolean;
  fullFundingSuccess100: boolean;
  reachedRealPrincipal50Pct: boolean;
  reachedRealPrincipal25Pct: boolean;
  firstDepletionYear: number | null;
  firstWithdrawalShortfallYear: number | null;
  endingRealAssets: number;
  withdrawalStartRealAssets: number | null;
  finalRealAssetRetentionRatio: number | null;
  minimumFundingRatio: number | null;
  livingExpenseMdd: number | null;
  minimumMonthlySuppliedReal: number | null;
  realAfterTaxDividendCashflowMdd: number | null;
};

export type RetirementBootstrapPathResult = {
  initialRealPrincipal: number;
  records: RetirementBootstrapAnnualRecord[];
  checkpoints: RetirementBootstrapPathCheckpoint[];
  sampledObservationIndices: number[];
  sampledBlockStarts: number[];
};

export type RetirementBootstrapPeriodResult = {
  periodYears: number;
  simulationCount: number;
  /** @deprecated V1의 100% 완전 충족 집계. fullFundingSuccessCount100을 사용한다. */
  successCount: number;
  /** @deprecated V1의 100% 완전 충족 집계. fullFundingSuccessRate100을 사용한다. */
  successRate: number;
  sustainabilitySuccessCount85: number;
  sustainabilitySuccessRate85: number;
  fullFundingSuccessCount100: number;
  fullFundingSuccessRate100: number;
  reachedRealPrincipal50PctCount: number;
  reachedRealPrincipal50PctProbability: number;
  reachedRealPrincipal25PctCount: number;
  reachedRealPrincipal25PctProbability: number;
  averageEndingRealAssets: number;
  finalRealAssetRetention: RetirementBootstrapFinalRealAssetRetentionDistribution;
  livingExpenseRisk: RetirementBootstrapLivingExpenseRisk;
  realAfterTaxDividendCashflowRisk: RetirementBootstrapDividendCashflowRisk;
};

export type RetirementBootstrapFinalRealAssetRetentionDistribution = {
  denominatorPathCount: number;
  atLeast100PctCount: number;
  atLeast100PctProbability: number;
  from80To100PctCount: number;
  from80To100PctProbability: number;
  from50To80PctCount: number;
  from50To80PctProbability: number;
  from25To50PctCount: number;
  from25To50PctProbability: number;
  below25PctCount: number;
  below25PctProbability: number;
  depletedPathCount: number;
  depletedProbability: number;
  medianRetentionRatio: number | null;
};

export type RetirementBootstrapLivingExpenseRisk = {
  observedPathCount: number;
  worstMinimumFundingRatio: number | null;
  worstLivingExpenseMdd: number | null;
  worstMinimumMonthlySuppliedReal: number | null;
  lower1PctMinimumFundingRatio: number | null;
  lower1PctLivingExpenseMdd: number | null;
  lower1PctMinimumMonthlySuppliedReal: number | null;
  lower5PctMinimumFundingRatio: number | null;
  lower5PctLivingExpenseMdd: number | null;
  lower5PctMinimumMonthlySuppliedReal: number | null;
  medianMinimumFundingRatio: number | null;
  medianLivingExpenseMdd: number | null;
  medianMinimumMonthlySuppliedReal: number | null;
  below85PctProbability: number;
  below70PctProbability: number;
  below50PctProbability: number;
};

export type RetirementBootstrapDividendCashflowRisk = {
  observedPathCount: number;
  drop20PctOrMoreCount: number;
  drop20PctOrMoreProbability: number;
  drop30PctOrMoreCount: number;
  drop30PctOrMoreProbability: number;
  drop40PctOrMoreCount: number;
  drop40PctOrMoreProbability: number;
  drop50PctOrMoreCount: number;
  drop50PctOrMoreProbability: number;
  drop60PctOrMoreCount: number;
  drop60PctOrMoreProbability: number;
};

export type RetirementBootstrapFailureYearCount = {
  yearNumber: number;
  calendarYear: number;
  count: number;
};

export type RetirementBootstrapPeriodFailureDiagnostics = {
  periodYears: number;
  successCount: number;
  withdrawalShortfallOnlyCount: number;
  depletionOnlyCount: number;
  withdrawalShortfallAndDepletionCount: number;
  otherFailureCount: number;
  firstFailureYears: RetirementBootstrapFailureYearCount[];
};

export type RetirementBootstrapFirstWithdrawalCashflowDiagnostics = {
  yearNumber: number;
  calendarYear: number;
  observedPathCount: number;
  shortfallCount: number;
  averageRequiredWithdrawalNominal: number;
  averageGrossIsaWithdrawal: number;
  averageNetIsaWithdrawal: number;
  averageGrossPensionWithdrawal: number;
  averageNetPensionWithdrawal: number;
  averageGrossBrokerageDividend: number;
  averageNetBrokerageDividend: number;
  averageSuppliedWithdrawalNet: number;
  minimumSuppliedWithdrawalNet: number;
  maximumSuppliedWithdrawalNet: number;
};

export type RetirementBootstrapFailureDiagnostics = {
  periods: RetirementBootstrapPeriodFailureDiagnostics[];
  firstWithdrawalCashflow: RetirementBootstrapFirstWithdrawalCashflowDiagnostics | null;
};

export type RecenteringDiagnostics = {
  seriesId: string;
  targetGeometricRatePct: number;
  resultingGeometricRatePct: number;
  observationCount: number;
  clippedLowCount: number;
  clippedHighCount: number;
  logStandardDeviationBefore: number;
  logStandardDeviationAfter: number;
};

export type RetirementBootstrapResult = {
  schemaVersion: typeof RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION;
  method: "five_year_block_bootstrap_recentered";
  iterations: number;
  blockLength: number;
  seed: number;
  distributionStressPolicyId: string | null;
  datasetId: string;
  datasetVersion: string;
  datasetUsage: MarketPatternDatasetV1["usage"];
  dataPeriod: { startYear: number; endYear: number };
  datasetUpdatedAt: string;
  realValueBasis: "simulation_start_purchasing_power";
  recenteringDiagnostics: RecenteringDiagnostics[];
  periods: RetirementBootstrapPeriodResult[];
  failureDiagnostics: RetirementBootstrapFailureDiagnostics;
};
