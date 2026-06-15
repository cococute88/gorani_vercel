"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
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

const VIX_THRESHOLDS = { high: 30, watch: 20 } as const;

interface Props {
  data: SeriesPoint[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const REF_LABEL = { fill: "#94a3b8", fontSize: 11 };

// VIX 기준선이 항상 보이도록 데이터 범위와 임계값을 함께 감싸는 y축 도메인을 만든다.
function buildVixDomain(data: SeriesPoint[]): [number, number] {
  let max: number = VIX_THRESHOLDS.high + 2;
  let min: number = VIX_THRESHOLDS.watch;
  for (const point of data) {
    const v = Number(point.VIX);
    if (Number.isFinite(v)) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
  }
  return [Math.floor(min / 5) * 5, Math.ceil(max / 5) * 5];
}

// VIX 참고 그래프
export default function VixChart({ data }: Props) {
  const [yMin, yMax] = buildVixDomain(data);
  // 도메인 양 끝이 5의 배수라 5단위 눈금(10/15/20/...) 으로 깔끔하게 떨어진다.
  const yTickCount = (yMax - yMin) / 5 + 1;

  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-[15px] font-bold text-slate-300">VIX (변동성 지수)</h2><span className="text-[12px] text-slate-500">Yahoo Finance</span></div>
        {data.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-[13px] text-slate-500">VIX 데이터를 조회할 수 없습니다.</div>
        ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="vixFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
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
                domain={[yMin, yMax]}
                tickCount={yTickCount}
                allowDecimals={false}
                tick={AXIS_TICK_SM}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <ReferenceLine
                y={VIX_THRESHOLDS.high}
                stroke="#e5484d"
                strokeDasharray="4 4"
                label={{ value: `높은 변동성 ${VIX_THRESHOLDS.high}`, position: "insideTopLeft", ...REF_LABEL }}
              />
              <ReferenceLine
                y={VIX_THRESHOLDS.watch}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: `변동성 주의 ${VIX_THRESHOLDS.watch}`, position: "insideTopLeft", ...REF_LABEL }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="VIX" stroke="#8b5cf6" strokeWidth={2} fill="url(#vixFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </section>
  );
}
