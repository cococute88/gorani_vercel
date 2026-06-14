import { normalizeCalendarTicker } from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

// Calendar ticker source resolution.
//
// The dividend calendar must NOT use `/portfolio` snapshot holdings as its
// ticker universe. The calendar's "기본 포트폴리오" is the legacy dividend
// calendar ticker universe, resolved with this priority:
//   1. legacy portfolios  (legacyDividendCalendarMeta/portfolios -> items)
//   2. legacy imported calendar events (users/{uid}/calendarEvents tickers)
//   3. legacy memo keys   (legacyDividendCalendarMeta/memos -> items keys)
//   4. mock fallback       (DEFAULT_WATCHLIST_TICKERS) — only when nothing else
// A user's explicitly managed list (calendarTickers collection) overrides all
// of the above and is layered on top of this resolver by the calendar page.

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

export type CalendarTickerSourceInput = {
  legacyPortfolioTickers?: string[];
  legacyEventTickers?: string[];
  legacyMemoKeys?: string[];
  fallbackTickers?: string[];
};

export type CalendarTickerSourceKind =
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
 */
export function resolveCalendarTickerSource(input: CalendarTickerSourceInput): CalendarTickerSourceResult {
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
