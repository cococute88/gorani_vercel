import {
  normalizeCalendarTicker,
  type CalendarTickerCache,
  type CalendarTickerCacheSource,
} from "@/lib/calendar-event-identity";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const CALENDAR_TICKER_CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_CALENDAR_TICKER_CACHE_TTL_HOURS = 24;

export type CalendarTickerCacheMap<TEvent = Record<string, unknown>> = Record<string, CalendarTickerCache<TEvent>>;

type CreateCalendarTickerCacheEntryInput<TEvent> = {
  ticker: string;
  events: TEvent[];
  fetchedAt?: string;
  ttlHours?: number;
  source?: CalendarTickerCacheSource;
  warnings?: string[];
};

const CALENDAR_CACHE_STORAGE_KEY = STORAGE_KEYS.calendarCache;

function hasWindowLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function addHours(isoDate: string, hours: number): string {
  const date = new Date(isoDate);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date.toISOString();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeCalendarCacheTicker(ticker: string): string {
  return normalizeCalendarTicker(ticker);
}

export function getCalendarTickerCacheKey(ticker: string): string {
  return normalizeCalendarCacheTicker(ticker);
}

export function getCalendarTickerCacheExpiresAt(
  fetchedAt: string,
  ttlHours = DEFAULT_CALENDAR_TICKER_CACHE_TTL_HOURS,
): string {
  return addHours(fetchedAt, ttlHours);
}

export function createCalendarTickerCacheEntry<TEvent>({
  ticker,
  events,
  fetchedAt = new Date().toISOString(),
  ttlHours = DEFAULT_CALENDAR_TICKER_CACHE_TTL_HOURS,
  source = "mock",
  warnings = [],
}: CreateCalendarTickerCacheEntryInput<TEvent>): CalendarTickerCache<TEvent> {
  return {
    ticker: normalizeCalendarCacheTicker(ticker),
    events,
    fetchedAt,
    expiresAt: getCalendarTickerCacheExpiresAt(fetchedAt, ttlHours),
    source,
    warnings,
    schemaVersion: CALENDAR_TICKER_CACHE_SCHEMA_VERSION,
  };
}

export function isCalendarTickerCacheFresh<TEvent = unknown>(
  entry: CalendarTickerCache<TEvent> | null | undefined,
  now = new Date(),
): entry is CalendarTickerCache<TEvent> {
  if (!entry) return false;
  if (entry.schemaVersion !== CALENDAR_TICKER_CACHE_SCHEMA_VERSION) return false;
  if (!normalizeCalendarCacheTicker(entry.ticker)) return false;
  if (!Array.isArray(entry.events)) return false;

  const expiresAtTime = new Date(entry.expiresAt).getTime();
  if (!Number.isFinite(expiresAtTime)) return false;
  return expiresAtTime > now.getTime();
}

export function isCalendarTickerCacheExpired(entry: CalendarTickerCache<unknown> | null | undefined, now = new Date()): boolean {
  return !isCalendarTickerCacheFresh(entry, now);
}

export function loadCalendarCacheMap<TEvent = Record<string, unknown>>(): CalendarTickerCacheMap<TEvent> {
  if (!hasWindowLocalStorage()) return {};

  try {
    const stored = window.localStorage.getItem(CALENDAR_CACHE_STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as unknown;
    if (!isObjectRecord(parsed)) return {};

    const out: CalendarTickerCacheMap<TEvent> = {};
    for (const [rawTicker, rawEntry] of Object.entries(parsed)) {
      if (!isObjectRecord(rawEntry)) continue;
      const entry = rawEntry as CalendarTickerCache<TEvent>;
      const ticker = normalizeCalendarCacheTicker(entry.ticker || rawTicker);
      if (!ticker) continue;
      out[ticker] = { ...entry, ticker };
    }
    return out;
  } catch {
    try {
      window.localStorage.removeItem(CALENDAR_CACHE_STORAGE_KEY);
    } catch {
      // Ignore secondary storage errors and return an empty cache.
    }
    return {};
  }
}

export function saveCalendarCacheMap<TEvent>(cacheMap: CalendarTickerCacheMap<TEvent>): void {
  if (!hasWindowLocalStorage()) return;

  try {
    window.localStorage.setItem(CALENDAR_CACHE_STORAGE_KEY, JSON.stringify(cacheMap));
  } catch {
    // localStorage may be full or unavailable; cache writes are best effort.
  }
}

export function loadCalendarTickerCache<TEvent = Record<string, unknown>>(ticker: string): CalendarTickerCache<TEvent> | null {
  const key = getCalendarTickerCacheKey(ticker);
  if (!key) return null;
  return loadCalendarCacheMap<TEvent>()[key] ?? null;
}

export function saveCalendarTickerCache<TEvent>(entry: CalendarTickerCache<TEvent>): void {
  const key = getCalendarTickerCacheKey(entry.ticker);
  if (!key) return;
  const cacheMap = loadCalendarCacheMap<TEvent>();
  cacheMap[key] = { ...entry, ticker: key };
  saveCalendarCacheMap(cacheMap);
}

export function removeCalendarTickerCache(ticker: string): void {
  const key = getCalendarTickerCacheKey(ticker);
  if (!key) return;
  const cacheMap = loadCalendarCacheMap();
  delete cacheMap[key];
  saveCalendarCacheMap(cacheMap);
}
