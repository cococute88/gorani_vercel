"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerfSeriesPoint } from "@/lib/mock-dividend-data";
import {
  AXIS_LINE,
  AXIS_TICK_SM,
  CHART_GRID,
  CHART_MARGIN,
  TOOLTIP_STYLE,
} from "@/lib/chart-style";

interface Props {
  series: PerfSeriesPoint[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function eokFmt(v: number): string {
  return `${(v / 100000000).toFixed(1)}\uc5b5`;
}

function tooltipFormatter(value: number, name: string): [string, string] {
  return [`\u20a9 ${Math.round(value).toLocaleString("ko-KR")}`, name];
}

// 성과 분석: 누적입금 대비 포트폴리오 / KOSPI / S&P500 선그래프
// 추후 Codex 가 실제 로직을 붙일 수 있도록 series 를 props 로 분리.
export default function DividendPerformanceSection({ series }: Props) {
  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold text-slate-300">성과 분석</h2>
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">샘플 데이터</span>
        </div>
        <p className="mb-4 text-[12px] text-slate-500">
          누적 입금 대비 포트폴리오 가치 (KOSPI / S&P 500 투자 시 비교)
        </p>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} minTickGap={24} />
              <YAxis tickFormatter={eokFmt} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={48} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
              <Legend wrapperStyle={LEGEND_WRAPPER} />
              <Line type="monotone" dataKey="deposit" name="누적 입금" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="portfolio" name="내 포트폴리오" stroke="#3b82f6" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="kospi" name="KOSPI 투자 시" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="sp500" name="S&P 500 투자 시" stroke="#10b981" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

const LEGEND_WRAPPER = { fontSize: 12, paddingTop: 8 };
