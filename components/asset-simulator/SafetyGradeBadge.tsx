"use client";

import type { SafetyDisplay, UiTone } from "@/lib/asset-simulator-portfolio-ui";

// 안정성 등급 표시를 한 곳에서 통일하는 공용 배지.
// - size "lg": Hero 등 첫 화면 핵심 판단에서 통합 등급을 크게 1개만 노출한다.
// - size "sm": 보조 위치에서 작은 등급 배지로 노출한다.
// status 가 evaluated 가 아니면(평가 대상 없음 / 데이터 부족) 큰 등급처럼 보이지 않도록
// 회색 보조 텍스트로 낮은 시각 무게로 표시한다(showScore=false).
type Props = {
  display: SafetyDisplay;
  size?: "lg" | "sm";
  // lg 배지 하단에 붙는 캡션(예: "통합 등급"). 미평가 상태에서는 노출하지 않는다.
  caption?: string;
};

const LG_BADGE_TONE: Record<UiTone, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  neutral: "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
  caution: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  warning: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  muted: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

const SM_TEXT_TONE: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-800 dark:text-slate-100",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-600 dark:text-slate-300",
};

export default function SafetyGradeBadge({ display, size = "sm", caption }: Props) {
  // 미평가 상태(평가 대상 없음 / 데이터 부족): 등급 자리를 크게 쓰지 않고 회색 보조 텍스트로 강등한다.
  if (!display.showScore) {
    if (size === "lg") {
      return (
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-100 px-1 text-center ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <span className="break-keep text-[10.5px] font-semibold leading-tight text-slate-600 dark:text-slate-300">
            {display.gradeLabel}
          </span>
        </div>
      );
    }
    return (
      <span className="break-keep text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
        {display.gradeLabel}
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div
        className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ring-1 ring-inset ${LG_BADGE_TONE[display.tone]}`}
      >
        <span className="text-[26px] font-extrabold leading-none">{display.gradeLabel}</span>
        {caption && <span className="mt-0.5 text-[9.5px] font-semibold opacity-80">{caption}</span>}
      </div>
    );
  }

  return (
    <span className={`text-[18px] font-extrabold leading-none ${SM_TEXT_TONE[display.tone]}`}>
      {display.gradeLabel}
    </span>
  );
}
