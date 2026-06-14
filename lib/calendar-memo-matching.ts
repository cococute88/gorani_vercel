import { normalizeCalendarTicker } from "@/lib/calendar-event-identity";

// Legacy imported memos (dividend_calendar.memos) are keyed by the canonical
// uppercase ticker. The calendar UI, however, may display tickers with market
// suffixes (e.g. "360200.KS") or with mixed casing, so memo lookups must try a
// few normalized variants before giving up. This module centralizes that key
// normalization so the memo dialog and the regression test agree on the rules.

const TICKER_SUFFIX_PATTERN = /\.(KS|KQ|KRX|KOE|KSC|T|HK|L|TO|SS|SZ)$/i;

/** Canonical key used when *saving* a memo (uppercase, suffix preserved). */
export function canonicalMemoTickerKey(ticker: string): string {
  return normalizeCalendarTicker(ticker);
}

/** Uppercase ticker with a trailing market suffix removed (e.g. ".KS"). */
export function stripTickerSuffix(ticker: string): string {
  return normalizeCalendarTicker(ticker).replace(TICKER_SUFFIX_PATTERN, "");
}

/**
 * Ordered list of keys to try when resolving a memo for a display ticker:
 *   1. exact ticker (as displayed)
 *   2. uppercase ticker
 *   3. canonical normalized ticker
 *   4. suffix-stripped base ticker
 * Duplicates are removed while preserving order.
 */
export function memoLookupKeys(ticker: string): string[] {
  const raw = (ticker ?? "").trim();
  const keys = [raw, raw.toUpperCase(), canonicalMemoTickerKey(ticker), stripTickerSuffix(ticker)];
  return Array.from(new Set(keys.filter((key) => Boolean(key))));
}

/** Resolve the first non-empty memo for a display ticker, or "" when none. */
export function lookupTickerMemo(memos: Record<string, string> | undefined | null, ticker: string): string {
  if (!memos) return "";
  for (const key of memoLookupKeys(ticker)) {
    const memo = memos[key];
    if (typeof memo === "string" && memo.trim()) return memo;
  }
  return "";
}

/** True when a memo (non-empty) exists for the ticker under any lookup key. */
export function hasTickerMemo(memos: Record<string, string> | undefined | null, ticker: string): boolean {
  return Boolean(lookupTickerMemo(memos, ticker));
}

/**
 * Merge legacy imported memos (base) with locally edited memos (override).
 * Both maps are re-keyed to the canonical uppercase ticker so later lookups are
 * deterministic. Empty strings clear the entry.
 */
export function mergeMemoMaps(
  legacy: Record<string, string> | undefined | null,
  local: Record<string, string> | undefined | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const source of [legacy, local]) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const canonical = canonicalMemoTickerKey(key);
      if (!canonical) continue;
      if (typeof value === "string" && value.trim()) out[canonical] = value;
      else delete out[canonical];
    }
  }
  return out;
}
