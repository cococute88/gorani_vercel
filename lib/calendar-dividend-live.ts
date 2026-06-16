import { buildGeneratedCalendarEventId, normalizeCalendarTicker } from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

export type ProviderStatusValue = "ok" | "missing_key" | "rate_limited" | "failed" | "skipped";
export type DividendLiveProviderStatus = { yahoo?: ProviderStatusValue; finnhub?: ProviderStatusValue; polygon?: ProviderStatusValue };
export type DividendLiveSource = "live" | "partial" | "unavailable";
export type DividendLiveApiResponse = {
  ticker: string;
  source: DividendLiveSource;
  events: CalendarEvent[];
  failedReason?: string;
  updatedAt: string;
  providerStatus: DividendLiveProviderStatus;
  warnings: string[];
  rateLimitDelayMs?: number;
};

export type DividendHistoryRow = { exDate: string; amount: number; paymentDate?: string | null; declaredDate?: string | null; source?: string };
export type DividendFrequency = "monthly" | "quarterly" | "semiannual" | "annual";
export type DividendFrequencyInference = { frequency: DividendFrequency | null; medianIntervalDays: number | null; months: number | null; warnings: string[] };

const MS_PER_DAY = 86_400_000;
const PROJECTION_MONTHS = 12;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next;
}

export function getNextTradingDay(date: string | Date): string {
  let next = typeof date === "string" ? parseDate(date) : new Date(date);
  if (!next) throw new Error("valid date required");
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addDays(next, 1);
  return toIsoDate(next);
}

export function getPrevTradingDay(date: string | Date): string {
  let next = typeof date === "string" ? parseDate(date) : new Date(date);
  if (!next) throw new Error("valid date required");
  next = addDays(next, -1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addDays(next, -1);
  return toIsoDate(next);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function inferDividendFrequency(rows: DividendHistoryRow[]): DividendFrequencyInference {
  const dates = rows.map((r) => parseDate(r.exDate)).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < 3) return { frequency: null, medianIntervalDays: null, months: null, warnings: ["At least 3 historical dividend dates are required for projection."] };
  const intervals = dates.slice(1).map((d, i) => Math.round((d.getTime() - dates[i].getTime()) / MS_PER_DAY)).filter((d) => d > 0);
  const days = median(intervals);
  if (!days) return { frequency: null, medianIntervalDays: null, months: null, warnings: ["Dividend interval inference failed."] };
  if (days <= 45) return { frequency: "monthly", medianIntervalDays: days, months: 1, warnings: [] };
  if (days <= 120) return { frequency: "quarterly", medianIntervalDays: days, months: 3, warnings: [] };
  if (days <= 210) return { frequency: "semiannual", medianIntervalDays: days, months: 6, warnings: [] };
  return { frequency: "annual", medianIntervalDays: days, months: 12, warnings: [] };
}

function event(ticker: string, type: CalendarEvent["type"], date: string, status: CalendarEvent["status"], amount: number | null, exDivDate: string, paymentDate: string, sourceKind: CalendarEvent["sourceKind"]): CalendarEvent {
  const canonicalEventId = buildGeneratedCalendarEventId({ ticker, eventType: type, eventDate: date, sourceKind: sourceKind === "estimated" ? "estimated" : "declared" });
  return { id: canonicalEventId, canonicalEventId, legacyEventId: `${ticker}-${type}-${date}`, sourceKind, ticker, type, date, status, dividendAmount: amount, buyDeadline: getPrevTradingDay(exDivDate), exDivDate, paymentDate, annualYield: 0, taxSavingUsd: 0 };
}

export function normalizeDividendEvents(tickerRaw: string, rows: DividendHistoryRow[]): CalendarEvent[] {
  const ticker = normalizeCalendarTicker(tickerRaw);
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const parsed = parseDate(row.exDate);
    if (!ticker || !parsed || !(row.amount > 0)) continue;
    const exDivDate = getNextTradingDay(parsed);
    const paymentDate = row.paymentDate ? getNextTradingDay(row.paymentDate) : getNextTradingDay(addDays(parseDate(exDivDate)!, 14));
    for (const item of [
      event(ticker, "buy_by", getPrevTradingDay(exDivDate), "confirmed", row.amount, exDivDate, paymentDate, "declared"),
      event(ticker, "ex_div", exDivDate, "confirmed", row.amount, exDivDate, paymentDate, "declared"),
      event(ticker, "pay", paymentDate, "confirmed", row.amount, exDivDate, paymentDate, "declared"),
    ]) if (!seen.has(item.id)) { seen.add(item.id); events.push(item); }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

export function projectFutureDividends(tickerRaw: string, rows: DividendHistoryRow[], today = new Date()): CalendarEvent[] {
  const ticker = normalizeCalendarTicker(tickerRaw);
  const frequency = inferDividendFrequency(rows);
  if (!ticker || !frequency.months) return [];
  const sorted = rows.map((r) => ({ ...r, parsed: parseDate(r.exDate) })).filter((r): r is DividendHistoryRow & { parsed: Date } => Boolean(r.parsed)).sort((a, b) => a.parsed.getTime() - b.parsed.getTime());
  const latest = sorted.at(-1);
  if (!latest) return [];
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = addMonths(todayStart, PROJECTION_MONTHS);
  const events: CalendarEvent[] = [];
  let ex = addMonths(latest.parsed, frequency.months);
  let guard = 0;
  while (ex < todayStart && guard++ < 36) ex = addMonths(ex, frequency.months);
  while (ex <= end && guard++ < 72) {
    const exDivDate = getNextTradingDay(ex);
    const paymentDate = getNextTradingDay(addDays(parseDate(exDivDate)!, 14));
    events.push(event(ticker, "buy_by", getPrevTradingDay(exDivDate), "estimated", latest.amount, exDivDate, paymentDate, "estimated"));
    events.push(event(ticker, "ex_div", exDivDate, "estimated", latest.amount, exDivDate, paymentDate, "estimated"));
    events.push(event(ticker, "pay", paymentDate, "estimated", latest.amount, exDivDate, paymentDate, "estimated"));
    ex = addMonths(ex, frequency.months);
  }
  return events;
}
