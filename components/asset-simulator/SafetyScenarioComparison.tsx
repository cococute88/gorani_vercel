"use client";

import { formatPct, STRESS_SCENARIO_NOTE } from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney } from "@/lib/format";
import type { SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyAssetTrajectoryChart from "./SafetyAssetTrajectoryChart";
import SafetyMonthlySupplyChart from "./SafetyMonthlySupplyChart";
import SafetyScenarioCompareTable from "./SafetyScenarioCompareTable";

type Props = {
  basic: SafetyResult;
  normal: SafetyResult;
  stress: SafetyResult;
  targetMonthlyExpenseReal: number | null;
  projection: SimulatorProjection;
  normalProjection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  calculationBasisSource: "cloud" | "local" | "default" | "session";
};

const BASIS_SOURCE_LABEL = {
  cloud: "저장된 사용자 가정(클라우드)",
  local: "저장된 사용자 가정(이 브라우저)",
  session: "현재 화면에서 적용한 가정(저장 전일 수 있음)",
  default: "코드 기본 입력값(적용된 포트폴리오 가정 없음)",
} as const;

export default function SafetyScenarioComparison({ basic, normal, stress, targetMonthlyExpenseReal, projection, normalProjection, stressProjection, calculationBasisSource }: Props) {
  const targetText = targetMonthlyExpenseReal !== null && targetMonthlyExpenseReal > 0
    ? `목표 월생활비 ${formatManwonMoney(targetMonthlyExpenseReal)}은 현재가치 기준입니다.`
    : "목표 월생활비를 입력하면 시나리오별 충당률과 생활비 미달 기간을 함께 판단합니다.";

  return (
    <section aria-label="Good Normal Bad 비교와 차트" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
      <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">시나리오 비교와 자산 추이</h3>
      <p className="mt-1 break-keep text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">Good: 입력 가정 100% · Normal: 성장률 85% · Bad: 첫해 -30%, 2~3년 0%, 이후 보수 성장</p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{targetText} {STRESS_SCENARIO_NOTE}</p>
      <details className="group mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-[#273032] dark:bg-white/[0.03] dark:text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">계산 기준 요약 · {BASIS_SOURCE_LABEL[calculationBasisSource]}</summary>
        <div className="mt-2 space-y-1 leading-relaxed">
          {projection.summary.portfolioSummary ? <>
            <p>절세계좌 {projection.summary.portfolioSummary.taxSaving.tickers.join(" / ")} · 적용 총수익률 {formatPct(projection.summary.portfolioSummary.taxSaving.effectiveTotalReturnPct)}</p>
            <p>위탁계좌 {projection.summary.portfolioSummary.brokerage.tickers.join(" / ")} · 주가성장률 {formatPct(projection.summary.portfolioSummary.brokerage.effectivePriceReturnPct)} · 배당률 {formatPct(projection.summary.portfolioSummary.brokerage.effectiveDividendYieldPct)} · 배당성장률 {formatPct(projection.summary.portfolioSummary.brokerage.effectiveDividendGrowthPct)}</p>
          </> : <p>절세계좌 수익률은 기본 입력값 {formatPct(projection.inputs.annualReturnRate)}을 사용합니다. 종목별 가정을 적용하려면 계좌 입력에서 결과 확인을 누르세요.</p>}
          <p>Good 100% · Normal 성장률 85% · Bad 첫 인출연도 -30%, 2~3년 0%, 이후 성장률 65% · Bad 배당성장률 50%, 배당률은 첫 3년만 20% 삭감</p>
          <p>보존율 = 실제 인출 시작 시점 실질자산 대비 최종 실질자산입니다.</p>
        </div>
      </details>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#273032] dark:bg-white/[0.03]"><h4 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">실질 총자산 추이</h4><SafetyAssetTrajectoryChart projection={projection} normalProjection={normalProjection} stressProjection={stressProjection} /></div>
        <SafetyScenarioCompareTable good={basic} normal={normal} bad={stress} goodProjection={projection} normalProjection={normalProjection} badProjection={stressProjection} />
      </div>
      <div className="mt-5"><SafetyMonthlySupplyChart projection={projection} normalProjection={normalProjection} stressProjection={stressProjection} targetMonthlyExpenseReal={targetMonthlyExpenseReal} safetyResult={basic} stressSafetyResult={stress} /></div>
    </section>
  );
}
