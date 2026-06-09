"use client";

import TopNav from "@/components/TopNav";
import QldAccountBarChart from "@/components/qld/QldAccountBarChart";
import QldMonthlyDividendChart from "@/components/qld/QldMonthlyDividendChart";

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
              QLD 전용 계좌·배당 흐름을 확인하는 대시보드
            </p>
          </div>
        </div>

        <section className="mb-4 rounded-[18px] border border-[#242938] bg-[#12151e] p-5">
          <div className="text-[14px] font-bold text-slate-100">QLD 전용 콘텐츠</div>
          <p className="mt-1 text-[12.5px] text-slate-500">
            총 평가금액, 총 평가금액 및 환율 추이, 종목 랭킹은 포트폴리오 관리 페이지 최하단으로 이동했습니다.
          </p>
        </section>

        {/* QLD 전용 잔여 콘텐츠: 계좌별 평가금액 + 월간 배당금 */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <QldAccountBarChart />
          <QldMonthlyDividendChart />
        </section>
      </main>
    </div>
  );
}
