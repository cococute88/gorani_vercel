"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { DEFAULT_WATCHLIST_TICKERS } from "@/lib/mock-dividend-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  loadLegacyDividendCalendarMemos,
  loadLegacyDividendCalendarPortfolios,
  loadLegacyImportedCalendarEvents,
  loadManualCalendarTickers,
  loadCalendarActivePortfolioId,
  loadCalendarPortfolios,
  loadPortfolioManualCalendarTickers,
  saveCalendarActivePortfolioId,
  saveCalendarPortfolio,
  saveLegacyDividendCalendarMemo,
  saveManualCalendarTickers,
  savePortfolioManualCalendarTickers,
  warnFirestoreFallback,
} from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { DEFAULT_CALENDAR_PORTFOLIO_ID, ensureDefaultCalendarPortfolio, getCalendarLocalStorageKey, getLegacyCalendarLocalStorageKey, type CalendarPortfolio } from "@/lib/calendar-portfolio";
import { canonicalMemoTickerKey, lookupTickerMemo, mergeMemoMaps } from "@/lib/calendar-memo-matching";
import {
  createManualCalendarTickerList,
  extractTickersFromCalendarEvents,
  flattenLegacyPortfolioTickers,
  readValidManualOverrideTickers,
  resolveCalendarTickers,
  uniqueCalendarTickers,
  type ManualCalendarTickerList,
} from "@/lib/calendar-ticker-source";
import DividendCalendarPage from "./DividendCalendarPage";
import TickerManager from "./TickerManager";
import PortfolioManageModal from "./PortfolioManageModal";
import CalendarPortfolioManageModal from "./CalendarPortfolioManageModal";
import TickerMemoDialog from "./TickerMemoDialog";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

const WATCHLIST_STORAGE_KEY = STORAGE_KEYS.calendarTickers;
const MEMOS_STORAGE_KEY = STORAGE_KEYS.calendarMemos;

function uniqUpper(arr: string[]): string[] {
  return uniqueCalendarTickers(arr);
}


function traceCalendarPageEffect(name: string, detail?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.info(`[dividend-calendar:effect] ${timestamp} WatchlistPage ${name}`, { timestamp, effect: `WatchlistPage ${name}`, ...detail });
}

function readStoredMemos(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(MEMOS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return mergeMemoMaps(null, parsed as Record<string, string>);
  } catch {
    return {};
  }
}

