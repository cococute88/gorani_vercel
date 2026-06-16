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
  successAverageReturnPct: number;
  failureAverageLossPct: number;
  rewardRiskRatio: number | null;
  expectedReturnPct: number;
  taxSavingPerTrade: number;
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
  peakPrice2: number;
  troughPrice: number;
  recoveryDate: string | null;
  recoveryDays: number | null;
  recovered: boolean;
  warning: string;
};

// 역대 최대 낙폭/회복기간 한 구간 (고점→저점→회복).
export type MddEpisode = {
  rank: number;
  peakDate: string;
  troughDate: string;
  recoveryDate: string | null;
  mdd: number; // 음수 % (예: -35.62)
  declineDays: number; // 고점→저점 소요일
  recoveryDays: number | null; // 저점→회복 소요일
  totalDays: number | null; // 고점→회복 소요일
  recovered: boolean;
};

// 연도별 수익률 한 행.
export type YearlyReturn = {
  year: number;
  returnPct: number; // % (예: 33.34)
  partial: boolean; // 현재 진행 중인 연도면 true
};

// 비교 기준년도 표 한 행.
export type ComparisonReturnRow = {
  label: string; // 예: "10년전 대비"
  years: number;
  available: boolean;
  totalReturnPct: number | null; // 총수익률 %
  cagrPct: number | null; // 연평균(CAGR) %
  baseDate: string | null;
};

// 주요 변동성 지표 표.
export type VolatilityStats = {
  high52w: number | null;
  low52w: number | null;
  return1yPct: number | null; // 1년전 대비 상승률 %
  currentDrawdownPct: number | null; // 고점대비 하락률 %
  maxDrawdownPct: number | null; // 최대 낙폭(MDD) %
  yearBestPct: number | null; // 연 최고 수익률 %
  yearWorstPct: number | null; // 연 최저 수익률 %
};

// 달러 vs 원화 drawdown 비교 한 포인트.
export type DrawdownComparePoint = {
  date: string;
  usd: number; // 달러 기준 drawdown %
  krw: number | null; // 원화 기준 drawdown % (환율 없으면 null)
};
