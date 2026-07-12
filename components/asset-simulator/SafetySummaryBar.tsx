"use client";

import { formatManwonMoney } from "@/lib/format";
import { formatSimulatorSavedAt } from "@/lib/asset-simulator-persistence";
import type { SafetyDisplay, SafetyVerdict, UiTone } from "@/lib/asset-simulator-portfolio-ui";

// 안정성 체크 탭 최상단 요약 바.
// 통합 등급 + 한줄 판단 + 목표/가정/저장 상태를 한 줄에 모아 대시보드 헤더 역할을 한다.
type Props = {
  overallGrade: SafetyDisplay;
  verdict: SafetyVerdict;
  targetMonthlyExpenseReal: number | null;
  portfolioApplied: boolean;
  // 적용된 가정의 적용 시각(ISO). 없으면 미표시.
  appliedAt: string | null;
  lastSavedAtMs: number;
  onSave: () => void;
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
};

const GRADE_BADGE: Record<UiTone, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  neutral: "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-100 dark:ring-slate-500/30",
  caution: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  warning: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  muted: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
};

const VERDICT_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-700 dark:text-emerald-300",
  neutral: "text-slate-800 dark:text-slate-100",
  caution: "text-amber-700 dark:text-amber-300",
  warning: "text-rose-700 dark:text-rose-300",
  muted: "text-slate-700 dark:text-slate-200",
};

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

export default function SafetySummaryBar({
  overallGrade,
  verdict,
  targetMonthlyExpenseReal,
  portfolioApplied,
  appliedAt,
  lastSavedAtMs,
  onSave,
  saving,
  saveMessage,
  saveError,
}: Props) {
  const hasTarget = targetMonthlyExpenseReal !== null;
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* 좌: 통합 등급 + 한줄 판단 */}
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ring-1 ring-inset ${GRADE_BADGE[overallGrade.tone]}`}
          >
            <span className="text-[26px] font-extrabold leading-none">{overallGrade.showScore ? overallGrade.gradeLabel : "—"}</span>
            <span className="mt-0.5 text-[9.5px] font-semibold opacity-80">통합 등급</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">한줄 판단</p>
            <p className={`mt-0.5 break-keep text-[15px] font-bold leading-snug ${VERDICT_TEXT[verdict.tone]}`}>
              {verdict.headline}
            </p>
            {verdict.subline && (
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">{verdict.subline}</p>
            )}
          </div>
        </div>

        {/* 우: 상태 칩 + 저장 */}
        <div className="flex shrink-0 flex-col gap-2.5 lg:items-end">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <StatusChip tone={hasTarget ? "on" : "off"}>
              {hasTarget ? `목표 ${formatManwonMoney(targetMonthlyExpenseReal)}/월` : "목표 미입력"}
            </StatusChip>
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
