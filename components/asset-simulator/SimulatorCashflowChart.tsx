"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SimulatorChartRow } from "@/lib/asset-simulator-types";

type Props = {
  data: SimulatorChartRow[];
  retirementYear: number;
};

const tooltipFormatter = (value: number | string) => `${Number(value).toLocaleString("ko-KR")}만원`;

export default function SimulatorCashflowChart({ data, retirementYear }: Props) {
  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4">
        <h2 className="text-base font-extrabold text-white">배당금 추이 차트</h2>
        <p className="mt-1 text-[13px] text-slate-400">절세계좌 월인출금과 위탁계좌 월배당금을 명목/실질로 표시합니다.</p>
      </div>
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#263033" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Number(value).toLocaleString("ko-KR")}만`} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ background: "#111516", border: "1px solid #334155", borderRadius: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine x={retirementYear} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "은퇴", fill: "#fbbf24", fontSize: 12 }} />
            <Line type="monotone" dataKey="taxSavingMonthlyNominal" name="절세 월인출금(명목)" stroke="#60a5fa" strokeWidth={2.3} dot={false} />
            <Line type="monotone" dataKey="taxSavingMonthlyReal" name="절세 월인출금(실질)" stroke="#60a5fa" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            <Line type="monotone" dataKey="taxableMonthlyDividendNominal" name="위탁 월배당금(명목)" stroke="#f472b6" strokeWidth={2.3} dot={false} />
            <Line type="monotone" dataKey="taxableMonthlyDividendReal" name="위탁 월배당금(실질)" stroke="#f472b6" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            <Line type="monotone" dataKey="totalMonthlyIncomeNominal" name="합산 월수익(명목)" stroke="#22c55e" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="totalMonthlyIncomeReal" name="합산 월수익(실질)" stroke="#22c55e" strokeWidth={2.1} strokeDasharray="6 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
