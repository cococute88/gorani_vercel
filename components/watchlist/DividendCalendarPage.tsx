"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatIsoDate } from "@/lib/calendar-grid";
import { sortCalendarEventsByPriority } from "@/lib/calendar-event-sort";
import { getCalendarEventsForTickers, getCalendarEventsForTickersWithProvider, isCustomCalendarEventLike, mergeGeneratedAndCustomCalendarEvents, selectCalendarDividendEvents } from "@/lib/calendar-event-provider";
import type { CalendarTickersProviderResult } from "@/lib/calendar-event-provider";
import {
  createCalendarCustomEvent,
  dedupeCalendarCustomEvents,
  deleteCalendarCustomEvent as deleteLocalCalendarCustomEvent,
  loadCalendarCustomEvents as loadLocalCalendarCustomEvents,
  saveCalendarCustomEvents as saveLocalCalendarCustomEvents,
  upsertCalendarCustomEvent as upsertLocalCalendarCustomEvent,
  type CalendarCustomEvent,
} from "@/lib/calendar-custom-events";
import { fetchQuoteLast } from "@/lib/calculator-data-provider";
import { DEFAULT_CALENDAR_FILTERS, buildTaxSavingRows } from "@/lib/mock-calendar-data";
import type { CalendarEvent, CalendarEventType, TaxSavingQuoteState } from "@/lib/mock-calendar-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  deleteCalendarCustomEvent as deleteFirestoreCalendarCustomEvent,
  loadCalendarCustomEvents as loadFirestoreCalendarCustomEvents,
  loadCalendarEventMetas,
  loadLegacyImportedCalendarEvents,
  saveCalendarCustomEvent as saveFirestoreCalendarCustomEvent,
  saveCalendarEventMeta,
  warnFirestoreFallback,
  type CalendarEventMeta,
} from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { EVENT_VISUALS } from "@/lib/event-visuals";
import CalendarGrid from "./CalendarGrid";
import CalendarEventDialog from "./CalendarEventDialog";
import CustomEventDialog, { type CustomEventSubmitInput } from "./CustomEventDialog";
import DividendSchedulePreview from "./DividendSchedulePreview";
import EconomicCalendarSection from "./EconomicCalendarSection";
import PortfolioSelectorMock from "./PortfolioSelectorMock";
import SelectedDateList from "./SelectedDateList";
import TaxSavingTable from "./TaxSavingTable";

interface Props {
  tickers: string[];
  tickerManager: ReactNode;
  headerAccessory?: ReactNode;
  onManagePortfolio?: () => void;
  // Legacy/imported 종목 메모 (ticker → memo). Already resolved by the parent;
  // selected-date cards and the event detail dialog share this ticker-level source.
  tickerMemos?: Record<string, string>;
  onSaveTickerMemo?: (ticker: string, memo: string) => void;
}

const CALENDAR_EVENT_META_STORAGE_KEY = STORAGE_KEYS.calendarEventMeta;

// Custom/user events are not part of the dividend-type filter — they always show
// on the grid as date-line text, so only the four dividend types are toggleable.
const FILTER_ORDER: CalendarEventType[] = ["ex_div", "buy_by", "pay", "earnings"];

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

