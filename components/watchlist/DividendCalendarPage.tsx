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
  loadCalendarCustomEvents as loadLocalCalendarCustomEvents,
  saveCalendarCustomEvents as saveLocalCalendarCustomEvents,
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
  loadPortfolioCalendarEventMetas,
  loadLegacyImportedCalendarEvents,
  loadPortfolioCalendarCustomEvents,
  saveCalendarCustomEvent as saveFirestoreCalendarCustomEvent,
  savePortfolioCalendarCustomEvent,
  saveCalendarEventMeta,
  savePortfolioCalendarEventMeta,
  saveCalendarTickerCacheEntry,
  savePortfolioCalendarTickerCacheEntry,
  warnFirestoreFallback,
  type CalendarEventMeta,
} from "@/lib/firebase/firestore-repositories";
import { DEFAULT_CALENDAR_PORTFOLIO_ID, getCalendarLocalStorageKey, getLegacyCalendarLocalStorageKey } from "@/lib/calendar-portfolio";
import { buildLiveCalendarCacheEntry, mergeFetchedEventsWithExistingCache, type DividendLiveResponse } from "@/lib/calendar-dividend-live";
import { loadCalendarCacheMap, saveCalendarCacheMap } from "@/lib/calendar-cache";
import CalendarGrid from "./CalendarGrid";
import CalendarEventDialog from "./CalendarEventDialog";
import CustomEventDialog, { type CustomEventSubmitInput } from "./CustomEventDialog";
import DividendSchedulePreview from "./DividendSchedulePreview";
import EconomicCalendarSection from "./EconomicCalendarSection";
import SelectedDateList from "./SelectedDateList";
import TaxSavingTable from "./TaxSavingTable";

interface Props {
  tickers: string[];
  tickerManager: ReactNode;
  onManagePortfolio?: () => void;
  onManageCalendarPortfolio?: () => void;
  activePortfolioId: string;
  activePortfolioName: string;
  // Legacy/imported 종목 메모 (ticker → memo). Already resolved by the parent;
  // selected-date cards and the event detail dialog share this ticker-level source.
  tickerMemos?: Record<string, string>;
  onSaveTickerMemo?: (ticker: string, memo: string) => void;
}

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

