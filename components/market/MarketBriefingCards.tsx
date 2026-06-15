"use client";

import type { BriefingItem } from "@/lib/market-data";

interface Props {
  items: BriefingItem[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-4";

// 상승=빨강 / 하락=파랑 (국내 관습 톤)
export default function MarketBriefingCards({ items }: Props) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[15px] font-bold text-slate-300">시장 브리핑</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.length === 0 && (
          <div className="col-span-full rounded-xl border border-[#2a3336] bg-[#191f20] p-4 text-center text-[13px] text-slate-500">
            시장 데이터를 불러오지 못했습니다.
          </div>
        )}
        {items.map((it) => (
          <div key={it.key} className={card}>
            <div className="text-[12px] text-slate-400">{it.label}</div>
            <div className="num mt-1.5 text-[18px] font-extrabold text-white">{it.value}</div>
            <div className={`num mt-1 text-[12.5px] font-semibold ${it.up ? "text-red-400" : "text-blue-400"}`}>
              {it.changePct == null ? "조회 불가" : `${it.up ? "▲" : "▼"} ${Math.abs(it.changePct).toFixed(2)}%`}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
