"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/market-data";
import {
  AXIS_LINE,
  AXIS_TICK_SM,
  CHART_GRID,
  CHART_MARGIN,
  TOOLTIP_STYLE,
  formatChartMonthTick,
} from "@/lib/chart-style";

interface Props {
  rsi: SeriesPoint[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
// 원본 Streamlit 워치리스트(QQQ/SCHD/SPY)와 동일한 색상.
const WATCHLIST = ["QQQ", "SCHD", "SPY"] as const;
const TICKER_COLORS: Record<string, string> = { QQQ: "#3b82f6", SCHD: "#22c55e", SPY: "#f59e0b" };
const LEGEND_WRAPPER = { fontSize: 11, paddingTop: 6 };

// RSI 14 추이 차트. (RSI 카드는 시장 지수 섹션으로 대체되었고, 추이 차트만 유지한다.)
export default function MarketRsiTrendChart({ rsi }: Props) {
  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-bold text-slate-300">RSI 14 추이</h3>
          <span className="text-[12px] text-slate-500">과매수 70 · 과매도 30</span>
        </div>
        <div className="h-[300px] w-full">
          {rsi.length === 0 ? <div className="flex h-full items-center justify-center text-[13px] text-slate-500">RSI 추이 데이터를 조회할 수 없습니다.</div> : <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rsi} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK_SM}
                tickLine={false}
                axisLine={AXIS_LINE}
                minTickGap={28}
                tickFormatter={formatChartMonthTick}
              />
              <YAxis domain={[0, 100]} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={32} />
              <ReferenceLine y={70} stroke="#e5484d" strokeDasharray="4 4" />
              <ReferenceLine y={30} stroke="#3b82f6" strokeDasharray="4 4" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_WRAPPER} />
              {WATCHLIST.map((t) => (
                <Line key={t} type="monotone" dataKey={t} stroke={TICKER_COLORS[t]} strokeWidth={1.8} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>}
        </div>
      </div>
    </section>
  );
}
