"use client";

import { formatManwonMoney } from "@/lib/format";
import {
  formatShortfallCellLabel,
  getShortfallCellStatus,
  type SafetyMonthlySupplyRow,
  type ShortfallCellStatus,
} from "@/lib/asset-simulator-safety-chart-ui";

type Props = {
  rows: SafetyMonthlySupplyRow[];
  targetMonthlyExpenseReal: number;
  basicShortfallYears: number;
  basicConsecutiveShortfallYears: number;
  stressShortfallYears: number | null;
  stressConsecutiveShortfallYears: number | null;
};

const STATUS_CLASS: Record<ShortfallCellStatus, string> = {
  sufficient: "bg-emerald-500 dark:bg-emerald-400",
  mild_shortfall: "bg-amber-500 dark:bg-amber-400",
  severe_shortfall: "bg-rose-500 dark:bg-rose-400",
  no_target: "bg-slate-200 dark:bg-slate-700",
  unavailable: "bg-slate-200 dark:bg-slate-700",
};

function StripRow({
  label,
  scenarioLabel,
  rows,
  target,
  valueKey,
}: {
  label: string;
  scenarioLabel: string;
  rows: SafetyMonthlySupplyRow[];
  target: number;
  valueKey: "baseSupply" | "stressSupply";
}) {
  const gridStyle = { gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` };
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      <div className="grid min-w-0 gap-px sm:gap-0.5" style={gridStyle}>
        {rows.map((row) => {
          const value = row[valueKey];
          const status = getShortfallCellStatus(value, target);
          const labelText = formatShortfallCellLabel(row.year, scenarioLabel, value, target);
          return (
            <span
              key={`${scenarioLabel}-${row.year}`}
              tabIndex={0}
              title={labelText}
              aria-label={labelText}
              className={`block h-2.5 min-w-0 rounded-sm outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-blue-500 dark:ring-offset-[#171d1e] ${STATUS_CLASS[status]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function SafetyShortfallHeatStrip({
  rows,
  targetMonthlyExpenseReal,
  basicShortfallYears,
  basicConsecutiveShortfallYears,
  stressShortfallYears,
  stressConsecutiveShortfallYears,
}: Props) {
  if (rows.length === 0) return null;
  const summary = `Good 생활비 미달 ${basicShortfallYears}년 · Bad 생활비 미달 ${stressShortfallYears ?? "결과 없음"}년`;
  const ariaLabel = `생활비 미달 연도 표시: ${summary}입니다. 연속 생활비 미달 최장은 Good ${basicConsecutiveShortfallYears}년, Bad ${stressConsecutiveShortfallYears ?? "결과 없음"}년입니다.`;

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700" role="group" aria-label={ariaLabel}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-200">생활비 미달 연도 빠른 확인</p>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">{summary}</p>
      </div>
      <p className="mt-0.5 text-[10.5px] text-slate-600 dark:text-slate-400">
        Bad 연속 생활비 미달 최장 {stressConsecutiveShortfallYears ?? 0}년 · 목표 {formatManwonMoney(targetMonthlyExpenseReal)}
      </p>
      <div className="mt-2 space-y-1.5">
        <StripRow label="Good" scenarioLabel="Good" rows={rows} target={targetMonthlyExpenseReal} valueKey="baseSupply" />
        <StripRow label="Bad" scenarioLabel="Bad" rows={rows} target={targetMonthlyExpenseReal} valueKey="stressSupply" />
      </div>
      <div className="ml-[2.75rem] mt-1 flex justify-between text-[10px] text-slate-600 dark:text-slate-400" aria-hidden>
        <span>{rows[0]?.year}년</span>
        {rows.length > 1 && <span>{rows.at(-1)?.year}년</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-700 dark:text-slate-300" aria-label="생활비 미달 연도 표시 범례">
        <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-emerald-500 dark:bg-emerald-400" />충분</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-amber-500 dark:bg-amber-400" />미달·경미</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-rose-500 dark:bg-rose-400" />미달·심각</span>
      </div>
    </div>
  );
}
