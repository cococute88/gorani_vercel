"use client";

import { formatCoverageRatio, formatPreservationRatio } from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney, formatRealAndNominalManwon } from "@/lib/format";
import type { RetirementSafetyResult, SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";

type Scenario = {
  label: "Good" | "Normal" | "Bad";
  projection: SimulatorProjection;
  safety: RetirementSafetyResult;
  color: string;
};

type Props = {
  scenarios: [Scenario, Scenario, Scenario];
  targetMonthlyExpenseReal: number | null;
  riskLabel: string;
  riskScore: number;
  riskDescription: string;
};

function firstMonthlyFlow(projection: SimulatorProjection) {
  return projection.totalWithdrawRows.find((row) => row.isWithdraw) ?? projection.totalWithdrawRows.at(0) ?? null;
}

function ScenarioSummaryCard({ scenario, targetMonthlyExpenseReal }: { scenario: Scenario; targetMonthlyExpenseReal: number | null }) {
  const row = firstMonthlyFlow(scenario.projection);
  const final = scenario.projection.chartRows.at(-1);
  const hasTarget = targetMonthlyExpenseReal !== null && targetMonthlyExpenseReal > 0;
  const flowReal = row?.totalMonthlyIncomeReal ?? null;
  const flowNominal = row?.totalMonthlyIncomeNominal ?? null;
  const targetNominal = hasTarget && row
    ? targetMonthlyExpenseReal! * Math.pow(1 + scenario.projection.inputs.inflationRate / 100, row.year - scenario.projection.inputs.startYear)
    : null;
  const difference = hasTarget && flowReal !== null ? flowReal - targetMonthlyExpenseReal! : null;
  const result = scenario.safety.combined;

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-[#2c3638]">
      <h3 className={`text-[15px] font-bold ${scenario.color}`}>{scenario.label}</h3>
      <dl className="mt-2 space-y-1.5 text-[11.5px]">
        <div><dt className="text-slate-500 dark:text-slate-400">월 현금흐름</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{flowReal === null || flowNominal === null ? "—" : formatRealAndNominalManwon(flowReal, flowNominal)}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">목표 대비</dt><dd className={difference === null ? "font-semibold text-slate-700 dark:text-slate-300" : difference < 0 ? "font-bold text-rose-600 dark:text-rose-400" : "font-bold text-emerald-700 dark:text-emerald-400"}>{difference === null ? "목표 월생활비 입력 시 표시" : `${formatManwonMoney(Math.abs(difference))} ${difference < 0 ? "부족" : "여유"}`}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">최종 자산 (실질·명목)</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{final ? formatRealAndNominalManwon(final.combinedRealBalance, final.combinedNominalBalance) : "—"}</dd></div>
        <div className="flex flex-wrap gap-x-2 text-slate-600 dark:text-slate-300"><span title="월 현금흐름이 목표 월생활비보다 낮은 연도 수입니다. 자산 고갈 기간이 아닙니다.">생활비 미달 {result.metrics.shortfallYears}년</span><span>·</span><span>보존율 {formatPreservationRatio(result.metrics.preservationRatio)}</span></div>
        {hasTarget && targetNominal !== null && <p className="text-[10.5px] text-slate-500 dark:text-slate-400">목표 {formatRealAndNominalManwon(targetMonthlyExpenseReal!, targetNominal)} · 충당률 {formatCoverageRatio(result.metrics.monthlyIncomeCoverageRatio)}</p>}
      </dl>
    </article>
  );
}

function AccountCard({ label, result }: { label: string; result: SafetyResult }) {
  return <div className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2c3638]"><p className="font-semibold text-slate-800 dark:text-slate-100">{label}</p><p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">보존율 <strong>{formatPreservationRatio(result.metrics.preservationRatio)}</strong></p><p className="text-[10.5px] text-slate-500 dark:text-slate-400">시작 {formatManwonMoney(result.metrics.startingRealAssets)} → 최종 {formatManwonMoney(result.metrics.endingRealAssets)}</p></div>;
}

function ScenarioAccountSummary({ scenario }: { scenario: Scenario }) {
  return <section className="min-w-0"><h4 className={`mb-1.5 text-[13px] font-bold ${scenario.color}`}>{scenario.label}</h4><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><AccountCard label="절세계좌" result={scenario.safety.taxSaving} /><AccountCard label="위탁계좌" result={scenario.safety.brokerage} /><AccountCard label="통합" result={scenario.safety.combined} /></div></section>;
}

export default function SafetyKpiCards({ scenarios, targetMonthlyExpenseReal, riskLabel, riskScore, riskDescription }: Props) {
  return (
    <section id="safety-results" aria-labelledby="safety-results-heading" className="scroll-mt-4 min-w-0 space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-500/30 dark:bg-[#171d1e] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="safety-results-heading" className="text-[17px] font-bold text-slate-900 dark:text-white"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">3</span>결과 확인</h2><span className={riskLabel === "안전" ? "text-[14px] font-bold text-emerald-700 dark:text-emerald-300" : riskLabel === "위험" ? "text-[14px] font-bold text-rose-700 dark:text-rose-300" : "text-[14px] font-bold text-amber-700 dark:text-amber-300"}>{riskLabel} {riskScore}점</span></div>
        <p className="mt-1 text-[11.5px] text-slate-600 dark:text-slate-400">{riskDescription}</p>
        <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-500">종합 점수는 Good·Normal·Bad 통합 결과 중 가장 낮은 점수이며, 각 시나리오의 판단과 점수는 아래 비교표에서 따로 확인할 수 있습니다.</p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">앞은 현재가치 기준, 괄호 안은 해당 연도 명목금액입니다. 안전성 탭은 현재년도부터 은퇴와 인출이 동시에 시작됩니다.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{scenarios.map((scenario) => <ScenarioSummaryCard key={scenario.label} scenario={scenario} targetMonthlyExpenseReal={targetMonthlyExpenseReal} />)}</div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">계좌별 결과 요약</h3>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">인출 시작 대비 실질자산 보존율 = 최종 실질자산 / 인출 시작 실질자산</p>
        <div className="mt-3 space-y-4">{scenarios.map((scenario) => <ScenarioAccountSummary key={scenario.label} scenario={scenario} />)}</div>
      </section>
    </section>
  );
}
