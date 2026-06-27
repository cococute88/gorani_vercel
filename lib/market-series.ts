// =============================================================
// Client adapter for long-range DAILY history (/api/market/long-series).
// Powers the SCHD detail modal's US10Y and SPY/SCHD Total-Return
// comparison tabs. Mirrors fetchIndexQuote's in-memory caching so
// repeated tab/range switches reuse a single network call per symbol.
// =============================================================

export type LongSeriesPoint = {
  date: string;
  close: number;
  adjClose: number | null;
};

export type LongSeriesDividend = {
  date: string;
  amount: number;
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

type CacheEntry = { at: number; promise: Promise<LongSeriesResponse> };
const CACHE_TTL_MS = 5 * 60_000; // long history is stable; cache 5 min in-tab
const cache = new Map<string, CacheEntry>();

function cacheKey(symbol: string, start: string) {
  return `${symbol}::${start}`;
}

export async function fetchLongSeries(symbol: string, start: string): Promise<LongSeriesResponse> {
  const key = cacheKey(symbol, start);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = (async () => {
    const response = await fetch(
      `/api/market/long-series?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as LongSeriesResponse;
  })();

  // Drop failed lookups so a transient error can be retried.
  promise.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), promise });
  return promise;
}
