"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatIsoDate } from "@/lib/calendar-grid";
import { getCalendarEventsForTickers, getCalendarEventsForTickersWithProvider, isCustomCalendarEventLike, mergeGeneratedAndCustomCalendarEvents } from "@/lib/calendar-event-provider";
import type { CalendarTickersProviderResult } from "@/lib/calendar-event-provider";
import {
  dedupeCalendarCustomEvents,
  loadCalendarCustomEvents as loadLocalCalendarCustomEvents,
  saveCalendarCustomEvents as saveLocalCalendarCustomEvents,
  type CalendarCustomEvent,
} from "@/lib/calendar-custom-events";
import { DEFAULT_CALENDAR_FILTERS, buildTaxSavingRows } from "@/lib/mock-calendar-data";
import type { CalendarEvent, CalendarEventType } from "@/lib/mock-calendar-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  loadCalendarCustomEvents as loadFirestoreCalendarCustomEvents,
  loadCalendarEventMetas,
  saveCalendarCustomEvent as saveFirestoreCalendarCustomEvent,
  saveCalendarEventMeta,
  warnFirestoreFallback,
  type CalendarEventMeta,
} from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";
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
  headerAccessory?: ReactNode;
}

const CALENDAR_EVENT_META_STORAGE_KEY = STORAGE_KEYS.calendarEventMeta;

const FILTER_ORDER: CalendarEventType[] = ["ex_div", "buy_by", "pay", "earnings", "custom"];

function getCalendarEventMetaKey(event: CalendarEvent): string {
  return event.canonicalEventId ?? event.id;
}

function getCalendarEventMetaLookupKeys(event: CalendarEvent): string[] {
  return Array.from(new Set([event.canonicalEventId, event.legacyEventId, event.id].filter(Boolean) as string[]));
}

function resolveCalendarEventMeta(event: CalendarEvent, metas: Record<string, CalendarEventMeta>): CalendarEventMeta | undefined {
  for (const key of getCalendarEventMetaLookupKeys(event)) {
    const meta = metas[key];
    if (meta) return meta;
  }
  return undefined;
}

