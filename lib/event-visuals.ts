import type { CalendarEvent, CalendarEventStatus, CalendarEventType } from "./mock-calendar-data";

export const EVENT_VISUALS: Record<CalendarEventType, { label: string; shortLabel: string; ko: string; bg: string; border: string; text: string }> = {
  ex_div: { label: "배당락", shortLabel: "배당락", ko: "배당락", bg: "bg-blue-500/20", border: "border-blue-400/60", text: "text-blue-200" },
  buy_by: { label: "매수마감", shortLabel: "매수", ko: "매수 마감", bg: "bg-red-500/20", border: "border-red-400/60", text: "text-red-200" },
  pay: { label: "지급", shortLabel: "지급", ko: "지급", bg: "bg-emerald-500/20", border: "border-emerald-400/60", text: "text-emerald-200" },
  earnings: { label: "실적", shortLabel: "실적", ko: "실적", bg: "bg-purple-500/20", border: "border-purple-400/60", text: "text-purple-200" },
};

export function eventChipLabel(event: Pick<CalendarEvent, "ticker" | "type">): string {
  return `${event.ticker} ${EVENT_VISUALS[event.type].shortLabel}`;
}

export function eventStatusLabel(status: CalendarEventStatus): string {
  return status === "confirmed" ? "확정" : "추정";
}

export function eventStateClasses(event: CalendarEvent, todayIso: string): string {
  const isPast = event.date < todayIso;
  const estimated = event.status === "estimated";
  return [
    isPast ? "opacity-45 grayscale" : "opacity-100",
    estimated ? "border-dashed opacity-60" : "border-solid",
  ].join(" ");
}
