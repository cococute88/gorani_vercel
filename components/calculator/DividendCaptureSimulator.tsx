"use client";

import MetricCard from "@/components/MetricCard";
import {
  dividendCaptureInput,
  dividendCaptureMetrics,
  dividendCaptureRows,
  dividendCaptureScatter,
} from "@/lib/mock-calculator-data";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function DividendCaptureSimulator() {
  return (
    <div className="space-y-5">
      <div className={panel}>
        <h2 className="text-[15px] font-bold text-white">Mock 입력</h2>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-5">
          <InputLabel label="티커" value={dividendCaptureInput.ticker} />
          <InputLabel label="보유 수량" value={`${dividendCaptureInput.shares}주`} />
          <InputLabel label="주당 배당" value={`$${dividendCaptureInput.dividendPerShare}`} />
          <InputLabel label="세율" value={`${dividendCaptureInput.taxRate}%`} />
          <InputLabel label="예상 배당락" value={`${dividendCaptureInput.expectedDropPct}%`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {dividendCaptureMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">성공/실패 분포</h2>
        <div className="h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="recoveryDays" name="회복일" unit="일" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis dataKey="profitPct" name="수익률" unit="%" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} />
              <Scatter data={dividendCaptureScatter} name="회차">
                {dividendCaptureScatter.map((entry) => (
                  <Cell key={entry.round} fill={entry.result === "성공" ? "#22c55e" : "#ef4444"} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ResultTable />
    </div>
  );
}

function InputLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3">
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-100">{value}</div>
    </div>
  );
}

function ResultTable() {
  return (
    <div className={panel}>
      <h2 className="mb-4 text-[15px] font-bold text-white">회차별 mock 결과</h2>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-[13px]">
          <thead className="text-slate-500">
            <tr className="border-b border-[#2a3336]">
              <th className="py-2">회차</th>
              <th>배당락일</th>
              <th>배당금</th>
              <th>회복일</th>
              <th>수익률</th>
              <th>손익분기</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {dividendCaptureRows.map((row) => (
              <tr key={row.round} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                <td className="py-2 font-semibold text-white">{row.round}</td>
                <td>{row.exDate}</td>
                <td>{row.dividend}</td>
                <td>{row.recoveryDays}일</td>
                <td>{row.profitPct}%</td>
                <td>{row.breakeven}</td>
                <td className={row.result === "성공" ? "text-green-400" : "text-red-400"}>{row.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
