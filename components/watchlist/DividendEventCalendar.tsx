"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { EVENT_META } from "@/lib/mock-dividend-data";
import type { DividendEvent, DivEventType } from "@/lib/mock-dividend-data";

interface Props {
  year: number;
  month: number; // 1~12
  events: DividendEvent[];
  visibleTypes: Record<DivEventType, boolean>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function chipStyle(type: DivEventType): { background: string; borderColor: string } {
  const meta = EVENT_META[type];
  return { background: `${meta.color}26`, borderColor: meta.border };
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 월간 배당 캘린더. 하루에 이벤트가 많으면 +N 으로 압축.
export default function DividendEventCalendar({
  year,
  month,
  events,
  visibleTypes,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const byDay = new Map<string, DividendEvent[]>();
  for (const ev of events) {
    if (!visibleTypes[ev.type]) continue;
    const list = byDay.get(ev.date) ?? [];
    list.push(ev);
    byDay.set(ev.date, list);
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayIso = iso(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate(),
  );

  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="num text-[15px] font-bold text-white">
          {year}년 {month}월
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10">
            <ChevronLeft size={16} />
          </button>
          <button onClick={onToday} className="rounded-md bg-white/10 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/20">
            TODAY
          </button>
          <button onClick={onNext} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-[#2a3336]">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`bg-[#11181a] py-2 text-center text-[12px] font-semibold ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"
            }`}
          >
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} className="min-h-[88px] bg-[#141a1b]" />;
          }
          const dateStr = iso(year, month, day);
          const dayEvents = byDay.get(dateStr) ?? [];
          const shown = dayEvents.slice(0, 2);
          const extra = dayEvents.length - shown.length;
          const isToday = dateStr === todayIso;
          return (
            <div key={dateStr} className="min-h-[88px] bg-[#191f20] p-1.5">
              <div
                className={`mb-1 text-[12px] font-medium ${
                  isToday
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"
                    : "text-slate-400"
                }`}
              >
                {day}
              </div>
              <div className="flex flex-col gap-0.5">
                {shown.map((ev) => (
                  <div
                    key={ev.id}
                    className="truncate rounded border px-1 py-0.5 text-[10.5px] font-medium text-white"
                    style={chipStyle(ev.type)}
                    title={`${ev.ticker} ${EVENT_META[ev.type].labelKo}`}
                  >
                    {ev.ticker} {EVENT_META[ev.type].label}
                  </div>
                ))}
                {extra > 0 && (
                  <div className="px-1 text-[10.5px] text-slate-400">+{extra}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-3 flex flex-wrap gap-3">
        {(Object.keys(EVENT_META) as DivEventType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={legendDot(t)} />
            {EVENT_META[t].labelKo}
          </span>
        ))}
      </div>
    </div>
  );
}

function legendDot(type: DivEventType): { background: string } {
  return { background: EVENT_META[type].color };
}
