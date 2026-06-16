import type { DividendPoint, OhlcPoint, PricePoint } from "@/lib/calculator-types";
import type {
  QuoteDividendsResponse,
  QuoteFxResponse,
  QuoteHistoryResponse,
  QuoteLastResponse,
} from "@/lib/quote-types";
import {
  requestQuoteDividends,
  requestQuoteFx,
  requestQuoteHistory,
  requestQuoteLast,
  type QuoteRange,
} from "@/lib/quote-client";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stableSeed(text: string) {
  return text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getTickerHistory(ticker: string, start: string, end: string, basePrice?: number): PricePoint[] {
  return getTickerOhlcHistory(ticker, start, end, basePrice).map(({ date, close }) => ({ date, close }));
}

export function getTickerOhlcHistory(ticker: string, start: string, end: string, basePrice?: number): OhlcPoint[] {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return [];

  const seed = stableSeed(ticker.toUpperCase());
  const points: OhlcPoint[] = [];
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));
  const step = totalDays > 420 ? 7 : totalDays > 160 ? 3 : 1;
  const anchor = basePrice && basePrice > 0 ? basePrice : 60 + (seed % 90);
  let previousClose = anchor;

  for (let day = 0; day <= totalDays; day += step) {
    const progress = day / totalDays;
    const cycle = Math.sin(progress * Math.PI * 4 + seed / 17) * 0.09;
    const shorterCycle = Math.sin(progress * Math.PI * 13 + seed / 9) * 0.035;
    const trend = (progress - 0.45) * (((seed % 19) - 7) / 100);
    const shock = Math.sin(progress * Math.PI * 2 + 1.2) < -0.92 ? -0.08 : 0;
    const close = Math.max(1, anchor * (1 + cycle + shorterCycle + trend + shock));
    const open = Math.max(1, previousClose * (1 + Math.sin(day + seed) * 0.008));
    const high = Math.max(open, close) * (1 + 0.006 + Math.abs(Math.sin(seed + day)) * 0.018);
    const low = Math.min(open, close) * (1 - 0.006 - Math.abs(Math.cos(seed + day)) * 0.014);
    points.push({ date: formatDate(addDays(startDate, day)), open: Number(open.toFixed(2)), high: Number(high.toFixed(2)), low: Number(low.toFixed(2)), close: Number(close.toFixed(2)) });
    previousClose = close;
  }

  const finalDate = formatDate(endDate);
  if (points.at(-1)?.date !== finalDate) {
    const previous = points.at(-1) ?? { open: anchor, high: anchor, low: anchor, close: anchor };
    points.push({ date: finalDate, open: previous.close, high: previous.high, low: previous.low, close: previous.close });
  }
  return points;
}

export function getTickerDividends(ticker: string, start: string, end: string, amount = 0.8): DividendPoint[] {
  const seed = stableSeed(ticker.toUpperCase());
  const startDate = new Date(start);
  const endDate = new Date(end);
  const rows: DividendPoint[] = [];
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return rows;

  const current = new Date(startDate);
  current.setDate(15 + (seed % 10));
  while (current <= endDate) {
    rows.push({ exDate: formatDate(current), amount: Number((amount * (0.94 + (seed % 9) / 100)).toFixed(3)) });
    current.setMonth(current.getMonth() + 3);
  }
  return rows;
}

export function getLatestPrice(ticker: string, fallback = 100) {
  return Number(clamp(fallback + (stableSeed(ticker) % 11) - 5, 1, 10_000).toFixed(2));
}

const rangeToDays: Record<string, number> = {
  "1m": 31,
  "6m": 183,
  "1y": 366,
  "3y": 1_098,
  "5y": 1_830,
  max: 46_000,
};

function resolveProviderDates(input: { range?: QuoteRange; start?: string; end?: string }) {
  const end = input.end || formatDate(new Date());
  if (input.start) return { start: input.start, end };
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const days = rangeToDays[input.range || "1y"] ?? rangeToDays["1y"];
  return { start: formatDate(addDays(endDate, -days)), end };
}

export async function fetchQuoteHistory(input: {
  ticker: string;
  range?: string;
  start?: string;
  end?: string;
}): Promise<QuoteHistoryResponse> {
  const { start, end } = resolveProviderDates(input);
  const normalizedTicker = input.ticker.trim().toUpperCase() || "SPY";
  const fallback: QuoteHistoryResponse = {
    ticker: input.ticker,
    normalizedTicker,
    source: "sample",
    updatedAt: new Date().toISOString(),
    warnings: ["Client-side sample fallback returned deterministic demo prices."],
    prices: getTickerOhlcHistory(normalizedTicker, start, end).map((point) => ({ ...point, volume: null })),
  };

  return requestQuoteHistory(input, fallback);
}

export async function fetchQuoteDividends(input: {
  ticker: string;
  range?: string;
  start?: string;
  end?: string;
}): Promise<QuoteDividendsResponse> {
  const { start, end } = resolveProviderDates({ range: input.range || "5y", start: input.start, end: input.end });
  const normalizedTicker = input.ticker.trim().toUpperCase() || "SCHD";
  const fallback: QuoteDividendsResponse = {
    ticker: input.ticker,
    normalizedTicker,
    source: "sample",
    updatedAt: new Date().toISOString(),
    warnings: ["Client-side sample fallback returned deterministic demo dividends."],
    dividends: getTickerDividends(normalizedTicker, start, end).map((point) => ({ date: point.exDate, amount: point.amount })),
  };

  return requestQuoteDividends(input, fallback);
}

export async function fetchQuoteLast(input: { ticker: string }): Promise<QuoteLastResponse> {
  const normalizedTicker = input.ticker.trim().toUpperCase() || "SPY";
  const fallback: QuoteLastResponse = {
    ticker: input.ticker,
    normalizedTicker,
    source: "sample",
    updatedAt: new Date().toISOString(),
    warnings: ["Client-side sample fallback returned a deterministic demo latest price."],
    price: getLatestPrice(normalizedTicker),
    date: formatDate(new Date()),
  };

  return requestQuoteLast(input, fallback);
}

export async function fetchUsdKrw(): Promise<QuoteFxResponse> {
  const fallback: QuoteFxResponse = {
    pair: "USDKRW",
    source: "sample",
    updatedAt: new Date().toISOString(),
    warnings: ["Client-side sample fallback returned a deterministic demo USD/KRW rate."],
    rate: 1_375,
    date: formatDate(new Date()),
  };

  return requestQuoteFx(fallback);
}
