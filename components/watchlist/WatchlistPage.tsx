"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import { latestOf, usePortfolioSnapshots } from "@/lib/portfolio-store";
import { DEFAULT_WATCHLIST_TICKERS } from "@/lib/mock-dividend-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { deleteCalendarTicker, loadCalendarTickers, saveCalendarTicker, warnFirestoreFallback } from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import DividendCalendarPage from "./DividendCalendarPage";
import TickerManager from "./TickerManager";

const WATCHLIST_STORAGE_KEY = STORAGE_KEYS.calendarTickers;

function uniqUpper(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of arr) {
    const ticker = value.trim().toUpperCase();
    if (ticker && !seen.has(ticker)) {
      seen.add(ticker);
      out.push(ticker);
    }
  }
  return out;
}

export default function WatchlistPage() {
  const { user } = useFirebaseAuth();
  const snapshots = usePortfolioSnapshots();
  const portfolioTickers = useMemo(() => {
    const latest = latestOf(snapshots);
    return uniqUpper(
      (latest?.holdings ?? [])
        .map((holding) => holding.ticker || "")
        .filter((ticker) => ticker && ticker !== "CASH" && ticker !== "CASH_LIKE"),
    );
  }, [snapshots]);

  const fromPortfolio = portfolioTickers.length > 0;
  const [tickers, setTickers] = useState<string[]>(fromPortfolio ? portfolioTickers : DEFAULT_WATCHLIST_TICKERS);
  const [portfolioName, setPortfolioName] = useState("내 포트폴리오");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (stored) setTickers(uniqUpper(JSON.parse(stored) as string[]));
    } catch {
      window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadCalendarTickers(user.uid)
      .then((items) => {
        const enabled = items.filter((item) => item.enabled !== false).map((item) => item.ticker);
        if (enabled.length > 0) setTickers(uniqUpper(enabled));
      })
      .catch((err) => warnFirestoreFallback("calendarTickers.load", err));
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
    setTickers((current) => {
      const next = uniqUpper([...current, ...parts]);
      void persistTickers(next);
      return next;
    });
  };

  const handleRemove = (ticker: string) => {
    setTickers((current) => {
      const next = current.filter((item) => item !== ticker);
      void persistTickers(next);
      return next;
    });
    if (user) {
      void deleteCalendarTicker(user.uid, ticker).catch((err) => warnFirestoreFallback("calendarTickers.delete", err));
    }
  };

  const tickerManager = (
    <TickerManager
      tickers={tickers}
      portfolioName={portfolioName}
      portfolioOptions={["내 포트폴리오", "배당 집중", "성장 집중"]}
      onSelectPortfolio={setPortfolioName}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onSave={() => void persistTickers(tickers)}
      fromPortfolio={fromPortfolio}
    />
  );

  return (
    <div className="min-h-screen bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto max-w-[1280px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <DividendCalendarPage
          tickers={tickers}
          tickerManager={tickerManager}
          headerAccessory={<StorageModeBadge />}
        />
      </main>
    </div>
  );
}
