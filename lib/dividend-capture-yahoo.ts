import type { DividendCaptureDividendPoint, DividendCapturePricePoint } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";

const FETCH_TIMEOUT_MS = 12_000;

type YahooChartResult = {
  meta?: { exchangeTimezoneName?: string };
  timestamp?: number[];
  indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> };
  events?: { dividends?: Record<string, { amount?: number; date?: number }> };
};

type YahooChartPayload = { chart?: { result?: YahooChartResult[]; error?: { code?: string; description?: string } | null } };

export type DividendCaptureYahooDataResponse = {
  ticker: string;
  normalizedTicker: string;
  source: QuoteSource;
  updatedAt: string;
  exchangeTimezoneName: string;
  dividendDateNormalization: string;
  priceDateNormalization: string;
  prices: DividendCapturePricePoint[];
  dividends: DividendCaptureDividendPoint[];
  diagnostics: {
    dividendEventsLength: number;
    priceRowsLength: number;
    matchedEvents: number;
    skippedEvents: number;
    skippedExDatesFirst10: string[];
    priceDateSampleFirst10: string[];
    priceDateSampleLast10: string[];
    mixedSources: boolean;
  };
  warnings: string[];
};

function normalizeTicker(input: string) {
  return input.trim().replace(/^\$/, "").replace(/\s+/g, "").toUpperCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cleanNumber(value: unknown, digits = 6) {
  if (!isFiniteNumber(value)) return null;
  return Number(value.toFixed(digits));
}

function normalizeChartDate(timestampSeconds: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampSeconds * 1000));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json,*/*;q=0.8", "user-agent": "Mozilla/5.0 dividend-capture-yfinance-parity" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDividendCaptureYahooData(input: { ticker: string; recent5yOnly?: boolean }): Promise<DividendCaptureYahooDataResponse> {
  const ticker = input.ticker || "";
  const normalizedTicker = normalizeTicker(ticker) || "ARCC";
  const now = Math.floor(Date.now() / 1000);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedTicker)}`);
  url.searchParams.set("period1", "0");
  url.searchParams.set("period2", String(now));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "div,splits");
  url.searchParams.set("includeAdjustedClose", "false");

  const payload = (await (await fetchWithTimeout(url.toString())).json()) as YahooChartPayload;
  const error = payload.chart?.error;
  if (error) throw new Error(error.description || error.code || "Yahoo chart error");
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error("Yahoo chart returned no result");

  const exchangeTimezoneName = result.meta?.exchangeTimezoneName || "America/New_York";
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp ?? [];
  if (!quote || timestamps.length === 0) throw new Error("Yahoo chart returned no daily quote rows");
  const cutoff = input.recent5yOnly ? normalizeChartDate(now - 365 * 5 * 86_400, exchangeTimezoneName) : null;

  const byDate = new Map<string, DividendCapturePricePoint>();
  timestamps.forEach((timestamp, index) => {
    const close = cleanNumber(quote.close?.[index]);
    if (close === null || close <= 0) return;
    const date = normalizeChartDate(timestamp, exchangeTimezoneName);
    if (cutoff && date < cutoff) return;
    byDate.set(date, {
      date,
      open: cleanNumber(quote.open?.[index], 4),
      high: cleanNumber(quote.high?.[index], 4),
      low: cleanNumber(quote.low?.[index], 4),
      close,
    });
  });
  const prices = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const priceDates = new Set(prices.map((price) => price.date));

  const dividends = Object.values(result.events?.dividends ?? {})
    .flatMap((event) => {
      const amount = cleanNumber(event.amount);
      if (!event.date || amount === null || amount <= 0) return [];
      const date = normalizeChartDate(event.date, exchangeTimezoneName);
      if (cutoff && date < cutoff) return [];
      return [{ date, amount }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const skippedExDates = dividends.map((dividend) => dividend.date).filter((date) => !priceDates.has(date));
  return {
    ticker,
    normalizedTicker,
    source: "yahoo",
    updatedAt: new Date().toISOString(),
    exchangeTimezoneName,
    dividendDateNormalization: `Yahoo chart events.dividends timestamps -> YYYY-MM-DD in ${exchangeTimezoneName}`,
    priceDateNormalization: `Yahoo chart timestamp rows -> YYYY-MM-DD in ${exchangeTimezoneName}`,
    prices,
    dividends,
    diagnostics: {
      dividendEventsLength: dividends.length,
      priceRowsLength: prices.length,
      matchedEvents: dividends.length - skippedExDates.length,
      skippedEvents: skippedExDates.length,
      skippedExDatesFirst10: skippedExDates.slice(0, 10),
      priceDateSampleFirst10: prices.slice(0, 10).map((price) => price.date),
      priceDateSampleLast10: prices.slice(-10).map((price) => price.date),
      mixedSources: false,
    },
    warnings: skippedExDates.length ? [`배당락일이 가격 데이터에 없어 제외된 이벤트 ${skippedExDates.length}건`] : [],
  };
}