export default function WatchlistPage() {
  const theme = useResolvedTheme();
  const { user } = useFirebaseAuth();

  // Manual override = a metadata-tagged ticker list the user saved via the modal.
  // Stored raw (any shape) and validated by the resolver; a stale array-only
  // value (old QQQ/SPY/MSFT/KRX list) is ignored so it can't shadow legacy data.
  const [manualOverride, setManualOverride] = useState<ManualCalendarTickerList | null>(null);
  // Derived legacy calendar ticker sources (priority order in resolveCalendarTickers).
  const [legacyPortfolioTickers, setLegacyPortfolioTickers] = useState<string[]>([]);
  const [legacyEventTickers, setLegacyEventTickers] = useState<string[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [manageOpen, setManageOpen] = useState(false);
  const [portfolioManageOpen, setPortfolioManageOpen] = useState(false);
  const [activePortfolioId, setActivePortfolioId] = useState(DEFAULT_CALENDAR_PORTFOLIO_ID);
  const [portfolios, setPortfolios] = useState<CalendarPortfolio[]>(() => ensureDefaultCalendarPortfolio([]));
  const [memoTicker, setMemoTicker] = useState<string | null>(null);

  // The calendar ticker universe. NOT `/portfolio` holdings — a valid manual
  // override, else the legacy dividend calendar universe (portfolios → imported
  // events → memos → mock fallback).
  const tickers = useMemo(
    () =>
      resolveCalendarTickers({
        manualOverride,
        legacyPortfolioTickers: activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? legacyPortfolioTickers : [],
        legacyEventTickers: activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? legacyEventTickers : [],
        legacyMemoKeys: activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? Object.keys(memos) : [],
        fallbackTickers: activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? DEFAULT_WATCHLIST_TICKERS : [],
      }),
    [activePortfolioId, manualOverride, legacyPortfolioTickers, legacyEventTickers, memos],
  );

  useEffect(() => {
    traceCalendarPageEffect("useEffect: Local Cache Read / portfolio", { activePortfolioId });
    if (typeof window === "undefined") return;
    try {
      const storageKey = getCalendarLocalStorageKey("tickerList", activePortfolioId);
      const stored = window.localStorage.getItem(storageKey) ?? (activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? window.localStorage.getItem(getLegacyCalendarLocalStorageKey("tickerList")) : null);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        // Only accept the new metadata-tagged shape; a bare array is stale and
        // is dropped (cleaning up the old key so legacy data can take over).
        if (readValidManualOverrideTickers(parsed).length > 0) {
          setManualOverride(parsed as ManualCalendarTickerList);
        } else {
          window.localStorage.removeItem(getCalendarLocalStorageKey("tickerList", activePortfolioId));
        }
      }
    } catch {
      window.localStorage.removeItem(getCalendarLocalStorageKey("tickerList", activePortfolioId));
    }
    setMemos(readStoredMemos());
  }, [activePortfolioId]);

  useEffect(() => {
    traceCalendarPageEffect("useEffect: Authentication Ready / Portfolio Load / Firestore Read", { uid: user?.uid ?? null, activePortfolioId });
    if (!user) return;

    loadCalendarActivePortfolioId(user.uid).then((id) => {
      traceCalendarPageEffect("React State Update: setActivePortfolioId", { before: activePortfolioId, after: id, changedBy: "loadCalendarActivePortfolioId()" });
      setActivePortfolioId(id);
    }).catch((err) => warnFirestoreFallback("calendarActivePortfolio.load", err));
    loadCalendarPortfolios(user.uid).then((items) => setPortfolios(ensureDefaultCalendarPortfolio(items))).catch((err) => warnFirestoreFallback("calendarPortfolios.load", err));
    const loadManual = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? loadManualCalendarTickers(user.uid) : loadPortfolioManualCalendarTickers(user.uid, activePortfolioId);
    loadManual.then((list) => {
      traceCalendarPageEffect("React State Update: setManualOverride", { tickerCount: list?.tickers.length ?? 0, changedBy: "loadManualCalendarTickers()" });
      setManualOverride(list);
    }).catch((err) => warnFirestoreFallback("manualCalendarTickers.load", err));

    // Legacy calendar ticker universe (preferred default source).
    loadLegacyDividendCalendarPortfolios(user.uid)
      .then((portfolios) => {
        const next = flattenLegacyPortfolioTickers(portfolios);
        traceCalendarPageEffect("React State Update: setLegacyPortfolioTickers", { tickers: next, changedBy: "loadLegacyDividendCalendarPortfolios()" });
        setLegacyPortfolioTickers(next);
      })
      .catch((err) => warnFirestoreFallback("legacyDividendCalendarPortfolios.load", err));

    loadLegacyImportedCalendarEvents(user.uid)
      .then((events) => {
        const next = extractTickersFromCalendarEvents(events);
        traceCalendarPageEffect("React State Update: setLegacyEventTickers", { tickers: next, changedBy: "loadLegacyImportedCalendarEvents()" });
        setLegacyEventTickers(next);
      })
      .catch((err) => warnFirestoreFallback("legacyCalendarEventTickers.load", err));

    // Legacy imported memos are the base; locally edited memos override them.
    loadLegacyDividendCalendarMemos(user.uid)
      .then((legacyMemos) => setMemos((current) => {
        const next = mergeMemoMaps(legacyMemos, current);
        traceCalendarPageEffect("React State Update: setMemos", { keys: Object.keys(next), changedBy: "loadLegacyDividendCalendarMemos()" });
        return next;
      }))
      .catch((err) => warnFirestoreFallback("legacyDividendCalendarMemos.load", err));
  }, [user, activePortfolioId]);

  // Persist a metadata-tagged manual override (localStorage + Firestore).
  const persistManualTickers = async (nextTickers: string[]) => {
    const list = createManualCalendarTickerList(nextTickers);
    setManualOverride(list);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(getCalendarLocalStorageKey("tickerList", activePortfolioId), JSON.stringify(list));
      } catch {
        // localStorage 사용 불가 환경에서는 화면 상태만 유지한다.
      }
    }
    if (user) {
      const save = activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID ? saveManualCalendarTickers(user.uid, list.tickers) : savePortfolioManualCalendarTickers(user.uid, activePortfolioId, list.tickers);
      await save.catch((err) => warnFirestoreFallback("manualCalendarTickers.save", err));
    }
  };

  const handleAdd = (raw: string) => {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    // Saving an edit promotes the currently displayed (possibly legacy-derived)
    // list to a metadata-tagged manual override.
    void persistManualTickers(uniqUpper([...tickers, ...parts]));
  };

  const handleRemove = (ticker: string) => {
    void persistManualTickers(tickers.filter((item) => item !== ticker));
  };

  const handleSaveMemo = (ticker: string, memo: string) => {
    const key = canonicalMemoTickerKey(ticker);
    if (!key) return;
    setMemos((current) => {
      const next = { ...current };
      if (memo.trim()) next[key] = memo;
      else delete next[key];
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(MEMOS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // 화면 상태만 유지한다.
        }
      }
      return next;
    });
    if (user) {
      void saveLegacyDividendCalendarMemo(user.uid, key, memo).catch((err) => warnFirestoreFallback("legacyDividendCalendarMemos.save", err));
    }
    setMemoTicker(null);
  };

  const activePortfolioName = portfolios.find((item) => item.id === activePortfolioId)?.name ?? activePortfolioId;

  const handleSavePortfolioSelection = (portfolioId: string, nextPortfolios: CalendarPortfolio[]) => {
    const normalized = ensureDefaultCalendarPortfolio(nextPortfolios);
    setPortfolios(normalized);
    setActivePortfolioId(portfolioId);
    setManualOverride(null);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEYS.calendarActivePortfolio, portfolioId);
    if (user) {
      void Promise.all([saveCalendarActivePortfolioId(user.uid, portfolioId), ...normalized.map((portfolio) => saveCalendarPortfolio(user.uid, portfolio))]).catch((err) => warnFirestoreFallback("calendarPortfolios.save", err));
    }
    setPortfolioManageOpen(false);
  };

  const tickerManager = (
    <TickerManager tickers={tickers} memos={memos} onTickerClick={setMemoTicker} activePortfolioName={activePortfolioName} />
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <DividendCalendarPage
          tickers={tickers}
          tickerManager={tickerManager}
          onManagePortfolio={() => setManageOpen(true)}
          onManageCalendarPortfolio={() => setPortfolioManageOpen(true)}
          activePortfolioId={activePortfolioId}
          activePortfolioName={activePortfolioName}
          tickerMemos={memos}
          onSaveTickerMemo={handleSaveMemo}
        />
      </main>

      <CalendarPortfolioManageModal
        open={portfolioManageOpen}
        portfolios={portfolios}
        activePortfolioId={activePortfolioId}
        onSave={handleSavePortfolioSelection}
        onClose={() => setPortfolioManageOpen(false)}
      />
      <PortfolioManageModal
        open={manageOpen}
        tickers={tickers}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onClose={() => setManageOpen(false)}
      />
      <TickerMemoDialog
        ticker={memoTicker}
        initialMemo={memoTicker ? lookupTickerMemo(memos, memoTicker) : ""}
        onSave={handleSaveMemo}
        onClose={() => setMemoTicker(null)}
      />
    </div>
  );
}
