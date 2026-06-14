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
  drawdown: SeriesPoint[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const WATCHLIST = ["QQQ", "SCHD", "SPY"] as const;
const TICKER_COLORS: Record<string, string> = { QQQ: "#3b82f6", SCHD: "#22c55e", SPY: "#f59e0b" };
const LEGEND_WRAPPER = { fontSize: 11, paddingTop: 6 };

// 0% 를 위쪽 기준선으로 두고, 가장 깊은 낙폭을 5% 단위로 내림한 y축 하한을 만든다.
// (도메인 하한이 항상 5의 배수라 recharts 자동 눈금이 0/-5/-10/... 로 정렬된다.)
function buildDrawdownFloor(drawdown: SeriesPoint[]): number {
  let min = 0;
  for (const point of drawdown) {
    for (const ticker of WATCHLIST) {
      const v = Number(point[ticker]);
      if (Number.isFinite(v) && v < min) min = v;
    }
  }
  return Math.min(-5, Math.floor(min / 5) * 5); // 예: -18.4 → -20, 데이터가 얕아도 최소 -5
}

// MDD 섹션: 현재 고점 대비 하락률 카드(QQQ/SCHD/SPY) + 하락률 추이 차트.
export default function MarketMddSection({ temps, drawdown }: Props) {
  const byTicker = new Map(temps.map((t) => [t.ticker, t]));
  const ddFloor = buildDrawdownFloor(drawdown);

  return (
    <section className="mb-6 space-y-4">
      <h2 className="text-[15px] font-bold text-slate-300">고점 대비 하락률 (MDD)</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {WATCHLIST.map((ticker) => {
          const t = byTicker.get(ticker);
          return (
            <div key={ticker} className={card}>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-white">{ticker}</span>
                <span className="text-[12px] text-slate-500">52주 고점대비</span>
              </div>
              <div className="num mt-2 text-[26px] font-extrabold text-blue-400">
                {t ? `${t.drawdownPct.toFixed(1)}%` : "N/A"}
              </div>
              <div className="mt-1 text-[11.5px] text-slate-500">현재 낙폭</div>
            </div>
          );
        })}
      </div>

      <div className={card}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-bold text-slate-300">고점 대비 하락률 추이 (%)</h3>
          <span className="text-[12px] text-slate-500">0% 기준 · 기준선 -10 · -20</span>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={drawdown} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK_SM}
                tickLine={false}
                axisLine={AXIS_LINE}
                minTickGap={28}
                tickFormatter={formatChartMonthTick}
              />
              <YAxis
                domain={[ddFloor, 0]}
                tickCount={Math.abs(ddFloor) / 5 + 1}
                allowDecimals={false}
                tickFormatter={(v: number) => `${v}%`}
                tick={AXIS_TICK_SM}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <ReferenceLine y={0} stroke="#8b95a1" />
              <ReferenceLine y={-10} stroke="#8b95a1" strokeDasharray="3 3" />
              <ReferenceLine y={-20} stroke="#8b95a1" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number | string) => `${Number(value).toFixed(1)}%`}
              />
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
