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
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import type { PerformanceSnapshotPoint } from "@/lib/performance-from-snapshots";
import { formatWon } from "@/lib/format";

// 투자 성과 대형 차트: 평가액/원금 라인 + 배당 막대. Recharts 사용.
// PORTFOLIO-PERF-UI-1: 임대소득(rent)은 차트/범례에서 더 이상 렌더링하지 않는다
// (저장 데이터 필드는 유지). 라이트/다크 테마 모두 가독성을 보장한다.
type Props = {
  data: PerformanceSnapshotPoint[];
  sourceLabel: string;
  dividendNote?: string;
  emptyMessage?: string;
};

type ChartPoint = {
  date: string;
  label: string;
  evaluationKRW: number | null;
  principalKRW: number | null;
  dividendKRW: number | null;
};

const chartMargin = { top: 10, right: 8, left: 0, bottom: 4 };
const lineDot = false as const;

function fmtEok(v: number) {
  return `${(v / 100000000).toFixed(1)}억`;
}

function fmtMan(v: number) {
  return `${Math.round(v / 10000).toLocaleString("ko-KR")}만`;
}

function tooltipFormatter(value: number, name: string): [string, string] {
  return [formatWon(value), name];
}

export default function PerformanceChart({
  data,
  sourceLabel,
  dividendNote,
  emptyMessage,
}: Props) {
  const isLight = useResolvedTheme() === "light";
  const chartData: ChartPoint[] = data;

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

  // x축 라벨을 너무 밀지 않게 데이터 개수에 따라 표시 간격을 조정한다.
  const interval = chartData.length > 24 ? 5 : chartData.length > 12 ? 2 : 0;

  const containerCls = isLight
    ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    : "rounded-2xl border border-[#2a3336] bg-[#1e2324] p-5";
  const titleCls = isLight ? "text-slate-800" : "text-slate-100";
  const sourceCls = isLight
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : "border-[#2a3336] bg-[#171b1c] text-slate-400";

  return (
    <div className={containerCls}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className={`text-[15px] font-bold ${titleCls}`}>💰 누적투자원금 · 평가액 · 배당금</div>
          {dividendNote && <div className="mt-1 text-[12px] text-slate-500">{dividendNote}</div>}
        </div>
        <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${sourceCls}`}>
          {sourceLabel}
        </span>
      </div>
      <div className="h-[400px] w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-slate-500">
            {emptyMessage ?? "표시할 스냅샷 히스토리가 없습니다."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} />
              <XAxis
                dataKey="label"
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
                tickFormatter={fmtEok}
                width={48}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtMan}
                width={46}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={false} formatter={tooltipFormatter} />
              <Legend wrapperStyle={legendStyle} />
              <Bar
                yAxisId="right"
                dataKey="dividendKRW"
                name="배당금"
                fill="#2dd4bf"
                barSize={5}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="principalKRW"
                name="누적투자원금"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={lineDot}
                connectNulls
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="evaluationKRW"
                name="평가액"
                stroke="#3b82f6"
                strokeWidth={2.4}
                dot={lineDot}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
