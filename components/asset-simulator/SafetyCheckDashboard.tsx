"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import { calibrateStressSafetyForDisplay } from "@/lib/asset-simulator-portfolio-ui";
import type { SimulatorInputs, SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyHeroCard from "./SafetyHeroCard";
import SafetyKpiCards from "./SafetyKpiCards";
import SafetyScenarioComparison from "./SafetyScenarioComparison";

type Props = {
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  targetMonthlyExpenseReal: number | null;
  onTargetMonthlyExpenseChange: (value: number | null) => void;
  inputs: SimulatorInputs;
  onInputsChange: (inputs: SimulatorInputs) => void;
  configPanel: ReactNode;
  safetyPanel: ReactNode;
};

function firstMonthlySupply(projection: SimulatorProjection) {
  return projection.totalWithdrawRows.find((row) => row.isWithdraw) ?? projection.totalWithdrawRows.at(0) ?? null;
}

export default function SafetyCheckDashboard({ projection, stressProjection, targetMonthlyExpenseReal, onTargetMonthlyExpenseChange, inputs, onInputsChange, configPanel, safetyPanel }: Props) {
  const safety = useMemo(() => calculateRetirementSafety(projection, { targetMonthlyExpenseReal }), [projection, targetMonthlyExpenseReal]);
  const stressSafety = useMemo(() => calculateRetirementSafety(stressProjection, { targetMonthlyExpenseReal }), [stressProjection, targetMonthlyExpenseReal]);
  const displayedStress = useMemo(() => calibrateStressSafetyForDisplay(safety, stressSafety), [safety, stressSafety]);
  const supply = firstMonthlySupply(projection);

  return (
    <div className="min-w-0 space-y-5">
      <SafetyHeroCard inputs={inputs} onInputsChange={onInputsChange} targetMonthlyExpenseReal={targetMonthlyExpenseReal} onTargetMonthlyExpenseChange={onTargetMonthlyExpenseChange} />
      {configPanel}
      <SafetyKpiCards projection={projection} safety={safety} targetMonthlyExpenseReal={targetMonthlyExpenseReal} taxMonthlySupply={supply?.taxSavingMonthlyReal ?? null} brokerageMonthlySupply={supply?.taxableMonthlyDividendReal ?? null} totalMonthlySupply={supply?.totalMonthlyIncomeReal ?? null} />
      <SafetyScenarioComparison basic={safety.combined} stress={displayedStress.combined} taxSavingPreservation={{ basic: safety.taxSaving.metrics.preservationRatio, stress: displayedStress.taxSaving.metrics.preservationRatio }} brokeragePreservation={{ basic: safety.brokerage.metrics.preservationRatio, stress: displayedStress.brokerage.metrics.preservationRatio }} hasTarget={targetMonthlyExpenseReal !== null} targetMonthlyExpenseReal={targetMonthlyExpenseReal} basicFinalReal={projection.summary.combinedRealBalance} stressFinalReal={stressProjection.summary.combinedRealBalance} projection={projection} stressProjection={stressProjection} />
      <details className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden"><span>기존 안전성 점수 참고</span><span className="text-slate-400 transition group-open:rotate-90">›</span></summary>
        <div className="mt-3 min-w-0">{safetyPanel}</div>
      </details>
    </div>
  );
}
