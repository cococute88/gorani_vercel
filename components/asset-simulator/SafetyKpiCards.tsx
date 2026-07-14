"use client";

import { formatManwonMoney } from "@/lib/format";
import { formatPct, formatPreservationRatio } from "@/lib/asset-simulator-portfolio-ui";
import type { RetirementSafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";

type Props = {
  projection: SimulatorProjection;
  safety: RetirementSafetyResult;
  targetMonthlyExpenseReal: number | null;
  taxMonthlySupply: number | null;
  brokerageMonthlySupply: number | null;
  totalMonthlySupply: number | null;
};

type AccountResultRow = {
  label: string;
  monthlyCash: number | null;
  asset: number;
  preservation: number;
  rate: string;
  basis: string;
};

function finalAccountAssets(projection: SimulatorProjection) {
  const row = projection.chartRows.at(-1);

  return {
    taxSaving: row?.realTaxSavingBalance ?? 0,
    brokerage: row?.taxableDividendBalanceReal ?? 0,
  };
}

function FlowMetric({
  label,
  value,
  tone = "text-slate-900 dark:text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 break-keep text-[17px] font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

function AccountResultMobileCard({ row, period }: { row: AccountResultRow; period: number }) {
  return (
    <article className="rounded-xl border border-slate-200 p-3 dark:border-[#2c3638] md:hidden">
      <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">{row.label}</h4>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">월 현금</dt>
          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
            {row.monthlyCash === null ? "—" : formatManwonMoney(row.monthlyCash)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">{period}년 후 실질자산</dt>
          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{formatManwonMoney(row.asset)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">실가치보존율</dt>
          <dd className="mt-0.5 font-bold text-emerald-700 dark:text-emerald-300">
            {formatPreservationRatio(row.preservation)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">가정 수익률</dt>
          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{row.rate}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500 dark:text-slate-400">기준</dt>
          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{row.basis}</dd>
        </div>
      </dl>
    </article>
  );
}

function AccountResultTable({ rows, period, totalMonthlySupply, totalAsset, coverage }: {
  rows: AccountResultRow[];
  period: number;
  totalMonthlySupply: number | null;
  totalAsset: number;
  coverage: number | null;
}) {
  return (
    <div className="mt-3 hidden overflow-x-auto md:block">
      <table className="min-w-[670px] w-full text-left text-[12px]">
        <thead className="border-b border-slate-200 text-slate-500 dark:border-[#2c3638] dark:text-slate-400">
          <tr>
            <th className="pb-2 font-semibold">계좌</th>
            <th className="pb-2 font-semibold">월 현금</th>
            <th className="pb-2 font-semibold">{period}년 후 실질자산</th>
            <th className="pb-2 font-semibold">실가치보존율</th>
            <th className="pb-2 font-semibold">가정 수익률</th>
            <th className="pb-2 font-semibold">기준</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-slate-100 last:border-0 dark:border-[#232b2d]">
              <td className="py-2.5 font-bold text-slate-800 dark:text-slate-100">{row.label}</td>
              <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-100">
                {row.monthlyCash === null ? "—" : formatManwonMoney(row.monthlyCash)}
              </td>
              <td className="py-2.5">{formatManwonMoney(row.asset)}</td>
              <td className="py-2.5 font-bold text-emerald-700 dark:text-emerald-300">
                {formatPreservationRatio(row.preservation)}
              </td>
              <td className="py-2.5">{row.rate}</td>
              <td className="py-2.5">{row.basis}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2.5 font-bold text-slate-900 dark:text-white">통합</td>
            <td className="py-2.5 font-bold text-slate-900 dark:text-white">
              {totalMonthlySupply === null ? "—" : formatManwonMoney(totalMonthlySupply)}
            </td>
            <td className="py-2.5 font-bold">{formatManwonMoney(totalAsset)}</td>
            <td className="py-2.5 font-bold text-emerald-700 dark:text-emerald-300">
              {coverage === null ? "—" : `목표 대비 ${Math.round(coverage * 100)}%`}
            </td>
            <td className="py-2.5">—</td>
            <td className="py-2.5">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SafetyKpiCards({
  projection,
  safety,
  targetMonthlyExpenseReal,
  taxMonthlySupply,
  brokerageMonthlySupply,
  totalMonthlySupply,
}: Props) {
  const hasTarget = targetMonthlyExpenseReal !== null && targetMonthlyExpenseReal > 0;
  const coverage = hasTarget && totalMonthlySupply !== null ? totalMonthlySupply / targetMonthlyExpenseReal : null;
  const difference = hasTarget && totalMonthlySupply !== null ? totalMonthlySupply - targetMonthlyExpenseReal : null;
  const coverageScale = coverage === null ? 0 : Math.min(100, (coverage / 1.5) * 100);
  const assets = finalAccountAssets(projection);
  const taxRate = projection.summary.portfolioSummary?.taxSaving.effectiveTotalReturnPct;
  const dividendRate = projection.summary.portfolioSummary?.brokerage.effectiveDividendYieldPct;
  const period = projection.inputs.years;
  const rows: AccountResultRow[] = [
    {
      label: "절세계좌",
      monthlyCash: taxMonthlySupply,
      asset: assets.taxSaving,
      preservation: safety.taxSaving.metrics.preservationRatio,
      rate: typeof taxRate === "number" ? `CAGR ${formatPct(taxRate, 1)}` : "—",
      basis: `연 ${formatPct(projection.inputs.withdrawalRate, 1)} 인출`,
    },
    {
      label: "위탁계좌",
      monthlyCash: brokerageMonthlySupply,
      asset: assets.brokerage,
      preservation: safety.brokerage.metrics.preservationRatio,
      rate: typeof dividendRate === "number" ? `배당률 ${formatPct(dividendRate, 1)}` : "—",
      basis: "배당 현금흐름",
    },
  ];
  const monthlyDifference = difference === null
    ? "—"
    : difference >= 0
      ? `${formatManwonMoney(difference)} 여유`
      : `${formatManwonMoney(Math.abs(difference))} 부족`;
  const differenceTone = difference !== null && difference >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <section id="safety-results" aria-labelledby="safety-results-heading" className="scroll-mt-4 min-w-0 space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-500/30 dark:bg-[#171d1e] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="safety-results-heading" className="text-[17px] font-bold text-slate-900 dark:text-white">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">3</span>
            결과 확인
          </h2>
          <span className={`text-[13px] font-bold ${differenceTone}`}>
            {difference === null ? "목표 월생활비를 입력해 주세요" : `목표 대비 월 ${monthlyDifference}`}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#2c3638] dark:bg-white/[0.03]">
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">월생활비 충당 결과</h3>
          <div className="mt-3 grid grid-cols-2 gap-y-3 sm:grid-cols-5">
            <FlowMetric label="목표 월생활비" value={hasTarget ? formatManwonMoney(targetMonthlyExpenseReal) : "—"} />
            <FlowMetric label="총 월 현금" value={totalMonthlySupply === null ? "—" : formatManwonMoney(totalMonthlySupply)} />
            <FlowMetric label="절세계좌 월 현금" value={taxMonthlySupply === null ? "—" : formatManwonMoney(taxMonthlySupply)} />
            <FlowMetric label="위탁계좌 월 현금" value={brokerageMonthlySupply === null ? "—" : formatManwonMoney(brokerageMonthlySupply)} />
            <FlowMetric label="월 여유/부족" value={monthlyDifference} tone={differenceTone} />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              충당률 <span className="ml-1 text-[16px] text-emerald-700 dark:text-emerald-300">{coverage === null ? "—" : `${Math.round(coverage * 100)}%`}</span>
            </p>
            <span className="text-[11px] text-slate-500">150% 기준</span>
          </div>
          <div className="relative mt-2 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${coverageScale}%` }} />
            <span aria-hidden className="absolute -top-1 h-4 border-l-2 border-slate-700 dark:border-slate-200" style={{ left: "66.666%" }} />
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-slate-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
            <span>150%</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">계좌별 결과 요약</h3>
        <div className="mt-3 space-y-2 md:hidden">
          {rows.map((row) => <AccountResultMobileCard key={row.label} row={row} period={period} />)}
        </div>
        <AccountResultTable
          rows={rows}
          period={period}
          totalMonthlySupply={totalMonthlySupply}
          totalAsset={assets.taxSaving + assets.brokerage}
          coverage={coverage}
        />
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          실가치보존율: 물가상승률을 반영한 현재가치 기준 자산 보존율
        </p>
      </div>
    </section>
  );
}
