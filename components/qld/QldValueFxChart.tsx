"use client";

import {
  ComposedChart,
  Area,
  Bar,
  Line,
  Legend,
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
import type { PerformanceDividendBarPoint } from "@/lib/performance-dividend-bars";
import { formatKoreanMoney, formatPercent } from "@/lib/format";

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;

// 차트 prop으로 쓰는 객체는 상수로 분리 (JSX 인라인 객체 리터랄 회피)
const chartMargin = { top: 24, right: 8, left: 4, bottom: 0 };
const axisTick = { fontSize: 10.5, fill: "#5b6479" };
const tooltipCursor = { stroke: "#3a4256", strokeWidth: 1 };
const valueColor = "#5b7cff";
const principalColor = "#f59e0b";
// 배당 막대 색상: 위탁 연간예상배당(초록) / 위탁 환산예상배당(파랑) / 절세 환산예상배당(겨자)
const annualColor = "#22c55e";
const taxableConvertedColor = "#3b82f6";
const taxAdvantagedConvertedColor = "#eab308";
const areaActiveDot = { r: 3, fill: valueColor, stroke: "#0b0d13", strokeWidth: 1.5 };
const valueDomain: [string, string] = ["dataMin - 4000000", "dataMax + 4000000"];
const legendStyle = { fontSize: 11, paddingTop: 6 };

type MergedPoint = {
  date: string;
  label: string;
  valueKRW: number;
  principalKRW: number | null;
  taxableAnnualKRW: number;
  taxableConvertedKRW: number;
  taxAdvantagedConvertedKRW: number;
  combinedConvertedKRW: number;
};

function DividendTooltipRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="num flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-slate-400">
        {color ? <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} /> : null}
        {label}
      </span>
      <span className="font-semibold text-slate-100">{won(value)}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload as MergedPoint | undefined;
  if (!datum) return null;
  return (
    <div className="min-w-[200px] rounded-lg border border-[#2a3142] bg-[#161a25] px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 text-[11px] text-slate-400">{label}</div>
      <div className="num mb-1.5 flex items-center justify-between gap-4 text-slate-100">
        <span className="text-slate-400">평가금액</span>
        <span className="font-semibold">{won(datum.valueKRW)}</span>
      </div>
      {datum.principalKRW != null && (
        <div className="num mb-1.5 flex items-center justify-between gap-4 text-slate-100">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: principalColor }} />
            누적투자원금
          </span>
          <span className="font-semibold">{won(datum.principalKRW)}</span>
        </div>
      )}
      <div className="my-1.5 border-t border-[#2a3142]" />
      <div className="flex flex-col gap-1">
        <DividendTooltipRow label="절세 환산예상배당" value={datum.taxAdvantagedConvertedKRW} color={taxAdvantagedConvertedColor} />
        <DividendTooltipRow label="위탁 환산예상배당" value={datum.taxableConvertedKRW} color={taxableConvertedColor} />
        <DividendTooltipRow label="합산 환산예상배당" value={datum.combinedConvertedKRW} />
        <DividendTooltipRow label="위탁 연간예상배당" value={datum.taxableAnnualKRW} color={annualColor} />
      </div>
    </div>
  );
}

