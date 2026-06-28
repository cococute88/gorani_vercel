"use client";

import { useState } from "react";
import type { CompareSeries, RollingPoint } from "@/lib/stock-compare/types";
import { formatSignedPct } from "@/lib/stock-compare/constants";

// =============================================================
// Rolling 1Y Total Return — Heatmap.
// 행 = 시리즈, 열 = 월말 기준일. 셀 색상 강도로 Rolling 1Y TR 을 표현한다.
// Hover 정보는 Scatter 와 동일(해당 월의 4개 시리즈 값).
// RollingScatterChart 와 독립된 컴포넌트로 쉽게 제거/교체할 수 있다.
// =============================================================

interface Props {
  points: RollingPoint[];
  series: CompareSeries[];
  hidden: Record<string, boolean>;
}

// ±30% 를 최대 강도로 보는 발산형 색상(초록=양 / 빨강=음).
function cellColor(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "transparent";
  const intensity = Math.min(1, Math.abs(value) / 30);
  const alpha = 0.12 + intensity * 0.78;
  return value >= 0 ? `rgba(22,163,74,${alpha.toFixed(3)})` : `rgba(220,38,38,${alpha.toFixed(3)})`;
}

function shortLabel(date: string): string {
  return `${date.slice(2, 4)}/${date.slice(5, 7)}`;
}

export default function RollingHeatmap({ points, series, hidden }: Props) {
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const visibleSeries = series.filter((s) => !hidden[s.key]);

  if (points.length === 0) {
    return <div className="flex h-full items-center justify-center text-[12.5px] text-slate-400">Rolling 데이터가 부족합니다(최소 1년 이상 필요).</div>;
  }

  const hovered = hoverDate ? points.find((p) => p.date === hoverDate) ?? null : null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 min-h-[34px]">
        {hovered ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px]">
            <span className="font-semibold text-slate-500 dark:text-slate-400">{hovered.date}</span>
            {visibleSeries.map((s) => {
              const v = hovered[s.key as keyof RollingPoint];
              return (
                <span key={s.key} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
                  <span
                    className="num font-bold"
                    style={{ color: typeof v === "number" && v < 0 ? "#dc2626" : "#16a34a" }}
                  >
                    {typeof v === "number" ? formatSignedPct(v) : "—"}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-[11.5px] text-slate-400">셀에 마우스를 올리면 해당 월의 4개 시리즈 값이 표시됩니다.</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="inline-flex flex-col gap-1">
          {visibleSeries.map((s) => (
            <div key={s.key} className="flex items-center gap-1">
              <div className="w-24 shrink-0 truncate pr-1 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400" title={s.label}>
                {s.label}
              </div>
              <div className="flex gap-[2px]">
                {points.map((p) => {
                  const v = p[s.key as keyof RollingPoint] as number | null;
                  return (
                    <div
                      key={p.date}
                      onMouseEnter={() => setHoverDate(p.date)}
                      onMouseLeave={() => setHoverDate((cur) => (cur === p.date ? null : cur))}
                      className={`h-5 w-[10px] rounded-[2px] transition-transform ${
                        hoverDate === p.date ? "scale-y-125 ring-1 ring-blue-400" : ""
                      }`}
                      style={{ backgroundColor: cellColor(v) }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          {/* 연도 눈금(첫 달 또는 1월에만 라벨 표시). */}
          <div className="flex items-center gap-1">
            <div className="w-24 shrink-0" />
            <div className="flex gap-[2px]">
              {points.map((p, i) => {
                const isJan = p.date.slice(5, 7) === "01";
                const showLabel = i === 0 || isJan;
                return (
                  <div key={p.date} className="w-[10px] text-center text-[8px] leading-tight text-slate-400">
                    {showLabel ? shortLabel(p.date) : ""}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
