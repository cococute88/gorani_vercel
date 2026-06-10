"use client";

import MetricCard from "@/components/MetricCard";
import { conversionInput, conversionMetrics, conversionRows, conversionSeries } from "@/lib/mock-calculator-data";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function ConversionCalculator() {
  return (
    <div className="space-y-5">
      <div className={panel}>
        <h2 className="text-[15px] font-bold text-white">Mock 입력</h2>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-5">
          <InputLabel label="매도 티커" value={conversionInput.sellTicker} />
          <InputLabel label="매수 티커" value={conversionInput.buyTicker} />
          <InputLabel label="매도 수량" value={`${conversionInput.sellShares}주`} />
          <InputLabel label="매도 단가" value={`$${conversionInput.sellPrice}`} />
          <InputLabel label="매수 단가" value={`$${conversionInput.buyPrice}`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {conversionMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">전환비 추이</h2>
        <div className="h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={conversionSeries} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[1.1, 1.42]} />
              <Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} />
              <ReferenceLine y={1.28} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "평균", fill: "#f59e0b", fontSize: 12 }} />
              <Line type="monotone" dataKey="ratio" name="전환비" stroke="#60a5fa" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">상세 mock 표</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-left text-[13px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                <th className="py-2">월</th>
                <th>매도 가격</th>
                <th>매수 가격</th>
                <th>전환비</th>
                <th>신호</th>
              </tr>
            </thead>
            <tbody>
              {conversionRows.map((row) => (
                <tr key={row.month} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                  <td className="py-2 font-semibold text-white">{row.month}</td>
                  <td>{row.sellPrice}</td>
                  <td>{row.buyPrice}</td>
                  <td>{row.ratio}</td>
                  <td className={row.signal === "전환 우위" ? "text-green-400" : "text-slate-400"}>{row.signal}</td>
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
