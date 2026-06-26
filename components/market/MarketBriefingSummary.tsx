"use client";

import type { BriefingItem } from "@/lib/market-data";

interface Props { briefing: BriefingItem[]; }

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]";

export default function MarketBriefingSummary({ briefing }: Props) {
  const cards = briefing.filter((item) => item.key !== "fng" && item.key !== "vix").slice(0, 4);
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[15px] font-bold text-slate-700 dark:text-slate-300">시장 브리핑</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.length === 0 && <div className={`${card} col-span-full text-center text-[13px] text-slate-500`}>시장 데이터를 불러오지 못했습니다.</div>}
        {cards.map((it) => (
          <div key={it.key} className={card}>
            <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">{it.label}</div>
            <div className="num mt-1.5 text-[18px] font-extrabold text-slate-900 dark:text-white">{it.value}</div>
            <div className={`num mt-1 text-[12.5px] font-semibold ${it.up ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`}>
              {it.source === "unavailable" || it.changePct == null ? "조회 불가" : `${it.up ? "▲" : "▼"} ${Math.abs(it.changePct).toFixed(2)}%`}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
