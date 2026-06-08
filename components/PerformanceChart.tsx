"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PERFORMANCE_SERIES } from "@/lib/mockData";

// 투자 성과 대형 차트: 평가액/원금 라인 + 배당/임대 막대. Recharts 사용.
export default function PerformanceChart() {
  const chartMargin = { top: 10, right: 8, left: 0, bottom: 0 };
  const axisTick = { fontSize: 11, fill: "#64748b" };
  const tooltipStyle = {
    background: "#1e2324",
    border: "1px solid #2a3336",
    borderRadius: 8,
    fontSize: 12,
    color: "#e2e8f0",
  };
  const legendStyle = { fontSize: 12, paddingTop: 8 };
  const lineDot = false as const;
  const fmtLeft = (v: number) => `${v}억`;
  const fmtRight = (v: number) => `${v}만`;

  // x축 라벨을 너무 밀지 않게 6개마다 표시
  const interval = 5;

  return (
    <div className="rounded-2xl border border-[#2a3336] bg-[#1e2324] p-5">
      <div className="mb-4 text-[15px] font-bold text-slate-100">
        💰 누적투자원금 · 평가액 · 배당금 · 임대소득
      </div>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={PERFORMANCE_SERIES} margin={chartMargin}>
            <CartesianGrid strokeDasharray="4 4" stroke="#2c3638" />
            <XAxis
              dataKey="date"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={interval}
            />
            <YAxis
              yAxisId="left"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtLeft}
              width={42}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtRight}
              width={42}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={false} />
            <Legend wrapperStyle={legendStyle} />
            <Bar
              yAxisId="right"
              dataKey="dividend"
              name="배당금"
              fill="#2dd4bf"
              barSize={5}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="rent"
              name="임대소득"
              fill="#a78bfa"
              barSize={5}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="principal"
              name="누적투자원금"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={lineDot}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="value"
              name="평가액"
              stroke="#3b82f6"
              strokeWidth={2.4}
              dot={lineDot}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