export default function DividendCalendarPage({ tickers, tickerManager, headerAccessory, onManagePortfolio, tickerMemos, onSaveTickerMemo }: Props) {
  const { user } = useFirebaseAuth();
  const today = new Date();
  const todayIso = formatIsoDate(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [filters, setFilters] = useState<Record<CalendarEventType, boolean>>(DEFAULT_CALENDAR_FILTERS);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [eventMetas, setEventMetas] = useState<Record<string, CalendarEventMeta>>({});
  const [legacyImportedEvents, setLegacyImportedEvents] = useState<CalendarEvent[]>([]);
  const [customEvents, setCustomEvents] = useState<CalendarCustomEvent[]>([]);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingCustomEvent, setEditingCustomEvent] = useState<CalendarCustomEvent | null>(null);
  const [providerResult, setProviderResult] = useState<CalendarTickersProviderResult>(() => ({
    events: getCalendarEventsForTickers({ tickers, year: today.getFullYear(), month: today.getMonth() + 1 }),
    tickerResults: [],
    cacheMap: {},
    source: "mock",
    warnings: ["Initial mock events are shown until the dividend provider finishes."],
  }));
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [taxQuoteByTicker, setTaxQuoteByTicker] = useState<Record<string, TaxSavingQuoteState>>({});
  const [taxQuoteLoadingTickers, setTaxQuoteLoadingTickers] = useState<Set<string>>(() => new Set());

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

    loadLegacyImportedCalendarEvents(user.uid)
      .then(setLegacyImportedEvents)
      .catch((err) => warnFirestoreFallback("legacyCalendarEvents.load", err));

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

  const openCreateCustomEvent = () => {
    setEditingCustomEvent(null);
    setCustomDialogOpen(true);
  };

  const openEditCustomEvent = (event: CalendarEvent) => {
    const targetId = event.canonicalEventId ?? event.id;
    setEditingCustomEvent(customEvents.find((customEvent) => customEvent.id === targetId) ?? null);
    setCustomDialogOpen(true);
  };

  // Custom events open the lightweight custom dialog; generated dividend events keep the read/meta dialog.
  const handleOpenEvent = (event: CalendarEvent) => {
    if (isCustomCalendarEventLike(event)) {
      openEditCustomEvent(event);
      return;
    }
    setActiveEvent(event);
  };

  const handleSubmitCustomEvent = (input: CustomEventSubmitInput) => {
    const record = createCalendarCustomEvent({
      id: input.id,
      title: input.title,
      date: input.date,
      ticker: input.ticker,
      note: input.note,
      createdAt: input.createdAt,
    });
    const next = upsertLocalCalendarCustomEvent(record);
    setCustomEvents(next);
    setCustomDialogOpen(false);
    setEditingCustomEvent(null);
    setSelectedDate(record.date);
    if (user) {
      void saveFirestoreCalendarCustomEvent(user.uid, record).catch((err) => warnFirestoreFallback("calendarCustomEvents.save", err));
    }
  };

  const handleDeleteCustomEvent = (eventId: string) => {
    const next = deleteLocalCalendarCustomEvent(eventId);
    setCustomEvents(next);
    setCustomDialogOpen(false);
    setEditingCustomEvent(null);
    if (user) {
      void deleteFirestoreCalendarCustomEvent(user.uid, eventId).catch((err) => warnFirestoreFallback("calendarCustomEvents.delete", err));
    }
  };

  // When imported (legacy/Firestore) calendar events exist, they are the single
  // source of truth — the mock/real provider events are NOT mixed in (prevents
  // stray SPY/QQQ/MSFT preview rows from polluting an imported calendar).
  const usedImportedEvents = legacyImportedEvents.length > 0;
  const dividendEvents = useMemo(
    () => selectCalendarDividendEvents({ providerEvents: providerResult.events, importedEvents: legacyImportedEvents }).events,
    [legacyImportedEvents, providerResult.events],
  );

  const events = useMemo(() => mergeGeneratedAndCustomCalendarEvents(dividendEvents, customEvents).map((event) => {
    const meta = resolveCalendarEventMeta(event, eventMetas);
    if (!meta) return event;
    return { ...event, favorite: meta.star ? "⭐" : meta.heart ? "💗" : event.favorite, note: meta.memo ?? event.note };
  }), [dividendEvents, customEvents, eventMetas]);
  const filteredEvents = useMemo(() => events.filter((event) => filters[event.type]), [events, filters]);
  // Custom events always render on the grid (date-line text) regardless of the dividend-type filter.
  const customCalendarEvents = useMemo(() => events.filter((event) => event.type === "custom"), [events]);
  const selectedEvents = useMemo(() => sortCalendarEventsByPriority(filteredEvents.filter((event) => event.date === selectedDate)), [filteredEvents, selectedDate]);
  const monthStartIso = useMemo(() => formatIsoDate(new Date(month.getFullYear(), month.getMonth(), 1)), [month]);
  const monthEndIso = useMemo(() => formatIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)), [month]);
  const monthEvents = useMemo(() => events.filter((event) => event.date >= monthStartIso && event.date <= monthEndIso), [events, monthEndIso, monthStartIso]);
  const taxCandidateRows = useMemo(() => buildTaxSavingRows(monthEvents, { todayIso }), [monthEvents, todayIso]);
  const taxQuoteTickerKey = useMemo(() => taxCandidateRows.map((row) => row.ticker).join("|"), [taxCandidateRows]);

  useEffect(() => {
    let cancelled = false;
    const quoteTickers = taxQuoteTickerKey ? taxQuoteTickerKey.split("|").filter(Boolean) : [];

    if (quoteTickers.length === 0) {
      setTaxQuoteByTicker({});
      setTaxQuoteLoadingTickers(new Set());
      return () => {
        cancelled = true;
      };
    }

    setTaxQuoteLoadingTickers(new Set(quoteTickers));

    Promise.all(
      quoteTickers.map(async (ticker) => {
        try {
          const quote = await fetchQuoteLast({ ticker });
          return {
            ticker,
            quote: {
              price: quote.price,
              warnings: quote.warnings,
              source: quote.source,
            } satisfies TaxSavingQuoteState,
          };
        } catch (error) {
          return {
            ticker,
            quote: {
              price: null,
              warnings: [`Quote last request failed for ${ticker}: ${error instanceof Error ? error.message : String(error)}`],
              source: "sample",
            } satisfies TaxSavingQuoteState,
          };
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, TaxSavingQuoteState> = {};
        for (const result of results) {
          next[result.ticker] = result.quote;
        }
        setTaxQuoteByTicker(next);
      })
      .finally(() => {
        if (!cancelled) setTaxQuoteLoadingTickers(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [taxQuoteTickerKey]);

  const taxRows = useMemo(
    () =>
      buildTaxSavingRows(monthEvents, {
        quoteByTicker: taxQuoteByTicker,
        loadingTickers: taxQuoteLoadingTickers,
        todayIso,
      }),
    [monthEvents, taxQuoteByTicker, taxQuoteLoadingTickers, todayIso],
  );

  // Per-ticker tax-saving estimate (현시세 기준 · 만달러당) reused for the
  // selected-date cards — same source as the right-rail 절세액 table.
  const taxSavingByTicker = useMemo(() => {
    const map: Record<string, { taxSavingUsd: number; canCalculate: boolean; isLoading?: boolean }> = {};
    for (const row of taxRows) {
      map[row.ticker] = { taxSavingUsd: row.taxSavingUsd, canCalculate: row.canCalculate, isLoading: row.isLoading };
    }
    return map;
  }, [taxRows]);

  const moveMonth = (delta: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const goToday = () => {
    const next = new Date(today.getFullYear(), today.getMonth(), 1);
    setMonth(next);
    setSelectedDate(todayIso);
  };

  const sourceLabel = usedImportedEvents ? "IMPORTED" : isProviderLoading ? "LOADING" : providerResult.source.toUpperCase();
  const sourceColor = usedImportedEvents
    ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
    : isProviderLoading
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
        {!usedImportedEvents && providerResult.warnings.length > 0 && (
          <p className="mt-1 truncate text-[11px] text-slate-500" title={providerResult.warnings.join(" | ")}>
            ⚠ {providerResult.warnings[0]}
          </p>
        )}
      </div>

      {/* Filters */}
      <section className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr]">
        <PortfolioSelectorMock onManage={onManagePortfolio} />
        <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-bold text-slate-300 sm:text-[14px]">필터</h2>
            <button
              type="button"
              onClick={openCreateCustomEvent}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-100 transition hover:bg-amber-500/25 sm:text-[12px]"
            >
              + 일정 추가
            </button>
          </div>
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
      <section className="mb-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <CalendarGrid
            month={month}
            events={filteredEvents}
            customEvents={customCalendarEvents}
            selectedDate={selectedDate}
            todayIso={todayIso}
            onSelectDate={setSelectedDate}
            onOpenEvent={handleOpenEvent}
            onPrevMonth={() => moveMonth(-1)}
            onNextMonth={() => moveMonth(1)}
            onToday={goToday}
          />
          <SelectedDateList
            selectedDate={selectedDate}
            events={selectedEvents}
            todayIso={todayIso}
            onOpenEvent={handleOpenEvent}
            taxSavingByTicker={taxSavingByTicker}
            tickerMemos={tickerMemos}
          />
        </div>
        <aside className="xl:sticky xl:top-4">
          <TaxSavingTable rows={taxRows} />
        </aside>
      </section>

      {/* U.S. economic calendar (this week / next week) */}
      <section className="mb-4">
        <EconomicCalendarSection />
      </section>

      {/* Schedule preview */}
      <section className="mb-4">
        <DividendSchedulePreview events={events} monthStartIso={monthStartIso} monthEndIso={monthEndIso} onOpenEvent={handleOpenEvent} />
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
        onSaveTickerMemo={onSaveTickerMemo}
        tickerMemos={tickerMemos}
        taxSavingByTicker={taxSavingByTicker}
        onClose={() => setActiveEvent(null)}
      />

      <CustomEventDialog
        open={customDialogOpen}
        event={editingCustomEvent}
        defaultDate={selectedDate || todayIso}
        onClose={() => {
          setCustomDialogOpen(false);
          setEditingCustomEvent(null);
        }}
        onSubmit={handleSubmitCustomEvent}
        onDelete={handleDeleteCustomEvent}
      />
    </>
  );
}
