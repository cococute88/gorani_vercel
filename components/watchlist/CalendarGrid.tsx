"use client";

import { buildMonthGrid } from "@/lib/calendar-grid";
import { eventChipLabel, eventStateClasses, EVENT_VISUALS, getEventVisual } from "@/lib/event-visuals";
import type { CalendarEvent, CalendarEventType } from "@/lib/mock-calendar-data";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// Calendar legend / chip slots only cover dividend-style events. Custom (user /
// economic) events render as a small text line next to the day number instead of
// taking a chip slot, mirroring the original Streamlit `::before` day-cell text.
const LEGEND_TYPES: CalendarEventType[] = ["ex_div", "buy_by", "pay", "earnings"];

interface Props {
  month: Date;
  events: CalendarEvent[];
  customEvents: CalendarEvent[];
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
  customEvents,
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
    if (event.type === "custom") continue; // custom events render as date-line text, not chips
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  }
  const customByDate = new Map<string, CalendarEvent[]>();
  for (const event of customEvents) {
    customByDate.set(event.date, [...(customByDate.get(event.date) ?? []), event]);
  }

  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 shadow-xl shadow-black/10 sm:p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
        <h2 className="text-[16px] font-extrabold text-white sm:text-[18px]">
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </h2>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={onPrevMonth} className="rounded-lg bg-black/5 px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15 sm:px-3 sm:text-[13px]">◀</button>
          <button type="button" onClick={onToday} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500 sm:px-3 sm:text-[13px]">오늘</button>
          <button type="button" onClick={onNextMonth} className="rounded-lg bg-black/5 px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15 sm:px-3 sm:text-[13px]">▶</button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-[#232d30]">
        {/* Weekday header */}
        {WEEKDAYS.map((weekday, index) => (
          <div key={weekday} className={`bg-slate-100 py-1.5 text-center text-[10px] font-bold dark:bg-[#101719] sm:py-2 sm:text-[11px] ${index === 0 ? "text-red-400 dark:text-red-300/80" : index === 6 ? "text-blue-500 dark:text-blue-300/80" : "text-slate-500"}`}>
            {weekday}
          </div>
        ))}
        {/* Day cells */}
        {cells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.isoDate) ?? [];
          const dayCustom = customByDate.get(cell.isoDate) ?? [];
          // Show up to three event chips per cell (date + custom/economic text
          // line stays on top); anything beyond three collapses into a "+N" pill.
          const shown = dayEvents.slice(0, 3);
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
                "relative flex min-h-[72px] flex-col justify-start overflow-hidden border-t border-[#232d30] text-left transition sm:min-h-[100px]",
                // Light-mode hover stays a faint sky tint (not the dark surface color,
                // which the global light remap does not touch on `hover:` classes).
                isCurrentMonth
                  ? "bg-[#191f20] hover:bg-sky-50 dark:hover:bg-[#1e2628]"
                  : "bg-slate-50 dark:bg-[#141a1b] hover:bg-sky-50 dark:hover:bg-[#1e2628]",
                selected ? "ring-2 ring-inset ring-blue-400/80" : "",
              ].join(" ")}
            >
              {/* Top line (first normal-flow row): day number + custom
                  (user/economic) inline text. The day cell is a top-anchored
                  flex column (justify-start), so this row sits flush with the
                  cell top in every cell and the chip block below stacks directly
                  beneath it. No absolute pinning, no vertical centering — that
                  is what previously let the <button> UA layout float the in-flow
                  chips to the middle of the cell. */}
              <div className="flex h-5 shrink-0 items-start gap-1 px-1 pt-1 leading-none sm:h-6 sm:px-1.5 sm:pt-1.5">
                <span className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none sm:h-6 sm:w-6 sm:text-[11px]",
                  isToday ? "bg-blue-500 text-white shadow-md shadow-blue-500/30" : "",
                  !isToday && isCurrentMonth ? "text-slate-700 dark:text-slate-200" : "",
                  !isToday && !isCurrentMonth ? "text-slate-400 dark:text-slate-600" : "",
                ].join(" ")}>
                  {cell.day}
                </span>
                {dayCustom.length > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    title={dayCustom.map((event) => event.title ?? event.ticker).join(", ")}
                    onClick={(clickEvent) => { clickEvent.stopPropagation(); onSelectDate(cell.isoDate); onOpenEvent(dayCustom[0]); }}
                    onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter") onOpenEvent(dayCustom[0]); }}
                    className={`min-w-0 flex-1 truncate pt-0.5 text-[9px] font-medium leading-none text-amber-700 dark:text-amber-200/90 sm:text-[10px] ${cell.isoDate < todayIso ? "opacity-60" : ""}`}
                  >
                    {dayCustom[0].title ?? dayCustom[0].ticker}{dayCustom.length > 1 ? ` +${dayCustom.length - 1}` : ""}
                  </span>
                )}
                {extra > 0 && (
                  <span className="ml-auto shrink-0 rounded bg-black/10 px-1 py-0.5 text-[9px] font-semibold leading-none text-slate-500 dark:bg-white/10 dark:text-slate-400 sm:text-[10px]">
                    +{extra}
                  </span>
                )}
              </div>
              {/* Event chips stack directly below the date line — top-anchored
                  (justify-start), small gap, never vertically centered. */}
              <div className="mt-0.5 flex min-h-0 min-w-0 flex-col justify-start gap-0.5 overflow-hidden px-1 pb-1 sm:px-1.5 sm:pb-1.5">
                {shown.map((event) => {
                  const visual = getEventVisual(event.type);
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

      {/* Legend — only the four dividend event types (no extra explanatory text) */}
      <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
        {LEGEND_TYPES.map((type) => {
          const visual = EVENT_VISUALS[type];
          return <span key={type} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-[11px] ${visual.bg} ${visual.border} ${visual.text}`}>{visual.label}</span>;
        })}
      </div>
    </section>
  );
}
