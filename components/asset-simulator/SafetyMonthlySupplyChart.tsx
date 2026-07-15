"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import { formatManwonMoney, formatRealAndNominalManwon } from "@/lib/format";
import { buildMonthlySupplyRows, type SafetyMonthlySupplyRow } from "@/lib/asset-simulator-safety-chart-ui";
import type { SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyShortfallHeatStrip from "./SafetyShortfallHeatStrip";

type Props = {
  projection: SimulatorProjection;
  normalProjection?: SimulatorProjection | null;
  stressProjection: SimulatorProjection | null;
  targetMonthlyExpenseReal: number | null;
  safetyResult: SafetyResult;
  stressSafetyResult: SafetyResult | null;
  onFocusTargetInput?: () => void;
};

type TooltipPayload = { payload?: SafetyMonthlySupplyRow };

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatAxisAmount(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000) return `${sign}${Number((abs / 10000).toFixed(1)).toLocaleString("ko-KR")}억`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}만`;
}

function formatTargetLabel(value: number): string {
  return `목표 ${formatAxisAmount(value)}`;
}

function SupplyLegend({ label, type }: { label: string; type: "base" | "stress" | "target" }) {
  const markerClass = type === "base"
    ? "h-2.5 w-2.5 rounded-sm bg-blue-600 dark:bg-blue-500"
    : type === "stress"
      ? "w-5 border-t-2 border-dashed border-amber-600"
      : "w-5 border-t-2 border-dashed border-slate-600 dark:border-slate-400";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
      <span aria-hidden className={markerClass} />
      {label}
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

function MonthlySupplyTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || !Number.isFinite(row.year)) return null;

  const baseSupply = toFiniteNumber(row.baseSupply);
  const normalSupply = toFiniteNumber(row.normalSupply);
  const stressSupply = toFiniteNumber(row.stressSupply);
  const target = toFiniteNumber(row.target);
  if (baseSupply === null && normalSupply === null && stressSupply === null) return null;

  const shortfalls = [
    baseSupply !== null && target !== null && baseSupply < target ? `Good -${formatManwonMoney(target - baseSupply)}/월` : null,
    stressSupply !== null && target !== null && stressSupply < target ? `Bad -${formatManwonMoney(target - stressSupply)}/월` : null,
  ].filter((value): value is string => value !== null);

  return (
    <div className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg dark:border-slate-700 dark:bg-[#12181a]">
      <p className="font-bold text-slate-900 dark:text-slate-100">{row.year}년</p>
      {baseSupply !== null && <p className="mt-1 text-slate-700 dark:text-slate-300">Good 월 현금흐름: {formatRealAndNominalManwon(baseSupply, row.baseSupplyNominal ?? baseSupply)}/월</p>}
      {normalSupply !== null && <p className="text-slate-700 dark:text-slate-300">Normal 월 현금흐름: {formatRealAndNominalManwon(normalSupply, row.normalSupplyNominal ?? normalSupply)}/월</p>}
      {stressSupply !== null && <p className="text-slate-700 dark:text-slate-300">Bad 월 현금흐름: {formatRealAndNominalManwon(stressSupply, row.stressSupplyNominal ?? stressSupply)}/월</p>}
      {target !== null && <p className="text-slate-700 dark:text-slate-300">목표 월생활비: {formatRealAndNominalManwon(target, row.targetNominal ?? target)}/월</p>}
      {shortfalls.length > 0 && <p className="text-rose-600 dark:text-rose-400">부족: {shortfalls.join(" · ")}</p>}
    </div>
  );
}

function ChartHeader({
  hasTarget,
  target,
  basicShortfallYears,
  stressShortfallYears,
  onFocusTargetInput,
}: {
  hasTarget: boolean;
  target: number | null;
  basicShortfallYears?: number;
  stressShortfallYears?: number | null;
  onFocusTargetInput?: () => void;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h4 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">월 현금흐름 vs 목표 월생활비</h4>
        {hasTarget ? (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {formatManwonMoney(target!)} 기준 · Good 생활비 미달 {basicShortfallYears ?? 0}년 · Bad 생활비 미달 {stressShortfallYears ?? 0}년
          </p>
        ) : (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            목표 월생활비를 입력하면 기준선과 부족 연도를 표시합니다.
          </p>
        )}
      </div>
      {!hasTarget && onFocusTargetInput && (
        <button
          type="button"
          onClick={onFocusTargetInput}
          className="w-fit shrink-0 rounded font-semibold text-blue-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:text-blue-400"
        >
          목표 입력하기 →
        </button>
      )}
    </div>
  );
}

export default function SafetyMonthlySupplyChart({
  projection,
  normalProjection = null,
  stressProjection,
  targetMonthlyExpenseReal,
  safetyResult,
  stressSafetyResult,
  onFocusTargetInput,
}: Props) {
  const hasTarget = targetMonthlyExpenseReal !== null && Number.isFinite(targetMonthlyExpenseReal);
  const target = hasTarget ? targetMonthlyExpenseReal : null;

  if (!stressProjection) {
    return (
      <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#273032] dark:bg-white/[0.03] sm:p-4">
        <ChartHeader hasTarget={hasTarget} target={target} onFocusTargetInput={onFocusTargetInput} />
        <EmptyState>Bad 시나리오 결과가 준비되지 않았습니다.</EmptyState>
      </section>
    );
  }

  const data = buildMonthlySupplyRows(projection, normalProjection, stressProjection, target);
  if (!data || data.length === 0) {
    return (
      <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#273032] dark:bg-white/[0.03] sm:p-4">
        <ChartHeader hasTarget={hasTarget} target={target} onFocusTargetInput={onFocusTargetInput} />
        <EmptyState>인출 구간이 준비되면 월 현금흐름 차트를 표시합니다.</EmptyState>
      </section>
    );
  }

  const basicShortfallYears = safetyResult.metrics.shortfallYears;
  const stressShortfallYears = stressSafetyResult?.metrics.shortfallYears ?? null;
  const basicConsecutiveShortfallYears = safetyResult.metrics.consecutiveShortfallYears;
  const stressConsecutiveShortfallYears = stressSafetyResult?.metrics.consecutiveShortfallYears ?? null;
  const ariaLabel = hasTarget
    ? `월 현금흐름 차트: 목표 ${formatManwonMoney(target!)} 기준으로 Good 시나리오 생활비 미달 ${basicShortfallYears}년, Bad 생활비 미달 ${stressShortfallYears ?? "결과 없음"}년입니다. 연속 생활비 미달은 Good ${basicConsecutiveShortfallYears}년, Bad ${stressConsecutiveShortfallYears ?? "결과 없음"}년입니다.`
    : "월 현금흐름 차트: Good 시나리오는 막대, Bad 시나리오는 점선으로 인출 구간의 월 현금흐름 추이를 보여줍니다. 목표 월생활비를 입력하면 기준선과 부족 연도가 표시됩니다.";

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#273032] dark:bg-white/[0.03] sm:p-4">
      <ChartHeader
        hasTarget={hasTarget}
        target={target}
        basicShortfallYears={basicShortfallYears}
        stressShortfallYears={stressShortfallYears}
        onFocusTargetInput={onFocusTargetInput}
      />
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="월 현금흐름 차트 범례">
        <SupplyLegend label="Good 월 현금흐름 (막대)" type="base" />
        <SupplyLegend label="Normal 월 현금흐름 (점선)" type="stress" />
        <SupplyLegend label="Bad 월 현금흐름 (점선)" type="stress" />
        {hasTarget && <SupplyLegend label="목표 월생활비 (점선)" type="target" />}
      </div>
      <div className="safety-monthly-supply min-w-0" role="img" aria-label={ariaLabel}>
        <div className="h-[200px] w-full md:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--safety-monthly-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke="var(--safety-monthly-axis)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--safety-monthly-axis)" tick={{ fontSize: 11 }} tickFormatter={formatAxisAmount} tickLine={false} axisLine={false} width={58} label={{ value: "만원/월", angle: -90, position: "insideLeft", fill: "var(--safety-monthly-axis)", fontSize: 10 }} />
              <Tooltip content={<MonthlySupplyTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} />
              {hasTarget && <ReferenceLine y={target!} stroke="var(--safety-monthly-target)" strokeDasharray="5 4" ifOverflow="extendDomain" label={{ value: formatTargetLabel(target!), position: "insideTopRight", fill: "var(--safety-monthly-target)", fontSize: 10 }} />}
              <Bar dataKey="baseSupply" name="Good 월 현금흐름" fill="var(--safety-monthly-base)" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="normalSupply" name="Normal 월 현금흐름" stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" dot={false} connectNulls />
              <Line type="monotone" dataKey="stressSupply" name="Bad 월 현금흐름" stroke="var(--safety-monthly-stress)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {hasTarget ? (
        <SafetyShortfallHeatStrip
          rows={data}
          targetMonthlyExpenseReal={target!}
          basicShortfallYears={basicShortfallYears}
          basicConsecutiveShortfallYears={basicConsecutiveShortfallYears}
          stressShortfallYears={stressShortfallYears}
          stressConsecutiveShortfallYears={stressConsecutiveShortfallYears}
        />
      ) : (
        <p className="mt-3 border-t border-slate-200 pt-3 text-[11.5px] text-slate-600 dark:border-slate-700 dark:text-slate-400">
          목표 월생활비를 입력하면 부족 연도를 표시합니다.
        </p>
      )}
      <style jsx>{`
        .safety-monthly-supply { --safety-monthly-base: #2563eb; --safety-monthly-stress: #d97706; --safety-monthly-target: #475569; --safety-monthly-axis: #64748b; --safety-monthly-grid: #cbd5e1; }
        :global(.dark) .safety-monthly-supply { --safety-monthly-base: #3b82f6; --safety-monthly-stress: #d97706; --safety-monthly-target: #94a3b8; --safety-monthly-axis: #94a3b8; --safety-monthly-grid: #334155; }
      `}</style>
    </section>
  );
}
