// Rolling U.S. high-importance economic calendar.
//
// This mirrors the original Streamlit project, which rendered "주요 미국 경제 일정"
// from a GitHub Actions-generated JSON (`original/data/economic_calendar_us_high.json`,
// see `docs/reference/dividend_calendar.py` → `render_us_economic_calendar_section`).
// That JSON was refreshed daily, so the section always covered the upcoming weeks.
//
// The first Vercel port embedded a single static snapshot of that JSON. Because the
// snapshot was frozen (its last event was 2026-07-02), the "다음주" bucket emptied out
// as soon as wall-clock time advanced past the snapshot — exactly the reported bug.
//
// To restore the original "always rolling forward" behavior WITHOUT depending on a
// fragile external scrape at request time, the events are now GENERATED from the
// well-known release cadence of each indicator (nth-weekday / nth-business-day rules)
// plus the Federal Reserve's published FOMC meeting schedule. This is fully
// generalized (no hardcoded symptom dates) and is guaranteed to populate this-week
// and next-week for any date. The static snapshot below is retained as a fixture and
// documentation reference.
import { isUsTradingDayIso, previousUsTradingDayIso } from "@/lib/us-market-calendar";

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
  source: "static" | "generated";
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

// ---------------------------------------------------------------------------
// Rolling event generator
// ---------------------------------------------------------------------------

type IndicatorImportance = EconomicImportance;

