export type CalendarEventSourceKind = "declared" | "estimated" | "custom" | "economic" | "sample";

export type GeneratedCalendarEventSourceKind = Extract<CalendarEventSourceKind, "declared" | "estimated" | "sample">;

export type CalendarEventMetaTarget = {
  eventId: string;
  canonicalEventId?: string;
};

export type CalendarTickerCacheSource = "mock" | "yahoo" | "finnhub" | "polygon" | "partial" | "sample" | "cache";

export type CalendarTickerCache<TEvent = Record<string, unknown>> = {
  ticker: string;
  events: TEvent[];
  fetchedAt: string;
  expiresAt: string;
  source: CalendarTickerCacheSource;
  warnings: string[];
  schemaVersion: number;
};

export type GeneratedCalendarEventIdInput = {
  ticker: string;
  eventType: string;
  eventDate: string;
  sourceKind?: GeneratedCalendarEventSourceKind;
  amount?: number | string | null;
  exDivDate?: string | null;
  paymentDate?: string | null;
  buyDeadline?: string | null;
};

export type CustomCalendarEventIdInput = {
  idOrUuid: string;
};

export type EconomicCalendarEventIdInput = {
  date: string;
  title: string;
};

export type CanonicalCalendarEventLike = {
  id?: string;
  ticker?: string;
  type?: string;
  eventType?: string;
  date?: string;
  eventDate?: string;
  sourceKind?: CalendarEventSourceKind;
  customId?: string;
  uuid?: string;
  title?: string;
  name?: string;
};

const EVENT_TYPE_ALIASES: Record<string, string> = {
  buy_by: "buy",
  buyby: "buy",
  "buy-by": "buy",
  buy_deadline: "buy",
  payment: "payment",
  pay: "payment",
  exdiv: "ex_div",
  "ex-div": "ex_div",
  ex_dividend: "ex_div",
};

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function normalizeDateSegment(value: string): string {
  return value.trim().slice(0, 10);
}

function normalizeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCalendarTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9._-]+/g, "");
}

export function normalizeCalendarEventType(eventType: string): string {
  const normalized = eventType.trim().toLowerCase().replace(/\s+/g, "_");
  return EVENT_TYPE_ALIASES[normalized] ?? normalized;
}

export function normalizeCalendarAmount(amount: number | string | null | undefined): string | undefined {
  if (amount == null || amount === "") return undefined;
  const numeric = typeof amount === "number" ? amount : Number(String(amount).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric)) return undefined;
  return numeric.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildGeneratedCalendarEventId(input: GeneratedCalendarEventIdInput): string {
  const ticker = normalizeCalendarTicker(input.ticker);
  const eventType = normalizeCalendarEventType(input.eventType);
  const eventDate = normalizeDateSegment(input.eventDate);

  if (!ticker || !eventType || !eventDate) {
    throw new Error("ticker, eventType, and eventDate are required to build a generated calendar event id");
  }

  return `dividend:${ticker}:${eventType}:${eventDate}`;
}

export function buildCustomCalendarEventId(idOrUuid: string): string {
  const raw = idOrUuid.trim();
  const normalized = raw.toLowerCase().startsWith("custom:") ? normalizeIdSegment(raw.slice("custom:".length)) : normalizeIdSegment(raw);
  if (!normalized) throw new Error("idOrUuid is required to build a custom calendar event id");
  return `custom:${normalized}`;
}

export function buildEconomicCalendarEventId(input: EconomicCalendarEventIdInput): string {
  const date = normalizeDateSegment(input.date);
  const title = input.title.trim().toLowerCase().replace(/\s+/g, " ");
  if (!date || !title) throw new Error("date and title are required to build an economic calendar event id");
  return `economic:${date}:${stableHash(title)}`;
}

export function getCanonicalCalendarEventId(event: CanonicalCalendarEventLike): string {
  if (event.sourceKind === "custom" || event.customId || event.uuid) {
    return buildCustomCalendarEventId(event.customId ?? event.uuid ?? event.id ?? "");
  }

  if (event.sourceKind === "economic") {
    return buildEconomicCalendarEventId({
      date: event.date ?? event.eventDate ?? "",
      title: event.title ?? event.name ?? event.id ?? "",
    });
  }

  if ((event.ticker && (event.type || event.eventType) && (event.date || event.eventDate))) {
    return buildGeneratedCalendarEventId({
      ticker: event.ticker,
      eventType: event.type ?? event.eventType ?? "",
      eventDate: event.date ?? event.eventDate ?? "",
      sourceKind: event.sourceKind === "sample" ? "sample" : undefined,
    });
  }

  if (event.id) return event.id;
  throw new Error("calendar event does not contain enough identity fields");
}
