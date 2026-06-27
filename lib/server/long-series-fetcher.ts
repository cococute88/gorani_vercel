import "server-only";

// =============================================================
// Long-range daily series fetcher (SCHD detail modal: US10Y /
// SPY·SCHD Total Return comparison).
//
// The existing getIndexQuote() maps to Yahoo *range tokens*; the
// widest daily token ("5y") caps history at ~5 years and "max"
// silently downgrades to MONTHLY candles. To power the SCHD modal's
// US10Y and Compare tabs we need DAILY candles spanning the full
// SCHD dividend history (~2011→now). Yahoo returns daily candles for
// arbitrarily long windows when queried with period1/period2 +
// interval=1d, so this fetcher uses that form and additionally
// surfaces dividend events + adjusted close (for total-return math).
// =============================================================

const FETCH_TIMEOUT_MS = 12_000;
// Cache long-range daily history aggressively; it barely changes intraday.
const REVALIDATE_SECONDS = 21_600; // 6h
// Earliest history we ever request. SCHD inception is 2011-10; ^TNX/SPY go
// back further. A fixed early floor keeps the request URL stable/cacheable.
const DEFAULT_START_ISO = "2010-01-01";

export type LongSeriesPoint = {
  date: string; // "YYYY-MM-DD"
  close: number;
  adjClose: number | null; // dividend+split adjusted close (gross total return)
};

export type LongSeriesDividend = {
  date: string; // ex-dividend date "YYYY-MM-DD"
  amount: number; // per-share amount, as reported by Yahoo
};

export type LongSeriesResponse = {
  symbol: string;
  source: "yahoo" | "empty";
  updatedAt: string;
  start: string;
  points: LongSeriesPoint[];
  dividends: LongSeriesDividend[];
  warnings: string[];
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
      events?: { dividends?: Record<string, { amount?: number; date?: number }> };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clean(value: unknown, digits = 4): number | null {
  if (!isFiniteNumber(value)) return null;
  return Number(value.toFixed(digits));
}

function normalizeSymbol(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function startIsoToUnix(start: string | null | undefined): number {
  const iso = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : DEFAULT_START_ISO;
  const ms = new Date(`${iso}T00:00:00Z`).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : Math.floor(new Date(`${DEFAULT_START_ISO}T00:00:00Z`).getTime() / 1000);
}


async function fetchYahooDaily(symbol: string, startUnix: number): Promise<YahooChartPayload> {
  const nowUnix = Math.floor(Date.now() / 1000);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("period1", String(startUnix));
  url.searchParams.set("period2", String(nowUnix));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 quote-api" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as YahooChartPayload;
    const error = payload.chart?.error;
    if (error) throw new Error(error.description || error.code || "Yahoo chart error");
    if (!payload.chart?.result?.[0]) throw new Error("Yahoo chart returned no result");
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function parsePoints(payload: YahooChartPayload): LongSeriesPoint[] {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const close = result?.indicators?.quote?.[0]?.close ?? [];
  const adj = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  if (timestamps.length === 0) return [];

  const byDate = new Map<string, LongSeriesPoint>();
  timestamps.forEach((timestamp, index) => {
    const c = clean(close[index], 4);
    if (c === null || c <= 0) return;
    byDate.set(toIsoDate(timestamp), { date: toIsoDate(timestamp), close: c, adjClose: clean(adj[index], 4) });
  });
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function parseDividends(payload: YahooChartPayload): LongSeriesDividend[] {
  const events = payload.chart?.result?.[0]?.events?.dividends ?? {};
  const out: LongSeriesDividend[] = [];
  for (const entry of Object.values(events)) {
    const amount = clean(entry?.amount, 6);
    if (amount === null || amount <= 0 || !isFiniteNumber(entry?.date)) continue;
    out.push({ date: toIsoDate(entry.date as number), amount });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function getLongDailySeries(input: { symbol: string; start?: string | null }): Promise<LongSeriesResponse> {
  const symbol = normalizeSymbol(input.symbol);
  const startUnix = startIsoToUnix(input.start);
  const startIso = toIsoDate(startUnix);
  const warnings: string[] = [];

  if (!symbol) {
    return { symbol, source: "empty", updatedAt: new Date().toISOString(), start: startIso, points: [], dividends: [], warnings: ["empty symbol"] };
  }

  try {
    const payload = await fetchYahooDaily(symbol, startUnix);
    const points = parsePoints(payload);
    const dividends = parseDividends(payload);
    if (points.length > 0) {
      return { symbol, source: "yahoo", updatedAt: new Date().toISOString(), start: startIso, points, dividends, warnings };
    }
    warnings.push(`Yahoo returned no usable daily candles for ${symbol}`);
  } catch (error) {
    warnings.push(`Yahoo long-series fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { symbol, source: "empty", updatedAt: new Date().toISOString(), start: startIso, points: [], dividends: [], warnings };
}
