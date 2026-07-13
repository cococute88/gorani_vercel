"use client";

import {
  describeAccountBasisHelp,
  describeAccountDiagnosis,
  describeSafety,
  type SafetyAccountKey,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult } from "@/lib/asset-simulator-types";
import SafetyGradeBadge from "./SafetyGradeBadge";
import SafetyBasisHelp from "./SafetyBasisHelp";

// 계좌 진단 행: 절세계좌 / 위탁계좌 / 통합의 기본→하락장 변화를 한눈에 본다.
// 시나리오 기준으로 흩어져 있던 등급을 계좌 기준으로 모아, "어느 계좌가 문제인가"를 바로 보게 한다.
// 미평가(평가 대상 없음/데이터 부족) 계좌는 큰 등급처럼 보이지 않도록 회색 보조 표시로 강등한다.
export type DiagnosisAccount = {
  key: SafetyAccountKey;
  name: string;
  basic: SafetyResult;
  stress: SafetyResult;
};

type Props = {
  accounts: DiagnosisAccount[];
  hasTarget: boolean;
  targetMonthlyExpenseReal: number | null;
};

const TONE_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-700 dark:text-slate-200",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-600 dark:text-slate-300",
};

const TONE_RING: Record<UiTone, string> = {
  positive: "border-emerald-200 dark:border-emerald-500/25",
  neutral: "border-slate-200 dark:border-[#273032]",
  caution: "border-amber-200 dark:border-amber-500/25",
  warning: "border-rose-200 dark:border-rose-500/25",
  muted: "border-slate-200 dark:border-[#273032]",
};

export default function SafetyAccountDiagnosis({ accounts, hasTarget, targetMonthlyExpenseReal }: Props) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2.5">
      {accounts.map(({ key, name, basic, stress }) => {
        const diag = describeAccountDiagnosis(key, basic, stress, hasTarget, targetMonthlyExpenseReal);
        const basicDisplay = describeSafety(basic);
        const stressDisplay = describeSafety(stress);
        const helpText = describeAccountBasisHelp(key, targetMonthlyExpenseReal);
        return (
          <div
            key={key}
            className={`flex min-w-0 flex-col gap-1.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm dark:bg-[#171d1e] ${TONE_RING[diag.tone]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{name}</span>
                <span className="ml-1.5 break-keep text-[11px] text-slate-600 dark:text-slate-300">· {diag.basisShort}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5" aria-label={diag.changeText}>
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
            </div>

            <p className={`break-keep text-[12px] leading-relaxed ${TONE_TEXT[diag.tone]}`}>{diag.reason}</p>

            <SafetyBasisHelp shortLabel={diag.basisShort} helpText={helpText} />
          </div>
        );
      })}
    </div>
  );
}
