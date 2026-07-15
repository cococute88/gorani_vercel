"use client";

import { describeScenarioRisk, formatCoverageRatio, formatPreservationRatio } from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney, formatRealAndNominalManwon } from "@/lib/format";
import type { RetirementSafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";

type Props = {
  projection: SimulatorProjection;
  safety: RetirementSafetyResult;
  normalSafety: RetirementSafetyResult;
  stressSafety: RetirementSafetyResult;
  targetMonthlyExpenseReal: number | null;
  taxMonthlySupply: number | null;
  taxMonthlySupplyNominal: number | null;
  brokerageMonthlySupply: number | null;
  brokerageMonthlySupplyNominal: number | null;
  totalMonthlySupply: number | null;
  totalMonthlySupplyNominal: number | null;
};

function Metric({ label, value, tone = "text-slate-900 dark:text-white" }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0 text-center"><p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-1 break-keep text-[15px] font-extrabold ${tone}`}>{value}</p></div>;
}

export default function SafetyKpiCards(props: Props) {
  const {
    projection, safety, normalSafety, stressSafety, targetMonthlyExpenseReal, taxMonthlySupply, taxMonthlySupplyNominal,
    brokerageMonthlySupply, brokerageMonthlySupplyNominal, totalMonthlySupply, totalMonthlySupplyNominal,
  } = props;
  const hasTarget = targetMonthlyExpenseReal !== null && targetMonthlyExpenseReal > 0;
  const coverage = hasTarget && totalMonthlySupply !== null ? totalMonthlySupply / targetMonthlyExpenseReal : null;
  const difference = coverage === null || totalMonthlySupply === null ? null : totalMonthlySupply - targetMonthlyExpenseReal!;
  const startYear = projection.inputs.startYear;
  const firstRow = projection.totalWithdrawRows.find((row) => row.isWithdraw) ?? projection.totalWithdrawRows.at(0) ?? null;
  const targetNominal = hasTarget && firstRow
    ? targetMonthlyExpenseReal! * Math.pow(1 + projection.inputs.inflationRate / 100, firstRow.year - startYear)
    : targetMonthlyExpenseReal;
  const risk = describeScenarioRisk(safety.combined, normalSafety.combined, stressSafety.combined);
  const finalRow = projection.chartRows.at(-1);
  const finalReal = finalRow?.combinedRealBalance ?? 0;
  const finalNominal = finalRow?.combinedNominalBalance ?? 0;
  const tone = risk.label === "안전" ? "text-emerald-700 dark:text-emerald-300" : risk.label === "위험" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300";

  return (
    <section id="safety-results" aria-labelledby="safety-results-heading" className="scroll-mt-4 min-w-0 space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-500/30 dark:bg-[#171d1e] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="safety-results-heading" className="text-[17px] font-bold text-slate-900 dark:text-white"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">3</span>결과 확인</h2>
          <span className={`text-[14px] font-bold ${tone}`}>{risk.label} {risk.score}점</span>
        </div>
        <p className="mt-1 text-[11.5px] text-slate-600 dark:text-slate-400">{risk.description}</p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">안전성 탭은 {startYear}년부터 은퇴와 인출이 동시에 시작된다고 가정합니다.</p>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#2c3638] dark:bg-white/[0.03]">
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">월생활비 충당 결과</h3>
          <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">앞은 현재가치 기준, 괄호 안은 해당 연도 명목금액입니다.</p>
          <div className="mt-3 grid grid-cols-2 gap-y-3 sm:grid-cols-5">
            <Metric label="목표 월생활비" value={hasTarget ? formatRealAndNominalManwon(targetMonthlyExpenseReal!, targetNominal ?? targetMonthlyExpenseReal!) : "—"} />
            <Metric label="총 월 현금흐름" value={totalMonthlySupply === null || totalMonthlySupplyNominal === null ? "—" : formatRealAndNominalManwon(totalMonthlySupply, totalMonthlySupplyNominal)} />
            <Metric label="절세계좌 월 현금흐름" value={taxMonthlySupply === null || taxMonthlySupplyNominal === null ? "—" : formatRealAndNominalManwon(taxMonthlySupply, taxMonthlySupplyNominal)} />
            <Metric label="위탁계좌 월 현금흐름" value={brokerageMonthlySupply === null || brokerageMonthlySupplyNominal === null ? "—" : formatRealAndNominalManwon(brokerageMonthlySupply, brokerageMonthlySupplyNominal)} />
            <Metric label="월 여유/부족" value={difference === null ? "—" : `${formatManwonMoney(Math.abs(difference))} ${difference >= 0 ? "여유" : "부족"}`} tone={difference !== null && difference < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">계좌별 결과 요약</h3>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">인출 시작 대비 실질자산 보존율 = 최종 실질자산 / 인출 시작 실질자산</p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["절세계좌", safety.taxSaving], ["위탁계좌", safety.brokerage], ["통합", safety.combined],
          ].map(([label, result]) => {
            const safetyResult = result as RetirementSafetyResult["combined"];
            return <div key={label as string} className="rounded-xl border border-slate-200 p-3 dark:border-[#2c3638]"><dt className="font-semibold text-slate-800 dark:text-slate-100">{label as string}</dt><dd className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">보존율 <strong>{formatPreservationRatio(safetyResult.metrics.preservationRatio)}</strong></dd><dd className="text-[11px] text-slate-500">시작 {formatManwonMoney(safetyResult.metrics.startingRealAssets)} → 최종 {formatManwonMoney(safetyResult.metrics.endingRealAssets)}</dd></div>;
          })}
        </dl>
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Good 최종 통합자산: {formatRealAndNominalManwon(finalReal, finalNominal)} · Good 월생활비 충당률: {formatCoverageRatio(coverage)}</p>
      </div>
    </section>
  );
}
