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
import MarketBriefingCards from "./MarketBriefingCards";
import FearGreedCard from "./FearGreedCard";
import MarketTemperatureTable from "./MarketTemperatureTable";
import RsiDrawdownChart from "./RsiDrawdownChart";
import VixChart from "./VixChart";
import TradingViewTreemap from "./TradingViewTreemap";
import AssetMapSection from "./AssetMapSection";
import MarketTemperatureSection from "./MarketTemperatureSection";

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

        <MarketBriefingCards items={briefing} />

        <MarketTemperatureSection />

        <section className="mb-6">
          <FearGreedCard data={fearGreed} />
        </section>

        <MarketTemperatureTable rows={temps} />
        <RsiDrawdownChart rsi={rsi} drawdown={drawdown} />
        <VixChart data={vix} />
        <TradingViewTreemap />
        <AssetMapSection />
      </main>
    </div>
  );
}
