"use client";

import { useMemo, useState } from "react";
import type { DividendBrokerageRow, SimulatorProjection, WithdrawRow, YearResult } from "@/lib/asset-simulator-types";
import SimulatorBalanceChart from "./SimulatorBalanceChart";
import SimulatorCashflowChart from "./SimulatorCashflowChart";
import TableCsvMenu from "@/components/ui/TableCsvMenu";

const TABS = ["잔고 추이 차트", "배당금 추이 차트", "적립 현황", "절세계좌인출(원금만)", "위탁계좌(배당용) 잔고"] as const;

type Props = { projection: SimulatorProjection };

function money(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}만원`;
}

function decimalMoney(value: number) {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원`;
}

function AccumulationTable({ rows }: { rows: YearResult[] }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  return (
    <div className="rounded-xl border border-[#263033]">
      <div className="flex justify-end border-b border-[#263033] bg-[#111516] px-3 py-2"><TableCsvMenu filename={`asset-simulator-accumulation-${today}.csv`} rows={rows} columns={[
        { header: "년도", value: (row) => row.year },
        { header: "상태", value: (row) => row.status },
        { header: "연금적립", value: (row) => money(row.pensionContribution) },
        { header: "연금잔고", value: (row) => money(row.pensionBalance) },
        { header: "ISA적립", value: (row) => money(row.isaContribution) },
        { header: "ISA잔고", value: (row) => money(row.isaBalance) },
        { header: "적립액from예비금", value: (row) => money(row.reserveUsed) },
        { header: "예비금 잔고", value: (row) => money(row.reserveBalance) },
        { header: "전체잔고", value: (row) => money(row.totalBalance) },
      ]} /></div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="bg-[#111516] text-[12px] uppercase tracking-wide text-slate-400">
          <tr>
            {["년도", "상태", "연금적립", "연금잔고", "ISA적립", "ISA잔고", "적립액from예비금", "예비금 잔고", "전체잔고"].map((header) => (
              <th key={header} className="px-3 py-3 text-right first:text-left">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-t border-[#263033] text-slate-200 odd:bg-white/[0.015]">
              <td className="px-3 py-2 text-left font-bold text-slate-100">{row.year}</td>
              <td className="px-3 py-2 text-right">{row.status}</td>
              <td className="px-3 py-2 text-right">{money(row.pensionContribution)}</td>
              <td className="px-3 py-2 text-right">{money(row.pensionBalance)}</td>
              <td className="px-3 py-2 text-right">{money(row.isaContribution)}</td>
              <td className="px-3 py-2 text-right">{money(row.isaBalance)}</td>
              <td className="px-3 py-2 text-right">{money(row.reserveUsed)}</td>
              <td className="px-3 py-2 text-right">{money(row.reserveBalance)}</td>
              <td className="px-3 py-2 text-right font-bold text-white">{money(row.totalBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function WithdrawTable({ rows }: { rows: WithdrawRow[] }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  return (
    <div className="rounded-xl border border-[#263033]">
      <div className="flex justify-end border-b border-[#263033] bg-[#111516] px-3 py-2"><TableCsvMenu filename={`asset-simulator-tax-withdrawals-${today}.csv`} rows={rows} columns={[
        { header: "년도", value: (row) => row.year },
        { header: "구분", value: (row) => row.isDelay ? "대기중" : row.category },
        { header: "ISA잔고(명목)", value: (row) => money(row.isaBalanceNominal) },
        { header: "연금잔고(명목)", value: (row) => money(row.pensionBalanceNominal) },
        { header: "월수령(명목)", value: (row) => row.isDelay ? "대기중" : decimalMoney(row.monthlyNominal) },
        { header: "월수령(실질)", value: (row) => row.isDelay ? "대기중" : decimalMoney(row.monthlyReal) },
      ]} /></div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-[#111516] text-[12px] uppercase tracking-wide text-slate-400">
          <tr>
            {["년도", "구분", "ISA잔고(명목)", "연금잔고(명목)", "월수령(명목,실질)"].map((header) => (
              <th key={header} className="px-3 py-3 text-right first:text-left">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-t border-[#263033] text-slate-200 odd:bg-white/[0.015]">
              <td className="px-3 py-2 text-left font-bold text-slate-100">{row.year}</td>
              <td className="px-3 py-2 text-right">{row.isDelay ? "대기중" : row.category}</td>
              <td className="px-3 py-2 text-right">{money(row.isaBalanceNominal)}</td>
              <td className="px-3 py-2 text-right">{money(row.pensionBalanceNominal)}</td>
              <td className="px-3 py-2 text-right font-semibold text-white">{row.isDelay ? "대기중" : `${decimalMoney(row.monthlyNominal)} (${decimalMoney(row.monthlyReal)})`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function DividendTable({ rows }: { rows: DividendBrokerageRow[] }) {
  const headers = [
    "년도",
    "배당용 위탁잔고(명목)",
    "배당용 위탁잔고(실질)",
    "세후 연간 배당금(명목)",
    "세후 연간 배당금(실질)",
    "세후 월별 배당금(명목)",
    "세후 월별 배당금(실질)",
    "월배당합(절세+위탁)(명목)",
    "월배당합(절세+위탁)(실질)",
  ];
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  return (
    <div className="rounded-xl border border-[#263033]">
      <div className="flex justify-end border-b border-[#263033] bg-[#111516] px-3 py-2"><TableCsvMenu filename={`asset-simulator-dividend-brokerage-${today}.csv`} rows={rows} columns={[
        { header: "년도", value: (row) => row.year },
        { header: "배당용 위탁잔고(명목)", value: (row) => money(row.taxableDividendBalanceNominal) },
        { header: "배당용 위탁잔고(실질)", value: (row) => money(row.taxableDividendBalanceReal) },
        { header: "세후 연간 배당금(명목)", value: (row) => decimalMoney(row.afterTaxAnnualDividendNominal) },
        { header: "세후 연간 배당금(실질)", value: (row) => decimalMoney(row.afterTaxAnnualDividendReal) },
        { header: "세후 월별 배당금(명목)", value: (row) => decimalMoney(row.afterTaxMonthlyDividendNominal) },
        { header: "세후 월별 배당금(실질)", value: (row) => decimalMoney(row.afterTaxMonthlyDividendReal) },
        { header: "월배당합(절세+위탁)(명목)", value: (row) => decimalMoney(row.totalMonthlyDividendNominal) },
        { header: "월배당합(절세+위탁)(실질)", value: (row) => decimalMoney(row.totalMonthlyDividendReal) },
      ]} /></div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[1280px] border-collapse text-sm">
        <thead className="bg-[#111516] text-[12px] uppercase tracking-wide text-slate-400">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-3 text-right first:text-left">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-t border-[#263033] text-slate-200 odd:bg-white/[0.015]">
              <td className="px-3 py-2 text-left font-bold text-slate-100">{row.year}</td>
              <td className="px-3 py-2 text-right">{money(row.taxableDividendBalanceNominal)}</td>
              <td className="px-3 py-2 text-right">{money(row.taxableDividendBalanceReal)}</td>
              <td className="px-3 py-2 text-right">{decimalMoney(row.afterTaxAnnualDividendNominal)}</td>
              <td className="px-3 py-2 text-right">{decimalMoney(row.afterTaxAnnualDividendReal)}</td>
              <td className="px-3 py-2 text-right">{decimalMoney(row.afterTaxMonthlyDividendNominal)}</td>
              <td className="px-3 py-2 text-right">{decimalMoney(row.afterTaxMonthlyDividendReal)}</td>
              <td className="px-3 py-2 text-right font-semibold text-white">{decimalMoney(row.totalMonthlyDividendNominal)}</td>
              <td className="px-3 py-2 text-right font-semibold text-white">{decimalMoney(row.totalMonthlyDividendReal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function SimulatorResultTabs({ projection }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(TABS[0]);

  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full border px-3 py-2 text-[13px] font-bold transition-colors ${
              activeTab === tab ? "border-blue-400 bg-blue-500/20 text-blue-100" : "border-[#303a3d] bg-[#111516] text-slate-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "잔고 추이 차트" && <SimulatorBalanceChart data={projection.chartRows} retirementYear={projection.summary.retirementYear ?? undefined} withdrawalStartYear={projection.summary.actualWithdrawalStartYear ?? undefined} />}
      {activeTab === "배당금 추이 차트" && <SimulatorCashflowChart data={projection.chartRows} retirementYear={projection.summary.retirementYear ?? undefined} withdrawalStartYear={projection.summary.actualWithdrawalStartYear ?? undefined} />}
      {activeTab === "적립 현황" && <AccumulationTable rows={projection.results} />}
      {activeTab === "절세계좌인출(원금만)" && <WithdrawTable rows={projection.taxWithdrawRows} />}
      {activeTab === "위탁계좌(배당용) 잔고" && <DividendTable rows={projection.dividendRows} />}
    </section>
  );
}
