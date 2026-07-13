"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import {
  calibrateStressSafetyForDisplay,
  describeSafety,
  describeSafetyVerdict,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyHeroCard from "./SafetyHeroCard";
import SafetyKpiCards from "./SafetyKpiCards";
import SafetyScenarioComparison from "./SafetyScenarioComparison";

// 안정성 체크 탭 전용 대시보드 래퍼.
// 상단 Hero Summary + (좌: 포트폴리오 설정 / 우: KPI·시나리오 비교) 2단 레이아웃 + 하단 상세로 구성한다.
// Safety 계산은 기존 calculateRetirementSafety 를 그대로 사용하고, 표시값만 파생한다.
type Props = {
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  portfolioApplied: boolean;
  targetMonthlyExpenseReal: number | null;
  // 목표 월생활비 입력이 Hero 로 이동하면서, 상위(page)의 setter 를 Hero 까지 전달한다.
  onTargetMonthlyExpenseChange: (value: number | null) => void;
  // 좌측 설정 패널 슬롯(PortfolioConfigSection).
  configPanel: ReactNode;
  // 하단 상세 슬롯(RetirementSafetySection: 계좌별 상세 아코디언).
  safetyPanel: ReactNode;
  // 요약 바 저장 상태.
  lastSavedAtMs: number;
  onSave: () => void;
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
};

export default function SafetyCheckDashboard({
  projection,
  stressProjection,
  portfolioApplied,
  targetMonthlyExpenseReal,
  onTargetMonthlyExpenseChange,
  configPanel,
  safetyPanel,
  lastSavedAtMs,
  onSave,
  saving,
  saveMessage,
  saveError,
}: Props) {
  const hasTarget = targetMonthlyExpenseReal !== null;

  const safety = useMemo(
    () => calculateRetirementSafety(projection, { targetMonthlyExpenseReal }),
    [projection, targetMonthlyExpenseReal],
  );
  const stressSafety = useMemo(
    () => calculateRetirementSafety(stressProjection, { targetMonthlyExpenseReal }),
    [stressProjection, targetMonthlyExpenseReal],
  );
  const displayedStress = useMemo(
    () => calibrateStressSafetyForDisplay(safety, stressSafety),
    [safety, stressSafety],
  );

  const overallGrade = useMemo(() => describeSafety(safety.combined), [safety]);
  const verdict = useMemo(
    () => describeSafetyVerdict(safety.combined, displayedStress.combined, hasTarget),
    [safety, displayedStress, hasTarget],
  );

  const finalRealAsset = projection.summary.combinedRealBalance;
  const stressFinalReal = stressProjection.summary.combinedRealBalance;
  const downturnDamage = finalRealAsset - stressFinalReal;
  const downturnDamageRatio = finalRealAsset > 0 ? downturnDamage / finalRealAsset : null;
  const appliedAt = projection.summary.portfolioSummary?.appliedAt ?? null;

  // KPI 의 "목표 입력하기" 버튼이 Hero 의 목표 입력창으로 포커스/스크롤을 이동시킨다.
  const focusTargetInput = useCallback(() => {
    if (typeof document === "undefined") return;
    const input = document.getElementById("target-monthly-expense");
    if (input instanceof HTMLElement) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div className="min-w-0 space-y-6">
      <SafetyHeroCard
        overallGrade={overallGrade}
        verdict={verdict}
        basicCombined={safety.combined}
        stressCombined={displayedStress.combined}
        targetMonthlyExpenseReal={targetMonthlyExpenseReal}
        onTargetMonthlyExpenseChange={onTargetMonthlyExpenseChange}
        portfolioApplied={portfolioApplied}
        appliedAt={appliedAt}
        lastSavedAtMs={lastSavedAtMs}
        onSave={onSave}
        saving={saving}
        saveMessage={saveMessage}
        saveError={saveError}
      />

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* 좌: 설정 패널 (데스크톱에서 sticky). 모바일에서는 KPI/비교 아래로 내려간다. */}
        <aside className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-4">
          {configPanel}
        </aside>

        {/* 우: KPI/시나리오 비교. 모바일에서는 최상단에 온다. */}
        <div className="order-1 min-w-0 space-y-6 lg:order-2">
          <SafetyKpiCards
            coverageRatio={safety.combined.metrics.monthlyIncomeCoverageRatio}
            stressCoverageRatio={displayedStress.combined.metrics.monthlyIncomeCoverageRatio}
            hasTarget={hasTarget}
            finalRealAsset={finalRealAsset}
            stressFinalRealAsset={stressFinalReal}
            downturnDamage={downturnDamage}
            downturnDamageRatio={downturnDamageRatio}
            onRequestTargetInput={focusTargetInput}
          />
          <SafetyScenarioComparison
            basic={safety.combined}
            stress={displayedStress.combined}
            hasTarget={hasTarget}
            targetMonthlyExpenseReal={targetMonthlyExpenseReal}
            basicFinalReal={finalRealAsset}
            stressFinalReal={stressFinalReal}
            projection={projection}
            stressProjection={stressProjection}
          />
        </div>
      </div>

      {/* 하단: 계좌별 상세(접기/펼치기 중심). 모바일에서는 설정 패널 아래에 온다. */}
      <div className="min-w-0">{safetyPanel}</div>
    </div>
  );
}
