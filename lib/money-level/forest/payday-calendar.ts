import {
  y2018,
  y2019,
  y2020,
  y2021,
  y2022,
  y2023,
  y2024,
  y2025,
  y2026,
  y2027,
} from "@hyunbinseo/holidays-kr/all";
import { toSolar } from "kor-lunar";
import { formatCalendarDate, type SeoulCalendarDate } from "./seoul-time";

export const PAYDAY_HOLIDAY_SUPPORT = {
  firstYear: 2018,
  lastYear: 2035,
  officialDataThrough: 2027,
} as const;

type HolidayTable = Readonly<Record<string, readonly string[]>>;
type HolidayPredicate = (date: SeoulCalendarDate) => boolean;

const CONFIRMED_HOLIDAYS: Readonly<Record<number, HolidayTable>> = {
  2018: y2018,
  2019: y2019,
  2020: y2020,
  2021: y2021,
  2022: y2022,
  2023: y2023,
  2024: y2024,
  2025: y2025,
  2026: y2026,
  2027: y2027,
};

type BaseHoliday = {
  date: SeoulCalendarDate;
  category: "national" | "new-year" | "seollal" | "buddha" | "labor" | "children" | "memorial" | "chuseok" | "christmas";
  group?: "seollal" | "chuseok";
};

const projectedHolidayCache = new Map<number, ReadonlySet<string>>();

function assertSupportedYear(year: number): void {
  if (!Number.isInteger(year) || year < PAYDAY_HOLIDAY_SUPPORT.firstYear || year > PAYDAY_HOLIDAY_SUPPORT.lastYear) {
    throw new RangeError(`Korean payday holiday calendar supports ${PAYDAY_HOLIDAY_SUPPORT.firstYear}-${PAYDAY_HOLIDAY_SUPPORT.lastYear}; received ${year}`);
  }
}

function utcDate(date: SeoulCalendarDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function addDays(date: SeoulCalendarDate, amount: number): SeoulCalendarDate {
  const next = utcDate(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function dayOfWeek(date: SeoulCalendarDate): number {
  return utcDate(date).getUTCDay();
}

function isWeekend(date: SeoulCalendarDate): boolean {
  const weekday = dayOfWeek(date);
  return weekday === 0 || weekday === 6;
}

function addBaseHoliday(target: BaseHoliday[], year: number, month: number, day: number, category: BaseHoliday["category"], group?: BaseHoliday["group"]): void {
  target.push({ date: { year, month, day }, category, group });
}

/**
 * Deterministic projection of the recurring national holidays and substitute
 * rules in the Public Offices Holiday Regulation effective 2026-05-11.
 * One-off holidays and future election dates are intentionally not guessed.
 */
function buildProjectedHolidaySet(year: number): ReadonlySet<string> {
  const cached = projectedHolidayCache.get(year);
  if (cached) return cached;

  const base: BaseHoliday[] = [];
  addBaseHoliday(base, year, 1, 1, "new-year");
  for (const [month, day] of [[3, 1], [7, 17], [8, 15], [10, 3], [10, 9]] as const) {
    addBaseHoliday(base, year, month, day, "national");
  }
  addBaseHoliday(base, year, 5, 1, "labor");
  addBaseHoliday(base, year, 5, 5, "children");
  addBaseHoliday(base, year, 6, 6, "memorial");
  addBaseHoliday(base, year, 12, 25, "christmas");

  const lunarNewYear = toSolar(year, 1, 1);
  const seollal = { year: lunarNewYear.year, month: lunarNewYear.month, day: lunarNewYear.day };
  for (const offset of [-1, 0, 1]) {
    const date = addDays(seollal, offset);
    addBaseHoliday(base, date.year, date.month, date.day, "seollal", "seollal");
  }
  const buddha = toSolar(year, 4, 8);
  addBaseHoliday(base, buddha.year, buddha.month, buddha.day, "buddha");
  const lunarChuseok = toSolar(year, 8, 15);
  const chuseok = { year: lunarChuseok.year, month: lunarChuseok.month, day: lunarChuseok.day };
  for (const offset of [-1, 0, 1]) {
    const date = addDays(chuseok, offset);
    addBaseHoliday(base, date.year, date.month, date.day, "chuseok", "chuseok");
  }

  const byDate = new Map<string, BaseHoliday[]>();
  for (const holiday of base) {
    const key = formatCalendarDate(holiday.date);
    byDate.set(key, [...(byDate.get(key) ?? []), holiday]);
  }
  const holidays = new Set(byDate.keys());
  const substitutionTargets = new Map<string, SeoulCalendarDate>();
  const groups = ["seollal", "chuseok"] as const;

  for (const group of groups) {
    const entries = base.filter((holiday) => holiday.group === group);
    const sundayOverlap = entries.some((holiday) => dayOfWeek(holiday.date) === 0);
    const weekdayCollision = entries.some((holiday) => !isWeekend(holiday.date) && (byDate.get(formatCalendarDate(holiday.date))?.length ?? 0) > 1);
    if (sundayOverlap || weekdayCollision) substitutionTargets.set(`group:${group}`, entries.at(-1)!.date);
  }

  for (const holiday of base.filter((entry) => !entry.group)) {
    const key = formatCalendarDate(holiday.date);
    const weekendEligible = ["national", "buddha", "labor", "children", "christmas"].includes(holiday.category);
    const collisionEligible = !["new-year", "memorial"].includes(holiday.category);
    if (weekendEligible && isWeekend(holiday.date)) substitutionTargets.set(`weekend:${key}`, holiday.date);
    if (collisionEligible && !isWeekend(holiday.date) && (byDate.get(key)?.length ?? 0) > 1) substitutionTargets.set(`collision:${key}`, holiday.date);
  }

  const sortedTargets = Array.from(substitutionTargets.values()).sort((left, right) => utcDate(left).getTime() - utcDate(right).getTime());
  for (const target of sortedTargets) {
    let substitute = addDays(target, 1);
    while (isWeekend(substitute) || holidays.has(formatCalendarDate(substitute))) substitute = addDays(substitute, 1);
    holidays.add(formatCalendarDate(substitute));
  }

  projectedHolidayCache.set(year, holidays);
  return holidays;
}

export function getKoreanHolidayDataQuality(year: number): "official" | "statutory-projection" {
  assertSupportedYear(year);
  return year <= PAYDAY_HOLIDAY_SUPPORT.officialDataThrough ? "official" : "statutory-projection";
}

export function isKoreanPublicHoliday(date: SeoulCalendarDate): boolean {
  assertSupportedYear(date.year);
  const key = formatCalendarDate(date);
  const confirmed = CONFIRMED_HOLIDAYS[date.year];
  return confirmed ? Object.prototype.hasOwnProperty.call(confirmed, key) : buildProjectedHolidaySet(date.year).has(key);
}

export function getActualPayday(year: number, month: number, isHoliday: HolidayPredicate = isKoreanPublicHoliday): SeoulCalendarDate {
  assertSupportedYear(year);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`Payday month must be 1-12; received ${month}`);
  let date: SeoulCalendarDate = { year, month, day: 17 };
  while (isWeekend(date) || isHoliday(date)) date = addDays(date, -1);
  return date;
}

export function isActualPayday(date: SeoulCalendarDate): boolean {
  return formatCalendarDate(date) === formatCalendarDate(getActualPayday(date.year, date.month));
}
