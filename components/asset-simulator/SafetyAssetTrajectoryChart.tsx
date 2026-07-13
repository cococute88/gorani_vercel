"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import { formatManwonMoney } from "@/lib/format";
import type { SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyChartTooltip from "./SafetyChartTooltip";

export type SafetyAssetTrajectoryRow = {
  year: number;
  base: number | null;
  stress: number | null;
};

type Props = {
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection | null;
};

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// 두 projection의 같은 연도를 방어적으로 병합한다. 계산값은 바꾸지 않고 차트 표시만 위한 행을 만든다.
function mergeTrajectoryRows(
  projection: SimulatorProjection,
  stressProjection: SimulatorProjection,
): SafetyAssetTrajectoryRow[] {
  const rows = new Map<number, SafetyAssetTrajectoryRow>();
  const ensureRow = (year: unknown) => {
    if (typeof year !== "number" || !Number.isFinite(year)) return null;
    const existing = rows.get(year);
    if (existing) return existing;
    const next = { year, base: null, stress: null };
    rows.set(year, next);
    return next;
  };

  projection.chartRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) merged.base = toFiniteNumber(row.combinedRealBalance);
  });
  stressProjection.chartRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) merged.stress = toFiniteNumber(row.combinedRealBalance);
  });

  return Array.from(rows.values())
    .filter((row) => row.base !== null || row.stress !== null)
    .sort((left, right) => left.year - right.year);
}

function formatAxisAmount(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000) {
    const eok = Number((abs / 10000).toFixed(1));
    return `${sign}${eok.toLocaleString("ko-KR")}억`;
  }
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}만`;
}

function ScenarioLegend({ label, value, stress = false }: { label: string; value: number | null; stress?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
      <span
        aria-hidden
        className={`w-5 shrink-0 border-t-2 ${stress ? "border-dashed border-amber-600" : "border-blue-600 dark:border-blue-500"}`}
      />
      <span className="truncate">{label}{value !== null ? ` ${formatManwonMoney(value)}` : ""}</span>
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-[12px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-white/[0.03] dark:text-slate-300 md:h-[260px]">
      {children}
    </div>
  );
}

export default function SafetyAssetTrajectoryChart({ projection, stressProjection }: Props) {
  if (!stressProjection) {
    return <EmptyState>하락장 시나리오 결과가 준비되지 않았습니다.</EmptyState>;
  }

  const data = mergeTrajectoryRows(projection, stressProjection);
  const chartFinalBase = [...data].reverse().find((row) => row.base !== null)?.base ?? null;
  const chartFinalStress = [...data].reverse().find((row) => row.stress !== null)?.stress ?? null;
  const finalBase = toFiniteNumber(projection.summary.combinedRealBalance) ?? chartFinalBase;
  const finalStress = toFiniteNumber(stressProjection.summary.combinedRealBalance) ?? chartFinalStress;
  const retirementYear = toFiniteNumber(projection.timeline.retirementYear);
  const withdrawalStartYear = toFiniteNumber(projection.timeline.withdrawalStartYear);
  const ariaLabel = `실질 총자산 추이: 기본 시나리오는 ${finalBase !== null ? formatManwonMoney(finalBase) : "결과 없음"}, 하락장 시나리오는 ${finalStress !== null ? formatManwonMoney(finalStress) : "결과 없음"}으로 종료됩니다.`;

  if (data.length === 0 || (finalBase === null && finalStress === null)) {
    return <EmptyState>시뮬레이션 결과가 준비되면 자산 추이 차트를 표시합니다.</EmptyState>;
  }

  return (
    <div className="safety-asset-trajectory min-w-0" role="img" aria-label={ariaLabel}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="차트 범례">
        <ScenarioLegend label="기본" value={finalBase} />
        <ScenarioLegend label="하락장" value={finalStress} stress />
        <span className="text-[11px] text-slate-600 dark:text-slate-400">실선/점선으로도 구분</span>
      </div>
      <div className="h-[200px] w-full md:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--safety-chart-grid)" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="var(--safety-chart-axis)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--safety-chart-axis)" tick={{ fontSize: 11 }} tickFormatter={formatAxisAmount} tickLine={false} axisLine={false} width={50} />
            <Tooltip content={<SafetyChartTooltip />} cursor={{ stroke: "var(--safety-chart-axis)", strokeDasharray: "3 3" }} />
            {retirementYear !== null && (
              <ReferenceLine
                x={retirementYear}
                stroke="var(--safety-chart-reference)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: "은퇴", position: "insideTopRight", fill: "var(--safety-chart-reference)", fontSize: 10 }}
              />
            )}
            {withdrawalStartYear !== null && withdrawalStartYear !== retirementYear && (
              <ReferenceLine
                x={withdrawalStartYear}
                stroke="var(--safety-chart-reference)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: "인출", position: "insideBottomRight", fill: "var(--safety-chart-reference)", fontSize: 10 }}
              />
            )}
            <Line type="monotone" dataKey="base" name="기본 실질 총자산" stroke="var(--safety-chart-base)" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="stress" name="하락장 실질 총자산" stroke="var(--safety-chart-stress)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <style jsx>{`
        .safety-asset-trajectory {
          --safety-chart-base: #2563eb;
          --safety-chart-stress: #d97706;
          --safety-chart-axis: #64748b;
          --safety-chart-grid: #cbd5e1;
          --safety-chart-reference: #64748b;
        }
        :global(.dark) .safety-asset-trajectory {
          --safety-chart-base: #3b82f6;
          --safety-chart-stress: #d97706;
          --safety-chart-axis: #94a3b8;
          --safety-chart-grid: #334155;
          --safety-chart-reference: #94a3b8;
        }
      `}</style>
    </div>
  );
}
