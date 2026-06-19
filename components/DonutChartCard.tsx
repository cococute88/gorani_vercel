"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Slice } from "@/lib/mockData";
import { formatCompactKrw } from "@/lib/format";

type Props = {
  title: string;
  data: Slice[];
  theme?: "dark" | "light";
  centerLabel?: string;
  centerValue?: string;
  maxLegend?: number;
  size?: number;
  legendCols?: number;
  emptyMessage?: string;
  className?: string;
  // When true the legend drops its max-height/scroll so every entry is visible at
  // once (card height grows to fit), with slightly taller rows / larger font.
  expandedLegend?: boolean;
};

function dotStyleFor(color: string) {
  return { backgroundColor: color };
}

// 도넛 차트 + 오른쪽 범례.
export default function DonutChartCard({
  title,
  data,
  theme = "light",
  centerLabel,
  centerValue,
  maxLegend,
  size = 132,
  legendCols = 1,
  emptyMessage = "표시할 데이터가 없습니다.",
  className = "",
  expandedLegend = false,
}: Props) {
  const isLight = theme === "light";
  const cardCls = isLight
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-[#191f20] border border-[#2a3336]";
  const titleCls = isLight ? "text-slate-800" : "text-slate-200";
  const legendName = isLight ? "text-slate-600" : "text-slate-400";
  const legendVal = isLight ? "text-slate-900" : "text-slate-200";

  const legend = maxLegend ? data.slice(0, maxLegend) : data;
  const inner = Math.round((size * 0.62) / 2);
  const outer = Math.round(size / 2);
  const wrapStyle = { width: size, height: size };
  const legendGridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${legendCols}, minmax(0, 1fr))`,
    columnGap: "14px",
    rowGap: "6px",
  };

  const hasData = data.some((slice) => Number.isFinite(slice.value) && slice.value > 0);

  return (
    <div className={`rounded-2xl p-4 ${cardCls} ${className}`}>
      <div className={`mb-3 text-[13px] font-bold ${titleCls}`}>{title}</div>
      {!hasData ? (
        <div className={`flex min-h-[132px] items-center rounded-xl border border-dashed px-4 text-[12.5px] leading-relaxed ${
          isLight
            ? "border-slate-200 bg-slate-50 text-slate-500"
            : "border-[#2a3336] bg-white/[0.03] text-slate-400"
        }`}>
          {emptyMessage}
        </div>
      ) : (
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={wrapStyle}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={inner}
                outerRadius={outer}
                paddingAngle={1}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {(centerValue || centerLabel) && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {centerLabel && (
                <span className={`text-[11px] ${legendName}`}>
                  {centerLabel}
                </span>
              )}
              {centerValue && (
                <span className={`num text-[13px] font-bold ${legendVal}`}>
                  {centerValue}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className={
            expandedLegend
              ? "flex-1"
              : `max-h-[180px] flex-1 overflow-y-auto pr-1 ${isLight ? "scroll-light" : "scroll-dark"}`
          }
        >
          <div style={legendGridStyle}>
            {legend.map((s) => (
              <div
                key={s.name}
                className={`flex items-center justify-between gap-2 ${expandedLegend ? "min-h-[24px]" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={dotStyleFor(s.color)}
                  />
                  <span className={`truncate ${expandedLegend ? "text-[12.5px]" : "text-[11.5px]"} ${legendName}`}>
                    {s.name}
                  </span>
                </span>
                <span
                  className={`num shrink-0 ${expandedLegend ? "text-[12.5px]" : "text-[11.5px]"} font-semibold ${legendVal}`}
                >
                  {s.amountKRW != null
                    ? `${formatCompactKrw(s.amountKRW)} · ${s.value}%`
                    : `${s.value}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
