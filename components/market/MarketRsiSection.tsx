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
import type { EtfTemperature, SeriesPoint } from "@/lib/market-data";
import {
  AXIS_LINE,
  AXIS_TICK_SM,
  CHART_GRID,
  CHART_MARGIN,
  TOOLTIP_STYLE,
  formatChartMonthTick,
} from "@/lib/chart-style";

interface Props {
  temps: EtfTemperature[];
  rsi: SeriesPoint[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
// 원본 Streamlit 워치리스트(QQQ/SCHD/SPY)와 동일한 색상.
const WATCHLIST = ["QQQ", "SCHD", "SPY"] as const;
const TICKER_COLORS: Record<string, string> = { QQQ: "#3b82f6", SCHD: "#22c55e", SPY: "#f59e0b" };
const LEGEND_WRAPPER = { fontSize: 11, paddingTop: 6 };

function rsiState(rsi: number): { label: string; cls: string } {
  if (rsi >= 70) return { label: "과매수", cls: "text-red-400" };
  if (rsi <= 30) return { label: "과매도", cls: "text-blue-400" };
  return { label: "중립", cls: "text-slate-300" };
}

// RSI 섹션: 현재 RSI 카드(QQQ/SCHD/SPY) + RSI 14 추이 차트.
export default function MarketRsiSection({ temps, rsi }: Props) {
  const byTicker = new Map(temps.map((t) => [t.ticker, t]));

  return (
    <section className="mb-6 space-y-4">
      <h2 className="text-[15px] font-bold text-slate-300">RSI (14)</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {WATCHLIST.map((ticker) => {
          const t = byTicker.get(ticker);
          const state = t ? rsiState(t.rsi) : null;
          return (
            <div key={ticker} className={card}>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-white">{ticker}</span>
                {state && <span className={`text-[12px] font-semibold ${state.cls}`}>{state.label}</span>}
              </div>
              <div className="num mt-2 text-[26px] font-extrabold text-white">{t ? t.rsi : "N/A"}</div>
              <div className="mt-1 text-[11.5px] text-slate-500">현재 RSI 14</div>
            </div>
          );
        })}
      </div>

      <div className={card}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-bold text-slate-300">RSI 14 추이</h3>
          <span className="text-[12px] text-slate-500">과매수 70 · 과매도 30</span>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
