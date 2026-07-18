"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import { describeScenarioRisk } from "@/lib/asset-simulator-portfolio-ui";
import type { SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyHeroCard from "./SafetyHeroCard";
import SafetyKpiCards from "./SafetyKpiCards";
import SafetyScenarioComparison from "./SafetyScenarioComparison";

type Props = {
  projection: SimulatorProjection;
  normalProjection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  targetMonthlyExpenseReal: number | null;
  onTargetMonthlyExpenseChange: (value: number | null) => void;
  simulationYears: number;
  inflationRate: number;
  onSimulationYearsChange: (value: number) => void;
  onInflationRateChange: (value: number) => void;
  calculationBasisSource: "cloud" | "local" | "default" | "session";
  configPanel: ReactNode;
  longTermPanel: ReactNode;
};

export default function SafetyCheckDashboard({ projection, normalProjection, stressProjection, targetMonthlyExpenseReal, onTargetMonthlyExpenseChange, simulationYears, inflationRate, onSimulationYearsChange, onInflationRateChange, calculationBasisSource, configPanel, longTermPanel }: Props) {
  const safety = useMemo(() => calculateRetirementSafety(projection, { targetMonthlyExpenseReal }), [projection, targetMonthlyExpenseReal]);
  const normalSafety = useMemo(() => calculateRetirementSafety(normalProjection, { targetMonthlyExpenseReal }), [normalProjection, targetMonthlyExpenseReal]);
  const stressSafety = useMemo(() => calculateRetirementSafety(stressProjection, { targetMonthlyExpenseReal }), [stressProjection, targetMonthlyExpenseReal]);
  const risk = describeScenarioRisk(safety.combined, normalSafety.combined, stressSafety.combined);
  const riskDescription = risk.description;

  return (
    <div className="min-w-0 space-y-5">
      <SafetyHeroCard simulationYears={simulationYears} inflationRate={inflationRate} onSimulationYearsChange={onSimulationYearsChange} onInflationRateChange={onInflationRateChange} targetMonthlyExpenseReal={targetMonthlyExpenseReal} onTargetMonthlyExpenseChange={onTargetMonthlyExpenseChange} />
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
      <SafetyScenarioComparison basic={safety.combined} normal={normalSafety.combined} stress={stressSafety.combined} targetMonthlyExpenseReal={targetMonthlyExpenseReal} projection={projection} normalProjection={normalProjection} stressProjection={stressProjection} calculationBasisSource={calculationBasisSource} />
      {longTermPanel}
    </div>
  );
}
