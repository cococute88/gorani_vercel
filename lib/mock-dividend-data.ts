// =============================================================
// 배당 관련 목업 데이터 + 계산 헬퍼.
// 배당 페이지 / 워치리스트 캘린더에서 공용.
// 실제 yfinance 호출은 브라우저에서 하지 않는다. 모두 mock / dummy 계산.
// TODO(codex): 실제 배당 API(예: 서버 route + yfinance/배당 컬린더) 연결.
// =============================================================
import type { Holding } from "./portfolio-types";

// 배당 소득세 (국내 기준 15.4%)
export const DIVIDEND_TAX_RATE = 0.154;

// 티커별 예상 배당률(%) — mock
export const DIVIDEND_YIELDS: Record<string, number> = {
  SCHD: 3.6,
  QQQ: 0.6,
  QLD: 0.2,
  TQQQ: 0,
  SPY: 1.3,
  VOO: 1.3,
  JEPI: 7.5,
  MSFT: 0.7,
  GOOGL: 0.5,
  AAPL: 0.5,
  NVDA: 0.03,
  TSLA: 0,
  NFLX: 0,
  CASH: 3.0,
  CASH_LIKE: 4.8,
};

// 티커별 배당 지급월 (1~12). 기본은 분기배당.
export const PAYMENT_MONTHS: Record<string, number[]> = {
  SCHD: [3, 6, 9, 12],
  QQQ: [3, 6, 9, 12],
  QLD: [3, 6, 9, 12],
  SPY: [3, 6, 9, 12],
  VOO: [3, 6, 9, 12],
  MSFT: [3, 6, 9, 12],
  AAPL: [2, 5, 8, 11],
  JEPI: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  CASH_LIKE: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

const DEFAULT_PAYMENT_MONTHS = [3, 6, 9, 12];

export function annualYieldPct(ticker?: string): number {
  if (!ticker) return 0;
  return DIVIDEND_YIELDS[ticker.toUpperCase()] ?? 0;
}

export function paymentMonthsOf(ticker?: string): number[] {
  if (!ticker) return [];
  return PAYMENT_MONTHS[ticker.toUpperCase()] ?? DEFAULT_PAYMENT_MONTHS;
}

export interface MonthlyDividendPoint {
  month: number; // 1~12
  label: string; // "1월" ...
  amount: number; // 월 합계 KRW
  [ticker: string]: string | number;
}

export interface MonthlyDividendComposition {
  data: MonthlyDividendPoint[];
  tickers: string[];
}

export const MONTH_LABELS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

/** 보유종목 기반 월별 예상 배당 (더미 계산). afterTax 면 세후 금액. */
export function buildMonthlyDividends(
  holdings: Holding[],
  afterTax: boolean,
): MonthlyDividendComposition {
  const factor = afterTax ? 1 - DIVIDEND_TAX_RATE : 1;
  const byTicker = new Map<string, number[]>();

  for (const h of holdings) {
    const ticker = (h.ticker || "기타").toUpperCase();
    const y = annualYieldPct(h.ticker);
    if (!y || !h.valueKRW) continue;
    const annual = ((h.valueKRW * y) / 100) * factor;
    const months = paymentMonthsOf(h.ticker);
    if (months.length === 0) continue;
    const per = annual / months.length;
    const monthly = byTicker.get(ticker) ?? new Array<number>(12).fill(0);
    for (const m of months) monthly[m - 1] += per;
    byTicker.set(ticker, monthly);
  }

  const rankedTickers = Array.from(byTicker.entries())
    .map(([ticker, values]) => ({ ticker, total: values.reduce((sum, v) => sum + v, 0) }))
    .sort((a, b) => b.total - a.total)
    .map((item) => item.ticker);
  const topTickers = rankedTickers.slice(0, 6);
  const overflowTickers = rankedTickers.slice(6);
  const visibleTickers = overflowTickers.length > 0 ? [...topTickers, "기타"] : topTickers;

  const data = MONTH_LABELS.map((label, i) => {
    const point: MonthlyDividendPoint = { month: i + 1, label, amount: 0 };
    for (const ticker of topTickers) {
      const value = Math.round(byTicker.get(ticker)?.[i] ?? 0);
      point[ticker] = value;
      point.amount += value;
    }
    if (overflowTickers.length > 0) {
      const other = Math.round(
        overflowTickers.reduce((sum, ticker) => sum + (byTicker.get(ticker)?.[i] ?? 0), 0),
      );
      point["기타"] = other;
      point.amount += other;
    }
    return point;
  });

  return { data, tickers: visibleTickers };
}

export function buildMonthlyDividendsFromRows(
  rows: DividendHoldingRow[],
): MonthlyDividendComposition {
  const byTicker = new Map<string, number[]>();

  for (const row of rows) {
    const ticker = (row.ticker || "기타").toUpperCase();
    if (!row.annualDividendKRW) continue;
    const months = paymentMonthsOf(ticker);
    if (months.length === 0) continue;
    const per = row.annualDividendKRW / months.length;
    const monthly = byTicker.get(ticker) ?? new Array<number>(12).fill(0);
    for (const month of months) monthly[month - 1] += per;
    byTicker.set(ticker, monthly);
  }

  const rankedTickers = Array.from(byTicker.entries())
    .map(([ticker, values]) => ({ ticker, total: values.reduce((sum, value) => sum + value, 0) }))
    .sort((a, b) => b.total - a.total)
    .map((item) => item.ticker);
  const topTickers = rankedTickers.slice(0, 6);
  const overflowTickers = rankedTickers.slice(6);
  const visibleTickers = overflowTickers.length > 0 ? [...topTickers, "기타"] : topTickers;

  const data = MONTH_LABELS.map((label, index) => {
    const point: MonthlyDividendPoint = { month: index + 1, label, amount: 0 };
    for (const ticker of topTickers) {
      const value = Math.round(byTicker.get(ticker)?.[index] ?? 0);
      point[ticker] = value;
      point.amount += value;
    }
    if (overflowTickers.length > 0) {
      const other = Math.round(
        overflowTickers.reduce((sum, ticker) => sum + (byTicker.get(ticker)?.[index] ?? 0), 0),
      );
      point["기타"] = other;
      point.amount += other;
    }
    return point;
  });

  return { data, tickers: visibleTickers };
}

/** 종목별 예상 연배당 행 (배당 테이블용). */
export interface DividendHoldingRow {
  ticker: string;
  name: string;
  quantity?: number;
  averageCost?: number;
  averageCostCurrency?: string;
  currentPrice?: number;
  currentPriceCurrency?: string;
  valueKRW: number;
  annualDividendKRW: number;
  expectedYieldPct: number; // 예상 배당률
  myYieldPct: number; // 내 배당률 (원금 대비)
  tag?: string;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeCurrency(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === "USD" || normalized === "$") return "USD";
  if (normalized === "KRW" || normalized === "₩") return "KRW";
  return normalized || undefined;
}

function inferredTickerCurrency(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ticker = value.trim().toUpperCase();
  if (/\.(KS|KQ)$/.test(ticker)) return "KRW";
  if (/^[A-Z]{1,5}$/.test(ticker)) return "USD";
  return undefined;
}

function readAverageCost(holding: Holding): Pick<DividendHoldingRow, "averageCost" | "averageCostCurrency"> {
  const extras = holding as Holding & Record<string, unknown>;
  const averageCostUSD = finiteNumber(extras.averageCostUSD);
  if (averageCostUSD !== undefined) return { averageCost: averageCostUSD, averageCostCurrency: "USD" };

  const averageCostKRW = finiteNumber(extras.averageCostKRW);
  if (averageCostKRW !== undefined) return { averageCost: averageCostKRW, averageCostCurrency: "KRW" };

  const averageCost = finiteNumber(extras.averageCost) ?? finiteNumber(extras.avgPrice);
  if (averageCost === undefined) return {};
  return { averageCost, averageCostCurrency: normalizeCurrency(holding.currency) };
}

function readCurrentPrice(holding: Holding): Pick<DividendHoldingRow, "currentPrice" | "currentPriceCurrency"> {
  const extras = holding as Holding & Record<string, unknown>;
  const currentPriceUSD = finiteNumber(extras.currentPriceUSD);
  if (currentPriceUSD !== undefined) return { currentPrice: currentPriceUSD, currentPriceCurrency: "USD" };

  const currentPriceKRW = finiteNumber(extras.currentPriceKRW);
  if (currentPriceKRW !== undefined) return { currentPrice: currentPriceKRW, currentPriceCurrency: "KRW" };

  const currentPrice = finiteNumber(holding.currentPrice);
  if (currentPrice === undefined) return {};
  const quoteTicker = typeof extras.quoteTicker === "string" ? extras.quoteTicker : undefined;
  return {
    currentPrice,
    currentPriceCurrency: normalizeCurrency(holding.currency) ?? inferredTickerCurrency(quoteTicker ?? holding.ticker),
  };
}

export function dividendHoldingWeightPct(row: Pick<DividendHoldingRow, "valueKRW">, tableTotalKRW: number): number | null {
  if (!Number.isFinite(tableTotalKRW) || tableTotalKRW <= 0) return null;
  return (row.valueKRW / tableTotalKRW) * 100;
}

export function buildDividendHoldingRows(
  holdings: Holding[],
  afterTax: boolean,
): DividendHoldingRow[] {
  const factor = afterTax ? 1 - DIVIDEND_TAX_RATE : 1;
  const rows = holdings.map((h) => {
    const ticker = (h.ticker || "—").toUpperCase();
    const y = annualYieldPct(h.ticker);
    const annual = (h.valueKRW * y) / 100 * factor;
    return {
      ticker,
      name: h.productName,
      quantity: h.quantity,
      ...readAverageCost(h),
      ...readCurrentPrice(h),
      valueKRW: h.valueKRW,
      annualDividendKRW: annual,
      expectedYieldPct: y,
      myYieldPct: 0,
      tag: h.tag,
    };
  });
  for (const r of rows) {
    r.annualDividendKRW = Math.round(r.annualDividendKRW);
    r.myYieldPct = r.valueKRW > 0 ? (r.annualDividendKRW / r.valueKRW) * 100 : 0;
  }
  return rows.sort((a, b) => b.annualDividendKRW - a.annualDividendKRW);
}

// ---- 성과 분석 시계열 (누적입금 vs 내 포트폴리오 vs KOSPI vs S&P500) ----
export interface PerfSeriesPoint {
  date: string;
  deposit: number; // 누적 입금
  portfolio: number; // 내 포트폴리오
  kospi: number; // KOSPI 투자 시
  sp500: number; // S&P 500 투자 시
}

function buildPerfSeries(): PerfSeriesPoint[] {
  const points: PerfSeriesPoint[] = [];
  const start = new Date("2024-01-01");
  let deposit = 0;
  let portfolio = 0;
  let kospi = 0;
  let sp500 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    deposit += 3_000_000;
    // 더미 수익률 경로
    portfolio = deposit * (1 + 0.018 * i) + Math.sin(i / 3) * 2_000_000;
    kospi = deposit * (1 + 0.004 * i);
    sp500 = deposit * (1 + 0.011 * i);
    points.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      deposit: Math.round(deposit),
      portfolio: Math.round(portfolio),
      kospi: Math.round(kospi),
      sp500: Math.round(sp500),
    });
  }
  return points;
}

