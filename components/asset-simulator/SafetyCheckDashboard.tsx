"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import { describeScenarioRisk } from "@/lib/asset-simulator-portfolio-ui";
import type { SimulatorInputs, SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyHeroCard from "./SafetyHeroCard";
import SafetyKpiCards from "./SafetyKpiCards";
import SafetyScenarioComparison from "./SafetyScenarioComparison";

type Props = {
  projection: SimulatorProjection;
  normalProjection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  targetMonthlyExpenseReal: number | null;
  onTargetMonthlyExpenseChange: (value: number | null) => void;
  inputs: SimulatorInputs;
  onInputsChange: (inputs: SimulatorInputs) => void;
  configPanel: ReactNode;
  safetyPanel: ReactNode;
};

export default function SafetyCheckDashboard({ projection, normalProjection, stressProjection, targetMonthlyExpenseReal, onTargetMonthlyExpenseChange, inputs, onInputsChange, configPanel, safetyPanel }: Props) {
  const safety = useMemo(() => calculateRetirementSafety(projection, { targetMonthlyExpenseReal }), [projection, targetMonthlyExpenseReal]);
  const normalSafety = useMemo(() => calculateRetirementSafety(normalProjection, { targetMonthlyExpenseReal }), [normalProjection, targetMonthlyExpenseReal]);
  const stressSafety = useMemo(() => calculateRetirementSafety(stressProjection, { targetMonthlyExpenseReal }), [stressProjection, targetMonthlyExpenseReal]);
  const risk = describeScenarioRisk(safety.combined, normalSafety.combined, stressSafety.combined);
  const riskDescription = stressSafety.combined.metrics.depleted || normalSafety.combined.metrics.depleted
    ? "Normal 또는 Bad에서 자산 고갈 신호가 있어 위험으로 판단됩니다."
    : normalSafety.combined.metrics.shortfallYears > 0 || stressSafety.combined.metrics.shortfallYears > 0
      ? "Normal과 Bad에서 생활비 미달 기간이 있어 현금흐름 부족 위험을 함께 확인해야 합니다."
      : risk.description;

  return (
    <div className="min-w-0 space-y-5">
      <SafetyHeroCard inputs={inputs} onInputsChange={onInputsChange} targetMonthlyExpenseReal={targetMonthlyExpenseReal} onTargetMonthlyExpenseChange={onTargetMonthlyExpenseChange} />
      {configPanel}
      <SafetyKpiCards
        scenarios={[
          { label: "Good", projection, safety, color: "text-blue-600 dark:text-blue-400" },
          { label: "Normal", projection: normalProjection, safety: normalSafety, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Bad", projection: stressProjection, safety: stressSafety, color: "text-amber-700 dark:text-amber-400" },
        ]}
        targetMonthlyExpenseReal={targetMonthlyExpenseReal}
        riskLabel={risk.label}
        riskScore={risk.score}
        riskDescription={riskDescription}
      />
      <SafetyScenarioComparison basic={safety.combined} normal={normalSafety.combined} stress={stressSafety.combined} targetMonthlyExpenseReal={targetMonthlyExpenseReal} projection={projection} normalProjection={normalProjection} stressProjection={stressProjection} />
      <details className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden"><span>계좌별 안전성 참고</span><span className="text-slate-400 transition group-open:rotate-90">›</span></summary>
        <div className="mt-3 min-w-0">{safetyPanel}</div>
      </details>
    </div>
  );
}
