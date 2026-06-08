"use client";

import { useState } from "react";
import { SECTOR_FILTERS, TOP_HOLDINGS, Holding } from "@/lib/mockData";

// 자산 맵 우측 카드: 섹터 필터 pill + TOP100 스크롤 테이블.
export default function HoldingsTable() {
  const [active, setActive] = useState("기술");

  const filtered: Holding[] =
    active === "전체"
      ? TOP_HOLDINGS
      : TOP_HOLDINGS.filter((h) => h.sector === active);

  const count = filtered.length;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
      <div className="mb-3 text-[15px] font-bold text-slate-100">
        실질 보유 TOP 100{" "}
        <span className="text-slate-400">
          — {active} ({count}개)
        </span>
      </div>

      {/* 섹터 필터 pill */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SECTOR_FILTERS.map((s) => {
          const on = s === active;
          return (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                on
                  ? "bg-blue-600 text-white"
                  : "bg-[#262d2f] text-slate-300 hover:bg-[#2f383a]"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* 테이블 */}
      <div className="min-h-0 flex-1">
        <div className="grid grid-cols-[1fr_88px_72px] gap-2 border-b border-[#2a3336] px-2 pb-2 text-[12px] font-medium text-slate-500">
          <span>종목</span>
          <span>섹터</span>
          <span className="text-right">비중</span>
        </div>
        <div className="scroll-dark max-h-[440px] overflow-y-auto">
          {filtered.map((h) => (
            <div
              key={h.rank}
              className="grid grid-cols-[1fr_88px_72px] items-center gap-2 border-b border-[#222a2c] px-2 py-2.5 hover:bg-white/5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="num w-5 shrink-0 text-[12px] text-slate-500">
                  {h.rank}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-100">
                    {h.name}
                  </div>
                  <div className="num text-[11px] text-slate-500">
                    {h.ticker}
                  </div>
                </div>
              </div>
              <span className="text-[12px] text-slate-400">{h.sector}</span>
              <span className="num text-right text-[13px] font-bold text-slate-100">
                {h.weight.toFixed(2)}%
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-[13px] text-slate-500">
              해당 섹터 종목이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
