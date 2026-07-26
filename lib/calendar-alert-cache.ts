import type { CalendarTickerCache } from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";
import { isCalendarTickerCacheFresh } from "@/lib/calendar-cache";

const ALERT_PROVENANCE_SCHEMA_VERSION = 2;

export type CalendarProviderPersistenceContext = {
  uid: string | null;
  portfolioId: string;
};

export function calendarProviderContextMatches(
  context: CalendarProviderPersistenceContext | null,
  uid: string | null,
  portfolioId: string,
): boolean {
  return context !== null && context.uid === uid && context.portfolioId === portfolioId;
}

/**
 * Return only provider-backed generated events that are safe to expose to
 * read-only alert consumers. Cache reuse may rewrite the entry source to
 * "cache", so event-level provenance remains the final sample guard.
 */
export function authoritativeAlertCacheEntry(
  entry: CalendarTickerCache<CalendarEvent> | null | undefined,
): CalendarTickerCache<CalendarEvent> | null {
  if (!entry || entry.source === "sample" || entry.source === "mock") return null;
  const events = entry.events.filter(
    (event) =>
      event.sourceKind === "declared"
      || (
        event.sourceKind === "estimated"
        && entry.schemaVersion >= ALERT_PROVENANCE_SCHEMA_VERSION
      ),
  );
  return events.length > 0 ? { ...entry, events } : null;
}

/**
 * Scrub an already-persisted cache without removing its authoritative ticker
 * document. An empty document suppresses stale legacy fallback until a real
 * provider-backed cache replaces it.
 */
export function sanitizedPersistedAlertCacheEntry(
  entry: CalendarTickerCache<CalendarEvent>,
): CalendarTickerCache<CalendarEvent> {
  return authoritativeAlertCacheEntry(entry) ?? { ...entry, events: [] };
}

/**
 * Only a fully safe, unexpired v2 document may suppress a provider refresh or
 * provider-result persistence. Older or expired schemas remain readable after
 * sanitization, but must be replaced by the next provider-backed v2 result.
 */
export function isCurrentPersistedAlertCacheEntry(
  entry: CalendarTickerCache<CalendarEvent>,
  now = new Date(),
): boolean {
  const authoritative = authoritativeAlertCacheEntry(entry);
  return (
    isCalendarTickerCacheFresh(entry, now)
    && authoritative !== null
    && authoritative.events.length === entry.events.length
  );
}

export function alertCacheEntriesNeedingPersistence(
  cacheMap: Record<string, CalendarTickerCache<CalendarEvent>>,
  currentPersistedTickers: ReadonlySet<string>,
  now = new Date(),
): CalendarTickerCache<CalendarEvent>[] {
  return Object.values(cacheMap)
    .filter(
      (entry) =>
        isCalendarTickerCacheFresh(entry, now)
        && !currentPersistedTickers.has(entry.ticker),
    )
    .map(authoritativeAlertCacheEntry)
    .filter((entry): entry is CalendarTickerCache<CalendarEvent> => Boolean(entry));
}

/**
 * A metadata save may race a provider/live refresh for the same ticker. Keep
 * the newer cache document while allowing an upgraded schema to replace an
 * older one regardless of timestamp.
 */
export function shouldReplacePersistedCalendarCache(
  persisted: Pick<CalendarTickerCache<unknown>, "schemaVersion" | "fetchedAt"> | null | undefined,
  candidate: Pick<CalendarTickerCache<unknown>, "schemaVersion" | "fetchedAt">,
): boolean {
  if (!persisted) return true;
  const persistedSchemaVersion = Number.isFinite(persisted.schemaVersion) ? persisted.schemaVersion : 0;
  const candidateSchemaVersion = Number.isFinite(candidate.schemaVersion) ? candidate.schemaVersion : 0;
  if (candidateSchemaVersion !== persistedSchemaVersion) {
    return candidateSchemaVersion > persistedSchemaVersion;
  }
  const persistedFetchedAt = Date.parse(persisted.fetchedAt);
  const candidateFetchedAt = Date.parse(candidate.fetchedAt);
  if (!Number.isFinite(candidateFetchedAt)) return false;
  if (!Number.isFinite(persistedFetchedAt)) return true;
  return candidateFetchedAt >= persistedFetchedAt;
}
