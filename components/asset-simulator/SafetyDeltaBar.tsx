"use client";

import type { UiTone } from "@/lib/asset-simulator-portfolio-ui";

// 비교표 변화 열에 쓰는 4px mini delta bar.
// 감소 비율(magnitude, 0~1)만큼 채우고, 심각도 톤으로 색만 구분한다.
// 색 단독으로 의미를 전달하지 않도록 셀에는 항상 방향 기호와 숫자를 함께 표시한다(이 bar 는 보조).
const TONE_FILL: Record<UiTone, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-slate-400 dark:bg-slate-500",
  caution: "bg-amber-500",
  warning: "bg-rose-500",
  muted: "bg-slate-300 dark:bg-slate-600",
};

export default function SafetyDeltaBar({ magnitude, tone }: { magnitude: number; tone: UiTone }) {
  const pct = Math.min(100, Math.max(0, magnitude * 100));
  // 0 이 아닌 감소는 최소 6% 폭을 보장해 눈에 보이게 한다.
  const width = magnitude > 0 ? Math.max(pct, 6) : 0;
  return (
    <div className="mt-1 h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60" aria-hidden>
      <div className={`h-full rounded-full ${TONE_FILL[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}
