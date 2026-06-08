"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
  afterTax: boolean;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function krwShort(v: number): string {
  if (v >= 10000) return `${Math.round(v / 10000)}\ub9cc`;
  return `${v}`;
}

function tooltipFormatter(value: number): [string, string] {
  return [`\u20a9 ${Math.round(value).toLocaleString("ko-KR")}`, "예상 배당"];
}

// 월별 예상 배당금 막대 차트 (세전/세후 반영)
export default function MonthlyDividendChart({ data, afterTax }: Props) {
  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-300">월별 예상 배당금</h2>
          <span className="text-[12px] text-slate-500">{afterTax ? "세후 기준" : "세전 기준"}</span>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis tickFormatter={krwShort} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={44} />
              <Tooltip cursor={TOOLTIP_CURSOR_FILL} contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
