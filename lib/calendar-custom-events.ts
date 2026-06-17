import { buildCustomCalendarEventId, normalizeCalendarTicker } from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { DEFAULT_CALENDAR_PORTFOLIO_ID, getCalendarLocalStorageKey, getLegacyCalendarLocalStorageKey } from "@/lib/calendar-portfolio";

export type CalendarCustomEvent = {
  id: string;
  canonicalEventId: string;
  sourceKind: "custom";
  title: string;
  date: string;
  type: "custom";
  ticker?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type CalendarCustomEventInput = {
  id?: string;
  title: string;
  date: string;
  ticker?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

const CALENDAR_CUSTOM_EVENTS_STORAGE_KEY = STORAGE_KEYS.calendarCustomEvents;
function calendarCustomEventsStorageKey(portfolioId = DEFAULT_CALENDAR_PORTFOLIO_ID): string { return getCalendarLocalStorageKey("customEvents", portfolioId); }

function hasWindowLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIsoDate(value: unknown): string {
  return toStringOrEmpty(value).slice(0, 10);
}

function getIsoTimestamp(value?: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const parsed = raw ? new Date(raw) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function generateCustomEventUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function isCalendarCustomEventId(eventId: string | undefined | null): boolean {
  return typeof eventId === "string" && eventId.trim().toLowerCase().startsWith("custom:");
}

export function normalizeCalendarCustomEvent(event: unknown): CalendarCustomEvent | null {
  if (!isObjectRecord(event)) return null;

  const title = toStringOrEmpty(event.title);
  const date = normalizeIsoDate(event.date);
  if (!title || !date) return null;

  const rawId = toStringOrEmpty(event.id) || toStringOrEmpty(event.canonicalEventId);
  if (!rawId) return null;

  let id: string;
  try {
    id = buildCustomCalendarEventId(rawId);
  } catch {
    return null;
  }

  const ticker = normalizeCalendarTicker(toStringOrEmpty(event.ticker));
  const note = toStringOrEmpty(event.note);
  const createdAt = getIsoTimestamp(event.createdAt);
  const updatedAt = getIsoTimestamp(event.updatedAt || createdAt);

  return {
    id,
    canonicalEventId: id,
    sourceKind: "custom",
    title,
    date,
    type: "custom",
    ...(ticker ? { ticker } : {}),
    ...(note ? { note } : {}),
    createdAt,
    updatedAt,
  };
}

export function createCalendarCustomEvent(input: CalendarCustomEventInput): CalendarCustomEvent {
  const now = new Date().toISOString();
  const rawId = input.id ?? generateCustomEventUuid();
  const event = normalizeCalendarCustomEvent({
    ...input,
    id: buildCustomCalendarEventId(rawId),
    canonicalEventId: buildCustomCalendarEventId(rawId),
    sourceKind: "custom",
    type: "custom",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
  if (!event) throw new Error("title, date, and a valid custom event id are required");
  return event;
}

export function sortCalendarCustomEvents(events: CalendarCustomEvent[]): CalendarCustomEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || (a.ticker ?? "").localeCompare(b.ticker ?? "") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export function dedupeCalendarCustomEvents(events: CalendarCustomEvent[]): CalendarCustomEvent[] {
  const byId = new Map<string, CalendarCustomEvent>();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return sortCalendarCustomEvents(Array.from(byId.values()));
}

export function loadCalendarCustomEvents(portfolioId = DEFAULT_CALENDAR_PORTFOLIO_ID): CalendarCustomEvent[] {
  if (!hasWindowLocalStorage()) return [];

  try {
    const storageKey = calendarCustomEventsStorageKey(portfolioId);
    const stored = window.localStorage.getItem(storageKey) ?? (portfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? window.localStorage.getItem(getLegacyCalendarLocalStorageKey("customEvents")) : null);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return dedupeCalendarCustomEvents(parsed.map(normalizeCalendarCustomEvent).filter((event): event is CalendarCustomEvent => Boolean(event)));
  } catch {
    try {
      window.localStorage.removeItem(calendarCustomEventsStorageKey(portfolioId));
    } catch {
      // Ignore secondary storage errors and fall back to an empty custom event list.
    }
    return [];
  }
}

export function saveCalendarCustomEvents(events: CalendarCustomEvent[], portfolioId = DEFAULT_CALENDAR_PORTFOLIO_ID): void {
  if (!hasWindowLocalStorage()) return;

  try {
    window.localStorage.setItem(calendarCustomEventsStorageKey(portfolioId), JSON.stringify(dedupeCalendarCustomEvents(events)));
  } catch {
    // User-owned custom events remain in memory if localStorage is unavailable.
  }
}

export function upsertCalendarCustomEvent(event: CalendarCustomEvent): CalendarCustomEvent[] {
  const normalized = normalizeCalendarCustomEvent(event);
  if (!normalized) return loadCalendarCustomEvents();
  const next = dedupeCalendarCustomEvents([...loadCalendarCustomEvents().filter((item) => item.id !== normalized.id), normalized]);
  saveCalendarCustomEvents(next);
  return next;
}

export function deleteCalendarCustomEvent(eventId: string): CalendarCustomEvent[] {
  let normalizedId: string;
  try {
    normalizedId = buildCustomCalendarEventId(eventId);
  } catch {
    return loadCalendarCustomEvents();
  }
  const next = loadCalendarCustomEvents().filter((event) => event.id !== normalizedId);
  saveCalendarCustomEvents(next);
  return next;
}

export function calendarCustomEventToCalendarEvent(event: CalendarCustomEvent): CalendarEvent {
  return {
    id: event.id,
    canonicalEventId: event.id,
    sourceKind: "custom",
    title: event.title,
    ticker: event.ticker ?? "CUSTOM",
    type: "custom",
    date: event.date,
    status: "confirmed",
    dividendAmount: null,
    buyDeadline: "",
    exDivDate: event.date,
    paymentDate: "",
    annualYield: 0,
    taxSavingUsd: 0,
    note: event.note,
  };
}
