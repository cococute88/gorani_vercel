import type { Holding, PortfolioSnapshot } from "./portfolio-types";
import { normalizeHoldingTickerInfo } from "./holding-ticker-normalizer";

export type DividendPerformancePoint = {
  date: string;
  deposit: number;
  portfolio: number;
  kospi: number | null;
  sp500: number | null;
  monthlyProfit: number | null;
  totalAssets: number | null;
  netInvestment: number;
  year: number;
};

export type DividendPerformanceKpis = {
  cumulativeDepositKRW: number;
  portfolioValueKRW: number;
  portfolioReturnPct: number | null;
  kospiValueKRW: number | null;
  kospiReturnPct: number | null;
  sp500ValueKRW: number | null;
  sp500ReturnPct: number | null;
};

export type BackcastPricePoint = { date: string; close: number };
export type DividendPerformanceHoldingInput = Pick<Holding, "ticker" | "quantity" | "valueKRW" | "currentPrice" | "currency" | "valueOriginalCurrency"> & {
  currentPriceKRW?: number;
  quantityEstimated?: boolean;
  estimatedQuantity?: number;
  shares?: number;
  estimatedShares?: number;
  normalizedTicker?: string;
  productName?: string;
  cleanName?: string;
  assetType?: string;
  tag?: string;
  symbolGroup?: string;
  accountGroup?: string;
  purposeGroup?: string;
  statusGroup?: string;
};

export type DividendPerformanceResult = {
  available: boolean;
  dataSource: "latest-holdings-backcast" | "snapshot-history" | "unavailable";
  sampleFallbackUsed: false;
  points: DividendPerformancePoint[];
  kpis: DividendPerformanceKpis | null;
  availableYears: number[];
  yearlyProfitKRW: Record<number, number>;
  warnings: string[];
  unavailableReason?: string;
};

type BuildBackcastInput = {
  holdings: DividendPerformanceHoldingInput[];
  priceHistories: Record<string, BackcastPricePoint[] | null | undefined>;
  benchmarkHistories?: { kospi?: BackcastPricePoint[] | null; sp500?: BackcastPricePoint[] | null };
  fxHistory?: BackcastPricePoint[] | null;
  latestDate?: string;
  months?: number;
};

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function monthKey(date: string): string { return date.slice(0, 7); }
function pct(value: number | null, base: number): number | null { return value == null || base <= 0 || value <= 0 ? null : (value / base - 1) * 100; }
function tickerOf(holding: DividendPerformanceHoldingInput): string {
  const direct = (holding.normalizedTicker ?? holding.ticker ?? "").trim().toUpperCase();
  if (direct) return direct;
  return (normalizeHoldingTickerInfo(holding).quoteTicker ?? "").trim().toUpperCase();
}
function isKrwTicker(ticker: string, holding?: DividendPerformanceHoldingInput): boolean { return holding?.currency === "KRW" || /^\d{6}(\.KS|\.KQ)?$/.test(ticker); }

function asof(series: BackcastPricePoint[] | null | undefined, date: string): number | null {
  if (!series?.length) return null;
  let value: number | null = null;
  for (const point of series) {
    if (point.date <= date) {
      if (Number.isFinite(point.close) && point.close > 0) value = point.close;
    } else break;
  }
  return value;
}

