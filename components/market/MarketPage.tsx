"use client";

import { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";
import {
  fetchEtfTemperatures,
  fetchFearGreed,
  fetchMarketBriefing,
  fetchRsiDrawdownSeries,
  fetchVixSeries,
  MARKET_RANGES,
} from "@/lib/market-data";
import {
  MOCK_BRIEFING,
  MOCK_ETF_TEMPERATURE,
  MOCK_FEAR_GREED,
  buildDrawdownSeries,
  buildRsiSeries,
  buildVixSeries,
} from "@/lib/mock-market-data";
import type {
  BriefingItem,
  EtfTemperature,
  FearGreedData,
  MarketRange,
  SeriesPoint,
} from "@/lib/market-data";
import MarketTopBriefing from "./MarketTopBriefing";
import MarketRsiSection from "./MarketRsiSection";
import MarketMddSection from "./MarketMddSection";
import VixChart from "./VixChart";
import MarketTemperatureSheet from "./MarketTemperatureSheet";
import TradingViewTreemap from "./TradingViewTreemap";
import AssetMapSection from "./AssetMapSection";

export default function MarketPage() {
  const [range, setRange] = useState<MarketRange>("1년");
  const [briefing, setBriefing] = useState<BriefingItem[]>(MOCK_BRIEFING);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(MOCK_FEAR_GREED);
  const [temps, setTemps] = useState<EtfTemperature[]>(MOCK_ETF_TEMPERATURE);
  const [rsi, setRsi] = useState<SeriesPoint[]>(() => buildRsiSeries("1년"));
  const [drawdown, setDrawdown] = useState<SeriesPoint[]>(() => buildDrawdownSeries("1년"));
  const [vix, setVix] = useState<SeriesPoint[]>(() => buildVixSeries("1년"));

  // 조회 실패해도 페이지가 깨지지 않도록 각 fetch 는 내부에서 방어됨.
  useEffect(() => {
    let active = true;
    fetchMarketBriefing().then((d) => active && d.length > 0 && setBriefing(d));
    fetchFearGreed().then((d) => active && d && setFearGreed(d));
    fetchEtfTemperatures().then((d) => active && d.length > 0 && setTemps(d));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchRsiDrawdownSeries(range).then((d) => {
      if (!active) return;
      if (d.rsi.length > 0) setRsi(d.rsi);
      if (d.drawdown.length > 0) setDrawdown(d.drawdown);
    });
    fetchVixSeries(range).then((d) => active && d.length > 0 && setVix(d));
    return () => {
      active = false;
    };
  }, [range]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-extrabold text-white">시장 현황</h1>
          <div className="flex items-center gap-1 rounded-lg bg-[#1b2021] p-1">
            {MARKET_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                  range === r ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* 1. 상단 시장 브리핑: 공포&탐욕 + 지수/매크로 카드 */}
        <MarketTopBriefing fearGreed={fearGreed} briefing={briefing} />

        {/* 2. RSI 섹션 / 3. MDD(하락률) 섹션 */}
        <MarketRsiSection temps={temps} rsi={rsi} />
        <MarketMddSection temps={temps} drawdown={drawdown} />

        {/* 4. VIX 참고 그래프 */}
        <VixChart data={vix} />

        {/* 5. 시장온도 참고 시트 */}
        <MarketTemperatureSheet />

        {/* 6. 섹터 트리맵 / 7. 자산 맵 (하단 유지) */}
        <TradingViewTreemap />
        <AssetMapSection />
      </main>
    </div>
  );
}
