"use client";

import { PERFORMANCE_PERIOD_OPTIONS } from "@/lib/performance-period";

interface Props {
  months: number;
  onChange: (months: number) => void;
  ariaLabel?: string;
}

// 성과분석 그래프 상단 기간 선택 토글(2년/1년/6개월).
// 포트폴리오 관리의 "역산 성과 분석" 세그먼트 토글과 동일한 스타일을 사용해 UX를 통일한다.
export default function PerformancePeriodToggle({
  months,
  onChange,
  ariaLabel = "기간 선택",
}: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-[#2a3336] dark:bg-[#11181a]"
      role="group"
      aria-label={ariaLabel}
    >
      {PERFORMANCE_PERIOD_OPTIONS.map((option) => {
        const active = option.months === months;
        return (
          <button
            key={option.months}
            type="button"
            onClick={() => onChange(option.months)}
            aria-pressed={active}
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              active
                ? "bg-blue-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
