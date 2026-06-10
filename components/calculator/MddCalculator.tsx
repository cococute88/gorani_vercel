"use client";

import MetricCard from "@/components/MetricCard";
import { mddInput, mddMetrics, mddRows, mddSeries } from "@/lib/mock-calculator-data";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function MddCalculator() {
  return (
    <div className="space-y-5">
      <div className={panel}>
        <h2 className="text-[15px] font-bold text-white">Mock 입력</h2>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <InputLabel label="티커" value={mddInput.ticker} />
          <InputLabel label="현재가" value={`$${mddInput.currentPrice}`} />
          <InputLabel label="52주 최고가" value={`$${mddInput.high52w}`} />
          <InputLabel label="52주 최저가" value={`$${mddInput.low52w}`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {mddMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">Drawdown chart</h2>
        <div className="h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mddSeries} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[-42, 0]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} formatter={(value) => [`${value}%`, "낙폭"]} />
              {[-10, -20, -30, -40].map((line) => (
                <ReferenceLine key={line} y={line} stroke="#475569" strokeDasharray="4 4" label={{ value: `${line}%`, fill: "#94a3b8", fontSize: 11 }} />
              ))}
              <Area type="monotone" dataKey="drawdown" name="낙폭" stroke="#fb7185" fill="#fb7185" fillOpacity={0.18} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">MDD 구간 mock 표</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-[13px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                <th className="py-2">구간</th>
                <th>고점일</th>
                <th>저점일</th>
                <th>MDD</th>
                <th>회복 기간</th>
              </tr>
            </thead>
            <tbody>
              {mddRows.map((row) => (
                <tr key={row.period} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                  <td className="py-2 font-semibold text-white">{row.period}</td>
                  <td>{row.highDate}</td>
                  <td>{row.lowDate}</td>
                  <td className="text-red-300">{row.mdd}</td>
                  <td>{row.recovery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
