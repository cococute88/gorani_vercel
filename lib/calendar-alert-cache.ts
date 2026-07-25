import type { CalendarTickerCache } from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

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
    (event) => event.sourceKind === "declared" || event.sourceKind === "estimated",
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