interface IndicatorSpec {
  /** Resolve the release ISO date for a given month, or null to skip. */
  resolve: (year: number, month1to12: number) => string | null;
  time: string; // KST HH:MM
  names: Array<{ name: string; importance: IndicatorImportance }>;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function ymdIso(year: number, month1to12: number, day: number): string {
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}

function dowOfIso(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).getUTCDay();
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** ISO date for the nth (1-based) weekday of a month, e.g. 1st Friday. */
function nthWeekdayIso(year: number, month1to12: number, weekday: number, nth: number): string {
  const firstDow = dowOfIso(ymdIso(year, month1to12, 1));
  const offset = (weekday - firstDow + 7) % 7;
  return ymdIso(year, month1to12, 1 + offset + (nth - 1) * 7);
}

/** ISO date for the last given weekday of a month, e.g. last Tuesday. */
function lastWeekdayIso(year: number, month1to12: number, weekday: number): string {
  const last = daysInMonth(year, month1to12);
  const lastDow = dowOfIso(ymdIso(year, month1to12, last));
  return ymdIso(year, month1to12, last - ((lastDow - weekday + 7) % 7));
}

/** ISO date for the nth (1-based) trading day of a month. */
function nthBusinessDayIso(year: number, month1to12: number, nth: number): string {
  const last = daysInMonth(year, month1to12);
  let count = 0;
  for (let day = 1; day <= last; day += 1) {
    const iso = ymdIso(year, month1to12, day);
    if (isUsTradingDayIso(iso)) {
      count += 1;
      if (count === nth) return iso;
    }
  }
  return ymdIso(year, month1to12, last);
}

/** ISO date for the last trading day of a month. */
function lastBusinessDayIso(year: number, month1to12: number): string {
  const last = daysInMonth(year, month1to12);
  for (let day = last; day >= 1; day -= 1) {
    const iso = ymdIso(year, month1to12, day);
    if (isUsTradingDayIso(iso)) return iso;
  }
  return ymdIso(year, month1to12, last);
}

/** Snap a fixed calendar day to the nearest weekday (Sat→Fri, Sun→Mon). */
function fixedDayToWeekdayIso(year: number, month1to12: number, day: number): string {
  const clamped = Math.min(day, daysInMonth(year, month1to12));
  const iso = ymdIso(year, month1to12, clamped);
  const dow = dowOfIso(iso);
  if (dow === 6) return ymdIso(year, month1to12, Math.max(1, clamped - 1));
  if (dow === 0) return ymdIso(year, month1to12, Math.min(daysInMonth(year, month1to12), clamped + 1));
  return iso;
}

// Federal Reserve FOMC meeting schedule (second/decision day). Source: the Fed's
// published meeting calendars for 2025–2027. The rate decision + statement are
// released at 14:00 ET, which is 03:00 the next day in KST; the press conference
// follows at 14:30 ET (03:30 KST next day). This is reference data, like the
// market-holiday rules — not a per-symptom hardcode.
const FOMC_DECISION_DAYS_ISO: string[] = [
  "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18", "2025-07-30", "2025-09-17", "2025-10-29", "2025-12-10",
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
  "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-16", "2027-07-28", "2027-09-22", "2027-11-03", "2027-12-15",
];

const MONTHLY_INDICATORS: IndicatorSpec[] = [
  {
    // Employment Situation — 1st Friday.
    resolve: (y, m) => nthWeekdayIso(y, m, 5, 1),
    time: "21:30",
    names: [
      { name: "비농업 고용지수", importance: "high" },
      { name: "실업률", importance: "high" },
      { name: "시간당 평균임금 (MoM)", importance: "high" },
    ],
  },
  {
    // ADP National Employment — Wednesday of the employment-report week (1st Wednesday).
    resolve: (y, m) => nthWeekdayIso(y, m, 3, 1),
    time: "21:15",
    names: [{ name: "ADP 비농업 고용변화", importance: "high" }],
  },
  {
    // ISM Manufacturing PMI — 1st business day.
    resolve: (y, m) => nthBusinessDayIso(y, m, 1),
    time: "23:00",
    names: [{ name: "ISM 제조업 PMI", importance: "high" }],
  },
  {
    // ISM Services PMI — 3rd business day.
    resolve: (y, m) => nthBusinessDayIso(y, m, 3),
    time: "23:00",
    names: [{ name: "ISM 서비스업 PMI", importance: "high" }],
  },
  {
    // JOLTS Job Openings — early month (~5th business day).
    resolve: (y, m) => nthBusinessDayIso(y, m, 5),
    time: "23:00",
    names: [{ name: "JOLTS 구인건수", importance: "high" }],
  },
  {
    // CPI — mid month (~12th).
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 12),
    time: "21:30",
    names: [
      { name: "소비자물가지수 (MoM)", importance: "high" },
      { name: "근원 소비자물가지수 (MoM)", importance: "high" },
    ],
  },
  {
    // PPI — mid month (~13th).
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 13),
    time: "21:30",
    names: [
      { name: "생산자물가지수 (MoM)", importance: "medium" },
      { name: "근원 생산자물가지수 (MoM)", importance: "medium" },
    ],
  },
  {
    // Michigan Consumer Sentiment (prelim) — 2nd Friday.
    resolve: (y, m) => nthWeekdayIso(y, m, 5, 2),
    time: "23:00",
    names: [{ name: "미시간대 소비자심리지수", importance: "medium" }],
  },
  {
    // Retail Sales — mid month (~16th).
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 16),
    time: "21:30",
    names: [
      { name: "소매판매 (MoM)", importance: "high" },
      { name: "근원 소매판매 (MoM)", importance: "high" },
    ],
  },
  {
    // S&P Global Flash PMIs — ~23rd.
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 23),
    time: "22:45",
    names: [
      { name: "S&P 글로벌 제조업 PMI", importance: "medium" },
      { name: "S&P 글로벌 서비스업 PMI", importance: "medium" },
    ],
  },
  {
    // New Home Sales — ~24th.
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 24),
    time: "23:00",
    names: [{ name: "신규주택 판매", importance: "medium" }],
  },
  {
    // Durable Goods Orders — ~26th.
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 26),
    time: "21:30",
    names: [{ name: "내구재 주문 (MoM)", importance: "medium" }],
  },
  {
    // GDP estimate — ~26th.
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 26),
    time: "21:30",
    names: [{ name: "GDP (QoQ)", importance: "high" }],
  },
  {
    // Core PCE Price Index — ~28th.
    resolve: (y, m) => fixedDayToWeekdayIso(y, m, 28),
    time: "21:30",
    names: [
      { name: "근원 PCE 물가지수 (MoM)", importance: "high" },
      { name: "근원 PCE 물가지수 (YoY)", importance: "high" },
    ],
  },
  {
    // CB Consumer Confidence — last Tuesday.
    resolve: (y, m) => lastWeekdayIso(y, m, 2),
    time: "23:00",
    names: [{ name: "CB 소비자신뢰지수", importance: "high" }],
  },
  {
    // Chicago PMI — last business day.
    resolve: (y, m) => lastBusinessDayIso(y, m),
    time: "22:45",
    names: [{ name: "시카고 PMI", importance: "medium" }],
  },
];

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Generate U.S. high-importance economic events for a rolling window around
 * `today`. The window always extends far enough forward to populate this-week
 * and next-week (and the schedule preview), so the section never empties out as
 * time advances. Dates follow each indicator's well-known release cadence; FOMC
 * uses the Fed's published meeting schedule.
 */
