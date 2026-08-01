import type { LongSeriesPoint } from "@/lib/market-series";

export type PortfolioMarket = "US" | "KR";
export type BaseCurrency = "KRW" | "USD";
export type ReturnMode = "tr" | "pr";
export type AnalysisMode = "actual" | "virtual";

export type PortfolioProxyHolding = {
  id: string;
  market: PortfolioMarket;
  ticker: string;
  weightPct: number;
};

export type PortfolioVirtualConfig = {
  enabled: boolean;
  startDate: string;
  proxies: PortfolioProxyHolding[];
};

export type PortfolioHoldingInput = {
  id: string;
  market: PortfolioMarket;
  ticker: string;
  weightPct: number;
  virtual?: PortfolioVirtualConfig;
};

export type PortfolioInput = {
  name: string;
  holdings: PortfolioHoldingInput[];
};

export type PortfolioCompareRequest = {
  portfolioA: PortfolioInput;
  portfolioB: PortfolioInput;
  baseCurrency: BaseCurrency;
  returnMode: ReturnMode;
  analysisMode: AnalysisMode;
};

export type ResolvedMarketSeries = {
  requestedTicker: string;
  resolvedSymbol: string;
  name: string;
  market: PortfolioMarket;
  exchange: string | null;
  currency: "USD" | "KRW";
  source: "yahoo";
  points: LongSeriesPoint[];
  dataStart: string;
  dataEnd: string;
  dividendCount?: number;
  warnings: string[];
};

export type PortfolioValuePoint = {
  date: string;
  value: number;
  virtual: boolean;
};

export type PortfolioHoldingResult = {
  id: string;
  requestedTicker: string;
  resolvedSymbol: string;
  name: string;
  market: PortfolioMarket;
  exchange: string | null;
  currency: "USD" | "KRW";
  dataStart: string;
  dataEnd: string;
  initialWeightPct: number;
  endingWeightPct: number;
  virtualStart: string | null;
  actualStart: string;
  transitionDate: string;
};

export type DrawdownDetails = {
  peakDate: string | null;
  troughDate: string | null;
  recoveryDate: string | null;
  recoveryDays: number | null;
};

export type PortfolioMetrics = {
  totalReturnPct: number | null;
  cagrPct: number | null;
  mddPct: number | null;
  volatilityPct: number | null;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  bestYearPct: number | null;
  worstYearPct: number | null;
  positiveYears: number;
  negativeYears: number;
  observationCount: number;
  elapsedYears: number | null;
  periodsPerYear: number | null;
  mixedMarket: boolean;
  drawdown: DrawdownDetails;
};

export type YearlyReturnRow = {
  year: number;
  returnPct: number;
  partial: boolean;
  includesVirtual: boolean;
};

export type PortfolioResult = {
  name: string;
  points: PortfolioValuePoint[];
  holdings: PortfolioHoldingResult[];
  metrics: PortfolioMetrics;
  yearly: YearlyReturnRow[];
};

export type RollingSummary = {
  months: number;
  observations: number;
  aMedian: number | null;
  aMean: number | null;
  aBest: number | null;
  aWorst: number | null;
  bMedian: number | null;
  bMean: number | null;
  bBest: number | null;
  bWorst: number | null;
  aBeatBPercent: number | null;
};

export type PortfolioCompareResult = {
  portfolioA: PortfolioResult;
  portfolioB: PortfolioResult;
  commonStart: string;
  endDate: string;
  baseCurrency: BaseCurrency;
  returnMode: ReturnMode;
  analysisMode: AnalysisMode;
  fxRequired: boolean;
  fxSymbol: string | null;
  rolling: RollingSummary[];
  warnings: string[];
  calculationMs: number;
};
