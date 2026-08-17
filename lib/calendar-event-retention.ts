import { getCanonicalCalendarEventId, normalizeCalendarTicker, type CalendarTickerCache } from "@/lib/calendar-event-identity";
import { createCalendarTickerCacheEntry } from "@/lib/calendar-cache";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

function isGeneratedCalendarEvent(event: CalendarEvent): boolean {
  return event.sourceKind !== "custom" && event.sourceKind !== "economic" && event.type !== "custom";
}

function isPersistedProviderEvent(event: CalendarEvent): boolean {
  return event.sourceKind === "declared" || event.sourceKind === "estimated";
}

function eventPriority(event: CalendarEvent): number {
  if (event.sourceKind === "declared" && event.status === "confirmed") return 40;
  if (event.status === "confirmed") return 30;
  if (event.sourceKind === "estimated") return 20;
  return 10;
}

function eventIdentity(event: CalendarEvent): string {
  try {
    return getCanonicalCalendarEventId(event);
  } catch {
    return [normalizeCalendarTicker(event.ticker), event.type, event.date.slice(0, 10)].join("|");
  }
}

/**
 * Merge a provider refresh without interpreting an omitted row as a deletion.
 *
 * Previously persisted provider rows are retained across successful, empty,
 * partial, and shifted projections. A fetched row replaces an existing row
 * only when both resolve to the same canonical ticker/type/date identity and
 * the fetched row has equal or stronger certainty.
 */
export function mergeRefreshedCalendarEvents(
  existingEvents: CalendarEvent[],
  fetchedEvents: CalendarEvent[],
): CalendarEvent[] {
  const byIdentity = new Map<string, CalendarEvent>();

  for (const event of existingEvents) {
    if (!isGeneratedCalendarEvent(event) || !isPersistedProviderEvent(event)) continue;
    const identity = eventIdentity(event);
    const current = byIdentity.get(identity);
    if (!current || eventPriority(event) > eventPriority(current)) {
      byIdentity.set(identity, event);
    }
  }

  for (const event of fetchedEvents) {
    if (!isGeneratedCalendarEvent(event)) continue;
    const identity = eventIdentity(event);
    const current = byIdentity.get(identity);
    if (!current || eventPriority(event) >= eventPriority(current)) {
      byIdentity.set(identity, event);
    }
  }

  return Array.from(byIdentity.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id),
  );
}

function cacheRecency(entry: CalendarTickerCache<CalendarEvent>): [number, number] {
  const schemaVersion = Number.isFinite(entry.schemaVersion) ? entry.schemaVersion : 0;
  const fetchedAt = Date.parse(entry.fetchedAt);
  return [schemaVersion, Number.isFinite(fetchedAt) ? fetchedAt : Number.NEGATIVE_INFINITY];
}

function newerCacheEntry(
  current: CalendarTickerCache<CalendarEvent>,
  candidate: CalendarTickerCache<CalendarEvent>,
): CalendarTickerCache<CalendarEvent> {
  const [currentSchema, currentFetchedAt] = cacheRecency(current);
  const [candidateSchema, candidateFetchedAt] = cacheRecency(candidate);
  if (candidateSchema !== currentSchema) return candidateSchema > currentSchema ? candidate : current;
  return candidateFetchedAt > currentFetchedAt ? candidate : current;
}

export function mergeCalendarTickerCacheEntries(
  current: CalendarTickerCache<CalendarEvent> | null | undefined,
  candidate: CalendarTickerCache<CalendarEvent>,
): CalendarTickerCache<CalendarEvent> {
  if (!current) return candidate;
  const metadata = newerCacheEntry(current, candidate);
  return {
    ...metadata,
    ticker: normalizeCalendarTicker(candidate.ticker || current.ticker),
    events: mergeRefreshedCalendarEvents(current.events, candidate.events),
  };
}

/**
 * Merge local, cloud, and in-memory ticker caches per ticker. Missing tickers
 * and missing events are preserved; cache metadata follows the newest entry.
 */
export function mergeCalendarEventCacheMaps(
  currentMap: Record<string, CalendarTickerCache<CalendarEvent>>,
  incomingMap: Record<string, CalendarTickerCache<CalendarEvent>>,
): Record<string, CalendarTickerCache<CalendarEvent>> {
  const merged = { ...currentMap };

  for (const [rawTicker, candidate] of Object.entries(incomingMap)) {
    const ticker = normalizeCalendarTicker(candidate.ticker || rawTicker);
    if (!ticker) continue;
    const current = merged[ticker];
    if (!current) {
      merged[ticker] = { ...candidate, ticker };
      continue;
    }

    merged[ticker] = mergeCalendarTickerCacheEntries(current, { ...candidate, ticker });
  }

  return merged;
}

/**
 * Promote events from an explicitly trusted recovery source (for example the
 * normalized legacy RTDB import) into the canonical ticker cache. Sample,
 * custom, and economic rows are never promoted. Canonical identity makes the
 * operation idempotent across reloads and across overlapping recovery sources.
 */
export function mergeTrustedRecoveryEventsIntoCalendarCacheMap(
  currentMap: Record<string, CalendarTickerCache<CalendarEvent>>,
  recoveryEvents: CalendarEvent[],
  fetchedAt = new Date().toISOString(),
): Record<string, CalendarTickerCache<CalendarEvent>> {
  const byTicker = new Map<string, CalendarEvent[]>();

  for (const event of recoveryEvents) {
    if (!isGeneratedCalendarEvent(event) || !isPersistedProviderEvent(event)) continue;
    const ticker = normalizeCalendarTicker(event.ticker);
    if (!ticker) continue;
    const events = byTicker.get(ticker) ?? [];
    events.push(event);
    byTicker.set(ticker, events);
  }

  const recoveryMap: Record<string, CalendarTickerCache<CalendarEvent>> = {};
  for (const [ticker, events] of Array.from(byTicker.entries())) {
    const current = currentMap[ticker];
    recoveryMap[ticker] = !current || current.source === "sample" || current.source === "mock"
      ? createCalendarTickerCacheEntry({
          ticker,
          events,
          fetchedAt,
          source: "cache",
          warnings: ["Recovered canonical events from a trusted persisted source."],
        })
      : { ...current, events };
  }

  return mergeCalendarEventCacheMaps(currentMap, recoveryMap);
}