function monthEndsFromHistories(histories: Array<BackcastPricePoint[] | null | undefined>, latestDate: string, months: number): string[] {
  const cutoff = new Date(`${latestDate}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const minDate = cutoff.toISOString().slice(0, 10);
  const byMonth = new Map<string, string>();
  for (const history of histories) {
    for (const point of history ?? []) {
      if (point.date < minDate || point.date > latestDate) continue;
      byMonth.set(monthKey(point.date), point.date);
    }
  }
  return Array.from(byMonth.values()).sort();
}

function estimateQuantity(holding: DividendPerformanceHoldingInput): number {
  const explicit = [holding.quantity, holding.estimatedQuantity, holding.shares, holding.estimatedShares]
    .map(finite)
    .find((value) => value > 0);
  if (explicit) return explicit;
  const currentPriceKRW = finite(holding.currentPriceKRW);
  if (currentPriceKRW > 0 && finite(holding.valueKRW) > 0) return finite(holding.valueKRW) / currentPriceKRW;
  const currentPrice = finite(holding.currentPrice);
  if (currentPrice > 0 && finite(holding.valueOriginalCurrency) > 0) return finite(holding.valueOriginalCurrency) / currentPrice;
  return 0;
}

function benchmarkLine(prices: BackcastPricePoint[] | null | undefined, months: string[], base: number, fx?: BackcastPricePoint[] | null): Array<number | null> {
  if (!prices?.length || base <= 0) return months.map(() => null);
  const startPrice = asof(prices, months[0]);
  const startFx = fx ? asof(fx, months[0]) : 1;
  if (!startPrice || !startFx) return months.map(() => null);
  return months.map((date) => {
    const price = asof(prices, date);
    const rate = fx ? asof(fx, date) : 1;
    return price && rate ? base * (price / startPrice) * (rate / startFx) : null;
  });
}

export function buildDividendPerformanceBackcast(input: BuildBackcastInput): DividendPerformanceResult {
  const monthsBack = input.months ?? 24;
  const latestDate = input.latestDate ?? new Date().toISOString().slice(0, 10);
  const candidates = input.holdings
    .map((holding) => ({ holding, ticker: tickerOf(holding), quantity: estimateQuantity(holding) }))
    .filter((row) => row.ticker && row.quantity > 0);
  const usable = candidates.filter((row) => input.priceHistories[row.ticker]?.length);

  if (input.holdings.length === 0) {
    return unavailable("성과분석 데이터 부족: 이 계좌 그룹에 보유종목이 없습니다.");
  }
  if (usable.length === 0) {
    return unavailable("과거 가격을 확인할 수 있는 보유종목이 없습니다.");
  }

  const months = monthEndsFromHistories(usable.map((row) => input.priceHistories[row.ticker]), latestDate, monthsBack);
  if (months.length < 2) {
    return unavailable("성과분석 데이터 부족: 과거 가격 데이터를 불러오지 못했습니다.");
  }

  const portfolioValues = months.map((date) => usable.reduce((sum, row) => {
    const price = asof(input.priceHistories[row.ticker], date);
    if (!price) return sum;
    const rate = isKrwTicker(row.ticker, row.holding) ? 1 : asof(input.fxHistory, date);
    return rate ? sum + row.quantity * price * rate : sum;
  }, 0));
  if (!portfolioValues.some((value) => value > 0)) return unavailable("성과분석 데이터 부족: 과거 가격 데이터를 불러오지 못했습니다.");

  const base = portfolioValues[0];
  const kospiValues = benchmarkLine(input.benchmarkHistories?.kospi, months, base);
  const sp500Values = benchmarkLine(input.benchmarkHistories?.sp500, months, base, input.fxHistory);
  const points = months.map((date, index) => {
    const portfolio = portfolioValues[index];
    const previous = index === 0 ? portfolio : portfolioValues[index - 1];
    return { date: monthKey(date), deposit: base, portfolio, kospi: kospiValues[index], sp500: sp500Values[index], monthlyProfit: index === 0 ? 0 : portfolio - previous, totalAssets: portfolio, netInvestment: 0, year: Number(date.slice(0, 4)) };
  });
  const latest = points.at(-1)!;
  const yearlyProfitKRW: Record<number, number> = {};
  for (const point of points) yearlyProfitKRW[point.year] = (yearlyProfitKRW[point.year] ?? 0) + (point.monthlyProfit ?? 0);
  const warnings = ["최신 보유종목을 현재 수량으로 고정하고, 과거 가격을 대입해 역산한 참고 성과입니다."];
  const excluded = candidates.filter((row) => !input.priceHistories[row.ticker]?.length).map((row) => row.ticker);
  if (excluded.length > 0) warnings.push(`일부 종목의 과거 가격을 불러오지 못해 제외했습니다: ${Array.from(new Set(excluded)).join(", ")}`);
  if (usable.some((row) => !finite(row.holding.quantity) && row.quantity > 0)) warnings.push("수량 원본값이 없는 종목은 수량(추정) 또는 평가금액/현재가 기준 추정 수량으로 계산했습니다.");
  if (!kospiValues.some((value) => value != null)) warnings.push("KOSPI 가격 데이터를 불러오지 못해 KOSPI 비교선을 표시하지 않습니다.");
  if (!sp500Values.some((value) => value != null)) warnings.push("S&P 500 가격/환율 데이터를 불러오지 못해 S&P 500 비교선을 표시하지 않습니다.");
  return { available: true, dataSource: "latest-holdings-backcast", sampleFallbackUsed: false, points, kpis: { cumulativeDepositKRW: base, portfolioValueKRW: latest.portfolio, portfolioReturnPct: pct(latest.portfolio, base), kospiValueKRW: latest.kospi, kospiReturnPct: pct(latest.kospi, base), sp500ValueKRW: latest.sp500, sp500ReturnPct: pct(latest.sp500, base) }, availableYears: Object.keys(yearlyProfitKRW).map(Number).sort((a, b) => a - b), yearlyProfitKRW, warnings };
}

function unavailable(reason: string): DividendPerformanceResult {
  return { available: false, dataSource: "unavailable", sampleFallbackUsed: false, points: [], kpis: null, availableYears: [], yearlyProfitKRW: {}, warnings: [reason], unavailableReason: reason };
}

export function buildDividendPerformanceFromSnapshots(snapshots: PortfolioSnapshot[]): DividendPerformanceResult {
  const latest = [...snapshots].filter((snapshot) => snapshot.snapshotDate).sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1))[0];
  return buildDividendPerformanceBackcast({ holdings: latest?.holdings ?? [], priceHistories: {}, latestDate: latest?.snapshotDate });
}
