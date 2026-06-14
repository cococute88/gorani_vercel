"use client";

import { Plus } from "lucide-react";
import TopNav from "@/components/TopNav";
import MiniTickerCard from "@/components/MiniTickerCard";
import PortfolioSummary from "@/components/PortfolioSummary";
import DonutChartCard from "@/components/DonutChartCard";
import AssetAccountCards from "@/components/AssetAccountCards";
import SampleBadge from "@/components/common/SampleBadge";
import PortfolioQuoteStatusPanel from "@/components/portfolio/PortfolioQuoteStatusPanel";
import PortfolioTreemap from "@/components/PortfolioTreemap";
import { PIN_TICKERS } from "@/lib/mockData";
import { usePortfolioView } from "@/lib/use-portfolio-view";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

// 스크린샷 4: 다크모드 포트폴리오 현황 + 트리맵
export default function PortfolioPage() {
  const portfolioView = usePortfolioView();
  const theme = useResolvedTheme();
  const d = portfolioView.summary;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {/* 제목줄 */}
        <div className="mb-4 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-[20px] font-extrabold text-slate-900 dark:text-white">
                포트폴리오 현황
              </h1>
              <SampleBadge label="시장 지표 샘플" />
              <span className="text-[12.5px] text-slate-500">
                {portfolioView.snapshot
                  ? `${portfolioView.snapshot.snapshotDate} 스냅샷 기준`
                  : "저장된 스냅샷 없음"}
              </span>
            </div>

            <div className="no-scrollbar -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {PIN_TICKERS.map((t) => (
                <div key={t.name} className="w-[210px] shrink-0 sm:w-[220px]">
                  <MiniTickerCard ticker={t} theme={theme} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span className="text-[13px] text-slate-400">
              계좌 {d.accountCount}개 · 종목 {d.holdingCount}개
            </span>
            <button className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700">
              <Plus size={15} /> 계좌 추가
            </button>
          </div>
        </div>

        {portfolioView.flags.hasSnapshot ? (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[12.5px] text-emerald-200">
            포트폴리오 관리에서 저장한 최신 스냅샷 실데이터를 표시하고 있습니다. sample fallback은 사용하지 않습니다.
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[12.5px] text-amber-200">
            저장된 스냅샷이 없어 실데이터 섹션을 empty 상태로 표시합니다. /portfolio-manager에서 엑셀을 등록하면 최신 스냅샷으로 전환됩니다.
          </div>
        )}

        {portfolioView.warnings.length > 0 ? (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-900 dark:text-amber-100">
            <div className="mb-1 font-bold">데이터 확인 필요</div>
            <ul className="space-y-1">
              {portfolioView.warnings.slice(0, 4).map((warning) => (
                <li key={warning.code}>· {warning.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {portfolioView.snapshot ? (
          <PortfolioQuoteStatusPanel holdings={portfolioView.mappedHoldings} />
        ) : null}

        {/* 요약 영역 */}
        <section className="mb-6">
          <PortfolioSummary theme={theme} />
        </section>

        {/* 중간 차트 3개 */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DonutChartCard
            title="계좌별 비중"
            data={portfolioView.accountAllocation}
            theme={theme}
            emptyMessage="financeAssets.amountKRW 또는 holdings.valueKRW 계좌 그룹이 부족해 계좌별 비중을 표시하지 않습니다."
          />
          <DonutChartCard
            title="종목별 비중 상위 15개"
            data={portfolioView.stockAllocation}
            theme={theme}
            maxLegend={15}
            emptyMessage="평가금액이 있는 보유종목이 없어 종목별 비중을 표시하지 않습니다."
          />
          <DonutChartCard
            title="자산 구성"
            data={portfolioView.assetAllocation}
            theme={theme}
            emptyMessage="holdings.assetType 또는 financeAssets.category 금액이 부족해 자산 구성을 표시하지 않습니다."
          />
        </section>

        {/* 계좌 현황 + 배당/성장 분석.
            기본(<1300px): 기존처럼 계좌 현황 → 트리맵 순으로 세로 스택.
            1300px+: 좌측 트리맵은 폭을 제한하고 우측 계좌 그룹(위탁·절세 세로 스택)이 남은 공간을 사용한다. */}
        <div className="grid min-w-0 grid-cols-1 gap-6 min-[1300px]:grid-cols-[minmax(380px,560px)_minmax(0,1fr)] min-[1300px]:items-start">
          {/* 계좌 현황: 위탁 / 절세 분리 (스냅샷 기반) — 1300px+ 우측 컬럼 */}
          <section className="mb-8 min-w-0 overflow-x-hidden min-[1300px]:col-start-2 min-[1300px]:row-start-1 min-[1300px]:mb-0">
            <AssetAccountCards theme={theme} compact />
          </section>

          {/* 하단 분석 블록 — 1300px+ 좌측 컬럼 */}
          <section className="min-w-0 overflow-x-hidden min-[1300px]:col-start-1 min-[1300px]:row-start-1">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-700 dark:text-slate-300">
                보유종목 분석
              </h2>
              {!portfolioView.flags.hasTreemap ? <SampleBadge label="empty" /> : null}
            </div>
            <div className="mx-auto min-w-0 w-full max-w-[560px] xl:mx-0">
              <PortfolioTreemap items={portfolioView.treemapItems} theme={theme} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
