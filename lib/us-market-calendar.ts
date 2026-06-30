// Generalized U.S. equity-market (NYSE/Nasdaq) trading-day calendar.
//
// Dividend buy-deadlines must land on the last *trading* day before the
// ex-dividend date — never on a weekend OR a market holiday. The previous
// implementation only skipped weekends, so an ex-date that follows a holiday
// (e.g. ex = Mon 2026-07-06, with Independence Day observed on Fri 2026-07-03)
// produced a buy-deadline of Fri 2026-07-03, a day the market is closed.
//
// All holidays here are computed from rules (nth-weekday / fixed-date with the
// standard NYSE observed-day adjustment) so the calendar is correct for any
// year without hardcoding specific symptom dates.

const DOW_SUN = 0;
const DOW_SAT = 6;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Civil-date ISO string (yyyy-mm-dd) built from integer y/m/d, timezone-independent. */
function isoFromYmd(year: number, month1to12: number, day: number): string {
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}

/** Day of week (0=Sun..6=Sat) for a civil date, computed via UTC so it is timezone-independent. */
function weekdayOfYmd(year: number, month1to12: number, day: number): number {
  return new Date(Date.UTC(year, month1to12 - 1, day)).getUTCDay();
}

/** ISO date for the `nth` (1-based) `weekday` of a month, e.g. 3rd Monday. */
function nthWeekdayOfMonth(year: number, month1to12: number, weekday: number, nth: number): string {
  const firstDow = weekdayOfYmd(year, month1to12, 1);
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return isoFromYmd(year, month1to12, day);
}

/** ISO date for the last `weekday` of a month, e.g. last Monday of May. */
function lastWeekdayOfMonth(year: number, month1to12: number, weekday: number): string {
  const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  const lastDow = weekdayOfYmd(year, month1to12, lastDay);
  const offset = (lastDow - weekday + 7) % 7;
  return isoFromYmd(year, month1to12, lastDay - offset);
}

/**
 * NYSE observed date for a fixed-date holiday:
 *   Saturday  -> observed the preceding Friday
 *   Sunday    -> observed the following Monday
 * (New Year's Day on Saturday is intentionally handled by the caller, which
 * skips it because the NYSE does not close the preceding Friday in that case.)
 */
function observedFixedDate(year: number, month1to12: number, day: number): string {
  const dow = weekdayOfYmd(year, month1to12, day);
  if (dow === DOW_SAT) {
    const date = new Date(Date.UTC(year, month1to12 - 1, day - 1));
    return date.toISOString().slice(0, 10);
  }
  if (dow === DOW_SUN) {
    const date = new Date(Date.UTC(year, month1to12 - 1, day + 1));
    return date.toISOString().slice(0, 10);
  }
  return isoFromYmd(year, month1to12, day);
}

/** Easter Sunday (Gregorian, Anonymous/Meeus algorithm) as an ISO date. */
function easterSundayIso(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoFromYmd(year, month, day);
}

/** Good Friday = Easter Sunday - 2 days. */
function goodFridayIso(year: number): string {
  const easter = new Date(`${easterSundayIso(year)}T00:00:00.000Z`);
  easter.setUTCDate(easter.getUTCDate() - 2);
  return easter.toISOString().slice(0, 10);
}

const holidayCache = new Map<number, Set<string>>();

/** Set of ISO dates the U.S. equity market is fully closed in `year`. */
export function getUsMarketHolidaySet(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const holidays = new Set<string>();

  // New Year's Day (Jan 1). Sunday -> observed Monday. Saturday -> NYSE stays
  // open the preceding Friday, so no observance is added.
  const newYearDow = weekdayOfYmd(year, 1, 1);
  if (newYearDow === DOW_SUN) holidays.add(isoFromYmd(year, 1, 2));
  else if (newYearDow !== DOW_SAT) holidays.add(isoFromYmd(year, 1, 1));

  holidays.add(nthWeekdayOfMonth(year, 1, 1, 3)); // MLK Day — 3rd Monday Jan
  holidays.add(nthWeekdayOfMonth(year, 2, 1, 3)); // Washington's Birthday — 3rd Monday Feb
  holidays.add(goodFridayIso(year)); // Good Friday
  holidays.add(lastWeekdayOfMonth(year, 5, 1)); // Memorial Day — last Monday May

  if (year >= 2022) holidays.add(observedFixedDate(year, 6, 19)); // Juneteenth (federal market holiday from 2022)

  holidays.add(observedFixedDate(year, 7, 4)); // Independence Day
  holidays.add(nthWeekdayOfMonth(year, 9, 1, 1)); // Labor Day — 1st Monday Sep
  holidays.add(nthWeekdayOfMonth(year, 11, 4, 4)); // Thanksgiving — 4th Thursday Nov
  holidays.add(observedFixedDate(year, 12, 25)); // Christmas Day

  holidayCache.set(year, holidays);
  return holidays;
}

/** True when `iso` (yyyy-mm-dd) is a recognized U.S. market holiday. */
export function isUsMarketHolidayIso(iso: string): boolean {
  const date = iso.slice(0, 10);
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  return getUsMarketHolidaySet(year).has(date);
}

/** True when `iso` is a weekday AND not a market holiday (i.e. the market is open). */
export function isUsTradingDayIso(iso: string): boolean {
  const date = iso.slice(0, 10);
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (dow === DOW_SAT || dow === DOW_SUN) return false;
  return !isUsMarketHolidayIso(date);
}

function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Last trading day strictly before `iso` (skips weekends and market holidays). */
export function previousUsTradingDayIso(iso: string): string {
  let cursor = shiftIso(iso, -1);
  let guard = 0;
  while (!isUsTradingDayIso(cursor) && guard < 30) {
    cursor = shiftIso(cursor, -1);
    guard += 1;
  }
  return cursor;
}

/** First trading day on or after `iso` (skips weekends and market holidays). */
export function nextUsTradingDayOnOrAfterIso(iso: string): string {
  let cursor = iso.slice(0, 10);
  let guard = 0;
  while (!isUsTradingDayIso(cursor) && guard < 30) {
    cursor = shiftIso(cursor, 1);
    guard += 1;
  }
  return cursor;
}

/** First trading day strictly after `iso` (skips weekends and market holidays). */
export function nextUsTradingDayAfterIso(iso: string): string {
  return nextUsTradingDayOnOrAfterIso(shiftIso(iso, 1));
}

function toLocalIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fromLocalIso(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Date-based wrapper: last trading day strictly before `date` (local civil date). */
export function previousUsTradingDay(date: Date): Date {
  return fromLocalIso(previousUsTradingDayIso(toLocalIso(date)));
}

/** Date-based wrapper: first trading day on or after `date` (local civil date). */
export function nextUsTradingDayOnOrAfter(date: Date): Date {
  return fromLocalIso(nextUsTradingDayOnOrAfterIso(toLocalIso(date)));
}
