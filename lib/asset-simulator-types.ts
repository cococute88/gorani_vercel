export type SimulatorInputs = {
  startYear: number;
  years: number;
  initialIsa: number;
  initialPension: number;
  initialTaxable: number;
  annualReturnRate: number;
  inflationRate: number;
  withdrawalRate: number;
  withdrawalGrowthRate: number;
  withdrawalDelayYears: number;
};

export type YearPlanRow = {
  year: number;
  monthlyContribution: number;
  isaContribution: number;
  pensionContribution: number;
  taxableContribution: number;
  isaToPensionTransfer: number;
  note: string;
};

export type SimulatorYearResult = {
  year: number;
  elapsedYear: number;
  isaBalance: number;
  pensionBalance: number;
  taxableBalance: number;
  nominalTotal: number;
  realTotal: number;
  annualContribution: number;
  annualWithdrawal: number;
  cashflow: number;
};

export type SimulatorSummary = {
  finalNominalAssets: number;
  finalRealAssets: number;
  expectedRetirementYear: number;
  monthlyWithdrawal: number;
  totalContribution: number;
  totalWithdrawal: number;
};

export type SimulatorProjection = {
  inputs: SimulatorInputs;
  yearPlans: YearPlanRow[];
  results: SimulatorYearResult[];
  summary: SimulatorSummary;
};

export type StoredSimulatorPreview = {
  inputs: SimulatorInputs;
  yearPlans: YearPlanRow[];
};
