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

export type YearPlan = {
  year: number;
  monthlyContribution: number;
  isaContribution: boolean;
  pensionContribution: boolean;
  isaToPensionTransfer: boolean;
  status?: string;
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
  nominalTaxSavingBalance: number;
  realTaxSavingBalance: number;
};

export type WithdrawRow = {
  year: number;
  category: string;
  isaBalanceNominal: number;
  pensionBalanceNominal: number;
  monthlyNominal: number;
  monthlyReal: number;
};

export type WithdrawPlan = {
  rows: WithdrawRow[];
  firstMonthlyWithdrawal: number;
};

export type TotalWithdrawRow = {
  year: number;
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
  retirementYear: number;
  pensionLimit: number;
};

export type SimulatorProjection = {
  inputs: SimulatorInputs;
  yearPlans: YearPlanRow[];
  results: YearResult[];
  chartRows: SimulatorChartRow[];
  taxWithdrawRows: WithdrawRow[];
  totalWithdrawRows: TotalWithdrawRow[];
  dividendRows: DividendBrokerageRow[];
  summary: SimulatorSummary;
};

export type StoredSimulatorPreview = {
  inputs: Partial<SimulatorInputs>;
  yearPlans: YearPlanRow[];
};