export function generateUsEconomicCalendarEvents(
  today: Date = new Date(),
  options: { backDays?: number; horizonDays?: number } = {},
): EconomicCalendarEvent[] {
  const backDays = options.backDays ?? 7;
  const horizonDays = options.horizonDays ?? 30;
  const startIso = addDaysIso(`${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`, -backDays);
  const endIso = addDaysIso(`${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`, horizonDays);

  const inRange = (iso: string) => iso >= startIso && iso <= endIso;
  const events: EconomicCalendarEvent[] = [];

  // Monthly indicators: iterate every month that the window can touch.
  const startMonth = new Date(`${startIso}T00:00:00.000Z`);
  const endMonth = new Date(`${endIso}T00:00:00.000Z`);
  for (
    let cursor = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth(), 1));
    cursor <= endMonth;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    for (const indicator of MONTHLY_INDICATORS) {
      const resolved = indicator.resolve(year, month);
      if (!resolved) continue;
      // Releases never occur on a closed-market day; snap holidays/weekends to
      // the previous trading day (e.g. a 1st-Friday payrolls date that falls on
      // an observed holiday is published the prior business day).
      const date = isUsTradingDayIso(resolved) ? resolved : previousUsTradingDayIso(resolved);
      if (!inRange(date)) continue;
      for (const entry of indicator.names) {
        events.push({ date, time: indicator.time, name: entry.name, importance: entry.importance });
      }
    }
  }

  // FOMC decisions: statement/decision (03:00 KST next day) + press conference (03:30 KST).
  for (const decisionDay of FOMC_DECISION_DAYS_ISO) {
    const announceIso = addDaysIso(decisionDay, 1);
    if (!inRange(announceIso)) continue;
    events.push({ date: announceIso, time: "03:00", name: "FOMC 금리결정", importance: "high" });
    events.push({ date: announceIso, time: "03:00", name: "FOMC 성명서", importance: "high" });
    events.push({ date: announceIso, time: "03:30", name: "FOMC 기자회견", importance: "high" });
  }

  // Weekly indicators: walk each day in the window.
  for (let iso = startIso; iso <= endIso; iso = addDaysIso(iso, 1)) {
    const dow = dowOfIso(iso);
    if (dow === 4) events.push({ date: iso, time: "21:30", name: "신규 실업수당 청구건수", importance: "high" }); // Thursday
    if (dow === 3) events.push({ date: iso, time: "23:30", name: "원유재고", importance: "medium" }); // Wednesday
  }

  // De-duplicate identical (date, time, name) tuples and sort.
  const seen = new Set<string>();
  const deduped = events.filter((event) => {
    const key = `${event.date}|${event.time}|${event.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return sortEvents(deduped);
}

/**
 * Split the static economic events into a this-week (today..+6) and a next-week
 * (today+7..+13) bucket, each sorted by date and time. Weeks roll forward from
 * `today` so the section always reflects the upcoming two weeks.
 */
export function splitEconomicEventsByWeek(
  today: Date = new Date(),
  events?: EconomicCalendarEvent[],
): EconomicCalendarWeeks {
  // When an explicit event list is supplied (tests / fixtures) it is used as-is
  // and reported as a "static" snapshot. Otherwise events are GENERATED from a
  // rolling window around `today`, so this-week / next-week never empty out.
  const isExplicit = Array.isArray(events);
  const resolvedEvents = isExplicit ? (events as EconomicCalendarEvent[]) : generateUsEconomicCalendarEvents(today);
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
      events: sortEvents(resolvedEvents.filter((event) => inRange(event, thisStartIso, thisEndIso))),
    },
    nextWeek: {
      label: "다음주",
      rangeLabel: rangeLabel(nextWeekStart, nextWeekEnd),
      startIso: nextStartIso,
      endIso: nextEndIso,
      events: sortEvents(resolvedEvents.filter((event) => inRange(event, nextStartIso, nextEndIso))),
    },
    updatedAt: isExplicit ? ECONOMIC_CALENDAR_UPDATED_AT : new Date().toISOString(),
    source: isExplicit ? "static" : "generated",
  };
}
