"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SimulatorYearResult } from "@/lib/asset-simulator-types";
import { formatKoreanMoney } from "@/lib/format";

type Props = { data: SimulatorYearResult[] };

const tooltipFormatter = (value: number | string) => formatKoreanMoney(Number(value));

export default function SimulatorCashflowChart({ data }: Props) {
  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4">
        <h2 className="text-base font-extrabold text-white">현금흐름</h2>
        <p className="mt-1 text-[13px] text-slate-400">연간 적립액, 인출액, 배당/현금흐름 mock을 비교합니다.</p>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#263033" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(Number(value) / 100000000)}억`} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ background: "#111516", border: "1px solid #334155", borderRadius: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="annualContribution" name="연간 적립액" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="annualWithdrawal" name="연간 인출액" fill="#fb7185" radius={[6, 6, 0, 0]} />
            <Bar dataKey="cashflow" name="배당/현금흐름 mock" fill="#a3e635" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
