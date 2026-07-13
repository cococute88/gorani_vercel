"use client";

import { formatManwonMoney } from "@/lib/format";
import type { SafetyAssetTrajectoryRow } from "@/lib/asset-simulator-safety-chart-ui";

type TooltipPayload = {
  dataKey?: string | number;
  value?: number | string | null;
  payload?: SafetyAssetTrajectoryRow;
};

type Props = {
  active?: boolean;
  payload?: TooltipPayload[];
};

function toFiniteNumber(value: number | string | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Safety 자산 추이 전용 tooltip. 두 시나리오의 이미 계산된 실질 총자산만 표시한다.
export default function SafetyChartTooltip({ active, payload }: Props) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row || !Number.isFinite(row.year)) return null;

  const base = toFiniteNumber(row.base);
  const stress = toFiniteNumber(row.stress);
  const difference = base !== null && stress !== null ? stress - base : null;

  if (base === null && stress === null) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg dark:border-slate-700 dark:bg-[#12181a]">
      <p className="font-bold text-slate-900 dark:text-slate-100">{row.year}년</p>
      {base !== null && <p className="mt-1 text-slate-700 dark:text-slate-300">기본: {formatManwonMoney(base)}</p>}
      {stress !== null && <p className="text-slate-700 dark:text-slate-300">하락장: {formatManwonMoney(stress)}</p>}
      {difference !== null && (
        <p className="text-slate-600 dark:text-slate-400">
          차이: {difference > 0 ? "+" : ""}{formatManwonMoney(difference)}
        </p>
      )}
    </div>
  );
}
