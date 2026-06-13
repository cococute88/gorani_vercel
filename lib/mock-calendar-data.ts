import { buildGeneratedCalendarEventId, type CalendarEventSourceKind } from "@/lib/calendar-event-identity";
import { calculateExpectedDividendTaxSaving } from "@/lib/tax-saving-calculator";

export type CalendarEventType = "ex_div" | "buy_by" | "pay" | "earnings" | "custom";
export type CalendarEventStatus = "confirmed" | "estimated";
export type CustomMark = "⭐" | "💗" | "⚠" | "※" | "ⓔ";

export interface CalendarEvent {
  id: string;
  canonicalEventId?: string;
  legacyEventId?: string;
  sourceKind?: CalendarEventSourceKind;
  title?: string;
  ticker: string;
  type: CalendarEventType;
  date: string;
  status: CalendarEventStatus;
  dividendAmount: number | null;
  buyDeadline: string;
  exDivDate: string;
  paymentDate: string;
  annualYield: number;
  taxSavingUsd: number;
  favorite?: CustomMark;
  note?: string;
}

export interface TaxSavingRow {
  ticker: string;
  taxSavingUsd: number;
  shouldBuyThisMonth: boolean;
  expectedShares?: number;
  expectedDividendUsd?: number;
  currentPrice?: number | null;
  dividendAmountPerShare?: number | null;
  canCalculate: boolean;
  warnings: string[];
  source?: string;
  isLoading?: boolean;
  eventDate?: string;
  eventType?: CalendarEventType;
}

export type TaxSavingQuoteState = {
  price: number | null;
  warnings?: string[];
  source?: string;
};

export type BuildTaxSavingRowsOptions = {
  quoteByTicker?: Record<string, TaxSavingQuoteState | undefined>;
  loadingTickers?: ReadonlySet<string>;
  todayIso?: string;
};

const PREVIEW_TICKERS = ["SCHD", "JEPI", "VOO", "QQQ", "MSFT", "AAPL", "O", "NVDA"];

const TICKER_PROFILE: Record<string, { amount: number; yield: number; tax: number; mark?: CustomMark }> = {
  SCHD: { amount: 0.28, yield: 3.6, tax: 11.1, mark: "⭐" },
  JEPI: { amount: 0.39, yield: 7.5, tax: 19.3, mark: "💗" },
  VOO: { amount: 1.78, yield: 1.3, tax: 5.0 },
  QQQ: { amount: 0.76, yield: 0.6, tax: 2.3, mark: "⚠" },
  MSFT: { amount: 0.83, yield: 0.7, tax: 2.7, mark: "※" },
  AAPL: { amount: 0.26, yield: 0.5, tax: 1.9 },
  O: { amount: 0.26, yield: 5.4, tax: 13.8, mark: "⭐" },
  NVDA: { amount: 0.01, yield: 0.03, tax: 0.1, mark: "ⓔ" },
};

