"use client";

import { useMemo } from "react";
import { buildMonthlySupplyRows } from "@/lib/asset-simulator-safety-chart-ui";
import { buildScenarioComparisonRows, formatPreservationRatio } from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney } from "@/lib/format";
import type { SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyAssetTrajectoryChart from "./SafetyAssetTrajectoryChart";
import SafetyMonthlySupplyChart from "./SafetyMonthlySupplyChart";
import SafetyScenarioCompareTable from "./SafetyScenarioCompareTable";

type PreservationComparison = {
  basic: number;
  stress: number;
};

type Props = {
  basic: SafetyResult;
  stress: SafetyResult;
  taxSavingPreservation: PreservationComparison;
  brokeragePreservation: PreservationComparison;
  hasTarget: boolean;
  targetMonthlyExpenseReal: number | null;
  basicFinalReal: number;
  stressFinalReal: number;
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection | null;
};

function firstSupply(projection: SimulatorProjection | null) {
  return projection?.totalWithdrawRows.find((row) => row.isWithdraw) ?? projection?.totalWithdrawRows.at(0) ?? null;
}

function targetDifferenceText(value: number | null): string {
  if (value === null) return "—";
  return value >= 0 ? `${formatManwonMoney(value)} 여유` : `${formatManwonMoney(Math.abs(value))} 부족`;
}

function StressMetric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-l border-slate-200 px-3 first:border-l-0 dark:border-[#2c3638]">
      <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 break-keep text-[14px] font-extrabold text-slate-900 dark:text-white">{children}</div>
    </div>
  );
}

export default function SafetyScenarioComparison({
  basic,
  stress,
  taxSavingPreservation,
  brokeragePreservation,
  hasTarget,
  targetMonthlyExpenseReal,
  basicFinalReal,
  stressFinalReal,
  projection,
  stressProjection,
}: Props) {
  const baseSupply = firstSupply(projection)?.totalMonthlyIncomeReal ?? null;
  const stressSupply = firstSupply(stressProjection)?.totalMonthlyIncomeReal ?? null;
  const baseDifference = hasTarget && baseSupply !== null ? baseSupply - targetMonthlyExpenseReal! : null;
  const stressDifference = hasTarget && stressSupply !== null ? stressSupply - targetMonthlyExpenseReal! : null;
  const rows = useMemo(() => buildScenarioComparisonRows(basic, stress, basicFinalReal, stressFinalReal, hasTarget), [basic, stress, basicFinalReal, stressFinalReal, hasTarget]);
  const shortfallStart = useMemo(() => {
    if (!stressProjection || targetMonthlyExpenseReal === null) return null;
    const supplyRows = buildMonthlySupplyRows(projection, stressProjection, targetMonthlyExpenseReal);
    return supplyRows?.find((row) => row.stressSupply !== null && row.stressSupply < targetMonthlyExpenseReal)?.year ?? null;
  }, [projection, stressProjection, targetMonthlyExpenseReal]);

  return (
    <section aria-label="하락장 비교와 보조 차트" className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">하락장 비교</h3>
        <p className="mt-1 text-[11.5px] text-slate-600 dark:text-slate-400">기본 시나리오와 은퇴 초반 하락장 가정의 현금흐름 변화를 함께 확인합니다.</p>
        <div className="mt-3 grid grid-cols-1 gap-y-3 sm:grid-cols-4 sm:gap-y-0">
          <StressMetric label="월 현금">
            <span>기본 {baseSupply === null ? "—" : formatManwonMoney(baseSupply)}</span>
            <span className="mx-1 text-slate-400">→</span>
            <span className="text-blue-600 dark:text-blue-400">하락장 {stressSupply === null ? "—" : formatManwonMoney(stressSupply)}</span>
          </StressMetric>
          <StressMetric label="목표 대비">
            <span>기본 {targetDifferenceText(baseDifference)}</span>
            <span className="mx-1 text-slate-400">→</span>
            <span className={stressDifference !== null && stressDifference < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>하락장 {targetDifferenceText(stressDifference)}</span>
          </StressMetric>
          <StressMetric label="실가치보존율">
            <span>절세 {formatPreservationRatio(taxSavingPreservation.basic)} → {formatPreservationRatio(taxSavingPreservation.stress)}</span>
            <span className="block text-[12px] font-semibold text-slate-600 dark:text-slate-300">위탁 {formatPreservationRatio(brokeragePreservation.basic)} → {formatPreservationRatio(brokeragePreservation.stress)}</span>
          </StressMetric>
          <StressMetric label="부족 시작">{shortfallStart ? `${shortfallStart}년` : "부족 없음"}</StressMetric>
        </div>
      </div>
      <SafetyMonthlySupplyChart projection={projection} stressProjection={stressProjection} targetMonthlyExpenseReal={targetMonthlyExpenseReal} safetyResult={basic} stressSafetyResult={stress} />
      <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-bold text-slate-900 dark:text-white [&::-webkit-details-marker]:hidden"><span>계좌별 실가치 자산 추이</span><span className="text-slate-400 transition group-open:rotate-90">›</span></summary>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#273032] dark:bg-white/[0.03]"><SafetyAssetTrajectoryChart projection={projection} stressProjection={stressProjection} /></div>
      </details>
      <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden"><span>기존 안전성 점수 참고</span><span className="text-slate-400 transition group-open:rotate-90">›</span></summary>
        <SafetyScenarioCompareTable basic={basic} stress={stress} rows={rows} />
      </details>
    </section>
  );
}
