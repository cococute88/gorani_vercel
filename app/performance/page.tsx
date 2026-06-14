"use client";

import { Copy, Plus } from "lucide-react";
import TopNav from "@/components/TopNav";
import MetricCard from "@/components/MetricCard";
import PerformanceChart from "@/components/PerformanceChart";
import SampleBadge from "@/components/common/SampleBadge";
import QldAssetSummaryCard from "@/components/qld/QldAssetSummaryCard";
import QldValueFxChart from "@/components/qld/QldValueFxChart";
import QldHoldingsRankTable from "@/components/qld/QldHoldingsRankTable";
import { PERFORMANCE_KPIS } from "@/lib/mockData";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

// 투자 성과 = 시간에 따른 성과/투자 결과 분석 (PORTFOLIO-PERF-UI-1)
export default function PerformancePage() {
  const theme = useResolvedTheme();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#181c1d] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {/* 제목줄 */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-[22px] font-extrabold text-slate-900 dark:text-white">
            📈 투자 성과
            <SampleBadge />
          </h1>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 dark:border-[#2a3336] dark:bg-[#1e2324] dark:text-slate-300 dark:hover:bg-[#252b2c]">
              <Copy size={14} /> MD 복사
            </button>
            <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700">
              <Plus size={15} /> 데이터 입력
            </button>
          </div>
        </div>
        <p className="mb-5 text-[12.5px] text-slate-500">
          실데이터 연결 전 샘플 그래프입니다. 시간에 따른 투자 성과(누적원금 · 평가액 · 배당금)를 분석하는 화면입니다.
        </p>

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

        {/* 대형 차트 */}
        <PerformanceChart />

        <section className="mt-8 border-t border-slate-200 pt-6 dark:border-[#242938]">
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-extrabold text-slate-900 dark:text-white">평가금액 · 환율 추이 분석</h2>
              <SampleBadge />
            </div>
            <p className="mt-1 text-[12.5px] text-slate-500">
              총 평가금액, 환율 추이, 종목 랭킹을 시계열로 분석합니다. 현재는 샘플 데이터입니다.
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
