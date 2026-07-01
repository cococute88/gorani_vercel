import {
  createCalendarTickerCacheEntry,
  isCalendarTickerCacheFresh,
  loadCalendarTickerCache,
  saveCalendarTickerCache,
  type CalendarTickerCacheMap,
} from "@/lib/calendar-cache";
import {
  buildGeneratedCalendarEventId,
  getCanonicalCalendarEventId,
  normalizeCalendarTicker,
  type CalendarTickerCache,
  type CalendarTickerCacheSource,
} from "@/lib/calendar-event-identity";
import { calendarCustomEventToCalendarEvent, type CalendarCustomEvent } from "@/lib/calendar-custom-events";
import { nextUsTradingDayOnOrAfter, previousUsTradingDay } from "@/lib/us-market-calendar";
import { fetchQuoteDividends } from "@/lib/calculator-data-provider";
import { buildMockCalendarEvents, type CalendarEvent } from "@/lib/mock-calendar-data";
import type { QuoteDividendsResponse } from "@/lib/quote-types";

export type CalendarEventProviderKind = "mock" | "real";

export type DividendFrequency = "monthly" | "quarterly" | "semiannual" | "annual";

export type DividendFrequencyInference = {
  frequency: DividendFrequency | null;
  medianIntervalDays: number | null;
  months: number | null;
  warnings: string[];
};

export type CalendarTickerProviderInput = {
  ticker: string;
  year: number;
  month: number;
  provider?: CalendarEventProviderKind;
  cache?: CalendarTickerCache<CalendarEvent> | null;
  preferFreshCache?: boolean;
  skipCacheTtl?: boolean;
  fetchDividends?: QuoteDividendsFetcher;
  today?: Date;
};

export type CalendarTickersProviderInput = {
  tickers: string[];
  year: number;
  month: number;
  provider?: CalendarEventProviderKind;
  cacheMap?: CalendarTickerCacheMap<CalendarEvent>;
  preferFreshCache?: boolean;
  skipCacheTtl?: boolean;
  firestoreCacheTickers?: Set<string>;
  fetchDividends?: QuoteDividendsFetcher;
  today?: Date;
};

export type CalendarTickerProviderResult = {
  ticker: string;
  events: CalendarEvent[];
  cacheEntry: CalendarTickerCache<CalendarEvent>;
  source: CalendarTickerCacheSource;
  warnings: string[];
};

export type CalendarTickersProviderResult = {
  events: CalendarEvent[];
  tickerResults: CalendarTickerProviderResult[];
  cacheMap: CalendarTickerCacheMap<CalendarEvent>;
  source: CalendarTickerCacheSource;
  warnings: string[];
};

type DividendHistoryRow = {
  date: string;
  amount: number;
};

type BuildDividendEventsFromHistoryInput = {
  ticker: string;
  dividends: DividendHistoryRow[];
  sourceKind: CalendarEvent["sourceKind"];
};

type ProjectEstimatedDividendEventsInput = {
  ticker: string;
  dividends: DividendHistoryRow[];
  frequency: DividendFrequencyInference;
  today?: Date;
};

export type QuoteDividendsFetcher = (input: {
  ticker: string;
  range?: string;
  start?: string;
  end?: string;
}) => Promise<QuoteDividendsResponse>;

const DIVIDEND_HISTORY_RANGE = "5y";
const ESTIMATED_PROJECTION_MONTHS = 12;
const MS_PER_DAY = 86_400_000;

function uniqueNormalizedTickers(tickers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawTicker of tickers) {
    const ticker = normalizeCalendarTicker(rawTicker);
    if (ticker && !seen.has(ticker)) {
      seen.add(ticker);
      out.push(ticker);
    }
  }
  return out;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDay));
  return next;
}

