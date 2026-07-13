"use client";

// 평가 기준 도움말. 계좌마다 반복되던 기준 박스를 이 작은 접힘형 ⓘ 하나로 대체한다.
// - 기본은 접힘 상태(첫 화면을 짧게 유지).
// - summary 는 ⓘ 아이콘 + 짧은 기준 문구, 펼치면 전체 기준 설명이 보인다.
// 계산/판정에는 영향을 주지 않고 표시 문구만 담는다.
type Props = {
  // 짧은 기준 문구(예: "절세계좌 인출 계획 기준").
  shortLabel: string;
  // 펼쳤을 때 보이는 전체 기준 설명.
  helpText: string;
};

export default function SafetyBasisHelp({ shortLabel, helpText }: Props) {
  return (
    <details className="group min-w-0">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold leading-none text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          i
        </span>
        <span className="break-keep">{shortLabel}</span>
        <svg
          className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <p className="mt-1 break-keep text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{helpText}</p>
    </details>
  );
}
