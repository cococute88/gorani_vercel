import type { CalendarEvent, CalendarEventType } from "@/lib/mock-calendar-data";

const TYPE_PRIORITY: Record<CalendarEventType, number> = {
  ex_div: 0,
  buy_by: 1,
  pay: 2,
  earnings: 3,
  custom: 4,
};

export function getCalendarEventPriority(event: CalendarEvent): number {
  if (event.favorite === "💗") return 0;
  if (event.favorite === "⭐") return 1;
  if (event.status === "confirmed") return 2;
  return 3;
}

export function compareCalendarEventsByPriority(a: CalendarEvent, b: CalendarEvent): number {
  return (
    getCalendarEventPriority(a) - getCalendarEventPriority(b) ||
    (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99) ||
    a.ticker.localeCompare(b.ticker) ||
    a.id.localeCompare(b.id)
  );
}

export function sortCalendarEventsByPriority<T extends CalendarEvent>(events: readonly T[]): T[] {
  return events.map((event, index) => ({ event, index })).sort((a, b) => compareCalendarEventsByPriority(a.event, b.event) || a.index - b.index).map(({ event }) => event);
}
