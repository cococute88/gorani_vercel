// Static U.S. high-importance economic calendar.
//
// This mirrors the original Streamlit project, which rendered "주요 미국 경제 일정"
// from a GitHub Actions-generated JSON (`original/data/economic_calendar_us_high.json`,
// see `docs/reference/dividend_calendar.py` → `render_us_economic_calendar_section`).
// Instead of fetching a new external feed (out of scope), we embed a static snapshot
// of that data and split it into this-week / next-week buckets for the UI.

export type EconomicImportance = "high" | "medium" | "low";

export interface EconomicCalendarEvent {
  /** ISO date (yyyy-mm-dd, U.S. event date as published). */
  date: string;
  /** KST time string such as "21:30", or "-" when unknown. */
  time: string;
  /** Korean indicator name. */
  name: string;
  importance: EconomicImportance;
}

export interface EconomicCalendarWeek {
  /** Display label such as "이번주" / "다음주". */
  label: string;
  /** Date range label such as "6/14 ~ 6/20". */
  rangeLabel: string;
  startIso: string;
  endIso: string;
  events: EconomicCalendarEvent[];
}

export interface EconomicCalendarWeeks {
  thisWeek: EconomicCalendarWeek;
  nextWeek: EconomicCalendarWeek;
  /** ISO timestamp of the underlying snapshot. */
  updatedAt: string;
  source: "static";
}

/** Timestamp of the embedded snapshot (from the original investing.com export). */
export const ECONOMIC_CALENDAR_UPDATED_AT = "2026-06-12T08:13:16+09:00";

// Snapshot of the original `economic_calendar_us_high.json` events. A few clearly
// secondary indicators are tagged "medium" for visual variety; the headline
// indicators (CPI/FOMC/PCE/GDP/payrolls) stay "high".
export const STATIC_US_ECONOMIC_EVENTS: EconomicCalendarEvent[] = [
  { date: "2026-06-17", time: "21:30", name: "근원 소매판매 (MoM)", importance: "high" },
  { date: "2026-06-17", time: "21:30", name: "소매판매 (MoM)", importance: "high" },
  { date: "2026-06-17", time: "23:30", name: "원유재고", importance: "medium" },
  { date: "2026-06-18", time: "03:00", name: "FOMC 금리결정", importance: "high" },
  { date: "2026-06-18", time: "03:00", name: "FOMC 성명서", importance: "high" },
  { date: "2026-06-18", time: "03:30", name: "FOMC 기자회견", importance: "high" },
  { date: "2026-06-18", time: "21:30", name: "신규 실업수당 청구건수", importance: "high" },
  { date: "2026-06-18", time: "21:30", name: "필라델피아 연은 제조업지수", importance: "medium" },
  { date: "2026-06-23", time: "22:45", name: "S&P 글로벌 제조업 PMI", importance: "high" },
  { date: "2026-06-23", time: "22:45", name: "S&P 글로벌 서비스업 PMI", importance: "high" },
  { date: "2026-06-24", time: "23:00", name: "신규주택 판매", importance: "medium" },
  { date: "2026-06-25", time: "21:30", name: "근원 PCE 물가지수 (MoM)", importance: "high" },
  { date: "2026-06-25", time: "21:30", name: "근원 PCE 물가지수 (YoY)", importance: "high" },
  { date: "2026-06-25", time: "21:30", name: "내구재 주문 (MoM)", importance: "medium" },
  { date: "2026-06-25", time: "21:30", name: "GDP (QoQ)", importance: "high" },
  { date: "2026-06-30", time: "22:45", name: "시카고 PMI", importance: "medium" },
  { date: "2026-06-30", time: "23:00", name: "CB 소비자신뢰지수", importance: "high" },
  { date: "2026-06-30", time: "23:00", name: "JOLTS 구인건수", importance: "high" },
  { date: "2026-07-01", time: "21:15", name: "ADP 비농업 고용변화", importance: "high" },
  { date: "2026-07-01", time: "23:00", name: "ISM 제조업 PMI", importance: "high" },
  { date: "2026-07-02", time: "21:30", name: "시간당 평균임금 (MoM)", importance: "high" },
  { date: "2026-07-02", time: "21:30", name: "비농업 고용지수", importance: "high" },
  { date: "2026-07-02", time: "21:30", name: "실업률", importance: "high" },
];

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function timeSortKey(time: string): string {
  const match = /(\d{1,2})[:：](\d{2})/.exec(time);
  if (!match) return "99:99";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function sortEvents(events: EconomicCalendarEvent[]): EconomicCalendarEvent[] {
  return [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || timeSortKey(a.time).localeCompare(timeSortKey(b.time)) || a.name.localeCompare(b.name),
  );
}

function rangeLabel(start: Date, end: Date): string {
  return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
}

/** Format an ISO date for the table, e.g. "6/17(수)". */
export function formatEconomicEventDate(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}(${WEEKDAY_LABELS[parsed.getDay()]})`;
}

/** Format the snapshot timestamp into a short "yyyy-mm-dd HH:MM" label. */
export function formatEconomicUpdatedAt(updatedAt: string = ECONOMIC_CALENDAR_UPDATED_AT): string {
  const trimmed = updatedAt.trim();
  if (!trimmed) return "-";
  return trimmed.slice(0, 16).replace("T", " ");
}

/**
 * Split the static economic events into a this-week (today..+6) and a next-week
 * (today+7..+13) bucket, each sorted by date and time. Weeks roll forward from
 * `today` so the section always reflects the upcoming two weeks.
 */
export function splitEconomicEventsByWeek(
  today: Date = new Date(),
  events: EconomicCalendarEvent[] = STATIC_US_ECONOMIC_EVENTS,
): EconomicCalendarWeeks {
  const thisWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextWeekEnd = addDays(thisWeekStart, 13);

  const thisStartIso = toIsoDate(thisWeekStart);
  const thisEndIso = toIsoDate(thisWeekEnd);
  const nextStartIso = toIsoDate(nextWeekStart);
  const nextEndIso = toIsoDate(nextWeekEnd);

  const inRange = (event: EconomicCalendarEvent, startIso: string, endIso: string): boolean =>
    event.date >= startIso && event.date <= endIso;

  return {
    thisWeek: {
      label: "이번주",
      rangeLabel: rangeLabel(thisWeekStart, thisWeekEnd),
      startIso: thisStartIso,
      endIso: thisEndIso,
      events: sortEvents(events.filter((event) => inRange(event, thisStartIso, thisEndIso))),
    },
    nextWeek: {
      label: "다음주",
      rangeLabel: rangeLabel(nextWeekStart, nextWeekEnd),
      startIso: nextStartIso,
      endIso: nextEndIso,
      events: sortEvents(events.filter((event) => inRange(event, nextStartIso, nextEndIso))),
    },
    updatedAt: ECONOMIC_CALENDAR_UPDATED_AT,
    source: "static",
  };
}
