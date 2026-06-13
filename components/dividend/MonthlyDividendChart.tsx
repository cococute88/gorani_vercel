"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyDividendPoint } from "@/lib/mock-dividend-data";
import {
  AXIS_LINE,
  AXIS_TICK,
  AXIS_TICK_SM,
  CHART_GRID,
  CHART_MARGIN,
  TOOLTIP_CURSOR_FILL,
  TOOLTIP_STYLE,
} from "@/lib/chart-style";

interface Props {
  data: MonthlyDividendPoint[];
  tickers: string[];
  afterTax: boolean;
  includeTaxable: boolean;
  includeTaxAdvantaged: boolean;
  onToggleTaxable: (checked: boolean) => void;
  onToggleTaxAdvantaged: (checked: boolean) => void;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

function krwShort(v: number): string {
  if (v >= 10000) return `${Math.round(v / 10000)}만`;
  return `${v}`;
}

function tooltipFormatter(value: number, name: string): [string, string] {
  return [`₩ ${Math.round(value).toLocaleString("ko-KR")}`, name];
}

// 월별 예상 배당금 막대 차트 (세전/세후 반영) + 종목별 stacked 구성.
export default function MonthlyDividendChart({
  data,
  tickers,
  afterTax,
  includeTaxable,
  includeTaxAdvantaged,
  onToggleTaxable,
  onToggleTaxAdvantaged,
}: Props) {
  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-slate-300">월별 예상 배당금 구성</h2>
            <p className="mt-1 text-[12px] text-slate-500">상위 배당 티커 기준 stacked composition</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-1.5 text-[12.5px] text-slate-300">
              <input
                type="checkbox"
                checked={includeTaxable}
                onChange={(event) => onToggleTaxable(event.target.checked)}
                className="h-3.5 w-3.5 accent-blue-600"
              />
              <span className="break-keep">위탁</span>
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-slate-300">
              <input
                type="checkbox"
                checked={includeTaxAdvantaged}
                onChange={(event) => onToggleTaxAdvantaged(event.target.checked)}
                className="h-3.5 w-3.5 accent-blue-600"
              />
              <span className="break-keep">절세</span>
            </label>
            <span className="text-[12px] text-slate-500">{afterTax ? "세후 기준" : "세전 기준"}</span>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis tickFormatter={krwShort} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={44} />
              <Tooltip cursor={TOOLTIP_CURSOR_FILL} contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              {tickers.map((ticker, index) => (
                <Bar key={ticker} dataKey={ticker} stackId="dividend" fill={COLORS[index % COLORS.length]} radius={index === tickers.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
