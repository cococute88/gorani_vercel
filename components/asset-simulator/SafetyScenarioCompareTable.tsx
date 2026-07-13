"use client";

import {
  describeSafety,
  type ScenarioCompareRow,
  type ScenarioDeltaDirection,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult } from "@/lib/asset-simulator-types";
import SafetyDeltaBar from "./SafetyDeltaBar";

// 기본/하락장 단일 비교표.
// 열: 지표 · 기본 시나리오 · 하락장 시나리오 · 변화.
// 데스크톱은 4열 그리드, 모바일(375px)은 세로 카드형 row 로 전환해 가로 스크롤을 피한다.
type Props = {
  basic: SafetyResult;
  stress: SafetyResult;
  rows: ScenarioCompareRow[];
};

const TONE_DELTA_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-700 dark:text-slate-200",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400 font-bold",
  muted: "text-slate-600 dark:text-slate-300",
};

const GRADE_TONE_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-800 dark:text-slate-100",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-600 dark:text-slate-300",
};

function directionMark(direction: ScenarioDeltaDirection): string {
  if (direction === "down") return "▼";
  if (direction === "up") return "▲";
  return "—";
}

export default function SafetyScenarioCompareTable({ basic, stress, rows }: Props) {
  const basicGradeTone = describeSafety(basic).tone;
  const stressGradeTone = describeSafety(stress).tone;

  // 등급 행의 기본/하락장 셀은 각 시나리오 등급 톤으로 강조한다.
  const valueClass = (row: ScenarioCompareRow, which: "basic" | "stress") => {
    if (row.key === "grade") {
      return `font-bold ${GRADE_TONE_TEXT[which === "basic" ? basicGradeTone : stressGradeTone]}`;
    }
    return "font-semibold text-slate-900 dark:text-slate-100";
  };

  return (
    <div className="mt-3 min-w-0" role="table" aria-label="기본 하락장 지표 비교표">
      {/* 헤더: 데스크톱에서만 표시. 모바일은 각 행에 인라인 라벨을 둔다. */}
      <div
        role="row"
        className="hidden grid-cols-[1.1fr_1fr_1fr_1.3fr] items-center gap-x-3 border-b border-slate-200 pb-2 dark:border-[#273032] md:grid"
      >
        <span role="columnheader" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">지표</span>
        <span role="columnheader" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">기본 시나리오</span>
        <span role="columnheader" className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">하락장 시나리오</span>
        <span role="columnheader" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">변화</span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-[#232b2d]">
        {rows.map((row) => (
          <div
            key={row.key}
            role="row"
            className="grid grid-cols-2 gap-x-3 gap-y-1 py-2.5 md:grid-cols-[1.1fr_1fr_1fr_1.3fr] md:items-center"
          >
            {/* 지표 */}
            <div role="cell" className="col-span-2 md:col-span-1">
              <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{row.label}</span>
            </div>

            {/* 기본 */}
            <div role="cell" className="min-w-0">
              <span className="mr-1 text-[10.5px] text-slate-600 dark:text-slate-300 md:hidden">기본</span>
              <span className={`break-keep text-[13.5px] ${valueClass(row, "basic")}`}>{row.basicText}</span>
            </div>

            {/* 하락장 */}
            <div role="cell" className="min-w-0">
              <span className="mr-1 text-[10.5px] text-amber-600 dark:text-amber-400 md:hidden">하락장</span>
              <span className={`break-keep text-[13.5px] ${valueClass(row, "stress")}`}>{row.stressText}</span>
            </div>

            {/* 변화 */}
            <div role="cell" className="col-span-2 min-w-0 md:col-span-1">
              <span className="mr-1 text-[10.5px] text-slate-600 dark:text-slate-300 md:hidden">변화</span>
              <span className={`break-keep text-[12.5px] font-semibold ${TONE_DELTA_TEXT[row.tone]}`}>
                {row.key === "grade" ? (
                  row.deltaText
                ) : (
                  <>
                    <span aria-hidden className="mr-0.5">{directionMark(row.direction)}</span>
                    {row.deltaText}
                  </>
                )}
              </span>
              {row.showBar && <SafetyDeltaBar magnitude={row.magnitude} tone={row.tone} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
