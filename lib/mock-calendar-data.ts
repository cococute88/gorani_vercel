export type CalendarEventType = "ex_div" | "buy_by" | "pay" | "earnings";
export type CalendarEventStatus = "confirmed" | "estimated";
export type CustomMark = "⭐" | "💗" | "⚠" | "※" | "ⓔ";

export interface CalendarEvent {
  id: string;
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
}

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
  return {
    id: `${ticker}-${type}-${date}`,
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

export function buildTaxSavingRows(events: CalendarEvent[]): TaxSavingRow[] {
  const rows = new Map<string, TaxSavingRow>();
  for (const event of events) {
    if (!rows.has(event.ticker)) {
      rows.set(event.ticker, {
        ticker: event.ticker,
        taxSavingUsd: event.taxSavingUsd,
        shouldBuyThisMonth: events.some((item) => item.ticker === event.ticker && item.type === "buy_by"),
      });
    }
  }
  return Array.from(rows.values()).sort((a, b) => b.taxSavingUsd - a.taxSavingUsd);
}

export const DEFAULT_CALENDAR_FILTERS: Record<CalendarEventType, boolean> = {
  ex_div: true,
  buy_by: true,
  pay: false,
  earnings: true,
};
