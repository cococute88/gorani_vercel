export type SimConfig = {
  startYear: number;
  years: number;
  annualReturnRate: number;
  inflationRate: number;
  initialIsa: number;
  initialPension: number;
  reserveCash: number;
  initialTaxableDividend: number;
  withdrawalRate: number;
  withdrawalGrowthRate: number;
  withdrawalDelayYears: number;
};

export type SimulatorInputs = SimConfig;

export type SimulationTimeline = {
  startYear: number;
  simulationYears: number;
  endYear: number;
  retirementIndex: number | null;
  retirementYear: number | null;
  withdrawalStartIndex: number | null;
  withdrawalStartYear: number | null;
  yearsBeforeRetirement: number;
  yearsAfterRetirement: number;
};

export type YearPlan = {
  year: number;
  monthlyContribution: number;
  isaContribution: boolean;
  pensionContribution: boolean;
  isaToPensionTransfer: boolean;
  status?: "적립" | "은퇴" | "인출" | string;
};

export type YearPlanRow = YearPlan;

export type YearResult = {
  year: number;
  status: string;
  pensionContribution: number;
  pensionBalance: number;
  isaContribution: number;
  isaBalance: number;
  reserveUsed: number;
  reserveBalance: number;
  totalBalance: number;
  fromPrevReserveForPension: number;
  fromPrevReserveForIsa: number;
  isaTransferred: number;
  totalPensionDeposit: number;
  totalIsaDeposit: number;
  pensionNominal: number;
  isaNominal: number;
  reserveNominal: number;
  totalNominal: number;
  pensionReal: number;
  isaReal: number;
  reserveReal: number;
  totalReal: number;
  cumulativeInflation: number;
  nominalTaxSavingBalance: number;
  realTaxSavingBalance: number;
};

export type RealBalanceRow = {
  year: number;
  pensionReal: number;
  isaReal: number;
  reserveReal: number;
  totalReal: number;
  cumulativeInflation: number;
};

export type WithdrawRow = {
  year: number;
  category: string;
  isDelay: boolean;
  isaGross: number;
  isaNet: number;
  isaBalanceNominal: number;
  isaRemainingLimit: number | null;
  pensionGross: number;
  pensionNet: number;
  pensionBalanceNominal: number;
  pensionRemainingLimit: number | null;
  totalNet: number;
  monthlyNominal: number;
  monthlyReal: number;
  isaTaxRate: number;
  pensionTaxRate: number;
};

export type WithdrawPlan = {
  retireYear: number;
  actualStartYear: number;
  yearsUntil2050: number;
  isaBalanceAtStart: number;
  pensionBalanceAtStart: number;
  isaFirstWithdraw: number;
  pensionFirstWithdraw: number;
  isaConstraint: string;
  pensionConstraint: string;
  pensionDepositLimit: number;
  isaLimitUntil2050: number;
  rows: WithdrawRow[];
  totalGrossIsa: number;
  totalGrossPension: number;
  totalNetIsa: number;
  totalNetPension: number;
  finalIsaBalance: number;
  finalPensionBalance: number;
};

export type TotalWithdrawRow = {
  year: number;
  totalNominal?: number;
  withdraw?: number;
  monthly?: number;
  afterBalance?: number;
  realWithdraw?: number;
  isWithdraw?: boolean;
  taxSavingMonthlyNominal: number;
  taxSavingMonthlyReal: number;
  taxableMonthlyDividendNominal: number;
  taxableMonthlyDividendReal: number;
  totalMonthlyIncomeNominal: number;
  totalMonthlyIncomeReal: number;
};

export type DividendBrokerageRow = {
  year: number;
  taxableDividendBalanceNominal: number;
  taxableDividendBalanceReal: number;
  afterTaxAnnualDividendNominal: number;
  afterTaxAnnualDividendReal: number;
  afterTaxMonthlyDividendNominal: number;
  afterTaxMonthlyDividendReal: number;
  totalMonthlyDividendNominal: number;
  totalMonthlyDividendReal: number;
};

export type SimulatorChartRow = YearResult &
  TotalWithdrawRow & {
    taxableDividendBalanceNominal: number;
    taxableDividendBalanceReal: number;
    combinedNominalBalance: number;
    combinedRealBalance: number;
  };

export type SimulatorSummary = {
  finalNominalWithoutWithdrawal: number;
  finalRealWithoutWithdrawal: number;
  combinedNominalBalance: number;
  combinedRealBalance: number;
  retirementYear: number | null;
  actualWithdrawalStartYear: number | null;
  pensionLimit: number;
};

export type SimulatorProjection = {
  inputs: SimulatorInputs;
  timeline: SimulationTimeline;
  yearPlans: YearPlanRow[];
  results: YearResult[];
  realData: RealBalanceRow[];
  chartRows: SimulatorChartRow[];
  taxWithdrawRows: WithdrawRow[];
  totalWithdrawRows: TotalWithdrawRow[];
  dividendRows: DividendBrokerageRow[];
  withdrawPlan: WithdrawPlan | null;
  summary: SimulatorSummary;
};

export type SafetyGrade = "S" | "A" | "B" | "C" | "D" | "F";

export type SafetyStatus = "evaluated" | "not_applicable" | "data_insufficient";