// 평가금 추이: 평가액(area) + 누적투자원금(line) + 배당 막대(위탁 연간예상배당 / 위탁·절세 환산예상배당)
// 세전/세후 토글은 배당 막대에만 영향을 준다 (평가액/원금 라인은 변경하지 않는다).
export default function QldValueFxChart({
  compact = false,
  data,
  principalByDate,
  dividendBars,
  afterTax = true,
  onToggleTax,
}: {
  compact?: boolean;
  data: PerformanceQldResult;
  principalByDate?: Record<string, number | null>;
  dividendBars?: PerformanceDividendBarPoint[];
  afterTax?: boolean;
  onToggleTax?: (afterTax: boolean) => void;
}) {
  const { summary } = data;
  const barByDate = new Map((dividendBars ?? []).map((bar) => [bar.date, bar]));
  const chartData: MergedPoint[] = data.valueSeries.map((point) => {
    const bar = barByDate.get(point.date);
    return {
      date: point.date,
      label: point.label,
      valueKRW: point.valueKRW,
      principalKRW: principalByDate?.[point.date] ?? null,
      taxableAnnualKRW: bar?.taxableAnnualKRW ?? 0,
      taxableConvertedKRW: bar?.taxableConvertedKRW ?? 0,
      taxAdvantagedConvertedKRW: bar?.taxAdvantagedConvertedKRW ?? 0,
      combinedConvertedKRW: bar?.combinedConvertedKRW ?? 0,
    };
  });
  const mddStart = chartData.find((point) => point.date === summary.mddStartDate);
  const low = chartData.find((point) => point.date === summary.lowDate);
  const high = chartData.find((point) => point.date === summary.highDate);

  const fmtValueAxis = (v: number) => `${(v / 100_000_000).toFixed(2)}억`;
  const fmtDividendAxis = (v: number) => `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;

  return (
    <div className={`flex h-full flex-col rounded-[18px] border border-[#242938] bg-[#12151e] ${compact ? "p-3" : "p-5"}`}>
      <div className={`${compact ? "mb-2" : "mb-3"} flex flex-wrap items-center justify-between gap-2`}>
        <span className="text-[15px] font-bold text-slate-100">평가금 추이</span>
        {onToggleTax ? (
          <div className="flex items-center gap-1 rounded-lg border border-[#2a3142] bg-[#161a25] p-1">
            <button
              type="button"
              onClick={() => onToggleTax(true)}
              aria-pressed={afterTax}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                afterTax ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              세후
            </button>
            <button
              type="button"
              onClick={() => onToggleTax(false)}
              aria-pressed={!afterTax}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                !afterTax ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              세전
            </button>
          </div>
        ) : null}
      </div>

      <div className={`${compact ? "min-h-[210px]" : "min-h-[440px]"} w-full flex-1`}>
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-[#1f2433] bg-[#0e111a] px-4 text-center text-[13px] text-slate-500">
            저장된 스냅샷 평가금액이 없어 평가금 추이를 표시할 수 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={chartMargin} barGap={2} barCategoryGap="28%">
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
              <YAxis
                yAxisId="dividend"
                orientation="right"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtDividendAxis}
                width={46}
              />
              <Tooltip content={<ChartTooltip />} cursor={tooltipCursor} />
              <Legend wrapperStyle={legendStyle} />

              <Bar
                yAxisId="dividend"
                dataKey="taxableAnnualKRW"
                name="위탁 연간예상배당"
                fill={annualColor}
                stackId="annual"
                radius={[2, 2, 0, 0]}
                barSize={14}
              />
              <Bar
                yAxisId="dividend"
                dataKey="taxableConvertedKRW"
                name="위탁 환산예상배당"
                fill={taxableConvertedColor}
                stackId="converted"
                barSize={14}
              />
              <Bar
                yAxisId="dividend"
                dataKey="taxAdvantagedConvertedKRW"
                name="절세 환산예상배당"
                fill={taxAdvantagedConvertedColor}
                stackId="converted"
                radius={[2, 2, 0, 0]}
                barSize={14}
              />

              <Area
                yAxisId="value"
                type="monotone"
                dataKey="valueKRW"
                name="평가액"
                stroke={valueColor}
                strokeWidth={2}
                fill="url(#qldValueFill)"
                dot={false}
                activeDot={areaActiveDot}
              />
              <Line
                yAxisId="value"
                type="monotone"
                dataKey="principalKRW"
                name="누적투자원금"
                stroke={principalColor}
                strokeWidth={2}
                dot={false}
                connectNulls
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

      {/* 평가금 추이 하단 요약: 최고점/최저점/MDD (카드 없이 작은 텍스트 한 줄) */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
        <span>
          최고점{" "}
          <span className="font-semibold text-slate-300">
            {summary.highKRW == null ? "—" : formatKoreanMoney(summary.highKRW)}
          </span>
        </span>
        <span>
          최저점{" "}
          <span className="font-semibold text-slate-300">
            {summary.lowKRW == null ? "—" : formatKoreanMoney(summary.lowKRW)}
          </span>
        </span>
        <span>
          MDD{" "}
          <span className="font-semibold text-slate-300">
            {summary.mddPct == null ? "없음" : formatPercent(summary.mddPct, 2)}
          </span>
        </span>
      </div>
    </div>
  );
}
