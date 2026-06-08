"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import TopNav from "@/components/TopNav";
import DonutChartCard from "@/components/DonutChartCard";
import HoldingsTable from "@/components/HoldingsTable";
import { SECTOR_ALLOCATION } from "@/lib/mockData";

// 스크린샷 1: 다크모드 자산 맵 / ETF 투시
export default function AssetMapPage() {
  const [tab, setTab] = useState<"map" | "etf">("etf");

  return (
    <div className="min-h-screen bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto max-w-[1680px] px-8 py-6">
        {/* 상단 제목줄 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[22px] font-extrabold text-white">자산 맵</h1>
            <span className="text-[12.5px] text-slate-500">
              05/15 09:07 기준
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-[#1b2021] p-1">
            <button
              onClick={() => setTab("map")}
              className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                tab === "map"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              자산지도
            </button>
            <button
              onClick={() => setTab("etf")}
              className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                tab === "etf"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ETF 투시
            </button>
          </div>
        </div>

        {/* 접기 바 */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#2a3336] bg-[#191f20] px-4 py-3">
          <span className="text-[13px] font-medium text-slate-300">
            보유 ETF <b className="text-white">35개</b> · 커버리지{" "}
            <b className="text-white">91%</b>
          </span>
          <button className="flex items-center gap-1 text-[12.5px] text-slate-400 hover:text-slate-200">
            펼치기 <ChevronDown size={14} />
          </button>
        </div>

        {/* 본문 2열 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
            <DonutChartCardWrapper />
          </div>
          <HoldingsTable />
        </div>
      </main>
    </div>
  );
}

// 섹터 비중 도넛 (카드 타이틀 포함)
function DonutChartCardWrapper() {
  return (
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
  );
}
