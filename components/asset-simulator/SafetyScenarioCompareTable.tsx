"use client";

import { describeSafety, formatCoverageRatio, formatPreservationRatio } from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney } from "@/lib/format";
import type { SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";

type Props = {
  good: SafetyResult;
  normal: SafetyResult;
  bad: SafetyResult;
  goodProjection: SimulatorProjection;
  normalProjection: SimulatorProjection;
  badProjection: SimulatorProjection;
};

function statusText(result: SafetyResult): string {
  const display = describeSafety(result);
  return display.showScore ? `${display.gradeLabel} · ${result.score}점` : display.gradeLabel;
}

export default function SafetyScenarioCompareTable({ good, normal, bad, goodProjection, normalProjection, badProjection }: Props) {
  const values = [
    ["판단", statusText(good), statusText(normal), statusText(bad)],
    ["월생활비 충당률", formatCoverageRatio(good.metrics.monthlyIncomeCoverageRatio), formatCoverageRatio(normal.metrics.monthlyIncomeCoverageRatio), formatCoverageRatio(bad.metrics.monthlyIncomeCoverageRatio)],
    ["생활비 미달 기간", `${good.metrics.shortfallYears}년`, `${normal.metrics.shortfallYears}년`, `${bad.metrics.shortfallYears}년`],
    ["인출 시작 대비 보존율", formatPreservationRatio(good.metrics.preservationRatio), formatPreservationRatio(normal.metrics.preservationRatio), formatPreservationRatio(bad.metrics.preservationRatio)],
    ["최종 실질자산", formatManwonMoney(goodProjection.summary.combinedRealBalance), formatManwonMoney(normalProjection.summary.combinedRealBalance), formatManwonMoney(badProjection.summary.combinedRealBalance)],
  ];
  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 dark:border-[#273032]" role="table" aria-label="Good Normal Bad 안전성 비교표">
      <p className="px-3 pt-3 text-[11px] text-slate-500 dark:text-slate-400">생활비 미달 기간은 월 현금흐름이 목표 월생활비보다 낮은 연도 수이며, 자산 고갈 기간이 아닙니다.</p>
      <p className="px-3 pt-1 text-[10.5px] text-slate-500 dark:text-slate-500" title="최종 실질자산 ÷ 실제 인출 시작 행의 실질자산으로 계산합니다.">보존율은 실제 인출 시작 시점의 실질자산을 기준으로 계산합니다. 위탁계좌 보존율은 배당 현금흐름을 제외한 가격 잔고 기준입니다.</p>
      <div className="min-w-[560px] p-3">
        <div role="row" className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-2 text-[11px] font-semibold dark:border-[#273032]"><span>지표</span><span className="text-blue-600 dark:text-blue-400">Good</span><span className="text-emerald-600 dark:text-emerald-400">Normal</span><span className="text-amber-700 dark:text-amber-400">Bad</span></div>
        {values.map(([label, goodValue, normalValue, badValue]) => <div key={label} role="row" className="grid grid-cols-4 gap-2 border-b border-slate-100 py-2 text-[11.5px] last:border-0 dark:border-[#232b2d]"><span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span><span className="font-semibold text-slate-900 dark:text-slate-100">{goodValue}</span><span className="font-semibold text-slate-900 dark:text-slate-100">{normalValue}</span><span className="font-semibold text-slate-900 dark:text-slate-100">{badValue}</span></div>)}
      </div>
    </div>
  );
}
