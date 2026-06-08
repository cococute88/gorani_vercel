"use client";

import type { EtfTemperature } from "@/lib/market-data";

interface Props {
  rows: EtfTemperature[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function rsiTone(rsi: number): string {
  if (rsi >= 70) return "text-red-400";
  if (rsi <= 30) return "text-blue-400";
  return "text-slate-200";
}

// 관심 ETF 시장온도 (현재가/등락률/52주 고점 대비 하락률/RSI)
export default function MarketTemperatureTable({ rows }: Props) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[15px] font-bold text-slate-300">관심 ETF 시장온도</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((r) => (
          <div key={r.ticker} className={card}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-white">{r.ticker}</span>
              <span className={`num text-[12.5px] font-semibold ${r.changePct >= 0 ? "text-red-400" : "text-blue-400"}`}>
                {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="num mt-2 text-[18px] font-extrabold text-white">${r.price.toFixed(2)}</div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-slate-400">52주 고점대비</span>
              <span className="num text-blue-400">{r.drawdownPct.toFixed(1)}%</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px]">
              <span className="text-slate-400">RSI</span>
              <span className={`num font-semibold ${rsiTone(r.rsi)}`}>{r.rsi}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
