import "server-only";

// =============================================================
// Market index quote fetcher (S&P500 / NASDAQ100 / SCHD cards).
// Purpose-built for the /market index section: returns OHLCV
// candles (daily or intraday) plus the latest-day change derived
// from Yahoo's chart meta, so a single request feeds both the
// card header and the detail candlestick chart.
//
// This is intentionally separate from lib/server/quote-fetchers.ts
// (which serves the calculators with daily-only, date-keyed data)
// because the index chart needs intraday intervals and unix-second
// timestamps for lightweight-charts.
// =============================================================

const FETCH_TIMEOUT_MS = 12_000;

// Supported ranges -> Yahoo (range, interval). Intraday ranges keep
// candle counts low; long ranges step up to weekly to stay performant.
type RangeConfig = { range: string; interval: string; intraday: boolean; revalidate: number };

const RANGE_CONFIG: Record<string, RangeConfig> = {
  "1d": { range: "1d", interval: "5m", intraday: true, revalidate: 60 },
  "5d": { range: "5d", interval: "30m", intraday: true, revalidate: 120 },
  "1m": { range: "1mo", interval: "1d", intraday: false, revalidate: 900 },
  "3m": { range: "3mo", interval: "1d", intraday: false, revalidate: 900 },
  "6m": { range: "6mo", interval: "1d", intraday: false, revalidate: 1_800 },
  ytd: { range: "ytd", interval: "1d", intraday: false, revalidate: 1_800 },
  "1y": { range: "1y", interval: "1d", intraday: false, revalidate: 1_800 },
  "3y": { range: "3y", interval: "1d", intraday: false, revalidate: 3_600 },
  "5y": { range: "5y", interval: "1d", intraday: false, revalidate: 21_600 },
  max: { range: "max", interval: "1wk", intraday: false, revalidate: 21_600 },
};

const DEFAULT_RANGE = "1y";

