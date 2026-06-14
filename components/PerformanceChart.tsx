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
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

// 투자 성과 대형 차트: 평가액/원금 라인 + 배당 막대. Recharts 사용.
// PORTFOLIO-PERF-UI-1: 임대소득(rent)은 차트/범례에서 더 이상 렌더링하지 않는다
// (저장 데이터 필드는 유지). 라이트/다크 테마 모두 가독성을 보장한다.
export default function PerformanceChart() {
  const isLight = useResolvedTheme() === "light";

  const chartMargin = { top: 10, right: 8, left: 0, bottom: 4 };
  const axisTick = { fontSize: 11, fill: isLight ? "#64748b" : "#94a3b8" };
  const gridStroke = isLight ? "#e2e8f0" : "#2c3638";
  const tooltipStyle = {
    background: isLight ? "#ffffff" : "#1e2324",
    border: `1px solid ${isLight ? "#e2e8f0" : "#2a3336"}`,
    borderRadius: 8,
    fontSize: 12,
    color: isLight ? "#1e293b" : "#e2e8f0",
  };
  const legendStyle = { fontSize: 12, paddingTop: 8 };
  const lineDot = false as const;
  const fmtLeft = (v: number) => `${v}억`;
  const fmtRight = (v: number) => `${v}만`;

  // x축 라벨을 너무 밀지 않게 6개마다 표시
  const interval = 5;

  const containerCls = isLight
    ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    : "rounded-2xl border border-[#2a3336] bg-[#1e2324] p-5";
  const titleCls = isLight ? "text-slate-800" : "text-slate-100";

  return (
    <div className={containerCls}>
      <div className={`mb-4 text-[15px] font-bold ${titleCls}`}>
        💰 누적투자원금 · 평가액 · 배당금
      </div>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={PERFORMANCE_SERIES} margin={chartMargin}>
            <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} />
            <XAxis
              dataKey="date"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={interval}
              minTickGap={24}
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
