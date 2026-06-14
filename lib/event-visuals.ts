import type { CalendarEvent, CalendarEventStatus, CalendarEventType } from "./mock-calendar-data";

export const EVENT_VISUALS: Record<CalendarEventType, { label: string; shortLabel: string; ko: string; bg: string; border: string; text: string }> = {
  ex_div: { label: "배당락", shortLabel: "배당락", ko: "배당락", bg: "bg-blue-500/20", border: "border-blue-400/60", text: "text-blue-200" },
  buy_by: { label: "매수마감", shortLabel: "매수", ko: "매수 마감", bg: "bg-red-500/20", border: "border-red-400/60", text: "text-red-200" },
  pay: { label: "지급", shortLabel: "지급", ko: "지급", bg: "bg-emerald-500/20", border: "border-emerald-400/60", text: "text-emerald-200" },
  earnings: { label: "실적", shortLabel: "실적", ko: "실적", bg: "bg-purple-500/20", border: "border-purple-400/60", text: "text-purple-200" },
  custom: { label: "사용자", shortLabel: "사용자", ko: "사용자 일정", bg: "bg-amber-500/15", border: "border-amber-300/50", text: "text-amber-100" },
};

export function getEventVisual(type: string): (typeof EVENT_VISUALS)[CalendarEventType] {
  return EVENT_VISUALS[type as CalendarEventType] ?? EVENT_VISUALS.custom;
}

export function eventChipLabel(event: Pick<CalendarEvent, "ticker" | "type" | "title">): string {
  if (event.type === "custom") return event.title ?? event.ticker;
  return `${event.ticker} ${getEventVisual(event.type).shortLabel}`;
}

export function eventStatusLabel(status: CalendarEventStatus): string {
  return status === "confirmed" ? "확정" : "추정";
}

export function eventStateClasses(event: CalendarEvent, todayIso: string): string {
  const isPast = event.date < todayIso;
  const estimated = event.status === "estimated";
  // Opacity policy:
  //  - declared/confirmed & upcoming → full opacity
  //  - declared/confirmed & past     → light muted veil (~60%)
  //  - non-declared (estimated)      → faint (~40%) so 확정 vs 추정 reads at a
  //    glance, but still legible (we never stack two opacity utilities).
  // Past events keep their full event-type color (no desaturation) so
  // Ex-Div/Buy/Pay/Earn stay distinguishable in light and dark mode. Estimated
  // events stay dashed.
  const opacity = estimated ? "opacity-40" : isPast ? "opacity-60" : "opacity-100";
  return [opacity, estimated ? "border-dashed" : "border-solid"].join(" ");
}
