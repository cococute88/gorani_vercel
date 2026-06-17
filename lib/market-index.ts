// =============================================================
// /market 시장 지수 섹션 client adapter.
// Fetches the purpose-built /api/market/index-quote route, caches
// responses in-memory (per symbol+range) to avoid duplicate calls,
// and exposes range definitions + indicator helpers (MA) so the
// cards and detail chart stay in sync. Designed to extend later
// with MACD / RSI / Bollinger / ex-dividend markers.
// =============================================================

export type IndexCandle = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type IndexQuote = {
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

export type IndexDef = {
  symbol: string;
  /** API symbol used for data (may differ from display ticker). */
  name: string;
  ticker: string;
  description: string;
};

// Data sources: Yahoo Finance chart symbols. BTC/USDT uses Yahoo's BTC-USD proxy.
export const INDEX_DEFS: IndexDef[] = [
  { symbol: "SPY", name: "S&P 500", ticker: "SPY", description: "S&P 500 ETF" },
  { symbol: "DIA", name: "Dow Jones", ticker: "DIA", description: "Dow Jones Industrial Average ETF" },
  { symbol: "QQQ", name: "NASDAQ 100", ticker: "QQQ", description: "Nasdaq-100 ETF" },
];

// Card sparkline ranges (label -> api range key).
export const CARD_RANGES: Array<{ label: string; key: string }> = [
  { label: "1M", key: "1m" },
  { label: "3M", key: "3m" },
  { label: "6M", key: "6m" },
  { label: "1Y", key: "1y" },
  { label: "3Y", key: "3y" },
  { label: "MAX", key: "max" },
];

// Detail (candlestick) ranges, TradingView-style.
export const DETAIL_RANGES: Array<{ label: string; key: string }> = [
  { label: "1D", key: "1d" },
  { label: "5D", key: "5d" },
  { label: "1M", key: "1m" },
  { label: "3M", key: "3m" },
  { label: "6M", key: "6m" },
  { label: "YTD", key: "ytd" },
  { label: "1Y", key: "1y" },
  { label: "3Y", key: "3y" },
  { label: "5Y", key: "5y" },
  { label: "MAX", key: "max" },
];

export const MA_PERIODS = [20, 60, 120, 200] as const;
export type MaPeriod = (typeof MA_PERIODS)[number];

export const MA_COLORS: Record<MaPeriod, string> = {
  20: "#f59e0b",
  60: "#3b82f6",
  120: "#a855f7",
  200: "#ef4444",
};

type CacheEntry = { at: number; promise: Promise<IndexQuote> };
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(symbol: string, range: string) {
  return `${symbol}::${range}`;
}

export async function fetchIndexQuote(symbol: string, range: string): Promise<IndexQuote> {
  const key = cacheKey(symbol, range);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = (async () => {
    const response = await fetch(`/api/market/index-quote?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as IndexQuote;
  })();

  // Drop failed lookups from the cache so a transient error can be retried.
  promise.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

// Simple moving average over candle closes. Returns one point per candle
// once enough history exists (matching TradingView's leading-gap behavior).
export function movingAverage(candles: IndexCandle[], period: number): Array<{ time: string | number; value: number }> {
  if (candles.length < period) return [];
  const out: Array<{ time: string | number; value: number }> = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i += 1) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: Number((sum / period).toFixed(4)) });
  }
  return out;
}

export function formatUsd(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatSignedUsd(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatSignedPct(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
