"use client";

import TopNav from "@/components/TopNav";
import PortfolioSummary from "@/components/PortfolioSummary";
import DonutChartCard from "@/components/DonutChartCard";
import AssetAllocationDonut from "@/components/portfolio/AssetAllocationDonut";
import AssetAccountCards from "@/components/AssetAccountCards";
import PortfolioDividendSummaryCard from "@/components/portfolio/PortfolioDividendSummaryCard";
import AssetClassDonut from "@/components/portfolio/AssetClassDonut";
import PortfolioMarketIndicatorStrip from "@/components/portfolio/PortfolioMarketIndicatorStrip";
import { usePortfolioView } from "@/lib/use-portfolio-view";
import { usePortfolioFirestoreSnapshot } from "@/lib/portfolio-firestore-snapshot-sync";
import { buildAssetClassAllocation } from "@/lib/asset-class-allocation";
import { getAuthoritativeTotalAssetsKRW } from "@/lib/portfolio-authoritative-total";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { useMemo } from "react";

// 스크린샷 4: 다크모드 포트폴리오 현황 + 자산군 도넛
export default function PortfolioPage() {
  // 페이지 진입 시 Firestore 최신 portfolio_snapshot 을 데이터 공급원으로 사용한다.
  // (스냅샷 없음/오류 시 기존 로컬 데이터로 자동 fallback. UI/계산은 변경하지 않는다.)
  usePortfolioFirestoreSnapshot();
  const portfolioView = usePortfolioView();
  const theme = useResolvedTheme();

  // 모든 차트가 공유하는 단일 총자산 기준(권위 total_assets_krw).
  const authoritativeTotalAssetsKRW = getAuthoritativeTotalAssetsKRW(portfolioView.snapshot);

  // 하단 "보유 비중 분석": 보유종목/현금성 잔액을 TQQQ·QLD·QQQ·SPY·SCHD·MSFT·달러·현금·예적금·기타
  // 자산군 단위로 합산해 Streamlit 방식 도넛으로 표시한다 (원본 상품명 단위로 쪼개지 않는다).
  const assetClassSlices = useMemo(
    () =>
      buildAssetClassAllocation(
        portfolioView.mappedHoldings,
        portfolioView.snapshot?.financeAssets ?? [],
        {
          authoritativeCashKRW: portfolioView.snapshot?.authoritativeTotals?.totalCashKRW ?? null,
          authoritativeTotalAssetsKRW,
        },
      ),
    [portfolioView.mappedHoldings, portfolioView.snapshot, authoritativeTotalAssetsKRW],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {/* 제목줄: 제목 + 스냅샷 기준일. 데이터 관리(최근 동기화/최신화/확인이 필요한 항목)는
            포트폴리오 관리 페이지로 이동했다. 투자현황은 조회 화면으로 유지한다. */}
        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-[20px] font-extrabold text-slate-900 dark:text-white">
            포트폴리오 현황
          </h1>
          <span className="text-[12.5px] text-slate-500">
            {portfolioView.snapshot
              ? `${portfolioView.snapshot.snapshotDate} 스냅샷 기준`
              : "저장된 스냅샷 없음"}
          </span>
        </div>

        {/* 상단 compact 시장지표 strip: /api/market live briefing 재사용 (mock 미사용) */}
        <PortfolioMarketIndicatorStrip theme={theme} />

        {!portfolioView.flags.hasSnapshot ? (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-[12.5px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            아직 등록된 스냅샷이 없습니다. 포트폴리오 관리에서 엑셀을 등록하면 자산 구성과 보유종목이 여기에 표시됩니다.
          </div>
        ) : null}

        {/* 요약 영역 */}
        <section className="mb-6">
          <PortfolioSummary theme={theme} />
        </section>

        {/* 배당 요약 카드: 기존 "데이터 상태" 카드를 대체한다.
            배당현황과 동일한 계산(useDividendSummary)을 공유하며, 카드 전체를 클릭하면
            배당 → 배당현황으로 이동한다. 절세 납입원금은 자산시뮬레이터 Save 값 기준. */}
        <section className="mb-6">
          <PortfolioDividendSummaryCard />
        </section>

        {/* 중간 차트 3개 */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DonutChartCard
            title="계좌별 비중"
            data={portfolioView.accountAllocation}
            theme={theme}
            emptyMessage="계좌별 평가금액 정보가 없어 계좌 비중을 표시할 수 없습니다."
          />
          <AssetAllocationDonut
            title="종목별 비중"
            holdings={portfolioView.mappedHoldings}
            financeAssets={portfolioView.snapshot?.financeAssets ?? []}
            theme={theme}
            emptyMessage="평가금액이 있는 보유종목이 없어 종목별 비중을 표시할 수 없습니다."
            authoritativeCashKRW={portfolioView.snapshot?.authoritativeTotals?.totalCashKRW ?? null}
            authoritativeTotalAssetsKRW={authoritativeTotalAssetsKRW}
          />
          <DonutChartCard
            title="목적별 비중"
            data={portfolioView.assetAllocation}
            theme={theme}
            emptyMessage="자산 종류 정보가 없어 목적별 비중을 표시할 수 없습니다."
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

          {/* 하단 분석 블록 — 1300px+ 좌측 컬럼.
              기존 트리맵을 제거하고 Streamlit 방식 자산군 도넛으로 교체한다. */}
          <section className="min-w-0 overflow-x-hidden min-[1300px]:col-start-1 min-[1300px]:row-start-1">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-700 dark:text-slate-300">
                보유 비중 분석
              </h2>
              {assetClassSlices.length === 0 ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-[#2a3336] dark:bg-white/[0.03] dark:text-slate-400">
                  표시할 데이터 없음
                </span>
              ) : null}
            </div>
            <div className="mx-auto min-w-0 w-full max-w-[560px] xl:mx-0">
              <AssetClassDonut
                slices={assetClassSlices}
                theme={theme}
                totalOverrideKRW={authoritativeTotalAssetsKRW}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
