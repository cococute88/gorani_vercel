"use client";

import { useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { latestOf, usePortfolioSnapshots } from "@/lib/portfolio-store";
import { DEFAULT_WATCHLIST_TICKERS } from "@/lib/mock-dividend-data";
import DividendCalendarPage from "./DividendCalendarPage";
import TickerManager from "./TickerManager";

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

  const handleAdd = (raw: string) => {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    setTickers((current) => uniqUpper([...current, ...parts]));
  };

  const tickerManager = (
    <TickerManager
      tickers={tickers}
      portfolioName={portfolioName}
      portfolioOptions={["내 포트폴리오", "배당 집중", "성장 집중"]}
      onSelectPortfolio={setPortfolioName}
      onAdd={handleAdd}
      onRemove={(ticker) => setTickers((current) => current.filter((item) => item !== ticker))}
      onSave={() => undefined}
      fromPortfolio={fromPortfolio}
    />
  );

  return (
    <div className="min-h-screen bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto max-w-[1640px] px-4 py-6 sm:px-6 lg:px-8">
        <DividendCalendarPage tickers={tickers} tickerManager={tickerManager} />
      </main>
    </div>
  );
}
