"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
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

function firstMonthlySupply(projection: SimulatorProjection) {
  return projection.totalWithdrawRows.find((row) => row.isWithdraw) ?? projection.totalWithdrawRows.at(0) ?? null;
}

export default function SafetyCheckDashboard({ projection, normalProjection, stressProjection, targetMonthlyExpenseReal, onTargetMonthlyExpenseChange, inputs, onInputsChange, configPanel, safetyPanel }: Props) {
  const safety = useMemo(() => calculateRetirementSafety(projection, { targetMonthlyExpenseReal }), [projection, targetMonthlyExpenseReal]);
  const normalSafety = useMemo(() => calculateRetirementSafety(normalProjection, { targetMonthlyExpenseReal }), [normalProjection, targetMonthlyExpenseReal]);
  const stressSafety = useMemo(() => calculateRetirementSafety(stressProjection, { targetMonthlyExpenseReal }), [stressProjection, targetMonthlyExpenseReal]);
  const supply = firstMonthlySupply(projection);

  return (
    <div className="min-w-0 space-y-5">
      <SafetyHeroCard inputs={inputs} onInputsChange={onInputsChange} targetMonthlyExpenseReal={targetMonthlyExpenseReal} onTargetMonthlyExpenseChange={onTargetMonthlyExpenseChange} />
      {configPanel}
      <SafetyKpiCards
        projection={projection} safety={safety} normalSafety={normalSafety} stressSafety={stressSafety} targetMonthlyExpenseReal={targetMonthlyExpenseReal}
        taxMonthlySupply={supply?.taxSavingMonthlyReal ?? null} taxMonthlySupplyNominal={supply?.taxSavingMonthlyNominal ?? null}
        brokerageMonthlySupply={supply?.taxableMonthlyDividendReal ?? null} brokerageMonthlySupplyNominal={supply?.taxableMonthlyDividendNominal ?? null}
        totalMonthlySupply={supply?.totalMonthlyIncomeReal ?? null} totalMonthlySupplyNominal={supply?.totalMonthlyIncomeNominal ?? null}
      />
      <SafetyScenarioComparison basic={safety.combined} normal={normalSafety.combined} stress={stressSafety.combined} targetMonthlyExpenseReal={targetMonthlyExpenseReal} projection={projection} normalProjection={normalProjection} stressProjection={stressProjection} />
      <details className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden"><span>계좌별 안전성 참고</span><span className="text-slate-400 transition group-open:rotate-90">›</span></summary>
        <div className="mt-3 min-w-0">{safetyPanel}</div>
      </details>
    </div>
  );
}
