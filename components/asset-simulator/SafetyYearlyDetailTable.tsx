"use client";

import { formatManwonMoney } from "@/lib/format";
import {
  buildYearlyDetailRows,
  type SafetyYearlyDetailRow,
  type ShortfallCellStatus,
} from "@/lib/asset-simulator-safety-chart-ui";
import type { SimulatorProjection } from "@/lib/asset-simulator-types";

type Props = {
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  targetMonthlyExpenseReal: number | null;
};

const STATUS_LABEL: Record<ShortfallCellStatus, string> = {
  sufficient: "충분",
  mild_shortfall: "부족·경미",
  severe_shortfall: "부족·심각",
  no_target: "목표 없음",
  unavailable: "데이터 없음",
};

const STATUS_CLASS: Record<ShortfallCellStatus, string> = {
  sufficient: "text-emerald-700 dark:text-emerald-400",
  mild_shortfall: "text-amber-700 dark:text-amber-400",
  severe_shortfall: "text-rose-700 dark:text-rose-400",
  no_target: "text-slate-600 dark:text-slate-400",
  unavailable: "text-slate-600 dark:text-slate-400",
};

function formatCoverage(value: number | null, target: number | null): string {
  if (target === null || !Number.isFinite(target) || target <= 0) return "목표 없음";
  if (value === null || !Number.isFinite(value)) return "데이터 없음";
  return `${Math.round((value / target) * 100)}%`;
}

function formatValue(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : formatManwonMoney(value);
}

function formatStatus(row: SafetyYearlyDetailRow): string {
  if (row.baseStatus === "no_target") return STATUS_LABEL.no_target;
  if (row.baseStatus === row.stressStatus) return STATUS_LABEL[row.baseStatus];
  return `Good ${STATUS_LABEL[row.baseStatus]} · Bad ${STATUS_LABEL[row.stressStatus]}`;
}

function statusClass(row: SafetyYearlyDetailRow): string {
  if (row.stressStatus === "severe_shortfall" || row.baseStatus === "severe_shortfall") return STATUS_CLASS.severe_shortfall;
  if (row.stressStatus === "mild_shortfall" || row.baseStatus === "mild_shortfall") return STATUS_CLASS.mild_shortfall;
  return STATUS_CLASS[row.baseStatus];
}

export default function SafetyYearlyDetailTable({ projection, stressProjection, targetMonthlyExpenseReal }: Props) {
  const rows = buildYearlyDetailRows(projection, stressProjection, targetMonthlyExpenseReal);

  return (
    <details className="group mt-3 rounded-lg border border-slate-200 bg-white/60 dark:border-[#273032] dark:bg-white/[0.02]">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
        <span className="underline decoration-dotted underline-offset-2">연도별 월 현금흐름/자산 보기</span>
        <span className="ml-1.5 font-normal text-slate-600 dark:text-slate-400">(Good 접힘)</span>
      </summary>
      {rows.length === 0 ? (
        <p className="border-t border-slate-200 px-3 py-3 text-[11.5px] text-slate-600 dark:border-[#273032] dark:text-slate-400">인출 구간 데이터가 준비되면 연도별 상세를 표시합니다.</p>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200 dark:border-[#273032]">
          <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-[11px]">
            <caption className="sr-only">Good 및 Bad 시나리오의 연도별 월 현금흐름, 목표 대비, 실질 총자산 상세</caption>
            <thead className="bg-slate-100 text-slate-700 dark:bg-white/[0.04] dark:text-slate-300">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-slate-100 px-3 py-2 font-semibold dark:bg-[#1b2223]">연도</th>
                <th scope="col" className="px-3 py-2 font-semibold">상태</th>
                <th scope="col" className="px-3 py-2 font-semibold">Good 월 현금흐름</th>
                <th scope="col" className="px-3 py-2 font-semibold">Bad 월 현금흐름</th>
                <th scope="col" className="px-3 py-2 font-semibold">목표 대비</th>
                <th scope="col" className="px-3 py-2 font-semibold">Good 실질 총자산</th>
                <th scope="col" className="px-3 py-2 font-semibold">Bad 실질 총자산</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year} className="odd:bg-slate-50/70 dark:odd:bg-white/[0.015]">
                  <th scope="row" className="sticky left-0 z-10 bg-inherit px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{row.year}년</th>
                  <td className={`px-3 py-2 font-medium ${statusClass(row)}`}>{formatStatus(row)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatValue(row.baseSupply)}/월</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatValue(row.stressSupply)}/월</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">Good {formatCoverage(row.baseSupply, targetMonthlyExpenseReal)} · Bad {formatCoverage(row.stressSupply, targetMonthlyExpenseReal)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatValue(row.base)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatValue(row.stress)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