export const DIVIDEND_PERFORMANCE_SERIES: PerfSeriesPoint[] = buildPerfSeries();

// =============================================================
// 배당 캘린더 이벤트 (워치리스트용)
// =============================================================
export type DivEventType = "ex_div" | "buy" | "payment" | "earnings";

export interface EventMeta {
  type: DivEventType;
  labelKo: string;
  label: string;
  color: string; // 칩 배경
  border: string;
}

export const EVENT_META: Record<DivEventType, EventMeta> = {
  ex_div: { type: "ex_div", labelKo: "배당락일", label: "Ex-Div", color: "#3b82f6", border: "#1d4ed8" },
  buy: { type: "buy", labelKo: "매수마감", label: "Buy Deadline", color: "#ef4444", border: "#b91c1c" },
  payment: { type: "payment", labelKo: "지급일", label: "Payment", color: "#10b981", border: "#047857" },
  earnings: { type: "earnings", labelKo: "실적발표", label: "Earnings", color: "#8b5cf6", border: "#6d28d9" },
};

export interface DividendEvent {
  id: string;
  date: string; // YYYY-MM-DD
  ticker: string;
  type: DivEventType;
  estimated: boolean; // 예상(true) / 확정(false)
  amount?: number; // 주당 배당금 (USD, mock)
  price?: number; // 현재가 (USD, mock)
  annualYieldPct?: number;
}

