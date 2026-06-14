"use client";

import {
  ComposedChart,
  Area,
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
import type { PerformanceQldResult } from "@/lib/performance-qld-from-snapshots";

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
const moneyOrDash = (v: number | null) => (v === null ? "—" : won(v));
const pctOrDash = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const dateOrDash = (v: string | null) => v ?? "—";

// 차트 prop으로 쓰는 객체는 상수로 분리 (JSX 인라인 객체 리터랄 회피)
const chartMargin = { top: 24, right: 8, left: 4, bottom: 0 };
const axisTick = { fontSize: 10.5, fill: "#5b6479" };
const tooltipCursor = { stroke: "#3a4256", strokeWidth: 1 };
const valueColor = "#5b7cff";
const areaActiveDot = { r: 3, fill: valueColor, stroke: "#0b0d13", strokeWidth: 1.5 };
const valueDomain: [string, string] = ["dataMin - 4000000", "dataMax + 4000000"];

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload.find((p) => p.dataKey === "valueKRW")?.value as number | undefined;
  return (
    <div className="rounded-lg border border-[#2a3142] bg-[#161a25] px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 text-[11px] text-slate-400">{label}</div>
      {value !== undefined && (
        <div className="num flex items-center justify-between gap-4 text-slate-100">
          <span className="text-slate-400">평가금액</span>
          <span className="font-semibold">{won(value)}</span>
        </div>
      )}
    </div>
  );
}

// 스크린샷 1 오른쪽 카드: 평가금액 area/line + 환율 line 복합 차트 + 기간 버튼 + annotation + 요약
export default function QldValueFxChart({
  compact = false,
  data,
}: {
  compact?: boolean;
  data: PerformanceQldResult;
}) {
  const chartData = data.valueSeries;
  const { summary } = data;
  const mddStart = chartData.find((point) => point.date === summary.mddStartDate);
  const low = chartData.find((point) => point.date === summary.lowDate);
  const high = chartData.find((point) => point.date === summary.highDate);

  const fmtValueAxis = (v: number) => `${(v / 100_000_000).toFixed(2)}억`;

  const summaryCards: Array<{ label: string; value: string; sub?: string; tone: "up" | "down" | "neutral" }> = [
    { label: "최고점", value: moneyOrDash(summary.highKRW), sub: dateOrDash(summary.highDate), tone: "neutral" },
    { label: "최저점", value: moneyOrDash(summary.lowKRW), sub: dateOrDash(summary.lowDate), tone: "neutral" },
    {
      label: "MDD",
      value: pctOrDash(summary.mddPct),
      sub: summary.mddStartDate && summary.mddEndDate
        ? `${summary.mddStartDate} → ${summary.mddEndDate} · ${moneyOrDash(summary.mddAmountKRW)}`
        : "스냅샷 하락 구간 없음",
      tone: "down",
    },
    { label: "현재/최고", value: pctOrDash(summary.currentOverHighPct), sub: "최고 대비", tone: "down" },
    { label: "현재/최저", value: pctOrDash(summary.currentOverLowPct), sub: "최저 대비", tone: "up" },
  ];

  return (
    <div className={`flex h-full flex-col rounded-[18px] border border-[#242938] bg-[#12151e] ${compact ? "p-3" : "p-5"}`}>
      <div className={`${compact ? "mb-2" : "mb-3"} flex flex-wrap items-center justify-between gap-2`}>
        <span className="text-[15px] font-bold text-slate-100">총 평가금액 및 환율 추이</span>
        <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300">
          환율 추이 미제공
        </span>
      </div>
      <p className="mb-2 text-[11.5px] text-slate-500">
        스냅샷 평가금액만 표시합니다. 스냅샷에 환율 히스토리 필드가 없어 환율 추이는 표시하지 않습니다.
      </p>

      <div className={`${compact ? "h-[210px]" : "h-[300px]"} w-full`}>
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-[#1f2433] bg-[#0e111a] px-4 text-center text-[13px] text-slate-500">
            저장된 스냅샷 평가금액이 없어 하단 평가금액 추이를 표시할 수 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={chartMargin}>
              <defs>
                <linearGradient id="qldValueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={valueColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={valueColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2233" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                interval={chartData.length > 18 ? 4 : chartData.length > 8 ? 1 : 0}
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
              <Tooltip content={<ChartTooltip />} cursor={tooltipCursor} />

              <Area
                yAxisId="value"
                type="monotone"
                dataKey="valueKRW"
                stroke={valueColor}
                strokeWidth={2}
                fill="url(#qldValueFill)"
                dot={false}
                activeDot={areaActiveDot}
              />

              {mddStart && (
                <>
                  <ReferenceLine yAxisId="value" x={mddStart.label} stroke="#fb923c" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceDot yAxisId="value" x={mddStart.label} y={mddStart.valueKRW} r={4} fill="#fb923c" stroke="#0b0d13" strokeWidth={1.5}>
                    <Label value="MDD 시작" position="top" fill="#fb923c" fontSize={10.5} />
                  </ReferenceDot>
                </>
              )}

              {low && (
                <ReferenceDot yAxisId="value" x={low.label} y={low.valueKRW} r={4} fill="#fb4668" stroke="#0b0d13" strokeWidth={1.5}>
                  <Label value="저점" position="bottom" fill="#fb4668" fontSize={10.5} />
                </ReferenceDot>
              )}

              {high && (
                <ReferenceDot yAxisId="value" x={high.label} y={high.valueKRW} r={4} fill="#34d399" stroke="#0b0d13" strokeWidth={1.5}>
                  <Label value="고점" position="top" fill="#34d399" fontSize={10.5} />
                </ReferenceDot>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
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