export default function DividendCalendarPage({ tickers, tickerManager, onManagePortfolio, onManageCalendarPortfolio, activePortfolioId, activePortfolioName, tickerMemos, onSaveTickerMemo }: Props) {
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
  const [taxQuoteByTicker, setTaxQuoteByTicker] = useState<Record<string, TaxSavingQuoteState>>({});
  const [taxQuoteLoadingTickers, setTaxQuoteLoadingTickers] = useState<Set<string>>(() => new Set());
  const [liveRefreshState, setLiveRefreshState] = useState<{ running: boolean; done: number; total: number; success: string[]; failed: string[]; message: string; lastUpdatedAt?: string }>({ running: false, done: 0, total: 0, success: [], failed: [], message: "" });
  const [cloudSaveState, setCloudSaveState] = useState<{ running: boolean; message: string }>({ running: false, message: "" });
  const [liveRefreshedTickerSet, setLiveRefreshedTickerSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storageKey = getCalendarLocalStorageKey("eventMetas", activePortfolioId);
      const stored = window.localStorage.getItem(storageKey) ?? (activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? window.localStorage.getItem(getLegacyCalendarLocalStorageKey("eventMetas")) : null);
      if (stored) setEventMetas(JSON.parse(stored) as Record<string, CalendarEventMeta>);
    } catch {
      window.localStorage.removeItem(getCalendarLocalStorageKey("eventMetas", activePortfolioId));
    }
    setCustomEvents(loadLocalCalendarCustomEvents(activePortfolioId));
    setLegacyImportedEvents([]);
    setProviderResult((current) => ({ ...current, events: [] }));
  }, [activePortfolioId]);

  useEffect(() => {
    if (!user) return;
    const metaLoad = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? loadCalendarEventMetas(user.uid) : loadPortfolioCalendarEventMetas(user.uid, activePortfolioId);
    metaLoad
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

    if (activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID) {
      loadLegacyImportedCalendarEvents(user.uid)
        .then(setLegacyImportedEvents)
        .catch((err) => warnFirestoreFallback("legacyCalendarEvents.load", err));
    } else {
      setLegacyImportedEvents([]);
    }

    const customLoad = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? loadFirestoreCalendarCustomEvents(user.uid) : loadPortfolioCalendarCustomEvents(user.uid, activePortfolioId);
    customLoad
      .then((events) => {
        if (events.length > 0) {
          setCustomEvents((current) => {
            const next = dedupeCalendarCustomEvents([...current, ...events]);
            saveLocalCalendarCustomEvents(next, activePortfolioId);
            return next;
          });
        }
      })
      .catch((err) => warnFirestoreFallback("calendarCustomEvents.load", err));
  }, [user, activePortfolioId]);

  useEffect(() => {
    let cancelled = false;
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
      saveLocalCalendarCustomEvents(nextCustomEvents, activePortfolioId);
      const updatedCustomEvent = nextCustomEvents.find((customEvent) => customEvent.id === (event.canonicalEventId ?? event.id));
      if (user && updatedCustomEvent) {
        const saveCustom = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveFirestoreCalendarCustomEvent(user.uid, updatedCustomEvent) : savePortfolioCalendarCustomEvent(user.uid, activePortfolioId, updatedCustomEvent);
        void saveCustom.catch((err) => warnFirestoreFallback("calendarCustomEvents.save", err));
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
        window.localStorage.setItem(getCalendarLocalStorageKey("eventMetas", activePortfolioId), JSON.stringify(next));
      } catch {
        // localStorage 사용 불가 환경에서는 화면 상태만 유지한다.
      }
    }
    if (user) {
      const saveMeta = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveCalendarEventMeta(user.uid, canonicalEventId, canonicalMeta) : savePortfolioCalendarEventMeta(user.uid, activePortfolioId, canonicalEventId, canonicalMeta);
      void saveMeta.catch((err) => warnFirestoreFallback("calendarEvents.save", err));
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
    const next = dedupeCalendarCustomEvents([...customEvents.filter((item) => item.id !== record.id), record]);
    saveLocalCalendarCustomEvents(next, activePortfolioId);
    setCustomEvents(next);
    setCustomDialogOpen(false);
    setEditingCustomEvent(null);
    setSelectedDate(record.date);
    if (user) {
      const saveCustom = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveFirestoreCalendarCustomEvent(user.uid, record) : savePortfolioCalendarCustomEvent(user.uid, activePortfolioId, record);
      void saveCustom.catch((err) => warnFirestoreFallback("calendarCustomEvents.save", err));
    }
  };

  const handleDeleteCustomEvent = (eventId: string) => {
    const next = customEvents.filter((item) => item.id !== eventId);
    saveLocalCalendarCustomEvents(next, activePortfolioId);
    setCustomEvents(next);
    setCustomDialogOpen(false);
    setEditingCustomEvent(null);
    if (user) {
      void deleteFirestoreCalendarCustomEvent(user.uid, eventId).catch((err) => warnFirestoreFallback("calendarCustomEvents.delete", err));
    }
  };

  const activeTickerSet = useMemo(() => new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)), [tickers]);

  // When imported (legacy/Firestore) calendar events exist, they are the single
  // source of truth — the mock/real provider events are NOT mixed in (prevents
  // stray SPY/QQQ/MSFT preview rows from polluting an imported calendar).
  const usedImportedEvents = legacyImportedEvents.length > 0;
  const dividendEvents = useMemo(() => {
    const selected = selectCalendarDividendEvents({ providerEvents: providerResult.events, importedEvents: legacyImportedEvents });
    const activeOnlyEvents = selected.events.filter((event) => !event.ticker || event.ticker === "CUSTOM" || activeTickerSet.has(event.ticker));
    if (!selected.usedImported || liveRefreshedTickerSet.size === 0) return activeOnlyEvents;
    const refreshedProviderEvents = providerResult.events.filter((event) => liveRefreshedTickerSet.has(event.ticker) && activeTickerSet.has(event.ticker));
    const preservedImportedEvents = legacyImportedEvents.filter((event) => !liveRefreshedTickerSet.has(event.ticker) && activeTickerSet.has(event.ticker));
    return [...preservedImportedEvents, ...refreshedProviderEvents].sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type));
  }, [activeTickerSet, legacyImportedEvents, liveRefreshedTickerSet, providerResult.events]);

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
  const taxCandidateRows = useMemo(() => buildTaxSavingRows(monthEvents.filter((event) => activeTickerSet.has(event.ticker)), { todayIso }), [activeTickerSet, monthEvents, todayIso]);
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
      buildTaxSavingRows(monthEvents.filter((event) => activeTickerSet.has(event.ticker)), {
        quoteByTicker: taxQuoteByTicker,
        loadingTickers: taxQuoteLoadingTickers,
        todayIso,
      }),
    [activeTickerSet, monthEvents, taxQuoteByTicker, taxQuoteLoadingTickers, todayIso],
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

  const waitForLiveRefreshRateLimit = (delayMs?: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, Math.max(0, delayMs ?? 0));
  });

  const handleRefreshDividendEvents = async () => {
    const uniqueTickers = Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)));
    setLiveRefreshState({ running: true, done: 0, total: uniqueTickers.length, success: [], failed: [], message: `Polygon 무료 한도 보호를 위해 순차 조회 중... 0/${uniqueTickers.length}` });
    const cacheMap = loadCalendarCacheMap<CalendarEvent>(activePortfolioId);
    const successfulEvents: CalendarEvent[] = [];
    const success: string[] = [];
    const failed: string[] = [];

    for (let index = 0; index < uniqueTickers.length; index += 1) {
      const ticker = uniqueTickers[index];
      let rateLimitDelayMs: number | undefined;
      try {
        const response = await fetch(`/api/calendar/dividend-events?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const payload = (await response.json()) as DividendLiveResponse;
        rateLimitDelayMs = payload.rateLimitDelayMs;
        if (!response.ok || payload.source === "unavailable" || payload.events.length === 0) {
          failed.push(ticker);
        } else {
          const source = payload.source === "live" ? "polygon" : "partial";
          const existingEvents = [
            ...(cacheMap[ticker]?.events ?? []),
            ...providerResult.events.filter((event) => event.ticker === ticker),
            ...legacyImportedEvents.filter((event) => event.ticker === ticker),
          ];
          const mergedEvents = mergeFetchedEventsWithExistingCache(existingEvents, payload.events);
          const cacheEntry = buildLiveCalendarCacheEntry(ticker, mergedEvents, source, payload.warnings);
          cacheMap[ticker] = cacheEntry;
          successfulEvents.push(...cacheEntry.events);
          success.push(ticker);
          if (user) {
            const saveCache = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveCalendarTickerCacheEntry(user.uid, cacheEntry as never) : savePortfolioCalendarTickerCacheEntry(user.uid, activePortfolioId, cacheEntry as never);
            void saveCache.catch((err) => warnFirestoreFallback("calendarCache.liveRefresh.save", err));
          }
        }
      } catch {
        failed.push(ticker);
      }
      const done = index + 1;
      setLiveRefreshState({ running: true, done, total: uniqueTickers.length, success: [...success], failed: [...failed], message: `Polygon 무료 한도 보호를 위해 순차 조회 중... ${done}/${uniqueTickers.length}` });
      if (index < uniqueTickers.length - 1 && rateLimitDelayMs && rateLimitDelayMs > 0) {
        await waitForLiveRefreshRateLimit(rateLimitDelayMs);
      }
    }

    if (success.length > 0) {
      saveCalendarCacheMap(cacheMap, activePortfolioId);
      const nextProviderEvents = [
        ...providerResult.events.filter((event) => !success.includes(event.ticker)),
        ...successfulEvents,
      ].sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type));
      setProviderResult((current) => ({ ...current, events: nextProviderEvents, cacheMap: { ...current.cacheMap, ...cacheMap }, source: failed.length > 0 ? "partial" : "polygon", warnings: failed.length > 0 ? [`Live refresh partially failed: ${failed.join(", ")}`] : [] }));
      setLiveRefreshedTickerSet((current) => new Set([...Array.from(current), ...success]));
    }

    const lastUpdatedAt = new Date().toISOString();
    setLiveRefreshState({ running: false, done: uniqueTickers.length, total: uniqueTickers.length, success, failed, lastUpdatedAt, message: `배당 일정 최신화 완료: 성공 ${success.length}개, 실패 ${failed.length}개${failed.length ? ` · 실패: ${failed.join(", ")}` : ""}` });
  };

  const handleCloudSave = async () => {
    if (!user) { setCloudSaveState({ running: false, message: "로그인이 필요합니다" }); return; }
    setCloudSaveState({ running: true, message: "클라우드 저장 중..." });
    try {
      const cacheMap = loadCalendarCacheMap<CalendarEvent>(activePortfolioId);
      const cacheEntries = Object.values(cacheMap);
      await Promise.all([
        ...cacheEntries.map((entry) => activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveCalendarTickerCacheEntry(user.uid, entry as never) : savePortfolioCalendarTickerCacheEntry(user.uid, activePortfolioId, entry as never)),
        ...customEvents.map((event) => activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveFirestoreCalendarCustomEvent(user.uid, event) : savePortfolioCalendarCustomEvent(user.uid, activePortfolioId, event)),
        ...Object.entries(eventMetas).map(([eventId, meta]) => activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveCalendarEventMeta(user.uid, eventId, meta) : savePortfolioCalendarEventMeta(user.uid, activePortfolioId, eventId, meta)),
      ]);
      setCloudSaveState({ running: false, message: `클라우드 저장 완료: cache ${cacheEntries.length}개, custom ${customEvents.length}개, meta ${Object.keys(eventMetas).length}개` });
    } catch {
      setCloudSaveState({ running: false, message: "클라우드 저장에 실패했습니다. Firebase 설정과 로그인 상태를 확인하세요." });
    }
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-extrabold text-white sm:text-[26px]">배당캘린더</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshDividendEvents}
              disabled={liveRefreshState.running || tickers.length === 0}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
            >
              🔄 일정 최신화
            </button>
            <button
              type="button"
              onClick={handleCloudSave}
              disabled={!user || cloudSaveState.running}
              title={user ? "현재 캘린더 cache/custom events/event metas를 클라우드에 저장합니다." : "로그인이 필요합니다"}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-700 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-cyan-200"
            >
              💾 클라우드 저장
            </button>
          </div>
        </div>
        <p className="mt-1 text-[12px] text-slate-500 sm:text-[13px]">배당락·매수마감·지급·실적을 한 화면에서 확인합니다.</p>
        {liveRefreshState.message && (
          <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {liveRefreshState.message}
            {liveRefreshState.lastUpdatedAt ? ` · 마지막 최신화: ${new Date(liveRefreshState.lastUpdatedAt).toLocaleString("ko-KR", { hour12: false })}` : ""}
          </p>
        )}
        {cloudSaveState.message && (
          <p className="mt-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">{cloudSaveState.message}</p>
        )}
        {!usedImportedEvents && providerResult.warnings.length > 0 && (
          <p className="mt-1 truncate text-[11px] text-slate-500" title={providerResult.warnings.join(" | ")}>
            ⚠ {providerResult.warnings[0]}
          </p>
        )}
      </div>

      {/* Main content — wide calendar + narrow 절세액 rail. The top filter card
          and portfolio card are gone; filters now live on the calendar's bottom
          toolbar and portfolio management moved into the 티커 관리 section. */}
      <section className="mb-4">
        {/* Calendar card + 절세액 rail share one stretched row so the rail's
            height tracks the calendar CARD (not the selected-date list, which now
            sits full-width below). The rail is absolutely filled on desktop so it
            never dictates the row height — it always matches the calendar and
            scrolls internally. */}
        {/* All three blocks live in one grid so CSS `order` can reshuffle them on
            mobile (< md) without touching the desktop/tablet layout. Mobile order:
            캘린더 → 선택 날짜 일정 → 종목별 예상 절세액. At md+ `order-none` restores the
            source order (캘린더 → 절세액 → 선택 날짜 일정) and the xl 2-column layout. */}
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="order-1 min-w-0 md:order-none">
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
              taxSavingByTicker={taxSavingByTicker}
              filters={filters}
              onToggleFilter={(type) => setFilters((current) => ({ ...current, [type]: !current[type] }))}
              onAddEvent={openCreateCustomEvent}
            />
          </div>
          <aside className="relative order-3 min-w-0 md:order-none">
            <div className="xl:absolute xl:inset-0">
              <TaxSavingTable rows={taxRows} />
            </div>
          </aside>
          <div className="order-2 min-w-0 md:order-none xl:col-span-2">
            <SelectedDateList
              selectedDate={selectedDate}
              events={selectedEvents}
              todayIso={todayIso}
              onOpenEvent={handleOpenEvent}
              taxSavingByTicker={taxSavingByTicker}
              tickerMemos={tickerMemos}
            />
          </div>
        </div>
      </section>

      {/* U.S. economic calendar (this week / next week) */}
      <section className="mb-4">
        <EconomicCalendarSection />
      </section>

      {/* Schedule preview */}
      <section className="mb-4">
        <DividendSchedulePreview events={events} monthStartIso={monthStartIso} monthEndIso={monthEndIso} onOpenEvent={handleOpenEvent} />
      </section>

      {/* Ticker management — also hosts portfolio management (merged from the
          removed top 포트폴리오 card). The "포트폴리오 관리" button opens the existing
          add/remove modal; the ticker grid + legacy memo wiring are unchanged. */}
      <section className="mb-4 rounded-2xl border border-[#2a3336] bg-[#151b1d] p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-slate-200">티커 관리</h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">현재 포트폴리오: {activePortfolioName}</p>
          </div>
          <div className="flex gap-2"><button
            type="button"
            onClick={onManageCalendarPortfolio}
            className="shrink-0 whitespace-nowrap rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1.5 text-[12px] font-semibold text-blue-600 transition hover:bg-blue-500/20 dark:text-blue-200"
          >
            포트폴리오 관리
          </button>
          <button
            type="button"
            onClick={onManagePortfolio}
            className="shrink-0 whitespace-nowrap rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1.5 text-[12px] font-semibold text-blue-600 transition hover:bg-blue-500/20 dark:text-blue-200"
          >
            종목 관리
          </button></div>
        </div>
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