export type IndexCandle = {
  // lightweight-charts time: "YYYY-MM-DD" for daily, unix seconds for intraday.
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type IndexQuoteResponse = {
  symbol: string;
  source: "yahoo" | "sample";
  updatedAt: string;
  range: string;
  interval: string;
  intraday: boolean;
  currency: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  candles: IndexCandle[];
  warnings: string[];
};

type YahooMeta = {
  currency?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketTime?: number;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: YahooMeta;
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

function clean(value: unknown, digits = 4): number | null {
  if (!isFiniteNumber(value)) return null;
  return Number(value.toFixed(digits));
}

function normalizeSymbol(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

function clampRange(range?: string | null): string {
  const normalized = (range || DEFAULT_RANGE).toLowerCase();
  return normalized in RANGE_CONFIG ? normalized : DEFAULT_RANGE;
}

function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

async function fetchYahoo(symbol: string, cfg: RangeConfig): Promise<YahooChartPayload> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", cfg.range);
  url.searchParams.set("interval", cfg.interval);
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 quote-api" },
      next: { revalidate: cfg.revalidate },
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

// Accurate day-over-day baseline. A range=1d&interval=1d request exposes
// meta.chartPreviousClose = the *prior trading day* close (unlike longer
// ranges, where chartPreviousClose is the start-of-range close). Used for
// intraday/weekly sparkline ranges where the candles themselves can't give
// a day-over-day comparison.
async function fetchDayBaseline(symbol: string): Promise<{ price: number | null; previousClose: number | null }> {
  try {
    const payload = await fetchYahoo(symbol, { range: "1d", interval: "1d", intraday: false, revalidate: 60 });
    const meta = payload.chart?.result?.[0]?.meta ?? {};
    return { price: clean(meta.regularMarketPrice, 4), previousClose: clean(meta.chartPreviousClose, 4) };
  } catch {
    return { price: null, previousClose: null };
  }
}

function parseCandles(payload: YahooChartPayload, intraday: boolean): IndexCandle[] {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];

  const byKey = new Map<string | number, IndexCandle>();
  timestamps.forEach((timestamp, index) => {
    const close = clean(quote.close?.[index], 4);
    if (close === null || close <= 0) return;
    const open = clean(quote.open?.[index], 4) ?? close;
    const high = clean(quote.high?.[index], 4) ?? Math.max(open, close);
    const low = clean(quote.low?.[index], 4) ?? Math.min(open, close);
    const time = intraday ? timestamp : toIsoDate(timestamp);
    // Daily de-dupes by date string; intraday keys are unique timestamps.
    byKey.set(time, {
      time,
      open,
      high,
      low,
      close,
      volume: clean(quote.volume?.[index], 0),
    });
  });

  const candles = Array.from(byKey.values());
  candles.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return candles;
}

// Deterministic demo candles when Yahoo is unreachable, so the UI still renders.
function buildSampleCandles(symbol: string, cfg: RangeConfig): IndexCandle[] {
  const seed = symbol.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const points = cfg.intraday ? 78 : cfg.range === "1mo" ? 22 : cfg.range === "max" ? 260 : 180;
  const stepMs = cfg.intraday ? 5 * 60_000 : 86_400_000;
  const anchor = 80 + (seed % 200);
  const now = Date.now();
  const candles: IndexCandle[] = [];
  let prev = anchor;
  for (let i = points; i >= 0; i -= 1) {
    const t = now - i * stepMs;
    const progress = (points - i) / points;
    const wave = Math.sin(progress * Math.PI * 3 + seed / 11) * 0.06;
    const close = Math.max(1, anchor * (1 + wave + (progress - 0.5) * (((seed % 11) - 5) / 100)));
    const open = Math.max(1, prev * (1 + Math.sin(i + seed) * 0.004));
    const high = Math.max(open, close) * 1.006;
    const low = Math.min(open, close) * 0.994;
    candles.push({
      time: cfg.intraday ? Math.floor(t / 1000) : new Date(t).toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(1_000_000 + Math.abs(Math.sin(seed + i)) * 5_000_000),
    });
    prev = close;
  }
  return candles;
}

export async function getIndexQuote(input: { symbol: string; range?: string | null }): Promise<IndexQuoteResponse> {
  const symbol = normalizeSymbol(input.symbol) || "SPY";
  const rangeKey = clampRange(input.range);
  const cfg = RANGE_CONFIG[rangeKey];
  const warnings: string[] = [];

  try {
    const payload = await fetchYahoo(symbol, cfg);
    const candles = parseCandles(payload, cfg.intraday);
    if (candles.length > 0) {
      const meta = payload.chart?.result?.[0]?.meta ?? {};
      const lastClose = candles[candles.length - 1].close;
      // "전일 대비" = current price vs the prior trading day's close.
      // - Daily series: the second-to-last candle IS the prior session.
      // - Intraday/weekly series: candles can't express a day-over-day move,
      //   so pull a dedicated daily baseline.
      let price = clean(meta.regularMarketPrice, 4) ?? lastClose;
      let previousClose: number | null;
      if (cfg.interval === "1d") {
        previousClose = candles.length >= 2 ? candles[candles.length - 2].close : clean(meta.chartPreviousClose, 4);
      } else {
        const baseline = await fetchDayBaseline(symbol);
        price = baseline.price ?? price;
        previousClose = baseline.previousClose ?? (candles.length >= 2 ? candles[candles.length - 2].close : null);
      }
      const change = price !== null && previousClose !== null ? Number((price - previousClose).toFixed(4)) : null;
      const changePct =
        change !== null && previousClose ? Number(((change / previousClose) * 100).toFixed(4)) : null;
      return {
        symbol,
        source: "yahoo",
        updatedAt: nowIso(),
        range: rangeKey,
        interval: cfg.interval,
        intraday: cfg.intraday,
        currency: meta.currency ?? "USD",
        price,
        previousClose,
        change,
        changePct,
        candles,
        warnings,
      };
    }
    warnings.push(`Yahoo returned no usable candles for ${symbol} (${rangeKey})`);
  } catch (error) {
    warnings.push(`Yahoo index fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  warnings.push("Sample fallback returned deterministic demo candles.");
  const candles = buildSampleCandles(symbol, cfg);
  const price = candles[candles.length - 1]?.close ?? null;
  const previousClose = candles.length >= 2 ? candles[candles.length - 2].close : null;
  const change = price !== null && previousClose !== null ? Number((price - previousClose).toFixed(4)) : null;
  const changePct = change !== null && previousClose ? Number(((change / previousClose) * 100).toFixed(4)) : null;
  return {
    symbol,
    source: "sample",
    updatedAt: nowIso(),
    range: rangeKey,
    interval: cfg.interval,
    intraday: cfg.intraday,
    currency: "USD",
    price,
    previousClose,
    change,
    changePct,
    candles,
    warnings,
  };
}
