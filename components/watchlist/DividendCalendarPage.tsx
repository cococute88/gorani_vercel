"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  loadCalendarTickerCacheEntry,
  loadPortfolioCalendarTickerCacheEntry,
  savePortfolioCalendarTickerCacheEntry,
  saveCalendarCloudSavedAt,
  loadCalendarCloudSavedAt,
  warnFirestoreFallback,
  type CalendarEventMeta,
} from "@/lib/firebase/firestore-repositories";
import { DEFAULT_CALENDAR_PORTFOLIO_ID, getCalendarLocalStorageKey, getLegacyCalendarLocalStorageKey } from "@/lib/calendar-portfolio";
import { buildLiveCalendarCacheEntry, mergeFetchedEventsWithExistingCache, type DividendLiveResponse, type ProviderStatus } from "@/lib/calendar-dividend-live";
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


function summarizeCalendarEventForTrace(event: CalendarEvent) {
  return {
    ticker: event.ticker,
    eventType: event.type,
    estimated: event.status === "estimated" || event.sourceKind === "estimated",
    exDate: event.exDivDate,
    buyDate: event.buyDeadline,
    paymentDate: event.paymentDate,
    source: event.sourceKind ?? "unknown",
    eventDate: event.date,
    id: event.id,
  };
}

const RITM_TRACE_TICKER = "RITM";

function traceTimestamp() {
  return new Date().toISOString();
}

function summarizeRitmEvents(events: CalendarEvent[]) {
  return events.filter((event) => event.ticker === RITM_TRACE_TICKER).map(summarizeCalendarEventForTrace);
}

function traceCalendarFlow(stage: string, events: CalendarEvent[], changedBy?: string, beforeEvents?: CalendarEvent[]) {
  const rows = events.map(summarizeCalendarEventForTrace);
  const beforeRitm = beforeEvents ? summarizeRitmEvents(beforeEvents) : [];
  const afterRitm = rows.filter((row) => row.ticker === RITM_TRACE_TICKER);
  console.info(`[dividend-calendar:trace] ${traceTimestamp()} ${stage}`, {
    timestamp: traceTimestamp(),
    stage,
    count: rows.length,
    ticker: RITM_TRACE_TICKER,
    before: beforeRitm,
    after: afterRitm,
    changedBy: changedBy ?? stage,
    ritm: afterRitm,
    rows,
  });
}

function traceCalendarStateUpdate(name: string, nextEvents: CalendarEvent[], beforeEvents?: CalendarEvent[]) {
  traceCalendarFlow(`React State Update: ${name}`, nextEvents, name, beforeEvents);
}

function traceEffect(name: string, detail?: Record<string, unknown>) {
  console.info(`[dividend-calendar:effect] ${traceTimestamp()} ${name}`, { timestamp: traceTimestamp(), effect: name, ...detail });
}

function summarizeCacheEntryForTrace(entry: { ticker: string; events?: CalendarEvent[]; source?: string } | null | undefined) {
  return entry ? { ticker: entry.ticker, source: entry.source, events: (entry.events ?? []).map(summarizeCalendarEventForTrace) } : null;
}

function areCacheEntryEventsEqual(a: { events?: CalendarEvent[] } | null | undefined, b: { events?: CalendarEvent[] } | null | undefined) {
  return JSON.stringify((a?.events ?? []).map(summarizeCalendarEventForTrace)) === JSON.stringify((b?.events ?? []).map(summarizeCalendarEventForTrace));
}

function resolveCalendarEventMeta(event: CalendarEvent, metas: Record<string, CalendarEventMeta>): CalendarEventMeta | undefined {
  for (const key of getCalendarEventMetaLookupKeys(event)) {
    const meta = metas[key];
    if (meta) return meta;
  }
  return undefined;
}

