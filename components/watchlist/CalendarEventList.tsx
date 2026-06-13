"use client";

import { eventChipLabel, eventStateClasses, eventStatusLabel, getEventVisual } from "@/lib/event-visuals";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

interface Props {
  title: string;
  events: CalendarEvent[];
  todayIso: string;
  emptyText?: string;
  onOpenEvent: (event: CalendarEvent) => void;
}

export default function CalendarEventList({ title, events, todayIso, emptyText = "표시할 배당 일정이 없습니다.", onOpenEvent }: Props) {
  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
      <h2 className="mb-2 text-[14px] font-bold text-slate-200 sm:mb-3 sm:text-[15px]">{title}</h2>
      <div className="space-y-1.5 sm:space-y-2">
        {events.length === 0 && <p className="rounded-xl border border-dashed border-[#334044] px-3 py-5 text-center text-[12px] text-slate-500 sm:px-4 sm:py-6 sm:text-[13px]">{emptyText}</p>}
        {events.map((event) => {
          const visual = getEventVisual(event.type);
          return (
            <button key={event.id} type="button" onClick={() => onOpenEvent(event)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#263134] bg-[#141a1b] p-2.5 text-left hover:bg-[#1d2527] sm:gap-3 sm:p-3">
              <span className="min-w-0 flex-1">
                <span className={`inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px] ${visual.bg} ${visual.border} ${visual.text} ${eventStateClasses(event, todayIso)}`}>
                  {event.favorite ? `${event.favorite} ` : ""}{eventChipLabel(event)}
                </span>
                <span className="mt-1 block truncate text-[11px] text-slate-400 sm:text-[12px]">{event.date} · {event.dividendAmount == null ? "—" : `$${event.dividendAmount.toFixed(2)}`}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:px-2 sm:py-1 sm:text-[11px]">{eventStatusLabel(event.status)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
