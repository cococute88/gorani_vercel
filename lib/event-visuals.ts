import type { CalendarEvent, CalendarEventStatus, CalendarEventType } from "./mock-calendar-data";

export const EVENT_VISUALS: Record<CalendarEventType, { label: string; shortLabel: string; ko: string; bg: string; border: string; text: string }> = {
  ex_div: { label: "Ex-Div", shortLabel: "Ex-Div", ko: "배당락", bg: "bg-blue-500/20", border: "border-blue-400/70", text: "text-blue-100" },
  buy_by: { label: "Buy By", shortLabel: "Buy By", ko: "매수 마감", bg: "bg-red-500/20", border: "border-red-400/70", text: "text-red-100" },
  pay: { label: "Pay", shortLabel: "Pay", ko: "지급", bg: "bg-emerald-500/20", border: "border-emerald-400/70", text: "text-emerald-100" },
  earnings: { label: "Earnings", shortLabel: "Earnings", ko: "실적", bg: "bg-purple-500/20", border: "border-purple-400/70", text: "text-purple-100" },
};

export function eventChipLabel(event: Pick<CalendarEvent, "ticker" | "type">): string {
  return `${event.ticker} · ${event.type === "earnings" ? "Earnings" : EVENT_VISUALS[event.type].shortLabel}`;
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
