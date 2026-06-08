"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import {
  QLD_MONTHLY_DIVIDENDS,
  QLD_DIVIDEND_STACK_KEYS,
  QLD_DIVIDEND_SUMMARY,
} from "@/lib/qldDashboardData";

const won = (v: number) => v.toLocaleString("ko-KR");
const chartMargin = { top: 8, right: 8, left: 4, bottom: 0 };
const axisTick = { fontSize: 11, fill: "#5b6479" };
const tooltipCursor = { fill: "rgba(255,255,255,0.04)" };
const yDomain = [0, 2_500_000];

const fmtYAxis = (v: number) => (v === 0 ? "0" : `${(v / 10_000).toLocaleString("ko-KR")}`);

function DividendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const visible = payload.filter((p) => typeof p.value === "number" && (p.value as number) > 0);
  if (visible.length === 0) return null;
  const total = visible.reduce((acc, p) => acc + (p.value as number), 0);
  return (
    <div className="rounded-lg border border-[#2a3142] bg-[#161a25] px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="font-semibold text-slate-100">{label}</span>
        <span className="num text-slate-300">{won(total)}원</span>
      </div>
      {visible.map((p) => {
        const swatch = { backgroundColor: p.color as string };
        return (
          <div key={p.dataKey as string} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={swatch} />
            <span className="flex-1 text-slate-400">{p.dataKey as string}</span>
            <span className="num text-slate-200">{won(p.value as number)}</span>
          </div>
        );
      })}
    </div>
  );
}

// 스크린샷 4: 월간 배당금 (종목별 stacked bar) + 연도 select + 합계/연간예상 badge + legend
export default function QldMonthlyDividendChart() {
  const [year, setYear] = useState<string>(QLD_DIVIDEND_SUMMARY.year);
  const keys = QLD_DIVIDEND_STACK_KEYS;
  const topKey = keys[keys.length - 1].key;

  return (
    <div className="flex h-full flex-col rounded-[18px] border border-[#242938] bg-[#12151e] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-bold text-slate-100">월간 배당금</span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-lg border border-[#2a3142] bg-[#0e111a] px-2.5 py-1 text-[12px] font-medium text-slate-200 outline-none focus:border-[#5b7cff]"
          >
            {QLD_DIVIDEND_SUMMARY.yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="num rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11.5px] text-slate-300">
            합계 {won(QLD_DIVIDEND_SUMMARY.total)}원
          </span>
          <span className="num rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11.5px] font-medium text-emerald-400">
            연간 예상 {won(QLD_DIVIDEND_SUMMARY.annualEstimate)}원
          </span>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={QLD_MONTHLY_DIVIDENDS} margin={chartMargin} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2233" vertical={false} />
            <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis
              domain={yDomain}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtYAxis}
              width={42}
            />
            <Tooltip content={<DividendTooltip />} cursor={tooltipCursor} />
            {keys.map((k) => {
              const isTop = k.key === topKey;
              const radius: [number, number, number, number] = isTop ? [6, 6, 0, 0] : [0, 0, 0, 0];
              return (
                <Bar
                  key={k.key}
                  dataKey={k.key}
                  stackId="div"
                  fill={k.color}
                  radius={radius}
                  maxBarSize={40}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {keys.map((k) => {
          const dot = { backgroundColor: k.color };
          return (
            <span
              key={k.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#242938] bg-[#0e111a] px-2.5 py-1 text-[11px] text-slate-300"
            >
              <span className="h-2 w-2 rounded-full" style={dot} />
              <span className="text-slate-300">{k.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