const MOCK_PRICES: Record<string, number> = {
  SCHD: 28.5,
  QQQ: 485,
  QLD: 105,
  TQQQ: 78,
  SPY: 560,
  VOO: 515,
  JEPI: 58,
  MSFT: 430,
  GOOGL: 175,
  AAPL: 225,
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function clampDay(year: number, month: number, day: number): number {
  const last = new Date(year, month, 0).getDate();
  return Math.min(Math.max(day, 1), last);
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 특정 연/월에 대해 티커별 배당 이벤트 생성 (결정적 mock). */
export function buildDividendEvents(
  tickers: string[],
  year: number,
  month: number,
): DividendEvent[] {
  const events: DividendEvent[] = [];
  for (const raw of tickers) {
    const ticker = raw.toUpperCase();
    const months = paymentMonthsOf(ticker);
    const h = hashString(ticker);
    const paysThisMonth = months.includes(month);

    if (paysThisMonth) {
      const exDay = clampDay(year, month, 5 + (h % 18));
      const buyDay = clampDay(year, month, exDay - 1);
      const payDay = clampDay(year, month, exDay + 14);
      const yieldPct = annualYieldPct(ticker);
      const price = MOCK_PRICES[ticker] ?? 100;
      const perPay = months.length > 0 ? ((price * yieldPct) / 100) / months.length : 0;
      events.push({ id: `${ticker}-buy-${month}`, date: iso(year, month, buyDay), ticker, type: "buy", estimated: true, price, annualYieldPct: yieldPct });
      events.push({ id: `${ticker}-ex-${month}`, date: iso(year, month, exDay), ticker, type: "ex_div", estimated: true, amount: Math.round(perPay * 100) / 100, price, annualYieldPct: yieldPct });
      events.push({ id: `${ticker}-pay-${month}`, date: iso(year, month, payDay), ticker, type: "payment", estimated: false, amount: Math.round(perPay * 100) / 100, price, annualYieldPct: yieldPct });
    }

    // 실적발표: 분기월(1,4,7,10)에 개별 주식만
    if ([1, 4, 7, 10].includes(month) && ["MSFT", "GOOGL", "AAPL", "TSLA", "NVDA", "NFLX"].includes(ticker)) {
      const eDay = clampDay(year, month, 20 + (h % 8));
      events.push({ id: `${ticker}-earn-${month}`, date: iso(year, month, eDay), ticker, type: "earnings", estimated: true, price: MOCK_PRICES[ticker] ?? 100 });
    }
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// 기본 워치리스트 (등록 ticker 가 없을 때)
export const DEFAULT_WATCHLIST_TICKERS = ["SCHD", "QQQ", "QLD", "TQQQ", "SPY", "JEPI"];

// 경제일정 미니 (mock). TODO(codex): GitHub Actions 가 생성한 JSON 연결.
export interface EconomicEvent {
  date: string;
  title: string;
  importance: "high" | "medium" | "low";
  country: string;
}

export const MOCK_ECONOMIC_EVENTS: EconomicEvent[] = [
  { date: "2026-06-10", title: "미국 5월 CPI 발표", importance: "high", country: "US" },
  { date: "2026-06-17", title: "FOMC 기준금리 결정", importance: "high", country: "US" },
  { date: "2026-06-18", title: "미국 주간 실업수당 청구", importance: "medium", country: "US" },
  { date: "2026-06-26", title: "미국 5월 PCE 물가지수", importance: "high", country: "US" },
  { date: "2026-07-02", title: "미국 6월 고용보고서", importance: "high", country: "US" },
];
