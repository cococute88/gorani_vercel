"use client";

import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import TopNav from "@/components/TopNav";
import { usePortfolioSnapshots, latestOf } from "@/lib/portfolio-store";
import { MOCK_HOLDINGS } from "@/lib/mock-portfolio-data";
import {
  buildDividendHoldingRows,
  buildMonthlyDividends,
  DIVIDEND_PERFORMANCE_SERIES,
} from "@/lib/mock-dividend-data";
import { formatWon, formatPercent } from "@/lib/format";
import type { Holding } from "@/lib/portfolio-types";
import DividendSummaryCards from "./DividendSummaryCards";
import MonthlyDividendChart from "./MonthlyDividendChart";
import DividendHoldingsTable from "./DividendHoldingsTable";
import DividendPerformanceSection from "./DividendPerformanceSection";

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 목표 달성률 계산용 주당 단가 (mock, KRW). TODO(codex): 실시세 연결.
const MOCK_SHARE_PRICE_KRW: Record<string, number> = {
  SCHD: 39_000,
  QQQ: 665_000,
  QLD: 144_000,
  TQQQ: 107_000,
  SPY: 768_000,
  JEPI: 80_000,
};

export default function DividendPage() {
  const snapshots = usePortfolioSnapshots();
  const [afterTax, setAfterTax] = useState(true);
  const [targetTicker, setTargetTicker] = useState("SCHD");
  const [targetQty, setTargetQty] = useState(3300);

  const holdings: Holding[] = useMemo(() => {
    const latest = latestOf(snapshots);
    return latest && latest.holdings.length > 0 ? latest.holdings : MOCK_HOLDINGS;
  }, [snapshots]);

  const usingMock = useMemo(() => {
    const latest = latestOf(snapshots);
    return !(latest && latest.holdings.length > 0);
  }, [snapshots]);

  const rows = useMemo(() => buildDividendHoldingRows(holdings, afterTax), [holdings, afterTax]);
  const monthly = useMemo(() => buildMonthlyDividends(holdings, afterTax), [holdings, afterTax]);

  const evaluationKRW = holdings.reduce((s, h) => s + h.valueKRW, 0);
  const annualDividendKRW = rows.reduce((s, r) => s + r.annualDividendKRW, 0);
  const monthlyAvgKRW = annualDividendKRW / 12;

  // 목표 달성률: 현재 목표티커 보유주수 / 목표주수
  const price = MOCK_SHARE_PRICE_KRW[targetTicker] ?? 50_000;
  const targetValue = holdings
    .filter((h) => (h.ticker || "").toUpperCase() === targetTicker.toUpperCase())
    .reduce((s, h) => s + h.valueKRW, 0);
  const currentShares = price > 0 ? targetValue / price : 0;
  const achievementPct = targetQty > 0 ? (currentShares / targetQty) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto max-w-[1640px] px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-extrabold text-white">배당</h1>
          {usingMock && (
            <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-[12px] text-amber-400">
              등록된 스냅샷이 없어 목업 데이터로 표시 중
            </span>
          )}
        </div>

        <DividendSummaryCards
          evaluationKRW={evaluationKRW}
          annualDividendKRW={annualDividendKRW}
          monthlyAvgKRW={monthlyAvgKRW}
          achievementPct={achievementPct}
          afterTax={afterTax}
          onToggleTax={setAfterTax}
        />

        {/* 목표 설정 카드 */}
        <section className="mb-6">
          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <Target size={16} className="text-blue-400" />
              <h2 className="text-[15px] font-bold text-slate-300">배당 목표 설정</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-[12.5px] text-slate-400">목표 티커</span>
                <input
                  value={targetTicker}
                  onChange={(e) => setTargetTicker(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-[12.5px] text-slate-400">목표 수량 (주)</span>
                <input
                  type="number"
                  value={targetQty}
                  onChange={(e) => setTargetQty(Number(e.target.value) || 0)}
                  className="num mt-1 w-full rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
                />
              </label>
              <div className="flex flex-col justify-center rounded-lg bg-[#11181a] px-4 py-2">
                <span className="text-[12.5px] text-slate-400">현재 달성률</span>
                <span className="num text-[18px] font-extrabold text-blue-400">
                  {formatPercent(achievementPct, 1)}
                </span>
                <span className="num text-[11.5px] text-slate-500">
                  보유 약 {Math.round(currentShares).toLocaleString("ko-KR")} / {targetQty.toLocaleString("ko-KR")}주
                </span>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#11181a]">
              <div
                className="h-full rounded-full bg-blue-500"
                style={progressStyle(achievementPct)}
              />
            </div>
          </div>
        </section>

        <MonthlyDividendChart data={monthly} afterTax={afterTax} />
        <DividendHoldingsTable rows={rows} />
        <DividendPerformanceSection series={DIVIDEND_PERFORMANCE_SERIES} />
      </main>
    </div>
  );
}

function progressStyle(pct: number): { width: string } {
  const w = Math.max(0, Math.min(100, pct));
  return { width: `${w}%` };
}
