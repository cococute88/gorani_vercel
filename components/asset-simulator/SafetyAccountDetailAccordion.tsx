"use client";

import {
  describeAccountDiagnosis,
  describeSafety,
  type SafetyAccountKey,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult } from "@/lib/asset-simulator-types";
import SafetyGradeBadge from "./SafetyGradeBadge";
import SafetyAccountDetailPanel from "./SafetyAccountDetailPanel";

// 계좌 기준 상세 아코디언. 기존 "시나리오 → 계좌 3개" 구조를 "계좌 → 기본/하락장 비교"로 뒤집는다.
// 기본은 접힘이라 첫 화면이 짧고, 펼치면 한 계좌의 기본/하락장을 나란히 비교한다.
// summary 에는 계좌명 + 기본→하락장 등급 + 한줄 요약을 두고, 미평가면 회색 보조 표시로 강등한다.
type Props = {
  accountKey: SafetyAccountKey;
  name: string;
  basic: SafetyResult;
  stress: SafetyResult;
  hasTarget: boolean;
  targetMonthlyExpenseReal: number | null;
  // 열 라벨은 상위(RetirementSafetySection)에서 문자열로 전달한다.
  basicLabel: string;
  stressLabel: string;
};

const TONE_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-700 dark:text-slate-200",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-500 dark:text-slate-400",
};

export default function SafetyAccountDetailAccordion({
  accountKey,
  name,
  basic,
  stress,
  hasTarget,
  targetMonthlyExpenseReal,
  basicLabel,
  stressLabel,
}: Props) {
  const diag = describeAccountDiagnosis(accountKey, basic, stress, hasTarget, targetMonthlyExpenseReal);
  const basicDisplay = describeSafety(basic);
  const stressDisplay = describeSafety(stress);

  return (
    <details className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-[#273032] dark:bg-[#12181a]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{name} 상세</h3>
          <p className={`mt-0.5 break-keep text-[11.5px] leading-relaxed ${TONE_TEXT[diag.tone]}`}>{diag.reason}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5" aria-label={diag.changeText}>
            {diag.evaluated ? (
              <>
                <SafetyGradeBadge display={basicDisplay} size="sm" />
                <span aria-hidden className="text-[13px] text-slate-400 dark:text-slate-500">→</span>
                <SafetyGradeBadge display={stressDisplay} size="sm" />
              </>
            ) : (
              <SafetyGradeBadge display={basicDisplay} size="sm" />
            )}
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180 dark:text-slate-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </summary>

      {/* 기본/하락장 2열, 모바일(375px)에서는 1열로 전환한다. */}
      <div className="grid min-w-0 grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2 sm:px-4 sm:pb-4">
        <SafetyAccountDetailPanel label={basicLabel} result={basic} />
        <SafetyAccountDetailPanel label={stressLabel} result={stress} stress />
      </div>
    </details>
  );
}
