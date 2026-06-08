"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Customized,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  MONTHLY_INCOME_DARK,
  MONTHLY_INCOME_SERIES,
  ANNUAL_INCOME_BREAKDOWN,
  ANNUAL_INCOME_TOTAL_DONUT,
} from "@/lib/mockData";
import { formatWon } from "@/lib/format";

type Props = { theme?: "dark" | "light" };

// 2026년 5월 구간을 파란 반투명 배경으로 하이라이트.
function MayHighlight(props: any) {
  const { xAxisMap, offset } = props;
  if (!xAxisMap || !offset) return null;
  const key = Object.keys(xAxisMap)[0];
  const xAxis = xAxisMap[key];
  const scale = xAxis && xAxis.scale;
  if (!scale || typeof scale.bandwidth !== "function") return null;
  const x = scale("5월");
  if (x == null) return null;
  const band = scale.bandwidth();
  return (
    <rect
      x={x}
      y={offset.top}
      width={band}
      height={offset.height}
      fill="#3b82f6"
      fillOpacity={0.14}
      rx={4}
    />
  );
}

export default function MonthlyIncomeChart({ theme = "light" }: Props) {
  const isLight = theme === "light";
  const cardCls = isLight
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-[#191f20] border border-[#2a3336]";
  const titleCls = isLight ? "text-slate-800" : "text-slate-200";
  const axisColor = isLight ? "#94a3b8" : "#5b6770";
  const gridColor = isLight ? "#eef1f5" : "#222a2c";
  const subCls = isLight ? "text-slate-500" : "text-slate-400";

  const chartMargin = { top: 8, right: 8, left: -10, bottom: 0 };
  const tickStyle = { fontSize: 11, fill: axisColor };
  const tooltipStyle = {
    background: isLight ? "#ffffff" : "#1b2021",
    border: `1px solid ${gridColor}`,
    borderRadius: 8,
    fontSize: 12,
  };
  const tooltipItemStyle = { color: isLight ? "#0f172a" : "#e2e8f0" };
  const cursorStyle = { fill: isLight ? "#1118270a" : "#ffffff0d" };
  const fmtY = (v: number) => `${Math.round(v / 10000)}만`;
  const fmtTip = (v: number, name: string): [string, string] => [
    formatWon(v),
    name,
  ];

  return (
    <div className={`rounded-2xl p-4 ${cardCls}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[14px] font-bold ${titleCls}`}>월별 소득</span>
        <div className="flex flex-wrap items-center gap-2.5 text-[10.5px]">
          {MONTHLY_INCOME_SERIES.map((s) => {
            const dotStyle = { backgroundColor: s.color };
            return (
              <span key={s.key} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={dotStyle} />
                <span className={subCls}>{s.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-[200px] min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={MONTHLY_INCOME_DARK}
              margin={chartMargin}
              barCategoryGap="16%"
              barGap={1}
            >
              <Customized component={MayHighlight} />
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridColor}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={tickStyle}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtY}
                tick={tickStyle}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipItemStyle}
                cursor={cursorStyle}
                formatter={fmtTip}
              />
              {MONTHLY_INCOME_SERIES.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 우측 연간 소득 도넛 */}
        <div className="hidden shrink-0 lg:block">
          <div className="relative mx-auto h-[150px] w-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ANNUAL_INCOME_BREAKDOWN}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={64}
                  paddingAngle={1}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {ANNUAL_INCOME_BREAKDOWN.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-500">연간</span>
              <span className="num text-[12px] font-bold text-white">
                {ANNUAL_INCOME_TOTAL_DONUT.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-1 max-w-[180px] space-y-0.5">
            {ANNUAL_INCOME_BREAKDOWN.slice(0, 5).map((s) => {
              const dotStyle = { backgroundColor: s.color };
              return (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={dotStyle}
                  />
                  <span className="truncate text-[10px] text-slate-400">
                    {s.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
