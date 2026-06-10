"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatIsoDate } from "@/lib/calendar-grid";
import { DEFAULT_CALENDAR_FILTERS, buildMockCalendarEvents, buildTaxSavingRows } from "@/lib/mock-calendar-data";
import type { CalendarEvent, CalendarEventType } from "@/lib/mock-calendar-data";
import { EVENT_VISUALS } from "@/lib/event-visuals";
import CalendarGrid from "./CalendarGrid";
import CalendarEventDialog from "./CalendarEventDialog";
import CalendarEventList from "./CalendarEventList";
import DividendSchedulePreview from "./DividendSchedulePreview";
import PortfolioSelectorMock from "./PortfolioSelectorMock";
import SelectedDateList from "./SelectedDateList";
import TaxSavingTable from "./TaxSavingTable";

interface Props {
  tickers: string[];
  tickerManager: ReactNode;
}

const FILTER_ORDER: CalendarEventType[] = ["ex_div", "buy_by", "pay", "earnings"];

export default function DividendCalendarPage({ tickers, tickerManager }: Props) {
  const today = new Date();
  const todayIso = formatIsoDate(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [filters, setFilters] = useState<Record<CalendarEventType, boolean>>(DEFAULT_CALENDAR_FILTERS);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const events = useMemo(() => buildMockCalendarEvents(month.getFullYear(), month.getMonth() + 1, tickers), [month, tickers]);
  const filteredEvents = useMemo(() => events.filter((event) => filters[event.type]), [events, filters]);
  const selectedEvents = useMemo(() => filteredEvents.filter((event) => event.date === selectedDate), [filteredEvents, selectedDate]);
  const keyEvents = useMemo(() => filteredEvents.slice(0, 5), [filteredEvents]);
  const taxRows = useMemo(() => buildTaxSavingRows(events), [events]);

  const moveMonth = (delta: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const goToday = () => {
    const next = new Date(today.getFullYear(), today.getMonth(), 1);
    setMonth(next);
    setSelectedDate(todayIso);
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[24px] font-extrabold text-white sm:text-[28px]">배당캘린더</h1>
        <p className="mt-1 text-[13px] text-slate-400 sm:text-[14px]">배당락일·매수 마감·지급일·실적 발표를 mock 데이터로 한 화면에서 점검하는 preview입니다.</p>
      </div>

      <section className="mb-5 rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4">
        <p className="text-[13px] font-semibold text-blue-100">Preview 안내 카드</p>
        <p className="mt-1 text-[12.5px] leading-6 text-blue-100/80">이 화면은 외부 데이터 공급자나 서버 연동을 호출하지 않습니다. 모든 일정·절세액·상태는 기능 검증용 mock입니다.</p>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <PortfolioSelectorMock />
        <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
          <h2 className="mb-3 text-[15px] font-bold text-slate-200">필터</h2>
          <div className="flex flex-wrap gap-2">
            {FILTER_ORDER.map((type) => {
              const visual = EVENT_VISUALS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, [type]: !current[type] }))}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${filters[type] ? `${visual.bg} ${visual.border} ${visual.text}` : "border-white/10 bg-white/5 text-slate-500"}`}
                >
                  {visual.label} {filters[type] ? "ON" : "OFF"}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-slate-500">기본값: Ex-Div ON · Buy By ON · Pay OFF · Earnings ON</p>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <CalendarGrid
            month={month}
            events={filteredEvents}
            selectedDate={selectedDate}
            todayIso={todayIso}
            onSelectDate={setSelectedDate}
            onOpenEvent={setActiveEvent}
            onPrevMonth={() => moveMonth(-1)}
            onNextMonth={() => moveMonth(1)}
            onToday={goToday}
          />
          <SelectedDateList selectedDate={selectedDate} events={selectedEvents} todayIso={todayIso} onOpenEvent={setActiveEvent} />
        </div>
        <aside className="space-y-5">
          <TaxSavingTable rows={taxRows} />
          <CalendarEventList title="이번 달 주요 일정" events={keyEvents} todayIso={todayIso} onOpenEvent={setActiveEvent} />
        </aside>
      </section>

      <section className="mb-5">
        <DividendSchedulePreview events={events} onOpenEvent={setActiveEvent} />
      </section>

      <section className="mb-5 rounded-2xl border border-[#2a3336] bg-[#151b1d] p-4">
        <h2 className="mb-3 text-[15px] font-bold text-slate-200">티커 관리</h2>
        {tickerManager}
      </section>

      <section className="rounded-2xl border border-dashed border-[#334044] bg-[#141a1b] p-4 text-[13px] text-slate-400">
        <p className="font-semibold text-slate-200">Legacy CTA</p>
        <p className="mt-1">기존 티커 관리 흐름은 하단에 유지했습니다. 실제 저장/알림 연동은 이후 단계에서 연결합니다.</p>
      </section>

      <CalendarEventDialog event={activeEvent} onClose={() => setActiveEvent(null)} />
    </>
  );
}
