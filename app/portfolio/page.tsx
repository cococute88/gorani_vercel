"use client";

import { Plus } from "lucide-react";
import TopNav from "@/components/TopNav";
import MiniTickerCard from "@/components/MiniTickerCard";
import PortfolioSummary from "@/components/PortfolioSummary";
import DonutChartCard from "@/components/DonutChartCard";
import AssetAccountCards from "@/components/AssetAccountCards";
import TreemapMock from "@/components/TreemapMock";
import QldAccountBarChart from "@/components/qld/QldAccountBarChart";
import QldValueFxChart from "@/components/qld/QldValueFxChart";
import {
  PIN_TICKERS,
  ACCOUNT_ALLOCATION,
  STOCK_ALLOCATION,
  TAG_ALLOCATION_DARK,
} from "@/lib/mockData";
import { usePortfolioView } from "@/lib/use-portfolio-view";

// 스크린샷 4: 다크모드 포트폴리오 현황 + 트리맵
export default function PortfolioPage() {
  const portfolioView = usePortfolioView();
  const d = portfolioView.summary;
  const accountAllocation = portfolioView.hasLiveData
    ? portfolioView.accountAllocation
    : ACCOUNT_ALLOCATION;
  const stockAllocation = portfolioView.hasLiveData
    ? portfolioView.stockAllocation
    : STOCK_ALLOCATION;
  const purposeAllocation = portfolioView.hasLiveData
    ? portfolioView.purposeAllocation
    : TAG_ALLOCATION_DARK;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {/* 제목줄 */}
        <div className="mb-4 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-[20px] font-extrabold text-white">
                포트폴리오 현황
              </h1>
              <span className="text-[12.5px] text-slate-500">
                {portfolioView.snapshot
                  ? `${portfolioView.snapshot.snapshotDate} 스냅샷 기준`
                  : "05/15 09:03 기준"}
              </span>
              <span className="num text-[12.5px] text-slate-400">
                $1 = {d.fxUsd.toLocaleString()}원 · ¥100 ={" "}
                {d.fxJpy.toLocaleString()}원
              </span>
            </div>

            <div className="no-scrollbar -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {PIN_TICKERS.map((t) => (
                <div key={t.name} className="w-[210px] shrink-0 sm:w-[220px]">
                  <MiniTickerCard ticker={t} theme="dark" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span className="text-[13px] text-slate-400">
              계좌 {d.accounts}개 · 종목 {d.holdings}개
            </span>
            <button className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700">
              <Plus size={15} /> 계좌 추가
            </button>
          </div>
        </div>

        {portfolioView.hasLiveData ? (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[12.5px] text-emerald-200">
            포트폴리오 관리에서 저장한 최신 스냅샷 실데이터를 표시하고 있습니다.
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[12.5px] text-amber-200">
            저장된 스냅샷이 없어 목업 데이터로 표시합니다. /portfolio-manager에서 엑셀을 등록하면 실데이터로 전환됩니다.
          </div>
        )}

        {/* 요약 영역 */}
        <section className="mb-6">
          <PortfolioSummary theme="dark" />
        </section>

        {/* 중간 차트 3개 */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DonutChartCard
            title="계좌별 비중"
            data={accountAllocation}
            theme="dark"
          />
          <DonutChartCard
            title="종목별 비중 상위 15개"
            data={stockAllocation}
            theme="dark"
            maxLegend={15}
          />
          <DonutChartCard
            title="목적별 비중"
            data={purposeAllocation}
            theme="dark"
          />
        </section>

        {/* 계좌별 평가금액 / 총 평가금액 및 환율 추이 */}
        <section className="mb-6 grid min-w-0 grid-cols-1 gap-4 overflow-x-hidden xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.55fr)]">
          <div className="min-w-0">
            <QldAccountBarChart compact />
          </div>
          <div className="min-w-0">
            <QldValueFxChart compact />
          </div>
        </section>

        {/* 배당 / 성장 트리맵 + 계좌현황 */}
        <section className="grid min-w-0 grid-cols-1 gap-5 overflow-x-hidden xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="min-w-0 w-full max-w-full">
            <TreemapMock />
          </div>
          <div className="min-w-0">
            <h2 className="mb-3 text-[15px] font-bold text-slate-300">
              계좌 현황
            </h2>
            <AssetAccountCards theme="dark" />
          </div>
        </section>
      </main>
    </div>
  );
}
