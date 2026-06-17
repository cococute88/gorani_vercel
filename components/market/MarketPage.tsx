"use client";

import { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";
import { fetchMarketPayload, MARKET_RANGES } from "@/lib/market-data";
import type { BriefingItem, EtfTemperature, FearGreedData, MarketRange, MarketWarning, SeriesPoint } from "@/lib/market-data";
import MarketTopBriefing from "./MarketTopBriefing";
import MarketIndexSection from "./MarketIndexSection";
import MarketRsiTrendChart from "./MarketRsiTrendChart";
import MarketMddSection from "./MarketMddSection";
import VixChart from "./VixChart";
import MarketTemperatureSheet from "./MarketTemperatureSheet";
import TradingViewTreemap from "./TradingViewTreemap";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

export default function MarketPage() {
  const theme = useResolvedTheme();
  const [range, setRange] = useState<MarketRange>("1년");
  const [briefing, setBriefing] = useState<BriefingItem[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [temps, setTemps] = useState<EtfTemperature[]>([]);
  const [rsi, setRsi] = useState<SeriesPoint[]>([]);
  const [drawdown, setDrawdown] = useState<SeriesPoint[]>([]);
  const [vix, setVix] = useState<SeriesPoint[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<MarketWarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMarketPayload(range).then((payload) => {
      if (!active) return;
      setBriefing(payload.briefing);
      setFearGreed(payload.fearGreed);
      setTemps(payload.temperatures);
      setRsi(payload.rsi);
      setDrawdown(payload.drawdown);
      setVix(payload.vix);
      setUpdatedAt(payload.updatedAt);
      setWarnings(payload.warnings);
      setLoading(false);
    });
    return () => { active = false; };
  }, [range]);

  const status = loading ? "조회 중" : warnings.length > 0 ? "일부 데이터 조회 불가" : "Live";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-extrabold text-slate-900 dark:text-white">시장 현황</h1>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              데이터 상태: {status}{updatedAt ? ` · 최근 업데이트: ${new Date(updatedAt).toLocaleString("ko-KR")}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-transparent dark:bg-[#1b2021]">
            {MARKET_RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${range === r ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}>{r}</button>
            ))}
          </div>
        </div>
        {warnings.length > 0 && <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-[12.5px] text-amber-700 dark:text-amber-200">일부 시장 데이터를 불러오지 못했습니다. 조회 불가로 표시된 항목은 외부 데이터 제공처 응답이 복구되면 다시 표시됩니다.</div>}
        <MarketTopBriefing fearGreed={fearGreed} briefing={briefing} />
        <MarketIndexSection />
        <MarketRsiTrendChart rsi={rsi} />
        <MarketMddSection temps={temps} drawdown={drawdown} />
        <VixChart data={vix} />
        <MarketTemperatureSheet />
        <TradingViewTreemap />
      </main>
    </div>
  );
}
