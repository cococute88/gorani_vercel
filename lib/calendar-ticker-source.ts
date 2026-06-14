import { normalizeCalendarTicker } from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

// Calendar ticker source resolution.
//
// The dividend calendar must NOT use `/portfolio` snapshot holdings as its
// ticker universe. The calendar's "기본 포트폴리오" is the legacy dividend
// calendar ticker universe, resolved with this priority:
//   0. VALID manual override (saved via the new modal, carries source/version
//      metadata) — only a metadata-tagged list counts as a real override.
//   1. legacy portfolios  (legacyDividendCalendarMeta/portfolios -> items)
//   2. legacy imported calendar events (users/{uid}/calendarEvents tickers)
//   3. legacy memo keys   (legacyDividendCalendarMeta/memos -> items keys)
//   4. mock fallback       (DEFAULT_WATCHLIST_TICKERS) — only when nothing else
//
// CALENDAR-UX-POLISH-4: pre-existing array-only `calendarTickers` values (no
// metadata) are treated as STALE and are ignored, so an old QQQ/SPY/MSFT/KRX
// list can no longer shadow the imported legacy universe. A list only overrides
// the legacy sources when it was written by the current modal with metadata.

export const MANUAL_CALENDAR_TICKERS_SOURCE = "manual-calendar-tickers";
export const MANUAL_CALENDAR_TICKERS_VERSION = 2;

export function uniqueCalendarTickers(tickers: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tickers) {
    const ticker = normalizeCalendarTicker(raw);
    if (ticker && !seen.has(ticker)) {
      seen.add(ticker);
      out.push(ticker);
    }
  }
  return out;
}

/** Tickers referenced by imported/generated dividend events (custom events excluded). */
export function extractTickersFromCalendarEvents(
  events: Array<Pick<CalendarEvent, "ticker" | "type">>,
): string[] {
  return uniqueCalendarTickers(events.filter((event) => event.type !== "custom").map((event) => event.ticker));
}

/** Flatten the legacy portfolios map ({ name: ticker[] }) into a unique ticker list. */
export function flattenLegacyPortfolioTickers(
  portfolios: Record<string, string[]> | null | undefined,
): string[] {
  if (!portfolios) return [];
  return uniqueCalendarTickers(Object.values(portfolios).flat());
}

/** Metadata-tagged manual ticker list — the only shape that overrides legacy. */
export type ManualCalendarTickerList = {
  source: typeof MANUAL_CALENDAR_TICKERS_SOURCE;
  version: number;
  updatedAt?: unknown;
  tickers: string[];
};

/**
 * True only for a list written by the current modal: it must carry the
 * `manual-calendar-tickers` source and a version >= 2. A bare string[] (the old
 * stored shape) is intentionally rejected as stale.
 */
export function isValidManualCalendarTickerList(value: unknown): value is ManualCalendarTickerList {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.source === MANUAL_CALENDAR_TICKERS_SOURCE &&
    typeof candidate.version === "number" &&
    candidate.version >= MANUAL_CALENDAR_TICKERS_VERSION &&
    Array.isArray(candidate.tickers)
  );
}

/** Build a metadata-tagged manual override list from a raw ticker array. */
export function createManualCalendarTickerList(
  tickers: readonly string[],
  updatedAt: string = new Date().toISOString(),
): ManualCalendarTickerList {
  return {
    source: MANUAL_CALENDAR_TICKERS_SOURCE,
    version: MANUAL_CALENDAR_TICKERS_VERSION,
    updatedAt,
    tickers: uniqueCalendarTickers(tickers),
  };
}

/** Normalized tickers from a manual override, but ONLY if it is valid metadata. */
export function readValidManualOverrideTickers(value: unknown): string[] {
  return isValidManualCalendarTickerList(value) ? uniqueCalendarTickers(value.tickers) : [];
}

export type CalendarTickerSourceInput = {
  /** Raw stored manual override (any shape); validated internally. */
  manualOverride?: unknown;
  legacyPortfolioTickers?: string[];
  legacyEventTickers?: string[];
  legacyMemoKeys?: string[];
  fallbackTickers?: string[];
};

export type CalendarTickerSourceKind =
  | "manual"
  | "legacy-portfolios"
  | "legacy-events"
  | "legacy-memos"
  | "fallback"
  | "empty";

export type CalendarTickerSourceResult = {
  tickers: string[];
  source: CalendarTickerSourceKind;
};

/**
 * Resolve the calendar ticker universe using the priority described above.
 * Returns the first non-empty source plus a label identifying which one won.
 * Stale (metadata-less) manual overrides are ignored.
 */
export function resolveCalendarTickerSource(input: CalendarTickerSourceInput): CalendarTickerSourceResult {
  const manual = readValidManualOverrideTickers(input.manualOverride);
  if (manual.length > 0) return { tickers: manual, source: "manual" };

  const portfolios = uniqueCalendarTickers(input.legacyPortfolioTickers ?? []);
  if (portfolios.length > 0) return { tickers: portfolios, source: "legacy-portfolios" };

  const events = uniqueCalendarTickers(input.legacyEventTickers ?? []);
  if (events.length > 0) return { tickers: events, source: "legacy-events" };

  const memos = uniqueCalendarTickers(input.legacyMemoKeys ?? []);
  if (memos.length > 0) return { tickers: memos, source: "legacy-memos" };

  const fallback = uniqueCalendarTickers(input.fallbackTickers ?? []);
  if (fallback.length > 0) return { tickers: fallback, source: "fallback" };

  return { tickers: [], source: "empty" };
}

export function resolveCalendarTickers(input: CalendarTickerSourceInput): string[] {
  return resolveCalendarTickerSource(input).tickers;
}
