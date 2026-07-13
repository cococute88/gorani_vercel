"use client";

import { useCallback, useMemo } from "react";
import {
  buildScenarioComparisonRows,
  deriveAdjustmentCandidates,
  describeSafetyBasis,
  STRESS_SCENARIO_NOTE,
  summarizeWorsenedMetrics,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult } from "@/lib/asset-simulator-types";
import SafetyScenarioCompareTable from "./SafetyScenarioCompareTable";
import SafetyAdjustmentCandidates from "./SafetyAdjustmentCandidates";

// 기본/하락장 통합 안전성을 단일 비교표로 보여주는 섹션.
// 카드 2장을 나란히 두던 방식 대신, 지표별 기본/하락장/변화를 한 표에서 대조한다.
// 계좌별 상세는 아래 은퇴 안전성 분석(RetirementSafetySection)에서 확인한다.
type Props = {
  basic: SafetyResult;
  // 표시용으로 보정된 하락장 통합 결과(기본 점수를 넘지 않도록 cap 처리됨).
  stress: SafetyResult;
  hasTarget: boolean;
  // 통합 안전성 평가 기준 문구(목표 월생활비 / 임시 인출 기준)에 사용.
  targetMonthlyExpenseReal: number | null;
  // 최종 실질자산(만원).
  basicFinalReal: number;
  stressFinalReal: number;
};

export default function SafetyScenarioComparison({
  basic,
  stress,
  hasTarget,
  targetMonthlyExpenseReal,
  basicFinalReal,
  stressFinalReal,
}: Props) {
  const rows = useMemo(
    () => buildScenarioComparisonRows(basic, stress, basicFinalReal, stressFinalReal, hasTarget),
    [basic, stress, basicFinalReal, stressFinalReal, hasTarget],
  );
  const worsened = useMemo(() => summarizeWorsenedMetrics(rows), [rows]);
  const candidates = useMemo(() => deriveAdjustmentCandidates(basic, stress, hasTarget), [basic, stress, hasTarget]);
  const basis = describeSafetyBasis("combined", targetMonthlyExpenseReal);

  // 목표 미입력 시 Hero 의 목표 입력창으로 포커스를 이동시킨다.
  const focusTargetInput = useCallback(() => {
    if (typeof document === "undefined") return;
    const input = document.getElementById("target-monthly-expense");
    if (input instanceof HTMLElement) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
    }
  }, []);

  return (
    <section
      aria-label="기본·하락장 통합 안전성 비교"
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5"
    >
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">기본 · 하락장 비교</h3>
        {/* 하락장 설명은 여기 한 곳에서만 노출한다(중복 배너 방지). */}
        <p className="mt-1 break-keep text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
          {STRESS_SCENARIO_NOTE}
        </p>
        <p className="mt-1 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">{basis.label}</p>
      </div>

      <SafetyScenarioCompareTable basic={basic} stress={stress} rows={rows} />

      {!hasTarget && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
          목표 월생활비를 입력하면 월생활비 충당률까지 함께 비교됩니다.{" "}
          <button
            type="button"
            onClick={focusTargetInput}
            className="rounded font-semibold text-blue-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:text-blue-400"
          >
            목표 입력하기 →
          </button>
        </p>
      )}

      {/* 악화 항목 요약 */}
      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
        {worsened.items.length === 0 ? (
          <p className="break-keep text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">{worsened.headline}</p>
        ) : (
          <p className="break-keep text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{worsened.headline}:</span>{" "}
            {worsened.items.map((item, index) => (
              <span
                key={item.label}
                className={item.tone === "warning" ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}
              >
                {index > 0 ? ", " : ""}
                {item.label} {item.deltaText}
              </span>
            ))}
          </p>
        )}
      </div>

      <SafetyAdjustmentCandidates candidates={candidates} />
    </section>
  );
}
