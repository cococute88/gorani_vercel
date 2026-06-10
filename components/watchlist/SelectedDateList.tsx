"use client";

import type { CalendarEvent } from "@/lib/mock-calendar-data";
import CalendarEventList from "./CalendarEventList";

interface Props {
  selectedDate: string;
  events: CalendarEvent[];
  todayIso: string;
  onOpenEvent: (event: CalendarEvent) => void;
}

export default function SelectedDateList({ selectedDate, events, todayIso, onOpenEvent }: Props) {
  return (
    <CalendarEventList
      title={`선택 날짜 일정 · ${selectedDate}`}
      events={events}
      todayIso={todayIso}
      emptyText="선택한 날짜에 표시할 배당 일정이 없습니다."
      onOpenEvent={onOpenEvent}
    />
  );
}