function iso(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(Math.max(day, 1), lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function eventStatus(year: number, month: number, day: number, index: number): CalendarEventStatus {
  const today = new Date();
  const eventDate = new Date(year, month - 1, day);
  if (eventDate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
    return index % 2 === 0 ? "confirmed" : "estimated";
  }
  return index % 3 === 0 ? "confirmed" : "estimated";
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseDateTime(value: string): number {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compareEventDistance(a: CalendarEvent, b: CalendarEvent, todayMs: number): number {
  const aTime = parseDateTime(a.date);
  const bTime = parseDateTime(b.date);
  const aDistance = Number.isFinite(aTime) ? Math.abs(aTime - todayMs) : Number.POSITIVE_INFINITY;
  const bDistance = Number.isFinite(bTime) ? Math.abs(bTime - todayMs) : Number.POSITIVE_INFINITY;
  return aDistance - bDistance || a.date.localeCompare(b.date) || a.type.localeCompare(b.type);
}

function selectTaxSavingEvent(events: CalendarEvent[], todayIso: string): CalendarEvent | null {
  const dividendEvents = events.filter((event) => event.type !== "custom" && event.type !== "earnings" && isPositiveNumber(event.dividendAmount));
  if (dividendEvents.length === 0) return null;

  const exDivEvents = dividendEvents.filter((event) => event.type === "ex_div");
  const candidates = exDivEvents.length > 0 ? exDivEvents : dividendEvents;
  const upcoming = candidates.filter((event) => event.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  if (upcoming.length > 0) return upcoming[0];

  const todayMs = parseDateTime(todayIso);
  return [...candidates].sort((a, b) => compareEventDistance(a, b, todayMs))[0] ?? null;
}

function makeEvent(
  ticker: string,
  type: CalendarEventType,
  date: string,
  status: CalendarEventStatus,
  buyDeadline: string,
  exDivDate: string,
  paymentDate: string,
): CalendarEvent {
  const profile = TICKER_PROFILE[ticker] ?? { amount: 0.25, yield: 2.1, tax: 4.8 };
  const legacyEventId = `${ticker}-${type}-${date}`;
  const canonicalEventId = buildGeneratedCalendarEventId({
    ticker,
    eventType: type,
    eventDate: date,
    sourceKind: "sample",
  });
  return {
    id: canonicalEventId,
    canonicalEventId,
    legacyEventId,
    sourceKind: "sample",
    ticker,
    type,
    date,
    status,
    dividendAmount: type === "earnings" ? null : profile.amount,
    buyDeadline,
    exDivDate,
    paymentDate,
    annualYield: profile.yield,
    taxSavingUsd: profile.tax,
    favorite: profile.mark,
  };
}

export function buildMockCalendarEvents(year: number, month: number, tickers = PREVIEW_TICKERS): CalendarEvent[] {
  const chosen = tickers.length > 0 ? tickers.slice(0, 8).map((ticker) => ticker.toUpperCase()) : PREVIEW_TICKERS;
  const events: CalendarEvent[] = [];

  chosen.forEach((ticker, index) => {
    const exDay = 5 + ((index * 3) % 18);
    const buyDay = exDay - 1;
    const payDay = exDay + 13;
    const buyDeadline = iso(year, month, buyDay);
    const exDivDate = iso(year, month, exDay);
    const paymentDate = iso(year, month, payDay);
    const status = eventStatus(year, month, exDay, index);

    events.push(makeEvent(ticker, "buy_by", buyDeadline, eventStatus(year, month, buyDay, index + 1), buyDeadline, exDivDate, paymentDate));
    events.push(makeEvent(ticker, "ex_div", exDivDate, status, buyDeadline, exDivDate, paymentDate));
    events.push(makeEvent(ticker, "pay", paymentDate, eventStatus(year, month, payDay, index + 2), buyDeadline, exDivDate, paymentDate));

    if (["MSFT", "AAPL", "NVDA", "QQQ"].includes(ticker) || index === 1) {
      const earningsDay = 11 + ((index * 5) % 15);
      events.push(makeEvent(ticker, "earnings", iso(year, month, earningsDay), eventStatus(year, month, earningsDay, index), buyDeadline, exDivDate, paymentDate));
    }
  });

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
}

export function buildTaxSavingRows(events: CalendarEvent[], options: BuildTaxSavingRowsOptions = {}): TaxSavingRow[] {
  const rows = new Map<string, TaxSavingRow>();
  const eventsByTicker = new Map<string, CalendarEvent[]>();
  const todayIso = options.todayIso ?? todayIsoDate();

  for (const event of events) {
    if (event.sourceKind === "custom" || event.type === "custom") continue;
    const ticker = event.ticker.trim().toUpperCase();
    if (!ticker) continue;
    const current = eventsByTicker.get(ticker) ?? [];
    current.push(event);
    eventsByTicker.set(ticker, current);
  }

  for (const [ticker, tickerEvents] of Array.from(eventsByTicker.entries())) {
    const selectedEvent = selectTaxSavingEvent(tickerEvents, todayIso);
    const quote = options.quoteByTicker?.[ticker];
    const isLoading = options.loadingTickers?.has(ticker) ?? false;
    const dividendAmountPerShare = selectedEvent?.dividendAmount ?? null;
    const currentPrice = quote?.price ?? null;
    const warnings = [
      ...(selectedEvent ? [] : ["No positive dividend event is available for the visible month."]),
      ...(isLoading ? ["Current price is loading."] : []),
      ...(quote?.warnings ?? []),
    ];

    const result = isLoading
      ? {
          canCalculate: false,
          expectedShares: 0,
          expectedDividendUsd: 0,
          taxSavingUsd: 0,
          warnings: [],
        }
      : calculateExpectedDividendTaxSaving({
          currentPrice,
          dividendAmountPerShare,
        });

    rows.set(ticker, {
      ticker,
      taxSavingUsd: result.taxSavingUsd,
      shouldBuyThisMonth: tickerEvents.some((item: CalendarEvent) => item.type === "buy_by"),
      expectedShares: result.expectedShares,
      expectedDividendUsd: result.expectedDividendUsd,
      currentPrice,
      dividendAmountPerShare,
      canCalculate: result.canCalculate,
      warnings: [...warnings, ...result.warnings],
      source: [selectedEvent?.sourceKind, quote?.source].filter(Boolean).join("+") || undefined,
      isLoading,
      eventDate: selectedEvent?.date,
      eventType: selectedEvent?.type,
    });
  }

  return Array.from(rows.values()).sort((a, b) => {
    if (a.canCalculate !== b.canCalculate) return a.canCalculate ? -1 : 1;
    if (a.canCalculate && b.canCalculate) return b.taxSavingUsd - a.taxSavingUsd;
    if (a.isLoading !== b.isLoading) return a.isLoading ? -1 : 1;
    return a.ticker.localeCompare(b.ticker);
  });
}

export const DEFAULT_CALENDAR_FILTERS: Record<CalendarEventType, boolean> = {
  ex_div: true,
  buy_by: true,
  pay: false,
  earnings: true,
  custom: true,
};
