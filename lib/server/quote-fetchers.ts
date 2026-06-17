import "server-only";

import type {
  QuoteDividendsResponse,
  QuoteFxResponse,
  QuoteHistoryPrice,
  QuoteHistoryResponse,
  QuoteLastResponse,
} from "@/lib/quote-types";

const DAY_MS = 86_400_000;
const FETCH_TIMEOUT_MS = 12_000;
const RANGE_TO_DAYS: Record<string, number | null> = {
  "1m": 31,
  "6m": 183,
  "1y": 366,
  "3y": 1_098,
  "5y": 1_830,
  max: null,
};

type DateWindow = {
  start: string | null;
  end: string;
  range: string;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
      events?: {
        dividends?: Record<string, { amount?: number; date?: number }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cleanNumber(value: unknown, digits = 4) {
  if (!isFiniteNumber(value)) return null;
  return Number(value.toFixed(digits));
}

function stableSeed(text: string) {
  return text.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDateOnly(input?: string | null) {
  if (!input) return null;
  const match = input.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampRange(range?: string | null) {
  const normalized = (range || "1y").toLowerCase();
  return normalized in RANGE_TO_DAYS ? normalized : "1y";
}

function resolveDateWindow(input: { range?: string | null; start?: string | null; end?: string | null }): DateWindow {
  const endDate = parseDateOnly(input.end) ?? new Date();
  const end = toIsoDate(endDate);
  const explicitStart = parseDateOnly(input.start);

  if (explicitStart && explicitStart <= endDate) {
    return { start: toIsoDate(explicitStart), end, range: "custom" };
  }

  const range = clampRange(input.range);
  const days = RANGE_TO_DAYS[range];
  if (days === null) return { start: null, end, range };

  return { start: toIsoDate(addDays(endDate, -days)), end, range };
}

function withinWindow(date: string, window: DateWindow) {
  return (!window.start || date >= window.start) && date <= window.end;
}

function unixSeconds(date: string, endExclusive = false) {
  const parsed = parseDateOnly(date);
  const adjusted = endExclusive && parsed ? addDays(parsed, 1) : parsed;
  return Math.floor((adjusted?.getTime() ?? Date.now()) / 1000);
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/csv;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 quote-api",
      },
      next: { revalidate: 60 * 30 },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeTicker(input: string): string {
  return input.trim().replace(/^\$/, "").replace(/\s+/g, "").toUpperCase();
}

export function toIsoDate(input: Date | number | string): string {
  if (typeof input === "number") {
    const milliseconds = input > 10_000_000_000 ? input : input * 1000;
    return new Date(milliseconds).toISOString().slice(0, 10);
  }
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  return new Date(`${input}T00:00:00.000Z`).toISOString().slice(0, 10);
}

export function createWarning(...parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

export async function fetchYahooChart(input: {
  ticker: string;
  range?: string | null;
  start?: string | null;
  end?: string | null;
  events?: "history" | "div";
}): Promise<YahooChartPayload> {
  const ticker = normalizeTicker(input.ticker);
  if (!ticker) throw new Error("Ticker is required");

  const window = resolveDateWindow(input);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", input.events ?? "history");

  if (window.start) {
    url.searchParams.set("period1", String(unixSeconds(window.start)));
    url.searchParams.set("period2", String(unixSeconds(window.end, true)));
  } else {
    url.searchParams.set("range", "max");
  }

  const payload = (await (await fetchWithTimeout(url.toString())).json()) as YahooChartPayload;
  const error = payload.chart?.error;
  if (error) throw new Error(error.description || error.code || "Yahoo chart error");
  if (!payload.chart?.result?.[0]) throw new Error("Yahoo chart returned no result");
  return payload;
}

function parseYahooPrices(payload: YahooChartPayload, window: DateWindow): QuoteHistoryPrice[] {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];

  const byDate = new Map<string, QuoteHistoryPrice>();
  timestamps.forEach((timestamp, index) => {
    const close = cleanNumber(quote.close?.[index], 6);
    if (close === null || close <= 0) return;

    const date = toIsoDate(timestamp);
    if (!withinWindow(date, window)) return;

    byDate.set(date, {
      date,
      open: cleanNumber(quote.open?.[index]),
      high: cleanNumber(quote.high?.[index]),
      low: cleanNumber(quote.low?.[index]),
      close,
      volume: cleanNumber(quote.volume?.[index], 0),
    });
  });

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function parseYahooDividends(payload: YahooChartPayload, window: DateWindow) {
  const dividends = payload.chart?.result?.[0]?.events?.dividends;
  if (!dividends) return [];

  return Object.values(dividends)
    .flatMap((event) => {
      const amount = cleanNumber(event.amount, 6);
      if (amount === null || amount <= 0 || !event.date) return [];
      const date = toIsoDate(event.date);
      if (!withinWindow(date, window)) return [];
      return [{ date, amount }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchStooqDaily(input: {
  ticker: string;
  range?: string | null;
  start?: string | null;
  end?: string | null;
}): Promise<QuoteHistoryPrice[]> {
  const ticker = normalizeTicker(input.ticker);
  if (!ticker) throw new Error("Ticker is required");
  if (/[=^]/.test(ticker) || ticker.includes(".")) throw new Error("Stooq fallback only supports plain US tickers");

  const window = resolveDateWindow(input);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker.toLowerCase())}.us&i=d`;
  const csv = (await (await fetchWithTimeout(url)).text()).trim();
  if (!csv || csv.toLowerCase().startsWith("no data")) throw new Error("Stooq returned no data");

  const [headerLine, ...lines] = csv.split(/\r?\n/);
  const headers = headerLine.split(",");
  const column = (name: string) => headers.findIndex((header) => header.toLowerCase() === name.toLowerCase());
  const dateCol = column("Date");
  const openCol = column("Open");
  const highCol = column("High");
  const lowCol = column("Low");
  const closeCol = column("Close");
  const volumeCol = column("Volume");
  if (dateCol < 0 || closeCol < 0) throw new Error("Stooq CSV is missing required columns");

  return lines
    .flatMap((line) => {
      const cells = line.split(",");
      const date = cells[dateCol];
      const close = Number(cells[closeCol]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(close) || close <= 0 || !withinWindow(date, window)) return [];
      return [{
        date,
        open: cleanNumber(Number(cells[openCol])),
        high: cleanNumber(Number(cells[highCol])),
        low: cleanNumber(Number(cells[lowCol])),
        close: Number(close.toFixed(6)),
        volume: cleanNumber(Number(cells[volumeCol]), 0),
      }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildSampleHistory(input: {
  ticker: string;
  range?: string | null;
  start?: string | null;
  end?: string | null;
}): QuoteHistoryPrice[] {
  const ticker = normalizeTicker(input.ticker) || "SPY";
  const window = resolveDateWindow({ range: input.range === "max" ? "5y" : input.range, start: input.start, end: input.end });
  const start = parseDateOnly(window.start) ?? addDays(parseDateOnly(window.end) ?? new Date(), -366);
  const end = parseDateOnly(window.end) ?? new Date();
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
  // Keep sample fallback daily as well; visual downsampling must be handled by
  // chart-specific code, not by removing source history points.
  const step = 1;
  const seed = stableSeed(ticker);
  const anchor = 60 + (seed % 160);
  const rows: QuoteHistoryPrice[] = [];
  let previousClose = anchor;

  for (let day = 0; day <= totalDays; day += step) {
    const progress = day / totalDays;
    const cycle = Math.sin(progress * Math.PI * 4 + seed / 17) * 0.09;
    const shortCycle = Math.sin(progress * Math.PI * 13 + seed / 9) * 0.035;
    const trend = (progress - 0.45) * (((seed % 19) - 7) / 100);
    const close = Math.max(1, anchor * (1 + cycle + shortCycle + trend));
    const open = Math.max(1, previousClose * (1 + Math.sin(day + seed) * 0.008));
    const high = Math.max(open, close) * (1 + 0.006 + Math.abs(Math.sin(seed + day)) * 0.018);
    const low = Math.min(open, close) * (1 - 0.006 - Math.abs(Math.cos(seed + day)) * 0.014);
    rows.push({
      date: toIsoDate(addDays(start, day)),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(750_000 + Math.abs(Math.sin(seed + day)) * 7_500_000),
    });
    previousClose = close;
  }

  const finalDate = toIsoDate(end);
  if (rows.at(-1)?.date !== finalDate) {
    const previous = rows.at(-1) ?? { close: anchor, open: anchor, high: anchor, low: anchor, volume: null };
    rows.push({
      date: finalDate,
      open: previous.close,
      high: previous.high,
      low: previous.low,
      close: previous.close,
      volume: previous.volume ?? null,
    });
  }

  return rows;
}

export function buildSampleDividends(input: {
  ticker: string;
  range?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  const ticker = normalizeTicker(input.ticker) || "SCHD";
  const window = resolveDateWindow({ range: input.range || "5y", start: input.start, end: input.end });
  const start = parseDateOnly(window.start) ?? addDays(parseDateOnly(window.end) ?? new Date(), -1_830);
  const end = parseDateOnly(window.end) ?? new Date();
  const seed = stableSeed(ticker);
  const amount = Number((0.35 + (seed % 85) / 100).toFixed(3));
  const rows: Array<{ date: string; amount: number }> = [];
  const current = new Date(start);
  current.setUTCDate(15 + (seed % 10));

  while (current <= end) {
    rows.push({ date: toIsoDate(current), amount: Number((amount * (0.94 + (seed % 9) / 100)).toFixed(3)) });
    current.setUTCMonth(current.getUTCMonth() + 3);
  }

  return rows;
}

export async function getQuoteHistory(input: {
  ticker: string;
  range?: string | null;
  start?: string | null;
  end?: string | null;
}): Promise<QuoteHistoryResponse> {
  const ticker = input.ticker || "";
  const normalizedTicker = normalizeTicker(ticker) || "SPY";
  const warnings: string[] = [];
  const window = resolveDateWindow(input);

  try {
    const yahoo = await fetchYahooChart({ ...input, ticker: normalizedTicker, events: "history" });
    const prices = parseYahooPrices(yahoo, window);
    if (prices.length > 0) {
      return { ticker, normalizedTicker, source: "yahoo", updatedAt: nowIso(), warnings, prices };
    }
    warnings.push(createWarning("Yahoo returned no usable daily prices for", normalizedTicker));
  } catch (error) {
    warnings.push(createWarning("Yahoo history fallback triggered:", error instanceof Error ? error.message : String(error)));
  }

  try {
    const prices = await fetchStooqDaily({ ...input, ticker: normalizedTicker });
    if (prices.length > 0) {
      return { ticker, normalizedTicker, source: "stooq", updatedAt: nowIso(), warnings, prices };
    }
    warnings.push(createWarning("Stooq returned no usable daily prices for", normalizedTicker));
  } catch (error) {
    warnings.push(createWarning("Stooq fallback failed:", error instanceof Error ? error.message : String(error)));
  }

  warnings.push("Sample fallback returned deterministic demo prices.");
  return {
    ticker,
    normalizedTicker,
    source: "sample",
    updatedAt: nowIso(),
    warnings,
    prices: buildSampleHistory({ ...input, ticker: normalizedTicker }),
  };
}

export async function getQuoteDividends(input: {
  ticker: string;
  range?: string | null;
  start?: string | null;
  end?: string | null;
}): Promise<QuoteDividendsResponse> {
  const ticker = input.ticker || "";
  const normalizedTicker = normalizeTicker(ticker) || "SCHD";
  const warnings: string[] = [];
  const window = resolveDateWindow({ range: input.range || "5y", start: input.start, end: input.end });

  try {
    const yahoo = await fetchYahooChart({ ...input, ticker: normalizedTicker, range: input.range || "5y", events: "div" });
    const dividends = parseYahooDividends(yahoo, window);
    if (dividends.length === 0) warnings.push(createWarning("Yahoo returned no dividend events for", normalizedTicker));
    return { ticker, normalizedTicker, source: "yahoo", updatedAt: nowIso(), warnings, dividends };
  } catch (error) {
    warnings.push(createWarning("Yahoo dividends fallback triggered:", error instanceof Error ? error.message : String(error)));
  }

  warnings.push("Sample fallback returned deterministic demo dividends.");
  return {
    ticker,
    normalizedTicker,
    source: "sample",
    updatedAt: nowIso(),
    warnings,
    dividends: buildSampleDividends({ ...input, ticker: normalizedTicker, range: input.range || "5y" }),
  };
}

export async function getQuoteLast(input: { ticker: string }): Promise<QuoteLastResponse> {
  const history = await getQuoteHistory({ ticker: input.ticker, range: "1m" });
  const latest = history.prices.at(-1);
  return {
    ticker: history.ticker,
    normalizedTicker: history.normalizedTicker,
    source: history.source,
    updatedAt: nowIso(),
    warnings: history.warnings,
    price: latest?.close ?? null,
    date: latest?.date ?? null,
  };
}

export async function getQuoteFx(input: { pair?: string | null } = {}): Promise<QuoteFxResponse> {
  const warnings: string[] = [];
  const pair = (input.pair || "USDKRW").toUpperCase();
  if (pair !== "USDKRW") warnings.push(`Unsupported pair ${pair}; USDKRW was used.`);

  for (const symbol of ["KRW=X", "USDKRW=X"]) {
    try {
      const history = await getQuoteHistory({ ticker: symbol, range: "1m" });
      const latest = history.prices.at(-1);
      const rate = latest?.close ?? null;
      if (rate !== null && rate >= 700 && rate <= 3_000) {
        return {
          pair: "USDKRW",
          source: history.source === "sample" ? "sample" : "yahoo",
          updatedAt: nowIso(),
          warnings: [...warnings, ...history.warnings],
          rate,
          date: latest?.date ?? null,
        };
      }
      warnings.push(createWarning(symbol, "returned an abnormal USD/KRW value:", rate === null ? "null" : String(rate)));
    } catch (error) {
      warnings.push(createWarning(symbol, "lookup failed:", error instanceof Error ? error.message : String(error)));
    }
  }

  warnings.push("Sample fallback returned a deterministic USD/KRW demo rate.");
  return {
    pair: "USDKRW",
    source: "sample",
    updatedAt: nowIso(),
    warnings,
    rate: 1_375,
    date: toIsoDate(new Date()),
  };
}
