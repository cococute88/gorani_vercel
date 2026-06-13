"use client";

import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import TopNav from "@/components/TopNav";
import MetricCard from "@/components/MetricCard";
import PerformanceChart from "@/components/PerformanceChart";
import QldAssetSummaryCard from "@/components/qld/QldAssetSummaryCard";
import QldValueFxChart from "@/components/qld/QldValueFxChart";
import QldHoldingsRankTable from "@/components/qld/QldHoldingsRankTable";
import { PERFORMANCE_KPIS } from "@/lib/mockData";

// 스크린샷 3: 다크모드 투자 성과
export default function PerformancePage() {
  const [tab, setTab] = useState<"status" | "sim">("status");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#181c1d] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {/* 제목줄 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-[22px] font-extrabold text-white">
            📈 투자 성과
          </h1>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-[#2a3336] bg-[#1e2324] px-3 py-1.5 text-[13px] font-medium text-slate-300 hover:bg-[#252b2c]">
              <Copy size={14} /> MD 복사
            </button>
            <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700">
              <Plus size={15} /> 데이터 입력
            </button>
          </div>
        </div>

        {/* KPI 6개 */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {PERFORMANCE_KPIS.map((k) => (
            <MetricCard
              key={k.label}
              label={k.label}
              value={k.value}
              sub={k.sub}
              tone={k.tone}
              valueColor={
                k.tone === "green"
                  ? "#4ade80"
                  : k.tone === "orange"
                    ? "#fb923c"
                    : undefined
              }
            />
          ))}
        </div>

        {/* 탭 */}
        <div className="mb-4 flex items-center gap-1 border-b border-[#2a3336]">
          <button
            onClick={() => setTab("status")}
            className={`relative px-4 py-2 text-[14px] font-semibold transition-colors ${
              tab === "status"
                ? "text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            현황
            {tab === "status" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-500" />
            )}
          </button>
          <button
            onClick={() => setTab("sim")}
            className={`relative px-4 py-2 text-[14px] font-semibold transition-colors ${
              tab === "sim"
                ? "text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            시뮬레이션 · 목표
            {tab === "sim" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-500" />
            )}
          </button>
        </div>

        {/* 대형 차트 */}
        <PerformanceChart />

        <section className="mt-8 border-t border-[#242938] pt-6">
          <div className="mb-4">
            <h2 className="text-[18px] font-extrabold text-white">포트폴리오 평가 대시보드</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              기존 QLD 평가 화면의 총 평가금액, 환율 추이, 종목 랭킹을 투자 성과 페이지에서 함께 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <QldAssetSummaryCard />
            <QldValueFxChart />
          </div>
          <div className="mt-4">
            <QldHoldingsRankTable />
          </div>
        </section>
      </main>
    </div>
  );
}
