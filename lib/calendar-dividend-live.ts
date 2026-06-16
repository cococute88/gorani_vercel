import { buildCalendarTickerCacheFromEvents, buildDividendEventsFromHistory, inferDividendFrequency, normalizeCalendarEventForCache, projectEstimatedDividendEvents } from "@/lib/calendar-event-provider";
import { normalizeCalendarTicker, type CalendarTickerCache } from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";
import type { QuoteDividendsResponse } from "@/lib/quote-types";

export type DividendLiveSource = "live" | "partial" | "unavailable";
export type ProviderStatus = {
  yahoo?: "ok" | "failed" | "sample_fallback";
  finnhub?: "ok" | "missing_key" | "failed";
  polygon?: "ok" | "missing_key" | "rate_limited" | "failed";
};
export type DividendLiveResponse = {
  ticker: string;
  source: DividendLiveSource;
  events: CalendarEvent[];
  failedReason?: string;
  updatedAt: string;
  providerStatus: ProviderStatus;
  warnings: string[];
  rateLimitDelayMs?: number;
};
export type DeclaredDividendRow = { exDate: string; amount: number; payDate?: string | null };
export type DividendHistoryRow = { date: string; amount: number };

function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}
function toIsoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number): Date { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function nextWeekday(date: Date): Date { let next = new Date(date); while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addDays(next, 1); return next; }
export function normalizePaymentDate(exDate: string, payDate?: string | null): string {
  const parsed = parseIsoDate(payDate || "") ?? (parseIsoDate(exDate) ? addDays(parseIsoDate(exDate) as Date, 14) : null);
  return parsed ? toIsoDate(nextWeekday(parsed)) : "";
}

export function buildDeclaredDividendCalendarEvents(ticker: string, rows: DeclaredDividendRow[], sourceKind: CalendarEvent["sourceKind"] = "declared"): CalendarEvent[] {
  const base = buildDividendEventsFromHistory({ ticker, dividends: rows.map((row) => ({ date: row.exDate, amount: row.amount })), sourceKind });
  const payEvents = rows.flatMap((row) => {
    const exDivDate = row.exDate.slice(0, 10);
    const paymentDate = normalizePaymentDate(exDivDate, row.payDate);
    if (!paymentDate) return [];
    const exEvent = base.find((event) => event.type === "ex_div" && event.exDivDate === exDivDate && event.dividendAmount === row.amount);
    return [{
      ...(exEvent ?? base.find((event) => event.exDivDate === exDivDate) ?? base[0]),
      id: `dividend:${normalizeCalendarTicker(ticker)}:pay:${paymentDate}`,
      canonicalEventId: `dividend:${normalizeCalendarTicker(ticker)}:pay:${paymentDate}`,
      legacyEventId: `${normalizeCalendarTicker(ticker)}-pay-${paymentDate}`,
      ticker: normalizeCalendarTicker(ticker),
      type: "pay" as const,
      date: paymentDate,
      status: "confirmed" as const,
      sourceKind,
      exDivDate,
      paymentDate,
      dividendAmount: row.amount,
    } satisfies CalendarEvent];
  });
  const byEx = new Map(rows.map((row) => [row.exDate.slice(0, 10), normalizePaymentDate(row.exDate, row.payDate)]));
  return [...base.map((event) => ({ ...event, paymentDate: byEx.get(event.exDivDate) || event.paymentDate })), ...payEvents].map(normalizeCalendarEventForCache);
}

export function buildProjectedDividendCalendarEvents(ticker: string, history: DividendHistoryRow[], today = new Date()): CalendarEvent[] {
  const frequency = inferDividendFrequency(history.map((row) => row.date));
  return projectEstimatedDividendEvents({ ticker, dividends: history, frequency, today }).map((event) => ({
    ...event,
    paymentDate: normalizePaymentDate(event.exDivDate),
  })).map(normalizeCalendarEventForCache);
}

export function mergeDeclaredAndProjectedEvents(ticker: string, declaredRows: DeclaredDividendRow[], historyRows: DividendHistoryRow[], today = new Date()): CalendarEvent[] {
  const declared = buildDeclaredDividendCalendarEvents(ticker, declaredRows, "declared");
  const projected = buildProjectedDividendCalendarEvents(ticker, historyRows, today);
  const declaredEx = new Set(declared.filter((event) => event.type === "ex_div").map((event) => event.exDivDate));
  const events = [...declared, ...projected.filter((event) => !declaredEx.has(event.exDivDate))];
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

function eventMergeKey(event: CalendarEvent): string {
  return [normalizeCalendarTicker(event.ticker), event.type, (event.exDivDate || event.date).slice(0, 10)].join("|");
}

function isConfirmedDividendEvent(event: CalendarEvent): boolean {
  return event.sourceKind !== "custom" && event.status === "confirmed" && event.sourceKind !== "estimated";
}

function eventPriority(event: CalendarEvent, existingConfirmed: boolean): number {
  if (event.sourceKind === "custom") return 100;
  if (event.status === "confirmed" && event.sourceKind === "declared") return existingConfirmed ? 85 : 95;
  if (event.status === "confirmed") return existingConfirmed ? 80 : 90;
  if (event.sourceKind === "estimated" || event.status === "estimated") return 10;
  return 50;
}

export function mergeFetchedEventsWithExistingCache(existingEvents: CalendarEvent[], fetchedEvents: CalendarEvent[]): CalendarEvent[] {
  const byKey = new Map<string, { event: CalendarEvent; priority: number }>();

  for (const event of existingEvents) {
    if (event.sourceKind === "custom") continue;
    if (!isConfirmedDividendEvent(event)) continue;
    byKey.set(eventMergeKey(event), { event, priority: eventPriority(event, true) });
  }

  for (const event of fetchedEvents) {
    if (event.sourceKind === "custom") continue;
    const key = eventMergeKey(event);
    const candidatePriority = eventPriority(event, false);
    const current = byKey.get(key);
    if (!current || candidatePriority > current.priority) {
      byKey.set(key, { event, priority: candidatePriority });
    }
  }

  return Array.from(byKey.values()).map((entry) => entry.event).sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type));
}

export function buildLiveCalendarCacheEntry(ticker: string, events: CalendarEvent[], source: CalendarTickerCache<CalendarEvent>["source"], warnings: string[] = []) {
  return buildCalendarTickerCacheFromEvents(ticker, events, source, warnings);
}

export function yahooRowsFromQuoteResponse(response: QuoteDividendsResponse): DividendHistoryRow[] {
  return response.dividends.flatMap((row) => {
    const date = row.date?.slice(0, 10);
    const amount = Number(row.amount);
    return date && Number.isFinite(amount) && amount > 0 ? [{ date, amount }] : [];
  });
}
