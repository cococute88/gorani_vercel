"use client";

import { eventChipLabel, eventStateClasses, eventStatusLabel, EVENT_VISUALS } from "@/lib/event-visuals";
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
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
      <h2 className="mb-3 text-[15px] font-bold text-slate-200">{title}</h2>
      <div className="space-y-2">
        {events.length === 0 && <p className="rounded-xl border border-dashed border-[#334044] px-4 py-6 text-center text-[13px] text-slate-500">{emptyText}</p>}
        {events.map((event) => {
          const visual = EVENT_VISUALS[event.type];
          return (
            <button key={event.id} type="button" onClick={() => onOpenEvent(event)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#263134] bg-[#141a1b] p-3 text-left hover:bg-[#1d2527]">
              <span className="min-w-0">
                <span className={`inline-flex max-w-full rounded-md border px-2 py-1 text-[11px] font-semibold ${visual.bg} ${visual.border} ${visual.text} ${eventStateClasses(event, todayIso)}`}>
                  {event.favorite ? `${event.favorite} ` : ""}{eventChipLabel(event)}
                </span>
                <span className="mt-1 block text-[12px] text-slate-400">{event.date} · 예상 배당금 {event.dividendAmount == null ? "—" : `$${event.dividendAmount.toFixed(2)}`}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-slate-300">{eventStatusLabel(event.status)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
