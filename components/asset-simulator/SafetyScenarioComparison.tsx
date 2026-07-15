"use client";

import { useMemo } from "react";
import { buildScenarioComparisonRows, describeScenarioRisk, STRESS_SCENARIO_NOTE } from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney, formatRealAndNominalManwon } from "@/lib/format";
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
};

function firstSupply(projection: SimulatorProjection) {
  return projection.totalWithdrawRows.find((row) => row.isWithdraw) ?? projection.totalWithdrawRows.at(0) ?? null;
}

function ScenarioCard({ label, projection, result, color }: { label: string; projection: SimulatorProjection; result: SafetyResult; color: string }) {
  const row = firstSupply(projection);
  const final = projection.chartRows.at(-1);
  const flow = row ? formatRealAndNominalManwon(row.totalMonthlyIncomeReal, row.totalMonthlyIncomeNominal) : "—";
  const asset = final ? formatRealAndNominalManwon(final.combinedRealBalance, final.combinedNominalBalance) : "—";
  return <div className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-[#2c3638]"><p className={`font-bold ${color}`}>{label}</p><p className="mt-1 text-[11px] text-slate-500">월 현금흐름</p><p className="break-keep text-[12px] font-semibold text-slate-800 dark:text-slate-100">{flow}</p><p className="mt-1 text-[11px] text-slate-500">최종 자산 (실질·명목)</p><p className="break-keep text-[12px] font-semibold text-slate-800 dark:text-slate-100">{asset}</p><p className="mt-1 text-[11px] text-slate-500">부족 {result.metrics.shortfallYears}년 · 보존율 {Math.round(result.metrics.preservationRatio * 100)}%</p></div>;
}

export default function SafetyScenarioComparison({ basic, normal, stress, targetMonthlyExpenseReal, projection, normalProjection, stressProjection }: Props) {
  const hasTarget = targetMonthlyExpenseReal !== null && targetMonthlyExpenseReal > 0;
  const finalGood = projection.summary.combinedRealBalance;
  const finalBad = stressProjection.summary.combinedRealBalance;
  const rows = useMemo(() => buildScenarioComparisonRows(basic, stress, finalGood, finalBad, hasTarget), [basic, stress, finalGood, finalBad, hasTarget]);
  const risk = describeScenarioRisk(basic, normal, stress);
  const targetText = hasTarget ? `${formatManwonMoney(targetMonthlyExpenseReal!)}은 현재가치 기준이며, 차트 툴팁의 괄호 안은 해당 연도 명목금액입니다.` : "목표 월생활비를 입력하면 충당률과 부족 기간을 함께 판단합니다.";

  return (
    <section aria-label="Good Normal Bad 안전성 비교" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
      <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Good · Normal · Bad 비교</h3>
      <p className="mt-1 break-keep text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">Good은 사용자 입력값 100%를, Normal은 성장률 85%를 적용합니다. {STRESS_SCENARIO_NOTE}</p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{targetText}</p>
      <p className={`mt-2 text-[12px] font-semibold ${risk.label === "안전" ? "text-emerald-700 dark:text-emerald-300" : risk.label === "위험" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>고갈위험 판단: {risk.label} {risk.score}점 — {risk.description}</p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><ScenarioCard label="Good" projection={projection} result={basic} color="text-blue-600 dark:text-blue-400" /><ScenarioCard label="Normal" projection={normalProjection} result={normal} color="text-emerald-600 dark:text-emerald-400" /><ScenarioCard label="Bad" projection={stressProjection} result={stress} color="text-amber-700 dark:text-amber-400" /></div>
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#273032] dark:bg-white/[0.03]"><h4 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">실질 총자산 추이</h4><SafetyAssetTrajectoryChart projection={projection} normalProjection={normalProjection} stressProjection={stressProjection} /></div>
        <div className="min-w-0"><SafetyScenarioCompareTable basic={basic} stress={stress} rows={rows} /></div>
      </div>
      <div className="mt-5"><SafetyMonthlySupplyChart projection={projection} normalProjection={normalProjection} stressProjection={stressProjection} targetMonthlyExpenseReal={targetMonthlyExpenseReal} safetyResult={basic} stressSafetyResult={stress} /></div>
    </section>
  );
}
