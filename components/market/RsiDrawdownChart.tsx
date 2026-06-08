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
import { TEMPERATURE_TICKERS } from "@/lib/mock-market-data";
import {
  AXIS_LINE,
  AXIS_TICK_SM,
  CHART_GRID,
  CHART_MARGIN,
  SERIES_COLORS,
  TOOLTIP_STYLE,
} from "@/lib/chart-style";

interface Props {
  rsi: SeriesPoint[];
  drawdown: SeriesPoint[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const LEGEND_WRAPPER = { fontSize: 11, paddingTop: 6 };

// 종목별 RSI / 하락률 라인 차트 (기간 선택은 상위 MarketPage 에서 반영)
export default function RsiDrawdownChart({ rsi, drawdown }: Props) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className={card}>
        <h2 className="mb-4 text-[15px] font-bold text-slate-300">RSI (14)</h2>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rsi} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} minTickGap={28} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={32} />
              <ReferenceLine y={70} stroke="#e5484d" strokeDasharray="4 4" />
              <ReferenceLine y={30} stroke="#3b82f6" strokeDasharray="4 4" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_WRAPPER} />
              {TEMPERATURE_TICKERS.map((t, i) => (
                <Line key={t} type="monotone" dataKey={t} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={1.6} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-4 text-[15px] font-bold text-slate-300">52주 고점 대비 하락률 (%)</h2>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={drawdown} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} minTickGap={28} />
              <YAxis tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_WRAPPER} />
              {TEMPERATURE_TICKERS.map((t, i) => (
                <Line key={t} type="monotone" dataKey={t} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={1.6} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
