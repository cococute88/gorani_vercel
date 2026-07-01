import { buildCalendarTickerCacheFromEvents, buildDividendEventsFromHistory, inferDividendFrequency, normalizeCalendarEventForCache, projectEstimatedDividendEvents } from "@/lib/calendar-event-provider";
import { normalizeCalendarTicker, type CalendarTickerCache } from "@/lib/calendar-event-identity";
import { nextUsTradingDayOnOrAfterIso } from "@/lib/us-market-calendar";
import type { CalendarEvent } from "@/lib/mock-calendar-data";
import type { QuoteDividendsResponse } from "@/lib/quote-types";

export type DividendLiveSource = "live" | "partial" | "unavailable";
export type ProviderStatus = {
  yahoo?: "ok" | "failed" | "sample_fallback";
  finnhub?: "ok" | "missing_key" | "failed";
  polygon?: "ok" | "missing_key" | "unauthorized" | "forbidden" | "rate_limited" | "network_error" | "server_error" | "failed";
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
  failureCategory?: "missing_key" | "unauthorized" | "forbidden" | "rate_limited" | "network_error" | "server_error" | "failed";
};
export type DeclaredDividendRow = { exDate: string; amount: number; payDate?: string | null };
export type DividendHistoryRow = { date: string; amount: number };

function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}
function toIsoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number): Date { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
export function normalizePaymentDate(exDate: string, payDate?: string | null): string {
  // A provider-declared payment date is authoritative and confirmed — return it
  // verbatim (date only) without any weekend/holiday shifting.
  const declared = parseIsoDate(payDate || "");
  if (declared) return toIsoDate(declared);
  // Otherwise derive a provisional payment date (ex + 14 days) and snap it to
  // the next U.S. trading day so a derived date never lands on a closed market.
  const exParsed = parseIsoDate(exDate);
  if (!exParsed) return "";
  return nextUsTradingDayOnOrAfterIso(toIsoDate(addDays(exParsed, 14)));
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

// Merge dividend history rows from multiple confirmed sources (Yahoo history +
// declared Polygon/Finnhub ex-dates) into a single, date-sorted, deduplicated
// series. Declared rows are layered last so a declared cash amount wins when the
// same ex-date also exists in the Yahoo history.
function dedupeDividendHistoryByDate(rows: DividendHistoryRow[]): DividendHistoryRow[] {
  const byDate = new Map<string, DividendHistoryRow>();
  for (const row of rows) {
    const date = row.date?.slice(0, 10);
    const amount = Number(row.amount);
    if (!date || !Number.isFinite(amount) || amount <= 0) continue;
    byDate.set(date, { date, amount });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Restrict a (possibly Yahoo-enriched) history series so its LATEST point can
// never be later than the last confirmed declared (Polygon) ex-date. This keeps
// the projection seed pinned to Polygon's confirmed data even when older Yahoo
// rows are borrowed purely to infer cadence.
function capHistoryToLastDeclared(rows: DividendHistoryRow[], lastDeclaredDate: string): DividendHistoryRow[] {
  return rows.filter((row) => row.date <= lastDeclaredDate);
}

export function mergeDeclaredAndProjectedEvents(ticker: string, declaredRows: DeclaredDividendRow[], historyRows: DividendHistoryRow[], today = new Date()): CalendarEvent[] {
  const declared = buildDeclaredDividendCalendarEvents(ticker, declaredRows, "declared");

  // --- Streamlit parity: Polygon-declared data is the SINGLE SOURCE OF TRUTH ---
  // In original/modules/dividend_calendar.py the projection seed (`last_ex_div`)
  // and cadence come from the CONFIRMED declared series (Polygon on refresh), and
  // the estimated projection steps strictly forward from that last KNOWN date.
  // We reproduce that here: whenever declared (Polygon) rows exist, the projection
  // is seeded ONLY from them — Yahoo history is never allowed to advance the seed
  // date or fabricate a future beyond what Polygon confirms. Yahoo is used only as
  // a cadence aid when Polygon alone is too short, and as a complete fallback for
  // initial/preview display when there is no declared data at all (no Polygon key).
  const declaredHistory = dedupeDividendHistoryByDate(
    declaredRows.map((row) => ({ date: row.exDate.slice(0, 10), amount: row.amount })),
  );

  let projectionHistory: DividendHistoryRow[];
  if (declaredHistory.length >= 3) {
    // Normal refresh path: pure Polygon SSOT (seed + amount + cadence).
    projectionHistory = declaredHistory;
  } else if (declaredHistory.length >= 1) {
    // Polygon returned too few rows to infer cadence on its own: borrow older
    // cadence points from Yahoo, but pin the seed to the last declared ex-date.
    const lastDeclaredDate = declaredHistory[declaredHistory.length - 1].date;
    projectionHistory = capHistoryToLastDeclared(
      dedupeDividendHistoryByDate([...historyRows, ...declaredHistory]),
      lastDeclaredDate,
    );
  } else {
    // No declared data (Polygon unavailable) — degrade to Yahoo for fallback only.
    projectionHistory = dedupeDividendHistoryByDate(historyRows);
  }
  const projected = buildProjectedDividendCalendarEvents(ticker, projectionHistory, today);

  // Streamlit's `known_ex_dates` guard (original used a fixed < 20 day window):
  // because the projection is now seeded from the confirmed declared series, the
  // first estimate already lands one full period AFTER the last confirmed ex-date,
  // so collisions cannot normally occur. This stays only as a defensive net for
  // boundary cases and never merges two genuinely-distinct dividends.
  const declaredExDates = Array.from(
    new Set(declared.filter((event) => event.type === "ex_div").map((event) => event.exDivDate)),
  )
    .map((iso) => parseIsoDate(iso))
    .filter((date): date is Date => Boolean(date));

  const frequency = inferDividendFrequency(projectionHistory.map((row) => row.date));
  const collisionToleranceDays = frequency.medianIntervalDays
    ? Math.max(7, Math.floor(frequency.medianIntervalDays / 2))
    : 20;
  const toleranceMs = collisionToleranceDays * 86_400_000;

  const collidesWithConfirmed = (event: CalendarEvent): boolean => {
    const exDate = parseIsoDate(event.exDivDate || event.date);
    if (!exDate) return false;
    return declaredExDates.some((declaredDate) => Math.abs(declaredDate.getTime() - exDate.getTime()) <= toleranceMs);
  };

  const events = [...declared, ...projected.filter((event) => !collidesWithConfirmed(event))];
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
