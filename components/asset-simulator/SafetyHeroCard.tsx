"use client";

import { useEffect, useState } from "react";
import { formatManwonMoney } from "@/lib/format";
import { formatSimulatorSavedAt } from "@/lib/asset-simulator-persistence";
import {
  describeSafety,
  formatCoverageRatio,
  type SafetyDisplay,
  type SafetyVerdict,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult } from "@/lib/asset-simulator-types";
import SafetyGradeBadge from "./SafetyGradeBadge";

// 안정성 체크 탭 최상단 Hero Summary.
// 통합 등급(대형 1개) + 한줄 판단 + 기본→하락장 요약 + 목표 월생활비 인라인 입력 + 가정/저장 상태를 모은다.
// 목표 월생활비 입력은 기존 은퇴 안전성 분석 하단에서 이 Hero 로 이동했다.
type Props = {
  overallGrade: SafetyDisplay;
  verdict: SafetyVerdict;
  // 기본/하락장(표시 보정) 통합 결과. "기본 B → 하락장 D" 요약과 충당률 안내에 사용한다.
  basicCombined: SafetyResult;
  stressCombined: SafetyResult;
  // 목표 월생활비(현재 가치, 만원). null 이면 임시 평가.
  targetMonthlyExpenseReal: number | null;
  onTargetMonthlyExpenseChange: (value: number | null) => void;
  portfolioApplied: boolean;
  // 적용된 가정의 적용 시각(ISO). 없으면 미표시.
  appliedAt: string | null;
  lastSavedAtMs: number;
  onSave: () => void;
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
};

const VERDICT_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-700 dark:text-emerald-300",
  neutral: "text-slate-800 dark:text-slate-100",
  caution: "text-amber-700 dark:text-amber-300",
  warning: "text-rose-700 dark:text-rose-300",
  muted: "text-slate-700 dark:text-slate-200",
};

const SCENARIO_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-700 dark:text-slate-200",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-500 dark:text-slate-400",
};

// 입력 문자열 <-> 목표 월생활비(만원, 양수) 변환.
function formatTargetInput(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? String(value) : "";
}

function parseTargetInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// "기본 B(78.8)" 처럼 등급 + 점수(평가된 경우)를 한 조각으로 만든다.
function ScenarioToken({ label, result }: { label: string; result: SafetyResult }) {
  const display = describeSafety(result);
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-bold ${SCENARIO_TEXT[display.tone]}`}>{display.gradeLabel}</span>
      {display.showScore && (
        <span className="text-slate-500 dark:text-slate-400">{result.score}</span>
      )}
    </span>
  );
}

function StatusChip({ tone, children }: { tone: "on" | "off"; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${
        tone === "on"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
          : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30"
      }`}
    >
      {children}
    </span>
  );
}

export default function SafetyHeroCard({
  overallGrade,
  verdict,
  basicCombined,
  stressCombined,
  targetMonthlyExpenseReal,
  onTargetMonthlyExpenseChange,
  portfolioApplied,
  appliedAt,
  lastSavedAtMs,
  onSave,
  saving,
  saveMessage,
  saveError,
}: Props) {
  const hasTarget = targetMonthlyExpenseReal !== null;

  // 부드러운 타이핑을 위해 로컬 문자열 상태를 두고, 파싱된 값만 상위로 전달한다.
  // 외부(하이드레이션/초기화)로 값이 바뀔 때만 입력창을 동기화한다.
  const [rawInput, setRawInput] = useState(() => formatTargetInput(targetMonthlyExpenseReal));
  useEffect(() => {
    setRawInput((prev) => (parseTargetInput(prev) === targetMonthlyExpenseReal ? prev : formatTargetInput(targetMonthlyExpenseReal)));
  }, [targetMonthlyExpenseReal]);

  const handleTargetChange = (next: string) => {
    setRawInput(next);
    onTargetMonthlyExpenseChange(parseTargetInput(next));
  };

  const coverageRatio = basicCombined.metrics.monthlyIncomeCoverageRatio;
  const appliedAtLabel = (() => {
    if (!appliedAt) return null;
    const ms = Date.parse(appliedAt);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
  })();
  const savedLabel = lastSavedAtMs ? formatSimulatorSavedAt(lastSavedAtMs) : null;

  return (
    <section
      aria-label="안정성 체크 요약"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        {/* 좌: 통합 등급(대형 1개) + 한줄 판단 + 기본→하락장 요약 */}
        <div className="flex min-w-0 items-start gap-3.5">
          <SafetyGradeBadge display={overallGrade} size="lg" caption="통합 등급" />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">한줄 판단</p>
            <p className={`mt-0.5 break-keep text-[15px] font-bold leading-snug ${VERDICT_TEXT[verdict.tone]}`}>
              {verdict.headline}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
              <ScenarioToken label="기본" result={basicCombined} />
              <span aria-hidden className="text-slate-400 dark:text-slate-500">→</span>
              <ScenarioToken label="하락장" result={stressCombined} />
            </p>
          </div>
        </div>

        {/* 우: 목표 월생활비 입력 + 가정/저장 상태 */}
        <div className="flex shrink-0 flex-col gap-2.5 lg:min-w-[280px] lg:items-end">
          {/* 목표 월생활비 인라인 입력 (은퇴 안전성 분석 하단에서 이동) */}
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#273032] dark:bg-[#12181a] lg:max-w-[320px]">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <label htmlFor="target-monthly-expense" className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  목표 월생활비
                </label>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">현재 가치 기준</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id="target-monthly-expense"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={10}
                  value={rawInput}
                  onChange={(event) => handleTargetChange(event.target.value)}
                  placeholder="예: 300"
                  aria-describedby="target-monthly-expense-hint"
                  className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-[14px] font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-[#324043] dark:bg-[#0f1416] dark:text-slate-100 dark:focus:ring-blue-500/20"
                />
                <span className="text-[12px] text-slate-600 dark:text-slate-400">만원/월</span>
              </div>
            </div>
            <p id="target-monthly-expense-hint" className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              {hasTarget ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  목표 {formatManwonMoney(targetMonthlyExpenseReal)} 기준으로 평가 중
                  {typeof coverageRatio === "number" ? ` · 기본 충당률 ${formatCoverageRatio(coverageRatio)}` : ""}
                </span>
              ) : (
                <>입력하면 목표 생활비 기준으로 평가합니다. 입력 전에는 참고용 임시 평가를 보여줍니다.</>
              )}
            </p>
          </div>

          {/* 가정 적용 상태 + 저장 */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <StatusChip tone={portfolioApplied ? "on" : "off"}>
              {portfolioApplied ? "가정 적용됨" : "가정 미적용"}
            </StatusChip>
            {appliedAtLabel && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">적용 {appliedAtLabel}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              aria-busy={saving || undefined}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
            {saveError ? (
              <span className="text-[11.5px] font-semibold text-rose-600 dark:text-rose-400" role="status">{saveError}</span>
            ) : saveMessage ? (
              <span className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400" role="status">{saveMessage}</span>
            ) : savedLabel ? (
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400">마지막 저장 {savedLabel}</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
