import type { CalendarCustomEvent } from "@/lib/calendar-custom-events";
import { buildCustomCalendarEventId, normalizeCalendarTicker } from "@/lib/calendar-event-identity";
import type { CalendarEvent, CalendarEventStatus, CalendarEventType } from "@/lib/mock-calendar-data";

export const LEGACY_DIVIDEND_IMPORT_SOURCE = "legacy-rtdb-import";
export const LEGACY_DIVIDEND_META_COLLECTION = "legacyDividendCalendarMeta";

export type LegacyDividendEventType = "ex_div" | "buy" | "payment" | "earnings";

export type LegacyDividendEvent = {
  ticker?: unknown;
  event_type?: unknown;
  event_date?: unknown;
  ex_div_date?: unknown;
  payment_date?: unknown;
  buy_deadline?: unknown;
  dividend_amount?: unknown;
  current_price?: unknown;
  annual_yield?: unknown;
  estimated?: unknown;
  is_etf?: unknown;
  [key: string]: unknown;
};

export type LegacyDividendCalendarRoot = {
  dividend_calendar?: {
    _last_sync?: unknown;
    cached_events?: unknown;
    custom_ce?: unknown;
    marks?: unknown;
    memos?: unknown;
    portfolios?: unknown;
  };
};

export type LegacyCalendarMark = {
  heart?: boolean;
  star?: boolean;
};

export type LegacyImportedCalendarEvent = CalendarEvent & {
  eventType: CalendarEventType;
  eventDate: string;
  source: typeof LEGACY_DIVIDEND_IMPORT_SOURCE;
  legacyId: string;
  legacyPayload: Record<string, unknown>;
  legacyMarks?: LegacyCalendarMark;
  currentPrice?: number | null;
  isEtf?: boolean;
};

export type LegacyCalendarEventDoc = LegacyImportedCalendarEvent | LegacyImportedCustomCalendarEventDoc;

export type LegacyImportedCustomCalendarEventDoc = CalendarCustomEvent & {
  ticker: string;
  status: CalendarEventStatus;
  dividendAmount: null;
  buyDeadline: "";
  exDivDate: string;
  paymentDate: "";
  annualYield: 0;
  taxSavingUsd: 0;
  source: typeof LEGACY_DIVIDEND_IMPORT_SOURCE;
  eventType: "custom";
  eventDate: string;
  legacyId: string;
  legacyPayload: Record<string, unknown>;
};

export type LegacyDividendCalendarMetaDoc = {
  source: typeof LEGACY_DIVIDEND_IMPORT_SOURCE;
  legacyLastSync?: string;
  importedFrom: "dividend_calendar.memos" | "dividend_calendar.portfolios";
  items: Record<string, unknown>;
};

export type LegacyDividendCalendarImportPlan = {
  legacyLastSync?: string;
  calendarEventDocs: LegacyCalendarEventDoc[];
  customCalendarEvents: CalendarCustomEvent[];
  memosDoc: LegacyDividendCalendarMetaDoc | null;
  portfoliosDoc: LegacyDividendCalendarMetaDoc | null;
  excludedEvents: Array<{ ticker: string; eventType: string; eventDate: string; reason: string }>;
  stats: {
    totalTickerCount: number;
    cachedEventCount: number;
    importableEventCount: number;
    excludedEventCount: number;
    excludedPlaceholderEventCount: number;
    customEventCount: number;
    marksCount: number;
    memosCount: number;
    portfoliosCount: number;
    duplicateInputEventCount: number;
    estimatedFirestoreWriteCount: number;
  };
};

