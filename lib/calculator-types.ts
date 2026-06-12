import type { QuoteSource } from "@/lib/quote-types";

export type PricePoint = {
  date: string;
  close: number;
};

export type OhlcPoint = PricePoint & {
  open: number;
  high: number;
  low: number;
};

export type DividendPoint = {
  exDate: string;
  amount: number;
};

export type DividendCapturePricePoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
};

export type DividendCaptureDividendPoint = {
  date: string;
  amount: number;
};

export type DividendCaptureInput = {
  ticker: string;
  investmentAmount: number;
  buyType: "D-1 종가" | "D-1 시가" | "D-2 종가" | "D-2 시가";
  sellWindow: number;
  taxRate: number;
  recent5yOnly: boolean;
  dividendPerShare: number;
  commissionRate: number;
  slippageRate: number;
  analysisMonths: number;
  referenceBuyPrice: number;
  referenceExOpenPrice: number;
};

export type DividendCaptureRow = {
  round: string;
  exDate: string;
  buyPrice: number;
  afterTaxDividend: number;
  breakevenPrice: number;
  maxHigh: number;
  sellPrice: number;
  shares: number;
  grossDividend: number;
  netDividend: number;
  pricePnL: number;
  totalPnL: number;
  profitPct: number;
  result: "성공" | "실패";
  recoveryDate: string;
  recoveryDays: number;
  recoveryTradingDays: string;
  recoveryCalendarDays: string;
  note: string;
};

export type DividendCaptureResult = {
  rows: DividendCaptureRow[];
  source: QuoteSource;
  warnings: string[];
  updatedAt?: string;
  usedStartDate: string;
  usedEndDate: string;
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
  startDate: string;
  endDate: string;
  averageMonths: number;
  thresholdPct: number;
  sellFeeRate: number;
  buyFeeRate: number;
};

export type ConversionPricePoint = PricePoint;

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
  source: QuoteSource;
  warnings: string[];
  updatedAt?: string;
  usedStartDate: string;
  usedEndDate: string;
  sellFirstDate: string | null;
  buyFirstDate: string | null;
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
  source: QuoteSource;
  warnings: string[];
  updatedAt?: string;
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
