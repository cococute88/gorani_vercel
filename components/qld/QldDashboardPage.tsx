"use client";

import TopNav from "@/components/TopNav";
import QldAssetSummaryCard from "@/components/qld/QldAssetSummaryCard";
import QldValueFxChart from "@/components/qld/QldValueFxChart";
import QldAccountBarChart from "@/components/qld/QldAccountBarChart";
import QldMonthlyDividendChart from "@/components/qld/QldMonthlyDividendChart";
import QldHoldingsRankTable from "@/components/qld/QldHoldingsRankTable";

// QLD 대시보드 메인 조립. qld.kr 느낌의 다크 대시보드를 MOCK 데이터로 재현.
export default function QldDashboardPage() {
  return (
    <div className="min-h-screen bg-[#06070b] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto max-w-[1840px] px-5 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[20px] font-extrabold text-white">QLD 대시보드</h1>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              현재 총 자산과 전일 변동을 확인하는 QLD 포트폴리오 대시보드
            </p>
          </div>
        </div>

        {/* 1행: 총 평가금액 / 자산 구성 + 평가금액·환율 추이 */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <QldAssetSummaryCard />
          <QldValueFxChart />
        </section>

        {/* 2행: 계좌별 평가금액 + 월간 배당금 */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <QldAccountBarChart />
          <QldMonthlyDividendChart />
        </section>

        {/* 3행: 종목 랭킹 테이블 (전체폭) */}
        <section className="mt-4">
          <QldHoldingsRankTable />
        </section>
      </main>
    </div>
  );
}
