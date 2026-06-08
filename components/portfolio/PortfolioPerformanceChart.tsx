"use client";

import {
  CartesianGrid,
  ComposedChart,
  Area,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatWon } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import {
  AXIS_LINE,
  AXIS_TICK_SM,
  CHART_GRID,
  CHART_MARGIN,
  TOOLTIP_STYLE,
} from "@/lib/chart-style";

interface Props {
  snapshots: PortfolioSnapshot[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const LEGEND_WRAPPER = { fontSize: 12, paddingTop: 8 };

function eokFmt(v: number): string {
  return `${(v / 100000000).toFixed(1)}\uc5b5`;
}
function tooltipFormatter(value: number, name: string): [string, string] {
  return [formatWon(value), name];
}

// 누적입금(투자원금) 대비 포트폴리오 평가금액 선그래프 (+ 수익률 보조)
export default function PortfolioPerformanceChart({ snapshots }: Props) {
  const data = [...snapshots]
    .sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1))
    .map((s) => ({
      date: s.snapshotDate,
      principal: s.investmentPrincipalKRW,
      value: s.investmentValueKRW,
      returnPct: s.returnPct,
    }));

  return (
    <div className={card}>
      <h2 className="mb-1 text-[15px] font-bold text-slate-300">누적입금 대비 포트폴리오 가치</h2>
      <p className="mb-4 text-[12px] text-slate-500">x축: 스냅샷 날짜 · 투자원금 vs 평가금액 (수익률 보조축)</p>
      <div className="h-[320px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-slate-500">
            등록된 스냅샷이 없어 차트를 표시할 수 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} minTickGap={24} />
              <YAxis yAxisId="left" tickFormatter={eokFmt} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={48} />
              <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={40} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
              <Legend wrapperStyle={LEGEND_WRAPPER} />
              <Area yAxisId="left" type="monotone" dataKey="value" name="평가금액" stroke="#3b82f6" strokeWidth={2.2} fill="url(#pvFill)" />
              <Line yAxisId="left" type="monotone" dataKey="principal" name="투자원금" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="returnPct" name="수익률(%)" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
