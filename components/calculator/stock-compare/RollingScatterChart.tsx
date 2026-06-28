"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { CompareSeries, CompareSeriesKey, RollingPoint } from "@/lib/stock-compare/types";
import { formatSignedPct } from "@/lib/stock-compare/constants";

// =============================================================
// Rolling 1Y Total Return — Scatter.
// x축 = 월말 기준일, y축 = 직전 1년 누적 TR(%). 시리즈별 색상 점.
// Hover 시 해당 월의 4개 시리즈 값을 한 번에 표시한다(정보량 최소화).
// RollingHeatmap 과 완전히 독립된 컴포넌트로, 한쪽만 제거/교체 가능하다.
// =============================================================

interface Props {
  points: RollingPoint[];
  series: CompareSeries[];
  hidden: Record<string, boolean>;
  dark: boolean;
}

const SERIES_ORDER: CompareSeriesKey[] = ["a", "b", "aEx", "bEx"];

function ms(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function formatTick(value: number): string {
  const d = new Date(value);
  return `${String(d.getUTCFullYear()).slice(-2)}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function RollingScatterChart({ points, series, hidden, dark }: Props) {
  const visibleSeries = series.filter((s) => !hidden[s.key]);

  const byMs = useMemo(() => {
    const map = new Map<number, RollingPoint>();
    points.forEach((p) => map.set(ms(p.date), p));
    return map;
  }, [points]);

  const datasets = useMemo(() => {
    const out: Record<string, Array<{ x: number; y: number }>> = {};
    for (const s of visibleSeries) {
      const arr: Array<{ x: number; y: number }> = [];
      for (const p of points) {
        const v = p[s.key as keyof RollingPoint];
        if (typeof v === "number" && Number.isFinite(v)) arr.push({ x: ms(p.date), y: v });
      }
      out[s.key] = arr;
    }
    return out;
  }, [points, visibleSeries]);

  const axis = dark ? "#94a3b8" : "#64748b";
  const grid = dark ? "#2a3336" : "#e2e8f0";

  if (points.length === 0) {
    return <div className="flex h-full items-center justify-center text-[12.5px] text-slate-400">Rolling 데이터가 부족합니다(최소 1년 이상 필요).</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
        <CartesianGrid stroke={grid} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          domain={["dataMin", "dataMax"]}
          scale="time"
          tickFormatter={formatTick}
          tick={{ fill: axis, fontSize: 11 }}
          stroke={grid}
        />
        <YAxis
          type="number"
          dataKey="y"
          tickFormatter={(v: number) => `${Math.round(v)}%`}
          tick={{ fill: axis, fontSize: 11 }}
          stroke={grid}
          width={48}
        />
        <ZAxis range={[36, 36]} />
        <ReferenceLine y={0} stroke={axis} strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "#3b82f6" }}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const x = (payload[0]?.payload as { x?: number })?.x;
            if (x == null) return null;
            const point = byMs.get(x);
            if (!point) return null;
            return (
              <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur dark:border-[#2a3336] dark:bg-[#1e2324]/95">
                <div className="mb-1 font-semibold text-slate-500 dark:text-slate-400">{point.date}</div>
                <div className="space-y-0.5">
                  {visibleSeries.map((s) => {
                    const v = point[s.key as keyof RollingPoint];
                    return (
                      <div key={s.key} className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{s.label}</span>
                        </span>
                        <span
                          className="num font-bold"
                          style={{ color: typeof v === "number" && v < 0 ? "#dc2626" : "#16a34a" }}
                        >
                          {typeof v === "number" ? formatSignedPct(v) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }}
        />
        {SERIES_ORDER.filter((key) => datasets[key]?.length).map((key) => {
          const s = visibleSeries.find((d) => d.key === key)!;
          return <Scatter key={key} data={datasets[key]} fill={s.color} fillOpacity={0.78} />;
        })}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
