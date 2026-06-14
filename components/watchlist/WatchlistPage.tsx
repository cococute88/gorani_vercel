"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import { DEFAULT_WATCHLIST_TICKERS } from "@/lib/mock-dividend-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  deleteCalendarTicker,
  loadCalendarTickers,
  loadLegacyDividendCalendarMemos,
  loadLegacyDividendCalendarPortfolios,
  loadLegacyImportedCalendarEvents,
  saveCalendarTicker,
  saveLegacyDividendCalendarMemo,
  warnFirestoreFallback,
} from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { canonicalMemoTickerKey, lookupTickerMemo, mergeMemoMaps } from "@/lib/calendar-memo-matching";
import {
  extractTickersFromCalendarEvents,
  flattenLegacyPortfolioTickers,
  resolveCalendarTickers,
  uniqueCalendarTickers,
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

  // Explicit user-managed calendar ticker list (localStorage / Firestore
  // `calendarTickers`). When the user adds/removes a ticker we promote the
  // derived list to this explicit list. `null` means "not yet managed".
  const [explicitTickers, setExplicitTickers] = useState<string[] | null>(null);
  // Derived legacy calendar ticker sources (priority order in resolveCalendarTickers).
  const [legacyPortfolioTickers, setLegacyPortfolioTickers] = useState<string[]>([]);
  const [legacyEventTickers, setLegacyEventTickers] = useState<string[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [manageOpen, setManageOpen] = useState(false);
  const [memoTicker, setMemoTicker] = useState<string | null>(null);

  // The calendar ticker universe. NOT `/portfolio` holdings — the legacy
  // dividend calendar universe (portfolios → imported events → memos → mock).
  const tickers = useMemo(() => {
    if (explicitTickers && explicitTickers.length > 0) return explicitTickers;
    return resolveCalendarTickers({
      legacyPortfolioTickers,
      legacyEventTickers,
      legacyMemoKeys: Object.keys(memos),
      fallbackTickers: DEFAULT_WATCHLIST_TICKERS,
    });
  }, [explicitTickers, legacyPortfolioTickers, legacyEventTickers, memos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (stored) {
        const parsed = uniqUpper(JSON.parse(stored) as string[]);
        if (parsed.length > 0) setExplicitTickers(parsed);
      }
    } catch {
      window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    }
    setMemos(readStoredMemos());
  }, []);

  useEffect(() => {
    if (!user) return;

    // Explicitly managed calendar tickers (override everything when present).
    loadCalendarTickers(user.uid)
      .then((items) => {
        const enabled = items.filter((item) => item.enabled !== false).map((item) => item.ticker);
        if (enabled.length > 0) setExplicitTickers(uniqUpper(enabled));
      })
      .catch((err) => warnFirestoreFallback("calendarTickers.load", err));

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

  const persistTickers = async (nextTickers: string[]) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(nextTickers));
      } catch {
        // localStorage 사용 불가 환경에서는 화면 상태만 유지한다.
      }
    }
    if (user) {
      await Promise.all(nextTickers.map((ticker) => saveCalendarTicker(user.uid, { ticker, enabled: true }))).catch((err) =>
        warnFirestoreFallback("calendarTickers.save", err),
      );
    }
  };

  const handleAdd = (raw: string) => {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    // Promote the currently displayed (possibly derived) list to an explicit list.
    const next = uniqUpper([...tickers, ...parts]);
    setExplicitTickers(next);
    void persistTickers(next);
  };

  const handleRemove = (ticker: string) => {
    const next = tickers.filter((item) => item !== ticker);
    setExplicitTickers(next);
    void persistTickers(next);
    if (user) {
      void deleteCalendarTicker(user.uid, ticker).catch((err) => warnFirestoreFallback("calendarTickers.delete", err));
    }
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
