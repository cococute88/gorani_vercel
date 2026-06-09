"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import TopNav from "@/components/TopNav";
import MiniTickerCard from "@/components/MiniTickerCard";
import PortfolioSummary from "@/components/PortfolioSummary";
import DonutChartCard from "@/components/DonutChartCard";
import WatchlistRow from "@/components/WatchlistRow";
import AssetAccountCards from "@/components/AssetAccountCards";
import TreemapMock from "@/components/TreemapMock";
import QldAccountBarChart from "@/components/qld/QldAccountBarChart";
import QldValueFxChart from "@/components/qld/QldValueFxChart";
import {
  PIN_TICKERS,
  PERIOD_BUTTONS,
  ACCOUNT_ALLOCATION,
  STOCK_ALLOCATION,
  TAG_ALLOCATION_DARK,
  PORTFOLIO_SUMMARY_DARK,
} from "@/lib/mockData";

// 스크린샷 4: 다크모드 포트폴리오 현황 + 트리맵
export default function PortfolioPage() {
  const [period, setPeriod] = useState("1분");
  const d = PORTFOLIO_SUMMARY_DARK;

  return (
    <div className="min-h-screen bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {/* 제목줄 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-[20px] font-extrabold text-white">
              포트폴리오 현황
            </h1>
            <div className="flex items-center gap-1 rounded-lg bg-[#1b2021] p-1">
              {PERIOD_BUTTONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                    period === p
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <span className="text-[12.5px] text-slate-500">
              05/15 09:03 기준
            </span>
            <span className="num text-[12.5px] text-slate-400">
              $1 = {d.fxUsd.toLocaleString()}원 · ¥100 ={" "}
              {d.fxJpy.toLocaleString()}원
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-slate-400">
              계좌 {d.accounts}개 · 종목 {d.holdings}개
            </span>
            <button className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700">
              <Plus size={15} /> 계좌 추가
            </button>
          </div>
        </div>

        {/* 요약 영역 */}
        <section className="mb-6">
          <PortfolioSummary theme="dark" />
        </section>

        {/* 중간 차트 3개 */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DonutChartCard
            title="계좌별 비중"
            data={ACCOUNT_ALLOCATION}
            theme="dark"
          />
          <DonutChartCard
            title="종목별 비중 상위 15개"
            data={STOCK_ALLOCATION}
            theme="dark"
            maxLegend={15}
          />
          <DonutChartCard
            title="태그별 비중"
            data={TAG_ALLOCATION_DARK}
            theme="dark"
          />
        </section>

        {/* 하단 주요 대시보드: 계좌별 평가금액 / 총 평가금액 및 환율 추이 / 핀 차트 */}
        <section className="mb-6 grid min-w-0 grid-cols-1 gap-4 overflow-x-hidden xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.55fr)_minmax(300px,0.95fr)]">
          <div className="min-w-0">
            <QldAccountBarChart compact />
          </div>
          <div className="min-w-0">
            <QldValueFxChart compact />
          </div>
          <div className="min-w-0 rounded-[18px] border border-[#242938] bg-[#12151e] p-3">
            <h2 className="mb-2 text-[13px] font-bold text-slate-100">
              📌 핀 차트
            </h2>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {PIN_TICKERS.map((t) => (
                <MiniTickerCard key={t.name} ticker={t} theme="dark" />
              ))}
            </div>
          </div>
        </section>

        {/* 기존 하단 콘텐츠 */}
        <section className="grid min-w-0 grid-cols-1 gap-5 overflow-x-hidden">
          <div className="min-w-0 w-full max-w-full">
            <TreemapMock />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <WatchlistRow theme="dark" />
            <div>
              <h2 className="mb-3 text-[15px] font-bold text-slate-300">
                계좌 현황
              </h2>
              <AssetAccountCards theme="dark" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
