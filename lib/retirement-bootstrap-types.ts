import type { AppliedPortfolioAssumptionsV1, SimulatorInputs } from "./asset-simulator-types";

export const RETIREMENT_BOOTSTRAP_PERIODS = [30, 40, 50, 60, 70] as const;
export const DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS = 10_000;
export const DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH = 5;

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
  requiredWithdrawalNominal: number;
  grossIsaWithdrawal: number;
  netIsaWithdrawal: number;
  grossPensionWithdrawal: number;
  netPensionWithdrawal: number;
  grossBrokerageDividend: number;
  netBrokerageDividend: number;
  suppliedWithdrawalNet: number;
  withdrawalSatisfied: boolean;
  depleted: boolean;
};

export type RetirementBootstrapPathCheckpoint = {
  periodYears: number;
  success: boolean;
  reachedRealPrincipal50Pct: boolean;
  reachedRealPrincipal25Pct: boolean;
  firstDepletionYear: number | null;
  firstWithdrawalShortfallYear: number | null;
  endingRealAssets: number;
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
  successCount: number;
  successRate: number;
  reachedRealPrincipal50PctCount: number;
  reachedRealPrincipal50PctProbability: number;
  reachedRealPrincipal25PctCount: number;
  reachedRealPrincipal25PctProbability: number;
  averageEndingRealAssets: number;
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
