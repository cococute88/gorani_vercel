"use client";

import { useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { usePortfolioSnapshots, latestOf } from "@/lib/portfolio-store";
import {
  buildDividendEvents,
  DEFAULT_WATCHLIST_TICKERS,
  EVENT_META,
} from "@/lib/mock-dividend-data";
import type { DivEventType } from "@/lib/mock-dividend-data";
import TickerManager from "./TickerManager";
import DividendEventCalendar from "./DividendEventCalendar";
import DividendEventTable from "./DividendEventTable";
import EconomicCalendarMini from "./EconomicCalendarMini";

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const ALL_TYPES: DivEventType[] = ["ex_div", "buy", "payment", "earnings"];

function uniqUpper(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of arr) {
    const u = a.trim().toUpperCase();
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

export default function WatchlistPage() {
  const snapshots = usePortfolioSnapshots();

  // 포트폴리오 보유 티커 (없으면 기본 목업)
  const portfolioTickers = useMemo(() => {
    const latest = latestOf(snapshots);
    const ts = (latest?.holdings ?? [])
      .map((h) => (h.ticker || "").toUpperCase())
      .filter((t) => t && t !== "CASH" && t !== "CASH_LIKE");
    return uniqUpper(ts);
  }, [snapshots]);

  const fromPortfolio = portfolioTickers.length > 0;
  const initialTickers = fromPortfolio ? portfolioTickers : DEFAULT_WATCHLIST_TICKERS;

  const [tickers, setTickers] = useState<string[]>(initialTickers);
  const [portfolioName, setPortfolioName] = useState("내 포트폴리오");
  const [visibleTypes, setVisibleTypes] = useState<Record<DivEventType, boolean>>({
    ex_div: true,
    buy: true,
    payment: true,
    earnings: true,
  });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const events = useMemo(
    () => buildDividendEvents(tickers, year, month),
    [tickers, year, month],
  );
  const visibleEvents = useMemo(
    () => events.filter((e) => visibleTypes[e.type]),
    [events, visibleTypes],
  );

  const handleAdd = (raw: string) => {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    setTickers((prev) => uniqUpper([...prev, ...parts]));
  };
  const handleRemove = (t: string) => setTickers((prev) => prev.filter((x) => x !== t));

  const goPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  return (
    <div className="min-h-screen bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto max-w-[1640px] px-8 py-6">
        <h1 className="mb-4 text-[20px] font-extrabold text-white">배당캘린더</h1>

        <section className="mb-6">
          <TickerManager
            tickers={tickers}
            portfolioName={portfolioName}
            portfolioOptions={["내 포트폴리오", "배당 집중", "성장 집중"]}
            onSelectPortfolio={setPortfolioName}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onSave={() => undefined}
            fromPortfolio={fromPortfolio}
          />
        </section>

        {/* 이벤트 필터 */}
        <section className="mb-6">
          <div className={card}>
            <h2 className="mb-3 text-[15px] font-bold text-slate-300">이벤트 필터</h2>
            <div className="flex flex-wrap gap-3">
              {ALL_TYPES.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={visibleTypes[t]}
                    onChange={(e) =>
                      setVisibleTypes((prev) => ({ ...prev, [t]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={filterDot(t)} />
                  {EVENT_META[t].labelKo} ({EVENT_META[t].label})
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_minmax(0,420px)]">
          <DividendEventCalendar
            year={year}
            month={month}
            events={events}
            visibleTypes={visibleTypes}
            onPrev={goPrev}
            onNext={goNext}
            onToday={goToday}
          />
          <DividendEventTable events={visibleEvents} />
        </section>

        <section className="mb-6">
          <EconomicCalendarMini />
        </section>
      </main>
    </div>
  );
}

function filterDot(type: DivEventType): { background: string } {
  return { background: EVENT_META[type].color };
}
