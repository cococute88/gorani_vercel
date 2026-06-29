"use client";

// =============================================================
// 상단 옵션 바: 비중 고려 / 중복 제거 (기본 모두 ON).
// TR/PR(배당 포함·제외) 전환은 성과 비교 그래프 헤더의 TR/PR 토글로 이동했다
// (시장현황과 동일 UX). totalReturn 값은 그 토글이 제어한다.
// 옵션은 CompareOptions 객체로 관리하여 향후 토글 추가가 쉽다.
// =============================================================

export type CompareOptions = {
  weighted: boolean; // 비중 고려
  removeOverlap: boolean; // 중복 제거
  totalReturn: boolean; // TR 기준(adjClose) — 그래프 TR/PR 토글이 제어.
};

export const DEFAULT_COMPARE_OPTIONS: CompareOptions = {
  weighted: true,
  removeOverlap: true,
  totalReturn: true,
};

// 확장 가능한 옵션 정의 목록. (totalReturn 은 그래프 TR/PR 토글로 분리됨.)
const OPTION_DEFS: Array<{ key: keyof CompareOptions; label: string; hint: string }> = [
  { key: "weighted", label: "비중 고려", hint: "구성종목 비중을 반영해 중복을 제거합니다." },
  { key: "removeOverlap", label: "중복 제거", hint: "공통 구성종목을 제거한 성과를 함께 표시합니다." },
];

interface Props {
  options: CompareOptions;
  onChange: (next: CompareOptions) => void;
  disabled?: boolean;
}

export default function CompareOptionsBar({ options, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTION_DEFS.map((def) => {
        const active = options[def.key];
        const isWeightedDisabled = def.key === "weighted" && !options.removeOverlap;
        const itemDisabled = disabled || isWeightedDisabled;
        return (
          <button
            key={def.key}
            type="button"
            title={def.hint}
            disabled={itemDisabled}
            onClick={() => onChange({ ...options, [def.key]: !active })}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-300"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-[#2a3336] dark:bg-[#11171a] dark:text-slate-400 dark:hover:bg-white/5"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] leading-none ${
                active ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-transparent dark:border-slate-600"
              }`}
            >
              ✓
            </span>
            {def.label}
          </button>
        );
      })}
    </div>
  );
}
