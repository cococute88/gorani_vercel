"use client";

import { MARKET_RSI_TREND } from "@/lib/mock-market-data";
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

export default function MarketRsiChart() {
  return (
    <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-white">RSI 추이</h2>
        <span className="text-[12px] text-slate-500">QQQ · SCHD · SPY mock</span>
      </div>
      <div className="h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={MARKET_RSI_TREND} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[20, 80]} />
            <Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} />
            <ReferenceLine y={30} stroke="#60a5fa" strokeDasharray="4 4" label={{ value: "30", fill: "#60a5fa", fontSize: 11 }} />
            <ReferenceLine y={70} stroke="#fb7185" strokeDasharray="4 4" label={{ value: "70", fill: "#fb7185", fontSize: 11 }} />
            <Line type="monotone" dataKey="QQQ" stroke="#60a5fa" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="SCHD" stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="SPY" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