export default function DividendCalendarPage({ tickers, tickerManager, headerAccessory }: Props) {
  const { user } = useFirebaseAuth();
  const today = new Date();
  const todayIso = formatIsoDate(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [filters, setFilters] = useState<Record<CalendarEventType, boolean>>(DEFAULT_CALENDAR_FILTERS);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [eventMetas, setEventMetas] = useState<Record<string, CalendarEventMeta>>({});
  const [customEvents, setCustomEvents] = useState<CalendarCustomEvent[]>([]);
  const [providerResult, setProviderResult] = useState<CalendarTickersProviderResult>(() => ({
    events: getCalendarEventsForTickers({ tickers, year: today.getFullYear(), month: today.getMonth() + 1 }),
    tickerResults: [],
    cacheMap: {},
    source: "mock",
    warnings: ["Initial mock events are shown until the dividend provider finishes."],
  }));
  const [isProviderLoading, setIsProviderLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(CALENDAR_EVENT_META_STORAGE_KEY);
      if (stored) setEventMetas(JSON.parse(stored) as Record<string, CalendarEventMeta>);
    } catch {
      window.localStorage.removeItem(CALENDAR_EVENT_META_STORAGE_KEY);
    }
    setCustomEvents(loadLocalCalendarCustomEvents());
  }, []);

  useEffect(() => {
    if (!user) return;
    loadCalendarEventMetas(user.uid)
      .then((metas) => {
        if (metas.length > 0) {
          const next: Record<string, CalendarEventMeta> = {};
          for (const meta of metas) {
            next[meta.eventId] = meta;
            if (meta.canonicalEventId) next[meta.canonicalEventId] = meta;
          }
          setEventMetas(next);
        }
      })
      .catch((err) => warnFirestoreFallback("calendarEvents.load", err));

    loadFirestoreCalendarCustomEvents(user.uid)
      .then((events) => {
        if (events.length > 0) {
          setCustomEvents((current) => {
            const next = dedupeCalendarCustomEvents([...current, ...events]);
            saveLocalCalendarCustomEvents(next);
            return next;
          });
        }
      })
      .catch((err) => warnFirestoreFallback("calendarCustomEvents.load", err));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setIsProviderLoading(true);
    getCalendarEventsForTickersWithProvider({
      tickers,
      year: month.getFullYear(),
      month: month.getMonth() + 1,
      provider: "real",
      preferFreshCache: true,
    })
      .then((result) => {
        if (!cancelled) setProviderResult(result);
      })
      .catch((error) => {
        if (cancelled) return;
        setProviderResult({
          events: getCalendarEventsForTickers({ tickers, year: month.getFullYear(), month: month.getMonth() + 1 }),
          tickerResults: [],
          cacheMap: {},
          source: "mock",
          warnings: [`Calendar provider failed; mock fallback is shown: ${error instanceof Error ? error.message : String(error)}`],
        });
      })
      .finally(() => {
        if (!cancelled) setIsProviderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, tickers]);

  const persistEventMeta = (event: CalendarEvent, meta: CalendarEventMeta) => {
    if (isCustomCalendarEventLike(event)) {
      const nextCustomEvents = customEvents.map((customEvent) =>
        customEvent.id === (event.canonicalEventId ?? event.id)
          ? { ...customEvent, note: meta.memo ?? customEvent.note, updatedAt: new Date().toISOString() }
          : customEvent,
      );
      setCustomEvents(nextCustomEvents);
      saveLocalCalendarCustomEvents(nextCustomEvents);
      const updatedCustomEvent = nextCustomEvents.find((customEvent) => customEvent.id === (event.canonicalEventId ?? event.id));
      if (user && updatedCustomEvent) {
        void saveFirestoreCalendarCustomEvent(user.uid, updatedCustomEvent).catch((err) => warnFirestoreFallback("calendarCustomEvents.save", err));
      }
      return;
    }

    const canonicalEventId = getCalendarEventMetaKey(event);
    const canonicalMeta: CalendarEventMeta = {
      ...meta,
      eventId: canonicalEventId,
      canonicalEventId,
      ticker: event.ticker,
      sourceKind: event.sourceKind ?? meta.sourceKind,
    };
    const next = { ...eventMetas, [canonicalEventId]: canonicalMeta };
    setEventMetas(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CALENDAR_EVENT_META_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage 사용 불가 환경에서는 화면 상태만 유지한다.
      }
    }
    if (user) {
      void saveCalendarEventMeta(user.uid, canonicalEventId, canonicalMeta).catch((err) => warnFirestoreFallback("calendarEvents.save", err));
    }
  };

  const events = useMemo(() => mergeGeneratedAndCustomCalendarEvents(providerResult.events, customEvents).map((event) => {
    const meta = resolveCalendarEventMeta(event, eventMetas);
    if (!meta) return event;
    return { ...event, favorite: meta.star ? "⭐" : meta.heart ? "💗" : event.favorite, note: meta.memo ?? event.note };
  }), [providerResult.events, customEvents, eventMetas]);
  const filteredEvents = useMemo(() => events.filter((event) => filters[event.type]), [events, filters]);
  const selectedEvents = useMemo(() => filteredEvents.filter((event) => event.date === selectedDate), [filteredEvents, selectedDate]);
  const monthStartIso = useMemo(() => formatIsoDate(new Date(month.getFullYear(), month.getMonth(), 1)), [month]);
  const monthEndIso = useMemo(() => formatIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)), [month]);
  const monthEvents = useMemo(() => events.filter((event) => event.date >= monthStartIso && event.date <= monthEndIso), [events, monthEndIso, monthStartIso]);
  const keyEvents = useMemo(() => filteredEvents.filter((event) => event.date >= monthStartIso && event.date <= monthEndIso).slice(0, 5), [filteredEvents, monthEndIso, monthStartIso]);
  const taxRows = useMemo(() => buildTaxSavingRows(monthEvents), [monthEvents]);

  const moveMonth = (delta: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const goToday = () => {
    const next = new Date(today.getFullYear(), today.getMonth(), 1);
    setMonth(next);
    setSelectedDate(todayIso);
  };

  const sourceLabel = isProviderLoading ? "LOADING" : providerResult.source.toUpperCase();
  const sourceColor = isProviderLoading
    ? "bg-yellow-500/15 border-yellow-400/40 text-yellow-300"
    : providerResult.source === "mock" || providerResult.source === "sample"
      ? "bg-slate-500/15 border-slate-400/40 text-slate-300"
      : providerResult.source === "cache"
        ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-300"
        : "bg-emerald-500/15 border-emerald-400/40 text-emerald-300";

  return (
    <>
      {/* Page header */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-extrabold text-white sm:text-[26px]">배당캘린더</h1>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold sm:text-[11px] ${sourceColor}`}>
              {sourceLabel}
            </span>
            {headerAccessory}
          </div>
        </div>
        <p className="mt-1 text-[12px] text-slate-500 sm:text-[13px]">배당락·매수마감·지급·실적을 한 화면에서 확인합니다.</p>
        {providerResult.warnings.length > 0 && (
          <p className="mt-1 truncate text-[11px] text-slate-500" title={providerResult.warnings.join(" | ")}>
            ⚠ {providerResult.warnings[0]}
          </p>
        )}
      </div>

      {/* Filters */}
      <section className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr]">
        <PortfolioSelectorMock />
        <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
          <h2 className="mb-2 text-[13px] font-bold text-slate-300 sm:text-[14px]">필터</h2>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {FILTER_ORDER.map((type) => {
              const visual = EVENT_VISUALS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, [type]: !current[type] }))}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition sm:px-3 sm:py-1.5 sm:text-[12px] ${filters[type] ? `${visual.bg} ${visual.border} ${visual.text}` : "border-white/10 bg-white/5 text-slate-500"}`}
                >
                  {visual.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
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
        <aside className="space-y-4">
          <TaxSavingTable rows={taxRows} />
          <CalendarEventList title="이번 달 주요 일정" events={keyEvents} todayIso={todayIso} onOpenEvent={setActiveEvent} />
        </aside>
      </section>

      {/* Schedule preview */}
      <section className="mb-4">
        <DividendSchedulePreview events={events} onOpenEvent={setActiveEvent} />
      </section>

      {/* Ticker management */}
      <section className="mb-4 rounded-2xl border border-[#2a3336] bg-[#151b1d] p-3 sm:p-4">
        <h2 className="mb-3 text-[14px] font-bold text-slate-200">티커 관리</h2>
        {tickerManager}
      </section>

      <CalendarEventDialog
        event={activeEvent}
        meta={activeEvent ? resolveCalendarEventMeta(activeEvent, eventMetas) : undefined}
        onSaveMeta={persistEventMeta}
        onClose={() => setActiveEvent(null)}
      />
    </>
  );
}
