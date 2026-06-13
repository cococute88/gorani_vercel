import {
  loadHistoricalTaxSavingMetricForTicker,
  type HistoricalTaxSavingMetricLoadOptions,
  type HistoricalTaxSavingMetricLoadResult,
} from "@/lib/historical-tax-saving-service";

// In-memory, per-session cache for the five-year historical tax-saving metric.
//
// Scope and constraints (Step 5B-7):
// - in-memory only: no localStorage / sessionStorage / Firestore / IndexedDB
// - no persistent schema, no new dependency
// - cache key = ticker.trim().toUpperCase()
// - TTL = 30 minutes
// - stores both successful and unavailable results
// - deduplicates in-flight requests for the same ticker (shared promise)
//
// The cache lives at module scope, so it is shared for the lifetime of the
// client session (a page reload clears it). This avoids re-requesting the same
// ticker each time an eligible event dialog is reopened.

export const HISTORICAL_TAX_SAVING_CACHE_TTL_MS = 30 * 60 * 1000;

type HistoricalTaxSavingLoader = (
  ticker: string,
  options?: HistoricalTaxSavingMetricLoadOptions,
) => Promise<HistoricalTaxSavingMetricLoadResult>;

export type HistoricalTaxSavingCacheOptions = {
  // Override the loader (tests inject a counting/synthetic loader).
  loader?: HistoricalTaxSavingLoader;
  // Override the clock (tests advance a fake clock to exercise TTL).
  now?: () => number;
  // Override the TTL (tests use a short TTL).
  ttlMs?: number;
  // Forwarded to the underlying loader.
  loaderOptions?: HistoricalTaxSavingMetricLoadOptions;
};

type CacheEntry =
  | { status: "pending"; promise: Promise<HistoricalTaxSavingMetricLoadResult> }
  | { status: "resolved"; result: HistoricalTaxSavingMetricLoadResult; storedAt: number };

const cache = new Map<string, CacheEntry>();

function normalizeCacheKey(ticker: string): string {
  return ticker.trim().toUpperCase();
}

// A failure is converted to a safe unavailable result so the dialog never
// crashes and so rapid repeated failures are throttled by the TTL.
function buildUnavailableResult(ticker: string): HistoricalTaxSavingMetricLoadResult {
  return {
    ticker,
    canCalculate: false,
    taxSavingUsd: 0,
    avgProfitPct: 0,
    totalCount: 0,
    successCount: 0,
    failureCount: 0,
    dividendCount: 0,
    priceBarCount: 0,
    source: "quote-api",
    warnings: ["Historical tax-saving metric request failed."],
    calculatedAt: new Date().toISOString(),
  };
}

export function loadHistoricalTaxSavingMetricCached(
  ticker: string,
  options: HistoricalTaxSavingCacheOptions = {},
): Promise<HistoricalTaxSavingMetricLoadResult> {
  const loader = options.loader ?? loadHistoricalTaxSavingMetricForTicker;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? HISTORICAL_TAX_SAVING_CACHE_TTL_MS;
  const key = normalizeCacheKey(ticker);

  const existing = cache.get(key);
  if (existing) {
    // Reuse an in-flight request for the same ticker.
    if (existing.status === "pending") return existing.promise;
    // Reuse a fresh resolved result (success or unavailable).
    if (now() - existing.storedAt < ttlMs) return Promise.resolve(existing.result);
  }

  const promise = Promise.resolve()
    .then(() => loader(ticker, options.loaderOptions))
    .catch(() => buildUnavailableResult(key))
    .then((result) => {
      cache.set(key, { status: "resolved", result, storedAt: now() });
      return result;
    });

  cache.set(key, { status: "pending", promise });
  return promise;
}

// Test/maintenance helper: clears all cached entries.
export function clearHistoricalTaxSavingMetricCache(): void {
  cache.clear();
}