export type SafetyFailureReason =
  | "NONE"
  | "LOW_ASSET"
  | "INCOME_SHORTAGE"
  | "DIVIDEND_STOPPED"
  | "DATA_INSUFFICIENT";

export type SafetyMetrics = {
  startingRealAssets: number;
  endingRealAssets: number;
  preservationRatio: number;
  yearsEvaluated: number;
  failed: boolean;
  failureReason: SafetyFailureReason;
  depleted: boolean;
  livingExpensesCovered: boolean | null;
  sustainedThroughRetirement: boolean;
  principalSold: boolean | null;
  dividendsContinued: boolean | null;
  shortfallYears: number;
  consecutiveShortfallYears: number;
  preservationScore: number;
  incomeCoverageScore: number;
  depletionScore: number;
  stabilityScore: number;
  latePeriodDecline: boolean;
};

export type SafetyResult = {
  status: SafetyStatus;
  grade: SafetyGrade | null;
  score: number;
  positives: string[];
  warnings: string[];
  metrics: SafetyMetrics;
};

export type RetirementSafetyResult = {
  taxSaving: SafetyResult;
  brokerage: SafetyResult;
  combined: SafetyResult;
};

export type PortfolioAccountType = "taxSaving" | "brokerage";

export type PortfolioMetricMode = "auto" | "manual";

export type PortfolioMetricSource =
  | "yahoo-adj-close"
  | "yahoo-close"
  | "yahoo-dividends"
  | "manual"
  | "legacy";

export type PortfolioMetricStatus =
  | "resolved"
  | "manual"
  | "insufficient_history"
  | "not_applicable"
  | "failed";

export type PortfolioManualMetrics = {
  totalReturnCagrPct?: number;
  priceCagrPct?: number;
  dividendYieldPct?: number;
  dividendGrowthPct?: number;
};

export type PortfolioHoldingInput = {
  id: string;
  ticker: string;
  weightPct: number;
  metricMode: PortfolioMetricMode;
  manual?: PortfolioManualMetrics;
};

export type AccountPortfolioConfig = {
  accountType: PortfolioAccountType;
  holdings: PortfolioHoldingInput[];
};

export type AssetSimulatorPortfolioConfigV1 = {
  version: 1;
  taxSaving: AccountPortfolioConfig;
  brokerage: AccountPortfolioConfig;
};

export type ResolvedPortfolioMetric = {
  valuePct: number | null;
  source: PortfolioMetricSource;
  status: PortfolioMetricStatus;
  asOf: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  observationYears: number | null;
  warnings: string[];
};

export type PortfolioHoldingResolution = {
  ticker: string;
  totalReturnCagr: ResolvedPortfolioMetric;
  priceCagr: ResolvedPortfolioMetric;
  dividendYield: ResolvedPortfolioMetric;
  dividendGrowth: ResolvedPortfolioMetric;
};

export type ResolvePortfolioHoldingInput = {
  ticker: string;
  accountType: PortfolioAccountType;
};

export type PortfolioAssumptionsSnapshot = {
  resolvedAt: string;
  holdings: PortfolioHoldingResolution[];
};

export type PortfolioMetricKey =
  | "totalReturnCagr"
  | "priceCagr"
  | "dividendYield"
  | "dividendGrowth";

export type AppliedPortfolioHoldingAssumption = {
  holdingId: string;
  ticker: string;
  weightPct: number;
  metricMode: PortfolioMetricMode;
  totalReturnCagrPct: number | null;
  priceCagrPct: number | null;
  dividendYieldPct: number | null;
  dividendGrowthPct: number | null;
  sources: Record<PortfolioMetricKey, PortfolioMetricSource>;
  statuses: Record<PortfolioMetricKey, PortfolioMetricStatus>;
  warnings: string[];
};

export type AppliedAccountPortfolioAssumptions = {
  accountType: PortfolioAccountType;
  holdings: AppliedPortfolioHoldingAssumption[];
};

export type AppliedPortfolioAssumptionsV1 = {
  version: 1;
  appliedAt: string;
  taxSaving: AppliedAccountPortfolioAssumptions;
  brokerage: AppliedAccountPortfolioAssumptions;
};

export type PersistedPortfolioAssumptions =
  | PortfolioAssumptionsSnapshot
  | AppliedPortfolioAssumptionsV1;

export type PortfolioValidationIssue = {
  accountType: PortfolioAccountType;
  holdingId?: string;
  field?: "ticker" | "weightPct" | "metrics";
  metric?: PortfolioMetricKey;
  code:
    | "ticker_required"
    | "duplicate_ticker"
    | "invalid_weight"
    | "weight_total_not_100"
    | "manual_metric_required"
    | "account_type_mismatch"
    | "unknown_version"
    | "resolution_missing"
    | "metric_unresolved"
    | "assumption_incomplete"
    | "stale_assumption"
    | "config_changed_since_apply";
  message: string;
};

export type StoredSimulatorPreview = {
  inputs: Partial<SimulatorInputs>;
  yearPlans: YearPlanRow[];
  portfolioConfig?: AssetSimulatorPortfolioConfigV1;
  portfolioAssumptions?: PersistedPortfolioAssumptions;
  updatedAt?: unknown;
};
