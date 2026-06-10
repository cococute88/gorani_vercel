"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import DonutChartCard from "@/components/DonutChartCard";
import HoldingsTable from "@/components/HoldingsTable";
import { SECTOR_ALLOCATION } from "@/lib/mockData";

// 시장 현황 하단에 통합된 자산 맵 / ETF 투시 섹션.
export default function AssetMapSection() {
  const [tab, setTab] = useState<"map" | "etf">("etf");

  return (
    <section className="mt-8 border-t border-[#242938] pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-[20px] font-extrabold text-white">자산 맵</h2>
          <span className="text-[12.5px] text-slate-500">05/15 09:07 기준 · 시장 현황 통합</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-[#1b2021] p-1">
          <button
            type="button"
            onClick={() => setTab("map")}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === "map" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            자산지도
          </button>
          <button
            type="button"
            onClick={() => setTab("etf")}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === "etf" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ETF 투시
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2a3336] bg-[#191f20] px-4 py-3">
        <span className="text-[13px] font-medium text-slate-300">
          보유 ETF <b className="text-white">35개</b> · 커버리지 <b className="text-white">91%</b>
        </span>
        <button type="button" className="flex items-center gap-1 text-[12.5px] text-slate-400 hover:text-slate-200">
          펼치기 <ChevronDown size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
          <div className="-m-5">
            <DonutChartCard
              title="섹터 비중"
              data={SECTOR_ALLOCATION}
              theme="dark"
              size={150}
              centerLabel="섹터"
              centerValue="16개"
            />
          </div>
        </div>
        <HoldingsTable />
      </div>
    </section>
  );
}
