"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimulatorYearResult } from "@/lib/asset-simulator-types";
import { formatKoreanMoney } from "@/lib/format";

type Props = {
  data: SimulatorYearResult[];
  retirementYear: number;
};

const tooltipFormatter = (value: number | string) => formatKoreanMoney(Number(value));

export default function SimulatorBalanceChart({ data, retirementYear }: Props) {
  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4">
        <h2 className="text-base font-extrabold text-white">잔고 추이</h2>
        <p className="mt-1 text-[13px] text-slate-400">명목/실질 총자산과 계좌별 잔고를 함께 확인합니다.</p>
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#263033" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(Number(value) / 100000000)}억`} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ background: "#111516", border: "1px solid #334155", borderRadius: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine x={retirementYear} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "은퇴", fill: "#fbbf24", fontSize: 12 }} />
            <Line type="monotone" dataKey="nominalTotal" name="총자산 명목" stroke="#60a5fa" strokeWidth={2.4} dot={false} />
            <Line type="monotone" dataKey="realTotal" name="총자산 실질" stroke="#22c55e" strokeWidth={2.2} strokeDasharray="6 4" dot={false} />
            <Line type="monotone" dataKey="pensionBalance" name="연금저축" stroke="#f59e0b" strokeWidth={1.8} dot={false} />
            <Line type="monotone" dataKey="isaBalance" name="ISA" stroke="#a78bfa" strokeWidth={1.8} dot={false} />
            <Line type="monotone" dataKey="taxableBalance" name="위탁계좌" stroke="#f472b6" strokeWidth={1.8} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
