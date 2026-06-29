import type { CalendarEvent, CalendarEventType } from "@/lib/mock-calendar-data";

const TYPE_PRIORITY: Record<CalendarEventType, number> = {
  ex_div: 0,
  buy_by: 1,
  pay: 2,
  earnings: 3,
  custom: 4,
};

// CALENDAR-PRIORITY-STAR-FIRST: 일정 우선순위는 별(⭐) > 하트(💗) > 확정/일반 순이다.
// 별이 항상 하트보다 위에 오도록 한다. (캘린더 셀 내부 정렬과 선택 날짜 상세 목록이
// 모두 이 함수를 거치므로 두 화면의 정렬 결과가 항상 동일하다.)
export function getCalendarEventPriority(event: CalendarEvent): number {
  if (event.favorite === "⭐") return 0; // 별: 최상단
  if (event.favorite === "💗") return 1; // 하트: 별 다음
  if (event.status === "confirmed") return 2;
  return 3; // 일반
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