export default function DividendCalendarPage({ tickers, tickerManager, onManagePortfolio, onManageCalendarPortfolio, activePortfolioId, activePortfolioName, tickerMemos, onSaveTickerMemo }: Props) {
  const { user, loading: authLoading, configured: authConfigured } = useFirebaseAuth();
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
  const [liveRefreshState, setLiveRefreshState] = useState<{ running: boolean; done: number; total: number; success: string[]; failed: string[]; message: string; details?: string[]; tone?: "info" | "error"; lastUpdatedAt?: string }>({ running: false, done: 0, total: 0, success: [], failed: [], message: "" });
  const [cloudSaveState, setCloudSaveState] = useState<{ running: boolean; message: string }>({ running: false, message: "" });
  const [cloudSavedAt, setCloudSavedAt] = useState<string | null>(null);
  const [cloudSaveNeeded, setCloudSaveNeeded] = useState(false);
  const [liveRefreshedTickerSet, setLiveRefreshedTickerSet] = useState<Set<string>>(() => new Set());
  const providerEventsTraceRef = useRef<CalendarEvent[]>(providerResult.events);
  const legacyImportedEventsTraceRef = useRef<CalendarEvent[]>(legacyImportedEvents);

  useEffect(() => {
    providerEventsTraceRef.current = providerResult.events;
  }, [providerResult.events]);

  useEffect(() => {
    legacyImportedEventsTraceRef.current = legacyImportedEvents;
  }, [legacyImportedEvents]);

  useEffect(() => {
    traceEffect("Application Start", { activePortfolioId, activePortfolioName, tickers });
  }, [activePortfolioId, activePortfolioName, tickers]);

  useEffect(() => {
    traceEffect("Authentication Ready", { uid: user?.uid ?? null, authenticated: Boolean(user) });
  }, [user]);

  useEffect(() => {
    traceEffect("DividendCalendarPage useEffect: Local Cache Read / portfolio", { activePortfolioId });
    if (typeof window === "undefined") return;
    try {
      const storageKey = getCalendarLocalStorageKey("eventMetas", activePortfolioId);
      const stored = window.localStorage.getItem(storageKey) ?? (activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? window.localStorage.getItem(getLegacyCalendarLocalStorageKey("eventMetas")) : null);
      if (stored) {
        traceEffect("Local Cache Read: eventMetas", { activePortfolioId });
        setEventMetas(JSON.parse(stored) as Record<string, CalendarEventMeta>);
      }
    } catch {
      window.localStorage.removeItem(getCalendarLocalStorageKey("eventMetas", activePortfolioId));
    }
    setCustomEvents(loadLocalCalendarCustomEvents(activePortfolioId));
    setLegacyImportedEvents([]);
    setCloudSaveNeeded(false);
    setCloudSavedAt(null);
    setProviderResult((current) => {
      traceCalendarStateUpdate("setProviderResult(activePortfolio reset)", [], current.events);
      return { ...current, events: [] };
    });
  }, [activePortfolioId]);

  useEffect(() => {
    traceEffect("DividendCalendarPage useEffect: Firestore Read", { uid: user?.uid ?? null, activePortfolioId });
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
        .then((events) => {
          traceCalendarStateUpdate("setLegacyImportedEvents(loadLegacyImportedCalendarEvents)", events, legacyImportedEventsTraceRef.current);
          setLegacyImportedEvents(events);
        })
        .catch((err) => warnFirestoreFallback("legacyCalendarEvents.load", err));
    } else {
      traceCalendarStateUpdate("setLegacyImportedEvents(non-default portfolio reset)", [], legacyImportedEventsTraceRef.current);
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

    loadCalendarCloudSavedAt(user.uid, activePortfolioId)
      .then((savedAt) => { if (savedAt) setCloudSavedAt(savedAt); })
      .catch((err) => warnFirestoreFallback("calendarCloudSavedAt.load", err));
  }, [user, activePortfolioId]);

  useEffect(() => {
    traceEffect("DividendCalendarPage useEffect: Provider Load", { tickers, month: month.toISOString(), uid: user?.uid ?? null, activePortfolioId, authLoading, authConfigured });
    if (authConfigured && authLoading) return;
    let cancelled = false;
    const loadProviderEvents = async () => {
      const normalizedTickers = Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)));
      const firestoreCacheEntries = await Promise.all(
        user
          ? normalizedTickers.map((ticker) =>
              activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID
                ? loadCalendarTickerCacheEntry(user.uid, ticker)
                : loadPortfolioCalendarTickerCacheEntry(user.uid, activePortfolioId, ticker),
            )
          : [],
      );
      const typedFirestoreCacheMap = {} as ReturnType<typeof loadCalendarCacheMap<CalendarEvent>>;
      const firestoreCacheTickers = new Set<string>();
      for (const entry of firestoreCacheEntries) {
        if (entry?.ticker) {
          typedFirestoreCacheMap[entry.ticker] = entry as never;
          firestoreCacheTickers.add(entry.ticker);
        }
      }
      console.info(`[dividend-calendar:trace] ${traceTimestamp()} initial-load priority`, {
        timestamp: traceTimestamp(),
        stage: "Portfolio Load / Firestore Read / Local Cache Read",
        priority: ["firestore", "user-cache/localStorage", "latest-refresh/provider", "default-data", "projection"],
        firestoreCache: Object.values(typedFirestoreCacheMap).map((entry) => summarizeCacheEntryForTrace(entry as never)),
        localStorageCache: Object.values(loadCalendarCacheMap<CalendarEvent>(activePortfolioId)).map(summarizeCacheEntryForTrace),
      });
      if (firestoreCacheTickers.size > 0) saveCalendarCacheMap(typedFirestoreCacheMap, activePortfolioId);
      const localCacheMap = loadCalendarCacheMap<CalendarEvent>(activePortfolioId);
      return getCalendarEventsForTickersWithProvider({
        tickers,
        year: month.getFullYear(),
        month: month.getMonth() + 1,
        provider: "real",
        cacheMap: { ...localCacheMap, ...typedFirestoreCacheMap },
        preferFreshCache: true,
        firestoreCacheTickers,
      });
    };

    loadProviderEvents()
      .then((result) => {
        if (!cancelled) {
          traceCalendarFlow("Provider Load -> Projection -> Merge", result.events, "getCalendarEventsForTickersWithProvider()", providerEventsTraceRef.current);
          traceCalendarStateUpdate("setProviderResult(provider load)", result.events, providerEventsTraceRef.current);
          setProviderResult(result);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const fallbackEvents = getCalendarEventsForTickers({ tickers, year: month.getFullYear(), month: month.getMonth() + 1 });
        traceCalendarFlow("provider failure -> default data", fallbackEvents, "getCalendarEventsForTickers()", providerEventsTraceRef.current);
        setProviderResult({
          events: fallbackEvents,
          tickerResults: [],
          cacheMap: {},
          source: "mock",
          warnings: [`Calendar provider failed; mock fallback is shown: ${error instanceof Error ? error.message : String(error)}`],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activePortfolioId, authConfigured, authLoading, month, tickers, user]);

  const persistEventMeta = (event: CalendarEvent, meta: CalendarEventMeta) => {
    setCloudSaveNeeded(true);
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

  const handleSubmitCustomEvent = async (input: CustomEventSubmitInput) => {
    const record = createCalendarCustomEvent({
      id: input.id,
      title: input.title,
      date: input.date,
      ticker: input.ticker,
      note: input.note,
      createdAt: input.createdAt,
    });
    const next = dedupeCalendarCustomEvents([...customEvents.filter((item) => item.id !== record.id), record]);
    try {
      if (user) {
        const saveCustom = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveFirestoreCalendarCustomEvent(user.uid, record) : savePortfolioCalendarCustomEvent(user.uid, activePortfolioId, record);
        await saveCustom;
      }
      saveLocalCalendarCustomEvents(next, activePortfolioId);
      setCustomEvents(next);
      setCloudSaveNeeded(true);
      setCustomDialogOpen(false);
      setEditingCustomEvent(null);
      setSelectedDate(record.date);
    } catch (error) {
      warnFirestoreFallback("calendarCustomEvents.save", error);
      throw error;
    }
  };

  const handleDeleteCustomEvent = (eventId: string) => {
    const next = customEvents.filter((item) => item.id !== eventId);
    saveLocalCalendarCustomEvents(next, activePortfolioId);
    setCustomEvents(next);
    setCloudSaveNeeded(true);
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
    traceEffect("DividendCalendarPage useMemo: Projection / Merge", {
      providerEvents: providerResult.events.length,
      legacyImportedEvents: legacyImportedEvents.length,
      providerCacheTickers: Object.keys(providerResult.cacheMap),
      liveRefreshedTickers: Array.from(liveRefreshedTickerSet),
    });
    const selected = selectCalendarDividendEvents({ providerEvents: providerResult.events, importedEvents: legacyImportedEvents });
    const activeOnlyEvents = selected.events.filter((event) => !event.ticker || event.ticker === "CUSTOM" || activeTickerSet.has(event.ticker));
    const providerAuthoritativeTickerSet = new Set([
      ...Array.from(liveRefreshedTickerSet),
      ...Object.values(providerResult.cacheMap)
        .filter((entry) => entry.source === "cache" || entry.source === "yahoo" || entry.source === "polygon" || entry.source === "partial")
        .map((entry) => entry.ticker),
    ]);
    if (!selected.usedImported || providerAuthoritativeTickerSet.size === 0) {
      traceCalendarFlow("Merge: selectCalendarDividendEvents()", activeOnlyEvents, "selectCalendarDividendEvents()", providerResult.events);
      return activeOnlyEvents;
    }
    const authoritativeProviderEvents = providerResult.events.filter((event) => providerAuthoritativeTickerSet.has(event.ticker) && activeTickerSet.has(event.ticker));
    const preservedImportedEvents = legacyImportedEvents.filter((event) => !providerAuthoritativeTickerSet.has(event.ticker) && activeTickerSet.has(event.ticker));
    const merged = [...preservedImportedEvents, ...authoritativeProviderEvents].sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type));
    traceCalendarFlow("Merge: provider cache overrides legacy imported ticker", merged, "dividendEvents useMemo providerAuthoritativeTickerSet", legacyImportedEvents);
    return merged;
  }, [activeTickerSet, legacyImportedEvents, liveRefreshedTickerSet, providerResult.cacheMap, providerResult.events]);

  const events = useMemo(() => {
    traceEffect("DividendCalendarPage useMemo: Calendar Render mergeGeneratedAndCustomCalendarEvents", { dividendEvents: dividendEvents.length, customEvents: customEvents.length });
    const mergedEvents = mergeGeneratedAndCustomCalendarEvents(dividendEvents, customEvents).map((event) => {
      const meta = resolveCalendarEventMeta(event, eventMetas);
      if (!meta) return event;
      return { ...event, favorite: meta.star ? "⭐" : meta.heart ? "💗" : event.favorite, note: meta.memo ?? event.note };
    });
    traceCalendarFlow("Calendar Render: final events memo", mergedEvents, "mergeGeneratedAndCustomCalendarEvents()", dividendEvents);
    return mergedEvents;
  }, [dividendEvents, customEvents, eventMetas]);
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

  useEffect(() => {
    traceCalendarFlow("final Calendar Event", filteredEvents);
  }, [filteredEvents]);

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

  const formatRemainingTime = (milliseconds: number) => {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    const restSeconds = seconds % 60;
    if (minutes <= 0) return `약 ${restSeconds}초`;
    return restSeconds === 0 ? `약 ${minutes}분` : `약 ${minutes}분 ${restSeconds}초`;
  };

  const buildLiveRefreshDetails = (done: number, total: number, delayMs: number) => {
    const remainingTickers = Math.max(0, total - done);
    return [
      `Polygon API 무료 한도 준수를 위해 종목당 약 ${(delayMs / 1000).toFixed(1)}초 대기 중`,
      `${done} / ${total}`,
      `남은 예상 시간 ${formatRemainingTime(remainingTickers * delayMs)}`,
    ];
  };

  const polygonFailureMessage = (status?: ProviderStatus["polygon"], failedReason?: string) => {
    switch (status) {
      case "missing_key": return "Polygon API Key가 설정되어 있지 않습니다. 관리자에게 문의하거나 환경변수를 확인하세요.";
      case "unauthorized": return "Polygon API 인증에 실패했습니다(401 Unauthorized). API Key를 확인하세요.";
      case "forbidden": return "Polygon API 접근이 거부되었습니다(403 Forbidden). 권한 또는 요금제를 확인하세요.";
      case "rate_limited": return "Polygon API 호출 한도에 도달했습니다(429 Rate Limit). 잠시 후 다시 시도하세요.";
      case "network_error": return "Polygon API 네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.";
      case "server_error": return "Polygon 서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.";
      case "failed": return "Polygon API 호출에 실패했습니다. 로그를 확인하세요.";
      default: return failedReason ?? "배당 일정 최신화에 실패했습니다.";
    }
  };

  const handleRefreshDividendEvents = async () => {
    const uniqueTickers = Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)));
    setLiveRefreshState({ running: true, done: 0, total: uniqueTickers.length, success: [], failed: [], message: "Polygon 사용 가능 여부를 확인하는 중...", tone: "info" });
    let configuredDelayMs = 12500;
    try {
      const statusResponse = await fetch("/api/calendar/dividend-events/status", { cache: "no-store" });
      const statusPayload = (await statusResponse.json()) as { polygon?: "available" | "missing_key"; rateLimitDelayMs?: number; message?: string };
      configuredDelayMs = statusPayload.rateLimitDelayMs ?? configuredDelayMs;
      if (!statusResponse.ok || statusPayload.polygon !== "available") {
        setLiveRefreshState({ running: false, done: 0, total: uniqueTickers.length, success: [], failed: uniqueTickers, message: statusPayload.message ?? "Polygon API Key가 설정되어 있지 않습니다. 관리자에게 문의하거나 환경변수를 확인하세요.", tone: "error" });
        return;
      }
    } catch {
      setLiveRefreshState({ running: false, done: 0, total: uniqueTickers.length, success: [], failed: uniqueTickers, message: "Polygon 사용 가능 여부 확인에 실패했습니다. 네트워크 또는 서버 로그를 확인하세요.", tone: "error" });
      return;
    }
    setLiveRefreshState({ running: true, done: 0, total: uniqueTickers.length, success: [], failed: [], message: "Polygon API 무료 한도 보호를 위해 순차 조회 중...", details: buildLiveRefreshDetails(0, uniqueTickers.length, configuredDelayMs), tone: "info" });
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
          console.warn(`[dividend-calendar] ${ticker} refresh failed: ${polygonFailureMessage(payload.providerStatus?.polygon, payload.failedReason)}`);
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
      } catch (error) {
        failed.push(ticker);
        console.warn(`[dividend-calendar] ${ticker} refresh network/client failure`, error);
      }
      const done = index + 1;
      const progressDelayMs = rateLimitDelayMs ?? configuredDelayMs;
      setLiveRefreshState({ running: true, done, total: uniqueTickers.length, success: [...success], failed: [...failed], message: "Polygon API 무료 한도 보호를 위해 순차 조회 중...", details: buildLiveRefreshDetails(done, uniqueTickers.length, progressDelayMs), tone: "info" });
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
      traceCalendarFlow("latest-refresh result", nextProviderEvents, "handleRefreshDividendEvents()", providerResult.events);
      setProviderResult((current) => {
        traceCalendarStateUpdate("setProviderResult(latest refresh)", nextProviderEvents, current.events);
        return { ...current, events: nextProviderEvents, cacheMap: { ...current.cacheMap, ...cacheMap }, source: failed.length > 0 ? "partial" : "polygon", warnings: failed.length > 0 ? [`Live refresh partially failed: ${failed.join(", ")}`] : [] };
      });
      setLiveRefreshedTickerSet((current) => new Set([...Array.from(current), ...success]));
    }

    const lastUpdatedAt = new Date().toISOString();
    setLiveRefreshState({ running: false, done: uniqueTickers.length, total: uniqueTickers.length, success, failed, lastUpdatedAt, message: `배당 일정 최신화 완료: 성공 ${success.length}개, 실패 ${failed.length}개${failed.length ? ` · 실패: ${failed.join(", ")}` : ""}`, tone: failed.length > 0 ? "error" : "info" });
  };

  const handleCloudSave = async () => {
    if (!user) { setCloudSaveState({ running: false, message: "로그인이 필요합니다" }); return; }
    setCloudSaveState({ running: true, message: "클라우드 저장 중..." });
    try {
      const cacheMap = loadCalendarCacheMap<CalendarEvent>(activePortfolioId);
      const cacheEntries = Object.values(cacheMap);
      console.info("[dividend-calendar:trace] cloud-save payload", cacheEntries.map(summarizeCacheEntryForTrace));
      await Promise.all([
        ...cacheEntries.map((entry) => activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveCalendarTickerCacheEntry(user.uid, entry as never) : savePortfolioCalendarTickerCacheEntry(user.uid, activePortfolioId, entry as never)),
        ...customEvents.map((event) => activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveFirestoreCalendarCustomEvent(user.uid, event) : savePortfolioCalendarCustomEvent(user.uid, activePortfolioId, event)),
        ...Object.entries(eventMetas).map(([eventId, meta]) => activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveCalendarEventMeta(user.uid, eventId, meta) : savePortfolioCalendarEventMeta(user.uid, activePortfolioId, eventId, meta)),
      ]);
      const verifiedEntries = await Promise.all(cacheEntries.map((entry) => activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? loadCalendarTickerCacheEntry(user.uid, entry.ticker) : loadPortfolioCalendarTickerCacheEntry(user.uid, activePortfolioId, entry.ticker)));
      console.info("[dividend-calendar:trace] cloud-save read-after-write", verifiedEntries.map((entry) => summarizeCacheEntryForTrace(entry as never)));
      const mismatch = cacheEntries.find((entry, index) => !areCacheEntryEventsEqual(entry as never, verifiedEntries[index] as never));
      if (mismatch) throw new Error(`Calendar cache verification failed for ${mismatch.ticker}`);
      const savedAt = new Date().toISOString();
      await saveCalendarCloudSavedAt(user.uid, activePortfolioId, savedAt);
      setCloudSavedAt(savedAt);
      setCloudSaveNeeded(false);
      setCloudSaveState({ running: false, message: `클라우드 저장 완료: cache ${cacheEntries.length}개, custom ${customEvents.length}개, meta ${Object.keys(eventMetas).length}개` });
    } catch (error) {
      console.error("[dividend-calendar:trace] cloud-save failed", error);
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
            {cloudSaveNeeded ? (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                변경사항이 있습니다. 클라우드 저장해주세요.
              </span>
            ) : cloudSavedAt ? (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                마지막 저장: {new Date(cloudSavedAt).toLocaleString("ko-KR", { hour12: false })}
              </span>
            ) : null}
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
          <div className={`mt-1 text-[11px] font-semibold ${liveRefreshState.tone === "error" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
            <p>
              {liveRefreshState.message}
              {liveRefreshState.lastUpdatedAt ? ` · 마지막 최신화: ${new Date(liveRefreshState.lastUpdatedAt).toLocaleString("ko-KR", { hour12: false })}` : ""}
            </p>
            {liveRefreshState.details?.map((detail) => <p key={detail}>{detail}</p>)}
          </div>
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
