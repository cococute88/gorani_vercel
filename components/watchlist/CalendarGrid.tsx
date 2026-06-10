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
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4 shadow-xl shadow-black/10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold text-white">
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </h2>
          <p className="text-[12px] text-slate-400">외부 캘린더 라이브러리 없이 7열 월간 grid로 표시합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevMonth} className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] text-slate-200 hover:bg-white/15">이전</button>
          <button type="button" onClick={onToday} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-500">오늘</button>
          <button type="button" onClick={onNextMonth} className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] text-slate-200 hover:bg-white/15">다음</button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-[#2a3336] bg-[#2a3336] text-[11px] sm:text-[12px]">
        {WEEKDAYS.map((weekday, index) => (
          <div key={weekday} className={`bg-[#101719] py-2 text-center font-bold ${index === 0 ? "text-red-300" : index === 6 ? "text-blue-300" : "text-slate-400"}`}>
            {weekday}
          </div>
        ))}
        {cells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.isoDate) ?? [];
          const shown = dayEvents.slice(0, 2);
          const extra = dayEvents.length - shown.length;
          const selected = selectedDate === cell.isoDate;
          const isToday = todayIso === cell.isoDate;
          return (
            <button
              key={cell.isoDate}
              type="button"
              onClick={() => onSelectDate(cell.isoDate)}
              className={`min-h-[92px] border-t border-[#2a3336] bg-[#191f20] p-1.5 text-left transition hover:bg-[#202829] sm:min-h-[118px] sm:p-2 ${!cell.isCurrentMonth ? "bg-[#141a1b] text-slate-600" : ""} ${selected ? "ring-2 ring-inset ring-blue-400" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${isToday ? "bg-blue-600 text-white" : cell.isCurrentMonth ? "text-slate-300" : "text-slate-600"}`}>
                  {cell.day}
                </span>
                {extra > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300" onClick={(event) => { event.stopPropagation(); onSelectDate(cell.isoDate); }}>
                    +{extra}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {shown.map((event) => {
                  const visual = EVENT_VISUALS[event.type as CalendarEventType];
                  return (
                    <span
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={(clickEvent) => { clickEvent.stopPropagation(); onSelectDate(cell.isoDate); onOpenEvent(event); }}
                      onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter") onOpenEvent(event); }}
                      className={`truncate rounded-md border px-1.5 py-1 text-[10px] font-semibold ${visual.bg} ${visual.border} ${visual.text} ${eventStateClasses(event, todayIso)}`}
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

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(EVENT_VISUALS) as CalendarEventType[]).map((type) => {
          const visual = EVENT_VISUALS[type];
          return <span key={type} className={`rounded-full border px-2 py-1 text-[11px] ${visual.bg} ${visual.border} ${visual.text}`}>{visual.label}</span>;
        })}
        <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-slate-400">추정: 점선/60%</span>
        <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-slate-400">과거: 흐림+grayscale</span>
      </div>
    </section>
  );
}
