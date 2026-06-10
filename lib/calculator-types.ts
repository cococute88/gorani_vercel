export type PricePoint = {
  date: string;
  close: number;
};

export type DividendPoint = {
  exDate: string;
  amount: number;
};

export type DividendCaptureInput = {
  ticker: string;
  investmentAmount: number;
  buyDate: string;
  exDividendDate: string;
  sellBasis: "recovery" | "days";
  maxHoldingDays: number;
  dividendPerShare: number;
  taxRate: number;
  commissionRate: number;
  slippageRate: number;
  analysisMonths: number;
  buyPrice: number;
  postExLowPrice: number;
  recoveryPrice: number;
};

export type DividendCaptureRow = {
  round: string;
  exDate: string;
  buyPrice: number;
  exLowPrice: number;
  sellPrice: number;
  shares: number;
  grossDividend: number;
  netDividend: number;
  pricePnL: number;
  totalPnL: number;
  profitPct: number;
  recoveryDays: number;
  breakevenPrice: number;
  result: "성공" | "실패";
  note: string;
};

export type DividendCaptureResult = {
  rows: DividendCaptureRow[];
  successRate: number;
  totalNetProfit: number;
  averageProfitPct: number;
  averageRecoveryDays: number;
  breakevenPrice: number;
  shares: number;
  netDividend: number;
  expectedDrop: number;
  warning: string;
};

export type ConversionInput = {
  sellTicker: string;
  buyTicker: string;
  sellShares: number;
  sellPrice: number;
  buyPrice: number;
  periodMonths: number;
  averageMonths: number;
  thresholdPct: number;
  sellFeeRate: number;
  buyFeeRate: number;
};

export type ConversionRow = {
  date: string;
  sellPrice: number;
  buyPrice: number;
  ratio: number;
  averageRatio: number;
  deviationPct: number;
  signal: string;
};

export type ConversionResult = {
  rows: ConversionRow[];
  currentRatio: number;
  averageRatio: number;
  deviationPct: number;
  grossSellAmount: number;
  netSellAmount: number;
  buyableShares: number;
  leftoverCash: number;
  judgment: string;
  warning: string;
};

export type MddInput = {
  ticker: string;
  startDate: string;
  endDate: string;
  analysisPeriod: "6m" | "1y" | "3y" | "5y" | "custom";
  currency: "USD" | "KRW";
  initialAmount: number;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
};

export type MddSeriesPoint = PricePoint & {
  peak: number;
  drawdown: number;
  value: number;
};

export type MddSegment = {
  period: string;
  highDate: string;
  lowDate: string;
  mdd: number;
  recoveryDate: string | null;
  recoveryDays: number | null;
};

export type MddResult = {
  series: MddSeriesPoint[];
  segments: MddSegment[];
  currentPrice: number;
  peakPrice: number;
  currentDrawdown: number;
  maxDrawdown: number;
  highDate: string;
  lowDate: string;
  recoveryDate: string | null;
  recoveryDays: number | null;
  warning: string;
};