export function getPreviousDividendBuyDate(exDivDate: string | Date): string {
  const parsed = typeof exDivDate === "string" ? parseIsoDate(exDivDate) : exDivDate;
  if (!parsed || !Number.isFinite(parsed.getTime())) {
    throw new Error("A valid ex-dividend date is required to calculate the buy deadline.");
  }
  // Buy-deadline is the last *trading* day before the ex-date — skipping
  // weekends AND U.S. market holidays (e.g. ex on Mon after a Fri holiday must
  // not produce a closed-market buy-deadline).
  return toIsoDate(previousUsTradingDay(parsed));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function normalizeDividendHistory(dividends: QuoteDividendsResponse["dividends"]): DividendHistoryRow[] {
  const byDate = new Map<string, DividendHistoryRow>();
  for (const dividend of dividends) {
    const date = dividend.date?.slice(0, 10);
    const amount = Number(dividend.amount);
    if (!date || !Number.isFinite(amount)) continue;
    byDate.set(date, { date, amount });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function makeDividendEvent({
  ticker,
  type,
  date,
  status,
  dividendAmount,
  buyDeadline,
  exDivDate,
  sourceKind,
}: {
  ticker: string;
  type: CalendarEvent["type"];
  date: string;
  status: CalendarEvent["status"];
  dividendAmount: number | null;
  buyDeadline: string;
  exDivDate: string;
  sourceKind: CalendarEvent["sourceKind"];
}): CalendarEvent {
  const canonicalEventId = buildGeneratedCalendarEventId({
    ticker,
    eventType: type,
    eventDate: date,
    sourceKind: sourceKind === "sample" ? "sample" : sourceKind === "estimated" ? "estimated" : "declared",
  });
  const legacyEventId = `${ticker}-${type}-${date}`;
  return {
    id: canonicalEventId,
    canonicalEventId,
    legacyEventId,
    sourceKind,
    ticker,
    type,
    date,
    status,
    dividendAmount,
    buyDeadline,
    exDivDate,
    paymentDate: "",
    annualYield: 0,
    taxSavingUsd: 0,
  };
}

function getProviderSource(response: QuoteDividendsResponse): CalendarTickerCacheSource {
  return response.source === "yahoo" ? "yahoo" : "sample";
}

export function normalizeCalendarEventForCache(event: CalendarEvent): CalendarEvent {
  const canonicalEventId = event.canonicalEventId ?? getCanonicalCalendarEventId(event);
  const legacyEventId = event.legacyEventId ?? (event.id !== canonicalEventId ? event.id : undefined);
  return {
    ...event,
    id: canonicalEventId,
    canonicalEventId,
    legacyEventId,
    ticker: normalizeCalendarTicker(event.ticker),
    sourceKind: event.sourceKind ?? "sample",
  };
}

function normalizeGeneratedCalendarEventForCache(event: CalendarEvent): CalendarEvent {
  if (isCustomCalendarEventLike(event)) {
    throw new Error("Custom calendar events must not be stored in the generated dividend cache.");
  }
  const normalized = normalizeCalendarEventForCache(event) as CalendarEvent & {
    heart?: unknown;
    memo?: unknown;
    note?: unknown;
    star?: unknown;
  };
  const { heart: _heart, memo: _memo, note: _note, star: _star, ...cacheEvent } = normalized;
  return cacheEvent;
}

export function isCustomCalendarEventLike(event: Pick<CalendarEvent, "id" | "type" | "sourceKind">): boolean {
  return event.sourceKind === "custom" || event.type === "custom" || event.id.toLowerCase().startsWith("custom:");
}

export function buildDividendEventsFromHistory({
  ticker: rawTicker,
  dividends,
  sourceKind,
}: BuildDividendEventsFromHistoryInput): CalendarEvent[] {
  const ticker = normalizeCalendarTicker(rawTicker);
  if (!ticker) return [];

  return dividends.flatMap((dividend) => {
    const exDivDate = parseIsoDate(dividend.date);
    if (!exDivDate) return [];
    const exDivIso = toIsoDate(exDivDate);
    const buyDeadline = getPreviousDividendBuyDate(exDivDate);
    return [
      makeDividendEvent({
        ticker,
        type: "buy_by",
        date: buyDeadline,
        status: "confirmed",
        dividendAmount: dividend.amount,
        buyDeadline,
        exDivDate: exDivIso,
        sourceKind,
      }),
      makeDividendEvent({
        ticker,
        type: "ex_div",
        date: exDivIso,
        status: "confirmed",
        dividendAmount: dividend.amount,
        buyDeadline,
        exDivDate: exDivIso,
        sourceKind,
      }),
    ];
  });
}

export function inferDividendFrequency(dividendDates: string[]): DividendFrequencyInference {
  const dates = dividendDates
    .map(parseIsoDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length < 3) {
    return {
      frequency: null,
      medianIntervalDays: null,
      months: null,
      warnings: ["At least 3 historical dividend dates are required for projection."],
    };
  }

  const intervals = dates
    .slice(1)
    .map((date, index) => Math.round((date.getTime() - dates[index].getTime()) / MS_PER_DAY))
    .filter((days) => days > 0);
  const medianIntervalDays = median(intervals);
  if (medianIntervalDays == null) {
    return {
      frequency: null,
      medianIntervalDays: null,
      months: null,
      warnings: ["Dividend interval inference failed because historical dates were invalid."],
    };
  }

  if (medianIntervalDays >= 20 && medianIntervalDays <= 45) {
    return { frequency: "monthly", medianIntervalDays, months: 1, warnings: [] };
  }
  if (medianIntervalDays >= 70 && medianIntervalDays <= 110) {
    return { frequency: "quarterly", medianIntervalDays, months: 3, warnings: [] };
  }
  if (medianIntervalDays >= 150 && medianIntervalDays <= 220) {
    return { frequency: "semiannual", medianIntervalDays, months: 6, warnings: [] };
  }
  if (medianIntervalDays >= 300 && medianIntervalDays <= 430) {
    return { frequency: "annual", medianIntervalDays, months: 12, warnings: [] };
  }

  return {
    frequency: null,
    medianIntervalDays,
    months: null,
    warnings: [`Dividend interval ${medianIntervalDays} days is irregular; future projection was skipped.`],
  };
}

export function projectEstimatedDividendEvents({
  ticker: rawTicker,
  dividends,
  frequency,
  today = new Date(),
}: ProjectEstimatedDividendEventsInput): CalendarEvent[] {
  const ticker = normalizeCalendarTicker(rawTicker);
  if (!ticker || !frequency.months) return [];

  const sorted = dividends
    .map((dividend) => ({ ...dividend, parsedDate: parseIsoDate(dividend.date) }))
    .filter((dividend): dividend is DividendHistoryRow & { parsedDate: Date } => Boolean(dividend.parsedDate))
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  const latest = sorted.at(-1);
  if (!latest) return [];

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const projectionEnd = addMonths(todayStart, ESTIMATED_PROJECTION_MONTHS);
  const events: CalendarEvent[] = [];
  let nextExDivDate = addMonths(latest.parsedDate, frequency.months);
  let guard = 0;

  while (nextExDivDate < todayStart && guard < 24) {
    nextExDivDate = addMonths(nextExDivDate, frequency.months);
    guard += 1;
  }

  while (nextExDivDate <= projectionEnd && guard < 48) {
    // Estimated ex-dates must fall on a real trading day (skip weekends AND
    // U.S. market holidays) so the derived buy-deadline never lands on a
    // closed-market day.
    const adjustedExDivDate = nextUsTradingDayOnOrAfter(nextExDivDate);
    if (adjustedExDivDate > projectionEnd) break;
    const exDivIso = toIsoDate(adjustedExDivDate);
    const buyDeadline = getPreviousDividendBuyDate(adjustedExDivDate);
    events.push(
      makeDividendEvent({
        ticker,
        type: "buy_by",
        date: buyDeadline,
        status: "estimated",
        dividendAmount: latest.amount,
        buyDeadline,
        exDivDate: exDivIso,
        sourceKind: "estimated",
      }),
      makeDividendEvent({
        ticker,
        type: "ex_div",
        date: exDivIso,
        status: "estimated",
        dividendAmount: latest.amount,
        buyDeadline,
        exDivDate: exDivIso,
        sourceKind: "estimated",
      }),
    );
    nextExDivDate = addMonths(nextExDivDate, frequency.months);
    guard += 1;
  }

  return events;
}

export function getMockCalendarEventsForTicker(input: Pick<CalendarTickerProviderInput, "ticker" | "year" | "month">): CalendarEvent[] {
  const ticker = normalizeCalendarTicker(input.ticker);
  if (!ticker) return [];
  return buildMockCalendarEvents(input.year, input.month, [ticker]).map(normalizeCalendarEventForCache);
}

export function buildCalendarTickerCacheFromEvents(
  ticker: string,
  events: CalendarEvent[],
  source: CalendarTickerCacheSource = "mock",
  warnings: string[] = [],
): CalendarTickerCache<CalendarEvent> {
  return createCalendarTickerCacheEntry({
    ticker,
    events: events.filter((event) => !isCustomCalendarEventLike(event)).map(normalizeGeneratedCalendarEventForCache),
    source,
    warnings,
  });
}

/**
 * Pick the dividend-event source for the grid / schedule table.
 *
 * Policy (CALENDAR-UX-POLISH-3): when imported (Firestore/legacy) calendar
 * events exist, they are the single source of truth and the generated mock/real
 * provider events are NOT mixed in. Mock/preview events only fill in when no
 * imported events are present. Custom events are layered on top separately.
 */
export function selectCalendarDividendEvents({
  providerEvents,
  importedEvents,
}: {
  providerEvents: CalendarEvent[];
  importedEvents: CalendarEvent[];
}): { events: CalendarEvent[]; usedImported: boolean } {
  if (importedEvents.length > 0) {
    return { events: importedEvents, usedImported: true };
  }
  return { events: providerEvents, usedImported: false };
}

export function mergeGeneratedAndCustomCalendarEvents(
  generatedEvents: CalendarEvent[],
  customEvents: CalendarCustomEvent[],
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const seenIds = new Set<string>();

  for (const event of generatedEvents.map(normalizeCalendarEventForCache)) {
    if (seenIds.has(event.id)) continue;
    seenIds.add(event.id);
    events.push(event);
  }

  for (const customEvent of customEvents) {
    const event = calendarCustomEventToCalendarEvent(customEvent);
    if (seenIds.has(event.id)) continue;
    seenIds.add(event.id);
    events.push(event);
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}

function getMockCalendarResultForTicker(
  ticker: string,
  year: number,
  month: number,
  warnings: string[] = [],
): CalendarTickerProviderResult {
  const events = getMockCalendarEventsForTicker({ ticker, year, month });
  const cacheEntry = buildCalendarTickerCacheFromEvents(ticker, events, "mock", warnings);
  return {
    ticker,
    events,
    cacheEntry,
    source: "mock",
    warnings,
  };
}

export function getCalendarEventsForTicker({
  ticker: rawTicker,
  year,
  month,
  cache,
  preferFreshCache = false,
  skipCacheTtl,
}: CalendarTickerProviderInput): CalendarTickerProviderResult {
  const ticker = normalizeCalendarTicker(rawTicker);
  if (!ticker) {
    return {
      ticker: "",
      events: [],
      cacheEntry: buildCalendarTickerCacheFromEvents("", [], "mock", ["Ticker is empty after normalization."]),
      source: "mock",
      warnings: ["Ticker is empty after normalization."],
    };
  }

  if (preferFreshCache && isCalendarTickerCacheFresh(cache, undefined, { skipTtl: skipCacheTtl })) {
    const events = cache.events.map(normalizeCalendarEventForCache);
    return {
      ticker,
      events,
      cacheEntry: { ...cache, ticker, events, source: "cache" },
      source: "cache",
      warnings: cache.warnings,
    };
  }

  const events = getMockCalendarEventsForTicker({ ticker, year, month });
  return {
    ticker,
    events,
    cacheEntry: buildCalendarTickerCacheFromEvents(ticker, events, "mock"),
    source: "mock",
    warnings: [],
  };
}

export async function getRealDividendEventsForTicker({
  ticker: rawTicker,
  year,
  month,
  cache,
  preferFreshCache = true,
  skipCacheTtl,
  fetchDividends = fetchQuoteDividends,
  today,
}: CalendarTickerProviderInput): Promise<CalendarTickerProviderResult> {
  const ticker = normalizeCalendarTicker(rawTicker);
  if (!ticker) {
    const warnings = ["Ticker is empty after normalization."];
    return {
      ticker: "",
      events: [],
      cacheEntry: buildCalendarTickerCacheFromEvents("", [], "mock", warnings),
      source: "mock",
      warnings,
    };
  }

  const persistedCache = cache ?? loadCalendarTickerCache<CalendarEvent>(ticker);
  if (preferFreshCache && isCalendarTickerCacheFresh(persistedCache, undefined, { skipTtl: skipCacheTtl })) {
    const events = persistedCache.events.map(normalizeCalendarEventForCache);
    return {
      ticker,
      events,
      cacheEntry: { ...persistedCache, ticker, events, source: "cache" },
      source: "cache",
      warnings: persistedCache.warnings,
    };
  }

  try {
    const response = await fetchDividends({ ticker, range: DIVIDEND_HISTORY_RANGE });
    const dividends = normalizeDividendHistory(response.dividends);
    const providerSource = getProviderSource(response);
    const sourceKind: CalendarEvent["sourceKind"] = response.source === "yahoo" ? "declared" : "sample";
    const warnings = [...response.warnings];

    if (dividends.length === 0) {
      warnings.push(`${ticker} returned no dividend rows from /api/quote/dividends.`);
      if (persistedCache) {
        const events = persistedCache.events.map(normalizeCalendarEventForCache);
        const staleWarnings = [...warnings, "Expired calendar cache was used because the dividend provider returned no rows."];
        return {
          ticker,
          events,
          cacheEntry: { ...persistedCache, ticker, events, source: "cache", warnings: staleWarnings },
          source: "cache",
          warnings: staleWarnings,
        };
      }
      return getMockCalendarResultForTicker(ticker, year, month, [...warnings, "Mock calendar fallback was used."]);
    }

    const historicalEvents = buildDividendEventsFromHistory({ ticker, dividends, sourceKind });
    const frequency = inferDividendFrequency(dividends.map((dividend) => dividend.date));
    const estimatedEvents = projectEstimatedDividendEvents({ ticker, dividends, frequency, today });
    const events = [...historicalEvents, ...estimatedEvents]
      .map(normalizeCalendarEventForCache)
      .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type));
    const allWarnings = [
      ...warnings,
      ...frequency.warnings,
      ...(estimatedEvents.length > 0 ? [`Projected estimated dividend events for the next ${ESTIMATED_PROJECTION_MONTHS} months.`] : []),
    ];

    const cacheEntry = buildCalendarTickerCacheFromEvents(ticker, events, providerSource, allWarnings);
    saveCalendarTickerCache(cacheEntry);

    return {
      ticker,
      events,
      cacheEntry,
      source: providerSource,
      warnings: allWarnings,
    };
  } catch (error) {
    const warnings = [`Dividend provider failed for ${ticker}: ${error instanceof Error ? error.message : String(error)}`];
    if (persistedCache) {
      const events = persistedCache.events.map(normalizeCalendarEventForCache);
      const staleWarnings = [...warnings, "Expired calendar cache was used after provider failure."];
      return {
        ticker,
        events,
        cacheEntry: { ...persistedCache, ticker, events, source: "cache", warnings: staleWarnings },
        source: "cache",
        warnings: staleWarnings,
      };
    }
    return getMockCalendarResultForTicker(ticker, year, month, [...warnings, "Mock calendar fallback was used."]);
  }
}

export function getCalendarEventsForTickers({
  tickers,
  year,
  month,
  cacheMap = {},
  preferFreshCache = false,
}: CalendarTickersProviderInput): CalendarEvent[] {
  return uniqueNormalizedTickers(tickers)
    .flatMap((ticker) =>
      getCalendarEventsForTicker({
        ticker,
        year,
        month,
        cache: cacheMap[ticker],
        preferFreshCache,
      }).events,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
}

function summarizeSource(results: CalendarTickerProviderResult[]): CalendarTickerCacheSource {
  if (results.some((result) => result.source === "yahoo")) return "yahoo";
  if (results.some((result) => result.source === "sample")) return "sample";
  if (results.some((result) => result.source === "cache")) return "cache";
  return "mock";
}

export async function getCalendarEventsForTickersWithProvider({
  tickers,
  year,
  month,
  provider = "real",
  cacheMap = {},
  preferFreshCache = true,
  skipCacheTtl,
  firestoreCacheTickers,
  fetchDividends,
  today,
}: CalendarTickersProviderInput): Promise<CalendarTickersProviderResult> {
  const normalizedTickers = uniqueNormalizedTickers(tickers);
  const tickerResults = await Promise.all(
    normalizedTickers.map((ticker) => {
      const tickerSkipTtl = skipCacheTtl || (firestoreCacheTickers?.has(ticker) ?? false);
      return provider === "mock"
        ? Promise.resolve(getCalendarEventsForTicker({ ticker, year, month, cache: cacheMap[ticker], preferFreshCache, skipCacheTtl: tickerSkipTtl }))
        : getRealDividendEventsForTicker({ ticker, year, month, cache: cacheMap[ticker], preferFreshCache, skipCacheTtl: tickerSkipTtl, fetchDividends, today });
    }),
  );
  const events = tickerResults
    .flatMap((result) => result.events)
    .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type));
  const nextCacheMap: CalendarTickerCacheMap<CalendarEvent> = {};
  for (const result of tickerResults) {
    if (result.ticker) nextCacheMap[result.ticker] = result.cacheEntry;
  }
  return {
    events,
    tickerResults,
    cacheMap: nextCacheMap,
    source: summarizeSource(tickerResults),
    warnings: tickerResults.flatMap((result) => result.warnings.map((warning) => `${result.ticker}: ${warning}`)),
  };
}

export function mergeCalendarEventsWithCache({
  tickers,
  year,
  month,
  cacheMap = {},
}: Omit<CalendarTickersProviderInput, "provider" | "preferFreshCache">): CalendarEvent[] {
  return getCalendarEventsForTickers({
    tickers,
    year,
    month,
    cacheMap,
    preferFreshCache: true,
  });
}