const LEGACY_EVENT_TYPE_TO_CURRENT: Record<LegacyDividendEventType, CalendarEventType> = {
  ex_div: "ex_div",
  buy: "buy_by",
  payment: "pay",
  earnings: "earnings",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function sanitizeDocIdSegment(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeIsoDate(value: unknown): string {
  return toStringOrEmpty(value).slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

export function isLegacyPlaceholderDate(value: string): boolean {
  if (!isValidIsoDate(value)) return true;
  const year = Number(value.slice(0, 4));
  return value === "2999-12-31" || year >= 2100;
}

function normalizeLegacyEventType(value: unknown): LegacyDividendEventType | null {
  const normalized = toStringOrEmpty(value).toLowerCase();
  return normalized === "ex_div" || normalized === "buy" || normalized === "payment" || normalized === "earnings"
    ? normalized
    : null;
}

function buildLegacyCachedEventId(ticker: string, eventType: CalendarEventType, eventDate: string): string {
  return `legacy_${sanitizeDocIdSegment(ticker)}_${sanitizeDocIdSegment(eventType)}_${sanitizeDocIdSegment(eventDate)}`;
}

function buildLegacyCustomEventRawId(date: string, title: string, symbol: string): string {
  return `legacy_custom_${sanitizeDocIdSegment(date)}_${stableHash(`${title}|${symbol}`)}`;
}

function readCachedEvents(value: unknown): Map<string, LegacyDividendEvent[]> {
  const out = new Map<string, LegacyDividendEvent[]>();
  if (!isRecord(value)) return out;

  for (const [rawTicker, rawEvents] of Object.entries(value)) {
    if (!Array.isArray(rawEvents)) continue;
    const ticker = normalizeCalendarTicker(rawTicker);
    if (!ticker) continue;
    out.set(ticker, rawEvents.filter(isRecord) as LegacyDividendEvent[]);
  }
  return out;
}

function readMarks(value: unknown): Map<string, LegacyCalendarMark> {
  const out = new Map<string, LegacyCalendarMark>();
  if (!isRecord(value)) return out;
  for (const [key, rawMark] of Object.entries(value)) {
    if (!isRecord(rawMark)) continue;
    out.set(key, { heart: rawMark.heart === true, star: rawMark.star === true });
  }
  return out;
}

function readMemos(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(value)) return out;
  for (const [rawTicker, rawMemo] of Object.entries(value)) {
    const ticker = normalizeCalendarTicker(rawTicker);
    const memo = toStringOrEmpty(rawMemo);
    if (ticker && memo) out[ticker] = memo;
  }
  return out;
}

function readPortfolios(value: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!isRecord(value)) return out;
  for (const [name, rawTickers] of Object.entries(value)) {
    if (!Array.isArray(rawTickers)) continue;
    const tickers = rawTickers.map((item) => normalizeCalendarTicker(String(item))).filter(Boolean);
    out[name] = Array.from(new Set(tickers));
  }
  return out;
}

function readCustomEvents(value: unknown): LegacyImportedCustomCalendarEventDoc[] {
  if (!isRecord(value)) return [];
  const out: LegacyImportedCustomCalendarEventDoc[] = [];
  const now = new Date().toISOString();

  for (const [rawDate, rawEvent] of Object.entries(value)) {
    const date = normalizeIsoDate(rawDate);
    if (isLegacyPlaceholderDate(date)) continue;
    if (!isRecord(rawEvent)) continue;

    const title = toStringOrEmpty(rawEvent.name);
    if (!title) continue;
    const ticker = normalizeCalendarTicker(toStringOrEmpty(rawEvent.symbol)) || "CUSTOM";
    const rawId = buildLegacyCustomEventRawId(date, title, ticker);
    const id = buildCustomCalendarEventId(rawId);
    out.push({
      id,
      canonicalEventId: id,
      sourceKind: "custom",
      title,
      date,
      type: "custom",
      eventType: "custom",
      ticker,
      eventDate: date,
      status: "confirmed",
      dividendAmount: null,
      buyDeadline: "",
      exDivDate: date,
      paymentDate: "",
      annualYield: 0,
      taxSavingUsd: 0,
      source: LEGACY_DIVIDEND_IMPORT_SOURCE,
      legacyId: rawId,
      legacyPayload: { date, name: title, symbol: ticker },
      createdAt: now,
      updatedAt: now,
    });
  }

  return out;
}

function getCalendarDateForLegacyEvent(event: LegacyDividendEvent): string {
  const eventDate = normalizeIsoDate(event.event_date);
  if (eventDate) return eventDate;

  const eventType = normalizeLegacyEventType(event.event_type);
  if (eventType === "ex_div") return normalizeIsoDate(event.ex_div_date);
  if (eventType === "payment") return normalizeIsoDate(event.payment_date);
  if (eventType === "buy") return normalizeIsoDate(event.buy_deadline);
  return "";
}

function eventTitle(ticker: string, eventType: CalendarEventType): string {
  if (eventType === "custom") return ticker;
  return ticker;
}

export function buildLegacyDividendCalendarImportPlan(raw: unknown): LegacyDividendCalendarImportPlan {
  const root = raw as LegacyDividendCalendarRoot;
  const calendar = root.dividend_calendar;
  if (!isRecord(calendar)) {
    throw new Error("dividend_calendar object was not found in the uploaded JSON.");
  }

  const legacyLastSync = toStringOrEmpty(calendar._last_sync) || undefined;
  const cachedEvents = readCachedEvents(calendar.cached_events);
  const marks = readMarks(calendar.marks);
  const memos = readMemos(calendar.memos);
  const portfolios = readPortfolios(calendar.portfolios);
  const customEventDocs = readCustomEvents(calendar.custom_ce);
  const eventDocsById = new Map<string, LegacyCalendarEventDoc>();
  const excludedEvents: LegacyDividendCalendarImportPlan["excludedEvents"] = [];
  let cachedEventCount = 0;
  let placeholderExcluded = 0;
  let duplicateInputEventCount = 0;

  for (const [tickerFromBucket, events] of Array.from(cachedEvents.entries())) {
    for (const legacyEvent of events) {
      cachedEventCount += 1;
      const ticker = normalizeCalendarTicker(toStringOrEmpty(legacyEvent.ticker)) || tickerFromBucket;
      const legacyType = normalizeLegacyEventType(legacyEvent.event_type);
      const eventDate = getCalendarDateForLegacyEvent(legacyEvent);

      if (!legacyType || !ticker) {
        excludedEvents.push({ ticker, eventType: toStringOrEmpty(legacyEvent.event_type), eventDate, reason: "unsupported event type or empty ticker" });
        continue;
      }

      if (isLegacyPlaceholderDate(eventDate)) {
        placeholderExcluded += 1;
        excludedEvents.push({ ticker, eventType: legacyType, eventDate, reason: "placeholder, after 2100, or invalid date" });
        continue;
      }

      const eventType = LEGACY_EVENT_TYPE_TO_CURRENT[legacyType];
      const id = buildLegacyCachedEventId(ticker, eventType, eventDate);
      if (eventDocsById.has(id)) duplicateInputEventCount += 1;

      const buyDeadline = normalizeIsoDate(legacyEvent.buy_deadline);
      const exDivDate = normalizeIsoDate(legacyEvent.ex_div_date);
      const paymentDate = normalizeIsoDate(legacyEvent.payment_date);
      const dividendAmount = toNumberOrNull(legacyEvent.dividend_amount);
      const currentPrice = toNumberOrNull(legacyEvent.current_price);
      const annualYield = toNumberOrNull(legacyEvent.annual_yield);
      const legacyId = `${ticker}-${legacyType}-${eventDate}`;
      const mark = marks.get(legacyId);
      const status: CalendarEventStatus = toBoolean(legacyEvent.estimated) ? "estimated" : "confirmed";
      const payload: Record<string, unknown> = { ...legacyEvent };

      eventDocsById.set(id, {
        id,
        canonicalEventId: id,
        legacyEventId: legacyId,
        legacyId,
        sourceKind: status === "estimated" ? "estimated" : "declared",
        source: LEGACY_DIVIDEND_IMPORT_SOURCE,
        title: eventTitle(ticker, eventType),
        ticker,
        type: eventType,
        eventType,
        date: eventDate,
        eventDate,
        status,
        dividendAmount,
        buyDeadline,
        exDivDate,
        paymentDate,
        annualYield: annualYield ?? 0,
        taxSavingUsd: 0,
        currentPrice,
        isEtf: toBoolean(legacyEvent.is_etf),
        ...(mark ? { star: mark.star, heart: mark.heart, legacyMarks: mark } : {}),
        legacyPayload: payload,
      });
    }
  }

  for (const customEvent of customEventDocs) {
    if (eventDocsById.has(customEvent.id)) duplicateInputEventCount += 1;
    eventDocsById.set(customEvent.id, customEvent);
  }

  const memosDoc: LegacyDividendCalendarMetaDoc | null = Object.keys(memos).length > 0
    ? {
        source: LEGACY_DIVIDEND_IMPORT_SOURCE,
        legacyLastSync,
        importedFrom: "dividend_calendar.memos" as const,
        items: memos,
      }
    : null;

  const portfoliosDoc: LegacyDividendCalendarMetaDoc | null = Object.keys(portfolios).length > 0
    ? {
        source: LEGACY_DIVIDEND_IMPORT_SOURCE,
        legacyLastSync,
        importedFrom: "dividend_calendar.portfolios" as const,
        items: portfolios,
      }
    : null;

  const calendarEventDocs = Array.from(eventDocsById.values()).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const customCalendarEvents = customEventDocs.map(({ status: _status, dividendAmount: _dividendAmount, buyDeadline: _buyDeadline, exDivDate: _exDivDate, paymentDate: _paymentDate, annualYield: _annualYield, taxSavingUsd: _taxSavingUsd, source: _source, legacyId: _legacyId, legacyPayload: _legacyPayload, ...event }) => event);
  const metaWriteCount = (memosDoc ? 1 : 0) + (portfoliosDoc ? 1 : 0);

  return {
    legacyLastSync,
    calendarEventDocs,
    customCalendarEvents,
    memosDoc,
    portfoliosDoc,
    excludedEvents,
    stats: {
      totalTickerCount: cachedEvents.size,
      cachedEventCount,
      importableEventCount: calendarEventDocs.length,
      excludedEventCount: excludedEvents.length,
      excludedPlaceholderEventCount: placeholderExcluded,
      customEventCount: customCalendarEvents.length,
      marksCount: marks.size,
      memosCount: Object.keys(memos).length,
      portfoliosCount: Object.keys(portfolios).length,
      duplicateInputEventCount,
      estimatedFirestoreWriteCount: calendarEventDocs.length + customCalendarEvents.length + metaWriteCount,
    },
  };
}

export function normalizeLegacyImportedCalendarEventDoc(raw: unknown): LegacyImportedCalendarEvent | null {
  if (!isRecord(raw)) return null;
  if (raw.source !== LEGACY_DIVIDEND_IMPORT_SOURCE) return null;
  if (raw.type === "custom") return null;

  const ticker = normalizeCalendarTicker(toStringOrEmpty(raw.ticker));
  const type = raw.type;
  const date = normalizeIsoDate(raw.date);
  const id = toStringOrEmpty(raw.id) || toStringOrEmpty(raw.canonicalEventId);
  if (!ticker || !id || !isValidIsoDate(date)) return null;
  if (type !== "ex_div" && type !== "buy_by" && type !== "pay" && type !== "earnings") return null;

  return {
    id,
    canonicalEventId: id,
    legacyEventId: toStringOrEmpty(raw.legacyEventId) || toStringOrEmpty(raw.legacyId) || undefined,
    legacyId: toStringOrEmpty(raw.legacyId) || id,
    sourceKind: raw.sourceKind === "estimated" ? "estimated" : "declared",
    source: LEGACY_DIVIDEND_IMPORT_SOURCE,
    title: toStringOrEmpty(raw.title) || ticker,
    ticker,
    type,
    eventType: type,
    date,
    eventDate: date,
    status: raw.status === "estimated" ? "estimated" : "confirmed",
    dividendAmount: toNumberOrNull(raw.dividendAmount),
    buyDeadline: normalizeIsoDate(raw.buyDeadline),
    exDivDate: normalizeIsoDate(raw.exDivDate),
    paymentDate: normalizeIsoDate(raw.paymentDate),
    annualYield: toNumberOrNull(raw.annualYield) ?? 0,
    taxSavingUsd: toNumberOrNull(raw.taxSavingUsd) ?? 0,
    currentPrice: toNumberOrNull(raw.currentPrice),
    isEtf: toBoolean(raw.isEtf),
    ...(raw.star === true ? { favorite: "??" as CalendarEvent["favorite"] } : raw.heart === true ? { favorite: "??" as CalendarEvent["favorite"] } : {}),
    ...(isRecord(raw.legacyMarks) ? { legacyMarks: { star: raw.legacyMarks.star === true, heart: raw.legacyMarks.heart === true } } : {}),
    legacyPayload: isRecord(raw.legacyPayload) ? raw.legacyPayload : {},
  };
}
