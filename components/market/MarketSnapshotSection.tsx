"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fearGreedColor, fearGreedRating } from "@/lib/market-data";
import type { BriefingItem, FearGreedData } from "@/lib/market-data";
import { DEFAULT_DETAIL_RANGE, type IndexDef } from "@/lib/market-index";
import { AXIS_LINE, AXIS_TICK_SM, formatFearGreedAxisTick, formatFearGreedTooltipLabel, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from "@/lib/chart-style";

const IndexDetailModal = dynamic(() => import("./IndexDetailModal"), { ssr: false });

interface Props {
  fearGreed: FearGreedData | null;
  briefing: BriefingItem[];
}

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-[#2a3336] dark:bg-[#191f20] dark:hover:border-blue-500/60";
const FNG_BANDS = ["극단적 공포", "공포", "중립", "탐욕", "극단적 탐욕"];
const FNG_GRADIENT =
  "linear-gradient(90deg, #ef4444 0%, #f97316 25%, #eab308 50%, #84cc16 70%, #22c55e 100%)";

const DETAIL_DEFS: Record<string, IndexDef> = {
  sp500: { symbol: "SPY", name: "S&P 500", ticker: "SPY", description: "S&P 500 ETF" },
  dow: { symbol: "DIA", name: "Dow Jones", ticker: "DIA", description: "Dow Jones Industrial Average ETF" },
  nasdaq: { symbol: "QQQ", name: "NASDAQ 100", ticker: "QQQ", description: "Nasdaq-100 ETF" },
  schd: { symbol: "SCHD", name: "SCHD", ticker: "SCHD", description: "Schwab US Dividend Equity" },
  usdkrw: { symbol: "KRW=X", name: "USD/KRW", ticker: "USD/KRW", description: "US Dollar / Korean Won" },
  wti: { symbol: "CL=F", name: "WTI", ticker: "WTI", description: "WTI Crude Oil Futures" },
  gld: { symbol: "GLD", name: "GLD", ticker: "GLD", description: "Gold ETF" },
  btcusdt: { symbol: "BTC-USD", name: "BTC/USDT", ticker: "BTC/USDT", description: "Bitcoin USD proxy from Yahoo Finance" },
};

export default function MarketSnapshotSection({ fearGreed, briefing }: Props) {
  const cards = briefing.filter((item) => item.key !== "fng" && item.key !== "vix");
  const [active, setActive] = useState<IndexDef | null>(null);

  return (
    <section className="mb-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <FngCard data={fearGreed} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-200 bg-white p-4 text-center text-[13px] text-slate-500 dark:border-[#2a3336] dark:bg-[#191f20]">
              시장 데이터를 불러오지 못했습니다.
            </div>
          )}
          {cards.map((it) => {
            const def = DETAIL_DEFS[it.key];
            return (
              <button key={it.key} type="button" onClick={() => def && setActive(def)} className={`${card} text-left`}>
                <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">{it.label}</div>
                <div className="num mt-1.5 text-[18px] font-extrabold text-slate-900 dark:text-white">{it.value}</div>
                <div className={`num mt-1 text-[12.5px] font-semibold ${it.up ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`}>
                  {it.source === "unavailable" || it.changePct == null ? "조회 불가" : `${it.up ? "▲" : "▼"} ${Math.abs(it.changePct).toFixed(2)}%`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {active && <IndexDetailModal def={active} initialRange={DEFAULT_DETAIL_RANGE} onClose={() => setActive(null)} />}
    </section>
  );
}

function FngCard({ data }: { data: FearGreedData | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]">
        <h3 className="mb-3 text-[15px] font-bold text-slate-700 dark:text-slate-300">공포 &amp; 탐욕 지수</h3>
        <div className="flex h-[200px] items-center justify-center text-center text-[13px] text-slate-500">공포 & 탐욕 지수 조회 불가</div>
      </div>
    );
  }

  const rating = fearGreedRating(data.score);
  const color = fearGreedColor(data.score);
  const markerLeft = Math.max(0, Math.min(100, data.score));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-slate-700 dark:text-slate-300">공포 &amp; 탐욕 지수</h3>
        <span className="shrink-0 text-[11px] text-slate-500">{data.source ?? "CNN Fear & Greed"}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="num text-[44px] font-black leading-none" style={{ color }}>{data.score}</span>
        <span className="text-[15px] font-bold" style={{ color }}>{rating}</span>
      </div>
      <div className="relative mt-4 h-[14px] overflow-hidden rounded-full" style={{ background: FNG_GRADIENT }}>
        <div className="absolute top-[-3px] h-[20px] w-[4px] -translate-x-1/2 rounded-full bg-white shadow" style={{ left: `${markerLeft}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] leading-tight text-slate-500">
        {FNG_BANDS.map((band) => <span key={band} className="break-keep">{band}</span>)}
      </div>
      <div className="mt-4 h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.history} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="date" tickFormatter={formatFearGreedAxisTick} tick={AXIS_TICK_SM} axisLine={AXIS_LINE} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} hide />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} labelFormatter={formatFearGreedTooltipLabel} />
            <Line type="monotone" dataKey="value" name="공포탐욕 지수" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
