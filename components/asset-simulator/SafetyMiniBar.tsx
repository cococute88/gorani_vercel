"use client";

import { formatManwonMoney } from "@/lib/format";
import { formatCoverageRatio } from "@/lib/asset-simulator-portfolio-ui";

// KPI 카드용 CSS mini bar 모음. Recharts 를 쓰지 않고 div 만으로 표시를 보조한다.
// 계산 로직이 아니라 이미 계산된 값(충당률/손상폭/최종자산)을 시각화만 한다.
// 색만으로 의미가 전달되지 않도록 각 bar 에는 aria-label 과 숫자/문구를 함께 제공한다.

function clampPct(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// A. 월생활비 충당률 mini bar.
// scale 0~150%, 100% 기준선 표시. 기본 충당률을 fill, 하락장 충당률은 marker 로 표시한다.
// 목표 미입력 시에는 점선 트랙 + 안내 문구로 대체한다.
export function CoverageMiniBar({
  baseRatio,
  stressRatio,
  hasTarget,
}: {
  // 0~1 비율. 목표 미입력이거나 계산 불가면 null/undefined.
  baseRatio: number | null | undefined;
  stressRatio: number | null | undefined;
  hasTarget: boolean;
}) {
  const MAX = 150; // 표시 상한 %.
  if (!hasTarget || typeof baseRatio !== "number") {
    return (
      <div className="mt-2">
        <div className="h-1.5 w-full rounded-full border border-dashed border-slate-300 dark:border-slate-600" aria-hidden />
        <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">목표 입력 시 표시</p>
      </div>
    );
  }

  const basePct = baseRatio * 100;
  const fillWidth = clampPct((basePct / MAX) * 100);
  const referenceLeft = (100 / MAX) * 100; // 100% 지점.
  const fillTone =
    basePct >= 100
      ? "bg-emerald-500"
      : basePct >= 90
        ? "bg-amber-500"
        : "bg-rose-500";
  const hasStress = typeof stressRatio === "number";
  const stressPct = hasStress ? stressRatio! * 100 : 0;
  const stressLeft = clampPct((stressPct / MAX) * 100);

  return (
    <div className="mt-2">
      <div
        className="relative h-1.5 w-full overflow-visible rounded-full bg-slate-100 dark:bg-slate-700/60"
        role="img"
        aria-label={`월생활비 충당률: 기본 ${formatCoverageRatio(baseRatio)}${hasStress ? `, 하락장 ${formatCoverageRatio(stressRatio)}` : ""}, 기준 100%`}
      >
        <div className={`absolute inset-y-0 left-0 rounded-full ${fillTone}`} style={{ width: `${fillWidth}%` }} />
        {/* 100% 기준선 */}
        <div
          className="absolute inset-y-[-2px] w-px bg-slate-400 dark:bg-slate-500"
          style={{ left: `${referenceLeft}%` }}
          aria-hidden
        />
        {/* 하락장 marker */}
        {hasStress && (
          <div
            className="absolute inset-y-[-3px] w-[2px] rounded bg-amber-600 dark:bg-amber-400"
            style={{ left: `calc(${stressLeft}% - 1px)` }}
            aria-hidden
          />
        )}
      </div>
      {hasStress && (
        <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">
          하락장 {formatCoverageRatio(stressRatio)}
        </p>
      )}
    </div>
  );
}

// B. 하락장 손상폭 mini bar.
// scale 0~100%, 기본 대비 하락장 최종자산 감소율을 fill 로 표시한다.
export function DamageMiniBar({
  damageRatio,
}: {
  // 0~1 손상 비율(양수면 감소). 계산 불가면 null.
  damageRatio: number | null;
}) {
  if (typeof damageRatio !== "number") {
    return (
      <div className="mt-2">
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700/60" aria-hidden />
      </div>
    );
  }
  const pct = clampPct(damageRatio * 100);
  const tone = damageRatio <= 0 ? "bg-emerald-500" : damageRatio >= 0.25 ? "bg-rose-500" : "bg-amber-500";
  return (
    <div className="mt-2">
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60"
        role="img"
        aria-label={`하락장 손상폭: 기본 대비 약 ${formatCoverageRatio(Math.max(0, damageRatio))} 감소`}
      >
        <div className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${Math.max(pct, damageRatio > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}

// C. 최종 실질자산 mini comparison.
// 기본 최종자산을 100% bar 로, 하락장 최종자산을 상대 길이로 표시한다.
// 기본은 blue, 하락장은 amber(시나리오 식별 색).
export function AssetComparisonMiniBar({
  baseAsset,
  stressAsset,
}: {
  baseAsset: number;
  stressAsset: number;
}) {
  const base = Number.isFinite(baseAsset) ? baseAsset : 0;
  const stress = Number.isFinite(stressAsset) ? stressAsset : 0;
  // 두 값 중 큰 값을 100% 기준으로 삼아 상대 길이를 계산한다(하락장이 더 큰 예외도 방어).
  const max = Math.max(base, stress, 1);
  const baseWidth = clampPct((base / max) * 100);
  const stressWidth = clampPct((stress / max) * 100);
  return (
    <div
      className="mt-2 space-y-1"
      role="img"
      aria-label={`최종 실질자산 비교: 기본 ${formatManwonMoney(base)}, 하락장 ${formatManwonMoney(stress)}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
          <div className="h-full rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${baseWidth}%` }} />
        </div>
        <span className="w-8 shrink-0 text-right text-[9.5px] font-semibold text-slate-500 dark:text-slate-400">기본</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
          <div className="h-full rounded-full bg-amber-600 dark:bg-amber-500" style={{ width: `${stressWidth}%` }} />
        </div>
        <span className="w-8 shrink-0 text-right text-[9.5px] font-semibold text-slate-500 dark:text-slate-400">하락장</span>
      </div>
    </div>
  );
}
