"use client";

import { useResolvedTheme } from "@/components/theme/ThemeProvider";

type Props = {
  label?: string;
  className?: string;
};

// 실데이터 연결 전 샘플/목업 섹션임을 명확히 표시하는 작은 배지.
// PORTFOLIO-PERF-UI-1: mock 섹션이 사용자의 실제 데이터처럼 보이지 않도록 한다.
export default function SampleBadge({ label = "샘플 데이터", className = "" }: Props) {
  const isLight = useResolvedTheme() === "light";
  const tone = isLight
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-amber-400/20 bg-amber-500/10 text-amber-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
