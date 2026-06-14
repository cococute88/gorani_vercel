"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import { DEFAULT_WATCHLIST_TICKERS } from "@/lib/mock-dividend-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  loadLegacyDividendCalendarMemos,
  loadLegacyDividendCalendarPortfolios,
  loadLegacyImportedCalendarEvents,
  loadManualCalendarTickers,
  saveLegacyDividendCalendarMemo,
  saveManualCalendarTickers,
  warnFirestoreFallback,
} from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";
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
import TickerMemoDialog from "./TickerMemoDialog";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

const WATCHLIST_STORAGE_KEY = STORAGE_KEYS.calendarTickers;
const MEMOS_STORAGE_KEY = STORAGE_KEYS.calendarMemos;

function uniqUpper(arr: string[]): string[] {
  return uniqueCalendarTickers(arr);
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
  const [memoTicker, setMemoTicker] = useState<string | null>(null);

  // The calendar ticker universe. NOT `/portfolio` holdings — a valid manual
  // override, else the legacy dividend calendar universe (portfolios → imported
  // events → memos → mock fallback).
  const tickers = useMemo(
    () =>
      resolveCalendarTickers({
        manualOverride,
        legacyPortfolioTickers,
        legacyEventTickers,
        legacyMemoKeys: Object.keys(memos),
        fallbackTickers: DEFAULT_WATCHLIST_TICKERS,
      }),
    [manualOverride, legacyPortfolioTickers, legacyEventTickers, memos],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        // Only accept the new metadata-tagged shape; a bare array is stale and
        // is dropped (cleaning up the old key so legacy data can take over).
        if (readValidManualOverrideTickers(parsed).length > 0) {
          setManualOverride(parsed as ManualCalendarTickerList);
        } else {
          window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
        }
      }
    } catch {
      window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    }
    setMemos(readStoredMemos());
  }, []);

  useEffect(() => {
    if (!user) return;

    // Valid manual override (metadata-tagged) — the only thing allowed to win
    // over the imported legacy ticker universe.
    loadManualCalendarTickers(user.uid)
      .then((list) => {
        if (list) setManualOverride(list);
      })
      .catch((err) => warnFirestoreFallback("manualCalendarTickers.load", err));

    // Legacy calendar ticker universe (preferred default source).
    loadLegacyDividendCalendarPortfolios(user.uid)
      .then((portfolios) => setLegacyPortfolioTickers(flattenLegacyPortfolioTickers(portfolios)))
      .catch((err) => warnFirestoreFallback("legacyDividendCalendarPortfolios.load", err));

    loadLegacyImportedCalendarEvents(user.uid)
      .then((events) => setLegacyEventTickers(extractTickersFromCalendarEvents(events)))
      .catch((err) => warnFirestoreFallback("legacyCalendarEventTickers.load", err));

    // Legacy imported memos are the base; locally edited memos override them.
    loadLegacyDividendCalendarMemos(user.uid)
      .then((legacyMemos) => setMemos((current) => mergeMemoMaps(legacyMemos, current)))
      .catch((err) => warnFirestoreFallback("legacyDividendCalendarMemos.load", err));
  }, [user]);

  // Persist a metadata-tagged manual override (localStorage + Firestore).
  const persistManualTickers = async (nextTickers: string[]) => {
    const list = createManualCalendarTickerList(nextTickers);
    setManualOverride(list);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
      } catch {
        // localStorage 사용 불가 환경에서는 화면 상태만 유지한다.
      }
    }
    if (user) {
      await saveManualCalendarTickers(user.uid, list.tickers).catch((err) =>
        warnFirestoreFallback("manualCalendarTickers.save", err),
      );
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

  const tickerManager = (
    <TickerManager tickers={tickers} memos={memos} onTickerClick={setMemoTicker} />
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto max-w-[1280px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <DividendCalendarPage
          tickers={tickers}
          tickerManager={tickerManager}
          headerAccessory={<StorageModeBadge />}
          onManagePortfolio={() => setManageOpen(true)}
          tickerMemos={memos}
        />
      </main>

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
