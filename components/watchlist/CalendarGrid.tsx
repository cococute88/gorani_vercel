"use client";

import { buildMonthGrid } from "@/lib/calendar-grid";
import { eventChipLabel, eventStateClasses, EVENT_VISUALS } from "@/lib/event-visuals";
import type { CalendarEvent, CalendarEventType } from "@/lib/mock-calendar-data";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  month: Date;
  events: CalendarEvent[];
  selectedDate: string;
  todayIso: string;
  onSelectDate: (date: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export default function CalendarGrid({
  month,
  events,
  selectedDate,
  todayIso,
  onSelectDate,
  onOpenEvent,
  onPrevMonth,
  onNextMonth,
  onToday,
}: Props) {
  const cells = buildMonthGrid(month);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  }

  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 shadow-xl shadow-black/10 sm:p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
        <h2 className="text-[16px] font-extrabold text-white sm:text-[18px]">
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </h2>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={onPrevMonth} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] text-slate-200 hover:bg-white/15 sm:px-3 sm:text-[13px]">◀</button>
          <button type="button" onClick={onToday} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500 sm:px-3 sm:text-[13px]">오늘</button>
          <button type="button" onClick={onNextMonth} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] text-slate-200 hover:bg-white/15 sm:px-3 sm:text-[13px]">▶</button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-[#232d30]">
        {/* Weekday header */}
        {WEEKDAYS.map((weekday, index) => (
          <div key={weekday} className={`bg-[#101719] py-1.5 text-center text-[10px] font-bold sm:py-2 sm:text-[11px] ${index === 0 ? "text-red-300/80" : index === 6 ? "text-blue-300/80" : "text-slate-500"}`}>
            {weekday}
          </div>
        ))}
        {/* Day cells */}
        {cells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.isoDate) ?? [];
          const shown = dayEvents.slice(0, 2);
          const extra = dayEvents.length - shown.length;
          const selected = selectedDate === cell.isoDate;
          const isToday = todayIso === cell.isoDate;
          const isCurrentMonth = cell.isCurrentMonth;
          return (
            <button
              key={cell.isoDate}
              type="button"
              onClick={() => onSelectDate(cell.isoDate)}
              className={[
                "relative min-h-[72px] overflow-hidden border-t border-[#232d30] text-left transition sm:min-h-[100px]",
                isCurrentMonth ? "bg-[#191f20] hover:bg-[#1e2628]" : "bg-[#141a1b]",
                selected ? "ring-2 ring-inset ring-blue-400/80" : "",
              ].join(" ")}
            >
              {/* Day number */}
              <div className="absolute left-0 top-0 z-10">
                <span className={[
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-[11px]",
                  isToday ? "bg-blue-500 text-white shadow-md shadow-blue-500/30" : "",
                  !isToday && isCurrentMonth ? "text-slate-200" : "",
                  !isToday && !isCurrentMonth ? "text-slate-600" : "",
                ].join(" ")}>
                  {cell.day}
                </span>
              </div>
              {extra > 0 && (
                <span className="absolute right-1 top-1 z-10 rounded bg-white/10 px-1 py-0.5 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
                  +{extra}
                </span>
              )}
              {/* Event chips */}
              <div className="absolute inset-x-0 top-6 flex min-w-0 flex-col gap-0.5 px-1 pb-1 sm:top-7 sm:px-1.5 sm:pb-1.5">
                {shown.map((event) => {
                  const visual = EVENT_VISUALS[event.type as CalendarEventType];
                  return (
                    <span
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={(clickEvent) => { clickEvent.stopPropagation(); onSelectDate(cell.isoDate); onOpenEvent(event); }}
                      onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter") onOpenEvent(event); }}
                      className={[
                        "block min-w-0 truncate rounded border px-1 py-0.5 text-[9px] font-semibold leading-tight sm:px-1.5 sm:py-0.5 sm:text-[10px]",
                        visual.bg, visual.border, visual.text,
                        eventStateClasses(event, todayIso),
                      ].join(" ")}
                    >
                      {event.favorite ? `${event.favorite} ` : ""}{eventChipLabel(event)}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
        {(Object.keys(EVENT_VISUALS) as CalendarEventType[]).map((type) => {
          const visual = EVENT_VISUALS[type];
          return <span key={type} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-[11px] ${visual.bg} ${visual.border} ${visual.text}`}>{visual.label}</span>;
        })}
        <span className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[10px] text-slate-500 sm:text-[11px]">점선 = 추정</span>
      </div>
    </section>
  );
}
