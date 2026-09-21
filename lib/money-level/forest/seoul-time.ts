import type { MoneyLevelTimeOfDay } from "../types";

export const SEOUL_TIME_ZONE = "Asia/Seoul";
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1_000;

export type SeoulCalendarDate = {
  year: number;
  month: number;
  day: number;
};

const SEOUL_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getSeoulDateTime(date: Date): SeoulCalendarDate & { hour: number; minute: number } {
  const parts = Object.fromEntries(
    SEOUL_PARTS.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

export function getSeoulCalendarDate(date: Date): SeoulCalendarDate {
  const { year, month, day } = getSeoulDateTime(date);
  return { year, month, day };
}

export function resolveSeoulTimeOfDay(date: Date): MoneyLevelTimeOfDay {
  const { hour } = getSeoulDateTime(date);
  if (hour >= 5 && hour < 9) return "morning";
  if (hour >= 9 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

/** Next Seoul midnight or visual time-band boundary. Seoul has no DST. */
export function millisecondsUntilNextSeoulBoundary(date: Date): number {
  const seoul = getSeoulDateTime(date);
  const boundaries = [0, 5, 9, 16, 19, 24];
  const localNowMs = Date.UTC(seoul.year, seoul.month - 1, seoul.day, seoul.hour, seoul.minute);
  const nextLocalMs = boundaries
    .map((hour) => Date.UTC(seoul.year, seoul.month - 1, seoul.day, hour))
    .find((candidate) => candidate > localNowMs)
    ?? Date.UTC(seoul.year, seoul.month - 1, seoul.day + 1);
  const nextEpochMs = nextLocalMs - SEOUL_OFFSET_MS;
  return Math.max(1_000, nextEpochMs - date.getTime() + 250);
}

export function parsePreviewCalendarDate(value: string | null): SeoulCalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() + 1 !== month || normalized.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function formatCalendarDate(date: SeoulCalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
