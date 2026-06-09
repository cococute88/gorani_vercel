"use client";

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
  QLD_ACCOUNT_ROWS,
  QLD_ACCOUNT_STACK_KEYS,
} from "@/lib/qldDashboardData";

const won = (v: number) => v.toLocaleString("ko-KR");
const chartMargin = { top: 4, right: 16, left: 8, bottom: 0 };
const axisTick = { fontSize: 11, fill: "#5b6479" };
const yAxisTick = { fontSize: 11, fill: "#94a3b8" };
const tooltipCursor = { fill: "rgba(255,255,255,0.04)" };

function AccountTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const visible = payload.filter((p) => typeof p.value === "number" && (p.value as number) > 0);
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

const fmtXAxis = (v: number) => `${Math.round(v / 100_000_000)}억`;

// 스크린샷 2: 계좌별 평가금액 (종목별 색상 stacked horizontal bar) + 종목 legend chip
export default function QldAccountBarChart({ compact = false }: { compact?: boolean } = {}) {
  const keys = QLD_ACCOUNT_STACK_KEYS;
  const lastKey = keys[keys.length - 1].key;

  return (
    <div className={`flex h-full flex-col rounded-[18px] border border-[#242938] bg-[#12151e] ${compact ? "p-3" : "p-5"}`}>
      <div className={`${compact ? "mb-2 text-[13px]" : "mb-3 text-[15px]"} font-bold text-slate-100`}>계좌별 평가금액</div>

      <div className={`${compact ? "h-[210px]" : "h-[300px]"} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={QLD_ACCOUNT_ROWS} layout="vertical" margin={chartMargin} barCategoryGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2233" horizontal={false} />
            <XAxis
              type="number"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtXAxis}
            />
            <YAxis
              type="category"
              dataKey="account"
              tick={yAxisTick}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<AccountTooltip />} cursor={tooltipCursor} />
            {keys.map((k) => {
              const isLast = k.key === lastKey;
              const radius: [number, number, number, number] = isLast ? [0, 6, 6, 0] : [0, 0, 0, 0];
              return (
                <Bar
                  key={k.key}
                  dataKey={k.key}
                  stackId="acct"
                  fill={k.color}
                  radius={radius}
                  maxBarSize={18}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={`${compact ? "mt-2 gap-1" : "mt-4 gap-1.5"} flex flex-wrap`}>
        {keys.map((k) => {
          const dot = { backgroundColor: k.color };
          return (
            <span
              key={k.key}
              className={`inline-flex items-center gap-1.5 rounded-full border border-[#242938] bg-[#0e111a] ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"} text-slate-300`}
            >
              <span className="h-2 w-2 rounded-full" style={dot} />
              <span className="font-semibold text-slate-200">{k.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
