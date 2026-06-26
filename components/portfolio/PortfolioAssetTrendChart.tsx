"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatWon } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import { buildPortfolioAssetTrend } from "@/lib/portfolio-asset-trend";
import {
  AXIS_LINE,
  AXIS_TICK_SM,
  CHART_GRID,
  CHART_MARGIN,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from "@/lib/chart-style";

interface Props {
  snapshots: PortfolioSnapshot[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";
const LEGEND_WRAPPER = { fontSize: 12, paddingTop: 8 };

function eokFmt(v: number): string {
  return `${(v / 100000000).toFixed(1)}억`;
}

// 누적 영역(stacked area)의 누적 위치 라벨을 자산군별로 보여주는 hovermode="x unified" 툴팁.
function UnifiedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string; name?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  // 스택 위쪽(=큰 자산군)부터 보이도록 역순으로 표시한다 (원본 legend traceorder="reversed").
  const rows = [...payload].reverse();
  return (
    <div style={{ ...TOOLTIP_STYLE, padding: "8px 10px" }}>
      <div style={{ ...TOOLTIP_LABEL_STYLE, marginBottom: 6 }}>{label}</div>
      {rows.map((row) => (
        <div
          key={String(row.dataKey)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "1px 0" }}
        >
          <span
            style={{ width: 9, height: 9, borderRadius: 2, background: row.color, flexShrink: 0 }}
          />
          <span style={{ flex: 1 }}>{row.name}</span>
          <span style={{ fontWeight: 600 }}>{formatWon(row.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

// 원본 Streamlit "📈 월별 자산 추이" (original/pages_app/2_asset_tracker.py) 복원.
// 자산군 타입을 누적 영역으로 쌓고, 같은 화면 도넛과 동일한 분류·색·정렬을 공유한다.
export default function PortfolioAssetTrendChart({ snapshots }: Props) {
  const { series, points } = useMemo(
    () => buildPortfolioAssetTrend(snapshots),
    [snapshots],
  );

  // 범례는 큰 자산군부터(원본 legend traceorder="reversed"). series 는 이미 합계 내림차순.
  const legendPayload = series.map((s) => ({
    value: s.label,
    type: "square" as const,
    id: s.key,
    color: s.color,
  }));

  return (
    <div className={card}>
      <h2 className="mb-1 text-[15px] font-bold text-slate-300">📈 월별 자산 추이</h2>
      <p className="mb-4 text-[12px] text-slate-500">
        x축: 월(스냅샷 기준) · 자산군별 평가금액 누적
      </p>
      <div className="h-[400px] w-full">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-slate-500">
            데이터를 추가하면 월별 자산 추이 그래프가 나타납니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK_SM}
                tickLine={false}
                axisLine={AXIS_LINE}
                minTickGap={12}
              />
              <YAxis
                tickFormatter={eokFmt}
                tick={AXIS_TICK_SM}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<UnifiedTooltip />} />
              <Legend wrapperStyle={LEGEND_WRAPPER} payload={legendPayload} />
              {/* 작은 자산군부터 선언해 바닥에 깔고, 큰 자산군이 위로 쌓이게 한다
                  (원본은 reversed(tag_list) 로 trace 추가 → 큰 그룹이 위). */}
              {[...series].reverse().map((s) => (
                <Area
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stackId="assets"
                  stroke={s.color}
                  strokeWidth={2}
                  fill={s.color}
                  fillOpacity={1}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
