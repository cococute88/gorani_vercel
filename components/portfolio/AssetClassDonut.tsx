"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { AssetClassSlice } from "@/lib/asset-class-allocation";
import { formatCompactKrw } from "@/lib/format";

type Props = {
  slices: AssetClassSlice[];
  theme?: "dark" | "light";
  title?: string;
  emptyMessage?: string;
  // 권위 총자산(total_assets_krw). 주면 도넛 중앙 "총 평가금액" 을 이 값으로 고정한다
  // (자가합산 금지). 100만원 미만 숨김분이 있어도 중앙 총자산은 권위 총자산과 일치한다.
  totalOverrideKRW?: number | null;
};

function returnLabel(returnPct: number | null): string {
  if (returnPct === null) return "—";
  const sign = returnPct > 0 ? "+" : "";
  return `(${sign}${returnPct.toFixed(0)}%)`;
}

// PORTFOLIO-TREEMAP-TO-STREAMLIT-DONUT-1
// 원본 Streamlit 자산 트래커의 자산군 도넛(hole=0.5 + 하단 범례)을 재현한다.
// 범례는 "자산군명 / 비중 / (수익률) / 평가금액(억)" 형식으로 표시한다.
export default function AssetClassDonut({
  slices,
  theme = "light",
  title = "자산군 비중",
  emptyMessage = "평가금액이 있는 자산이 없어 자산군 도넛을 표시할 수 없습니다.",
  totalOverrideKRW,
}: Props) {
  const isLight = theme === "light";
  const cardCls = isLight
    ? "border-slate-200 bg-white shadow-sm"
    : "border-[#2a3336] bg-[#191f20]";
  const titleCls = isLight ? "text-slate-800" : "text-slate-100";
  const nameCls = isLight ? "text-slate-700" : "text-slate-200";
  const weakCls = isLight ? "text-slate-500" : "text-slate-400";

  const sliceTotal = slices.reduce((sum, slice) => sum + slice.valueKRW, 0);
  // 중앙 총 평가금액: 권위 총자산이 주어지면 그 값(단일 기준), 아니면 Σ 슬라이스(폴백).
  const total =
    typeof totalOverrideKRW === "number" && Number.isFinite(totalOverrideKRW) && totalOverrideKRW > 0
      ? totalOverrideKRW
      : sliceTotal;
  const hasData = sliceTotal > 0;

  return (
    <div className={`box-border min-h-[300px] w-full min-w-0 max-w-full overflow-hidden rounded-2xl border p-4 ${cardCls}`}>
      <div className={`mb-3 text-[14px] font-bold ${titleCls}`}>{title}</div>
      {!hasData ? (
        <div
          className={`flex min-h-[220px] items-center justify-center rounded-xl border border-dashed px-4 text-center text-[13px] leading-relaxed ${
            isLight
              ? "border-slate-200 bg-slate-50 text-slate-500"
              : "border-[#2a3336] bg-white/[0.03] text-slate-400"
          }`}
        >
          {emptyMessage}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* 도넛 (hole=0.5 재현) */}
          <div className="relative h-[150px] w-[150px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="valueKRW"
                  nameKey="name"
                  innerRadius={47}
                  outerRadius={74}
                  paddingAngle={1}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-[11px] ${weakCls}`}>총 평가금액</span>
              <span className={`num text-[14px] font-bold ${titleCls}`}>{formatCompactKrw(total)}</span>
            </div>
          </div>

          {/* 범례: 자산군명 / 비중 / (수익률) / 평가금액 */}
          <ul className="min-w-0 w-full flex-1 space-y-1.5">
            {slices.map((slice) => {
              const returnTone =
                slice.returnPct === null
                  ? weakCls
                  : slice.returnPct >= 0
                    ? "text-rose-500 dark:text-rose-400"
                    : "text-blue-500 dark:text-blue-400";
              return (
                <li key={slice.name} className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className={`w-[52px] shrink-0 truncate text-[12.5px] font-bold ${nameCls}`}>{slice.name}</span>
                  <span className={`num shrink-0 text-[12px] font-semibold ${nameCls}`}>
                    {slice.weightPct.toFixed(1)}%
                  </span>
                  <span className={`num shrink-0 text-[11.5px] font-medium ${returnTone}`}>
                    {returnLabel(slice.returnPct)}
                  </span>
                  <span className={`num ml-auto shrink-0 text-[12px] font-semibold ${nameCls}`}>
                    {formatCompactKrw(slice.valueKRW)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
