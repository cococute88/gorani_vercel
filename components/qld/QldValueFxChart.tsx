"use client";

import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
  Label,
  TooltipProps,
} from "recharts";
import {
  QLD_VALUE_FX_SERIES,
  QLD_CHART_ANNOTATIONS,
  QLD_PERIOD_BUTTONS,
  QLD_SUMMARY,
  QLD_COLORS,
} from "@/lib/qldDashboardData";

const won = (v: number) => v.toLocaleString("ko-KR");

// 차트 prop으로 쓰는 객체는 상수로 분리 (JSX 인라인 객체 리터랄 회피)
const chartMargin = { top: 24, right: 8, left: 4, bottom: 0 };
const axisTick = { fontSize: 10.5, fill: "#5b6479" };
const tooltipCursor = { stroke: "#3a4256", strokeWidth: 1 };
const areaActiveDot = { r: 3, fill: QLD_COLORS.qld, stroke: "#0b0d13", strokeWidth: 1.5 };
const valueDomain: [string, string] = ["dataMin - 4000000", "dataMax + 4000000"];
const fxDomain: [string, string] = ["dataMin - 6", "dataMax + 6"];

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload.find((p) => p.dataKey === "value")?.value as number | undefined;
  const fx = payload.find((p) => p.dataKey === "fx")?.value as number | undefined;
  return (
    <div className="rounded-lg border border-[#2a3142] bg-[#161a25] px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 text-[11px] text-slate-400">{label}</div>
      {value !== undefined && (
        <div className="num flex items-center justify-between gap-4 text-slate-100">
          <span className="text-slate-400">평가금액</span>
          <span className="font-semibold">{won(value)}원</span>
        </div>
      )}
      {fx !== undefined && (
        <div className="num flex items-center justify-between gap-4 text-slate-100">
          <span className="text-slate-400">환율</span>
          <span className="font-semibold">{fx.toLocaleString("ko-KR")}</span>
        </div>
      )}
    </div>
  );
}

// 스크린샷 1 오른쪽 카드: 평가금액 area/line + 환율 line 복합 차트 + 기간 버튼 + annotation + 요약
export default function QldValueFxChart({ compact = false }: { compact?: boolean } = {}) {
  const [period, setPeriod] = useState<string>("1일");
  const data = QLD_VALUE_FX_SERIES;
  const s = QLD_SUMMARY;

  const { mddStartIndex, lowIndex, highIndex } = QLD_CHART_ANNOTATIONS;
  const mddStart = data[mddStartIndex];
  const low = data[lowIndex];
  const high = data[highIndex];

  const fmtValueAxis = (v: number) => `${(v / 100_000_000).toFixed(2)}억`;
  const fmtFxAxis = (v: number) => v.toFixed(0);

  const summaryCards: Array<{ label: string; value: string; sub?: string; tone: "up" | "down" | "neutral" }> = [
    { label: "최고점", value: `${won(s.high)}원`, sub: s.highAt, tone: "neutral" },
    { label: "최저점", value: `${won(s.low)}원`, sub: s.lowAt, tone: "neutral" },
    { label: "MDD", value: `${s.mdd.toFixed(2)}%`, sub: `${s.mddRange} · ${won(s.mddAmount)}`, tone: "down" },
    { label: "현재/최고", value: `${s.currentOverHigh.toFixed(2)}%`, sub: "최고 대비", tone: "down" },
    { label: "현재/최저", value: `${s.currentOverLow.toFixed(2)}%`, sub: "최저 대비", tone: "up" },
  ];

  return (
    <div className={`flex h-full flex-col rounded-[18px] border border-[#242938] bg-[#12151e] ${compact ? "p-3" : "p-5"}`}>
      <div className={`${compact ? "mb-2" : "mb-3"} flex flex-wrap items-center justify-between gap-2`}>
        <span className="text-[15px] font-bold text-slate-100">총 평가금액 및 환율 추이</span>
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#0c0e16] p-1">
          {QLD_PERIOD_BUTTONS.map((p) => {
            const active = period === p;
            const btnCls = active
              ? "bg-[#5b7cff] text-white"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200";
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md ${compact ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-1 text-[11.5px]"} font-medium transition-colors ${btnCls}`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${compact ? "h-[210px]" : "h-[300px]"} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={chartMargin}>
            <defs>
              <linearGradient id="qldValueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={QLD_COLORS.qld} stopOpacity={0.35} />
                <stop offset="100%" stopColor={QLD_COLORS.qld} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2233" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={5}
              minTickGap={20}
            />
            <YAxis
              yAxisId="value"
              domain={valueDomain}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtValueAxis}
              width={52}
            />
            <YAxis
              yAxisId="fx"
              orientation="right"
              domain={fxDomain}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtFxAxis}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} cursor={tooltipCursor} />

            <Area
              yAxisId="value"
              type="monotone"
              dataKey="value"
              stroke={QLD_COLORS.qld}
              strokeWidth={2}
              fill="url(#qldValueFill)"
              dot={false}
              activeDot={areaActiveDot}
            />
            <Line
              yAxisId="fx"
              type="monotone"
              dataKey="fx"
              stroke={QLD_COLORS.fxLine}
              strokeWidth={1.4}
              dot={false}
              strokeDasharray="4 3"
            />

            <ReferenceLine yAxisId="value" x={mddStart.label} stroke="#fb923c" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceDot yAxisId="value" x={mddStart.label} y={mddStart.value} r={4} fill="#fb923c" stroke="#0b0d13" strokeWidth={1.5}>
              <Label value="MDD 시작" position="top" fill="#fb923c" fontSize={10.5} />
            </ReferenceDot>

            <ReferenceDot yAxisId="value" x={low.label} y={low.value} r={4} fill="#fb4668" stroke="#0b0d13" strokeWidth={1.5}>
              <Label value="저점" position="bottom" fill="#fb4668" fontSize={10.5} />
            </ReferenceDot>

            <ReferenceDot yAxisId="value" x={high.label} y={high.value} r={4} fill="#34d399" stroke="#0b0d13" strokeWidth={1.5}>
              <Label value="고점" position="top" fill="#34d399" fontSize={10.5} />
            </ReferenceDot>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className={`${compact ? "mt-2" : "mt-4"} grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5`}>
        {summaryCards.map((c) => {
          const toneCls =
            c.tone === "up" ? "text-emerald-400" : c.tone === "down" ? "text-rose-400" : "text-slate-100";
          return (
            <div key={c.label} className={`min-w-0 rounded-xl border border-[#1f2433] bg-[#0e111a] ${compact ? "px-2 py-1.5" : "px-2 py-2 sm:px-3 sm:py-2.5"}`}>
              <div className="break-keep text-[11px] text-slate-500">{c.label}</div>
              <div className={`num mt-0.5 break-keep font-bold leading-tight ${compact ? "text-[11px] sm:text-[12px]" : "text-[12px] sm:text-[14px]"} ${toneCls}`}>{c.value}</div>
              {c.sub && <div className="num mt-0.5 truncate text-[10px] text-slate-600">{c.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
