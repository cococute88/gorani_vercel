"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DividendPerformanceResult } from "@/lib/dividend-performance-from-snapshots";
import { AXIS_LINE, AXIS_TICK_SM, CHART_GRID, CHART_MARGIN, TOOLTIP_STYLE } from "@/lib/chart-style";
import { formatPercent } from "@/lib/format";

interface Props { result: DividendPerformanceResult; }

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const LEGEND_WRAPPER = { fontSize: 12, paddingTop: 8 };

function eokFmt(v: number): string { return `${(v / 100000000).toFixed(1)}억`; }
function manFmt(v: number): string { return `${Math.round(v / 10000).toLocaleString("ko-KR")}만`; }
function won(value: number | null | undefined): string { return value == null ? "계산 불가" : `₩ ${Math.round(value).toLocaleString("ko-KR")}`; }
function tooltipFormatter(value: number, name: string): [string, string] { return [won(value), name]; }


function paddedDomain(values: Array<number | null | undefined>, includeZero = false): [number | string, number | string] {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finiteValues.length === 0) return ["auto", "auto"];
  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  const range = Math.max(max - min, Math.abs(max) * 0.02, Math.abs(min) * 0.02, 1);
  return [min - range * 0.12, max + range * 0.12];
}

function performanceDomain(points: DividendPerformanceResult["points"]): [number | string | ((value: number) => number), number | string | ((value: number) => number)] {
  const values = points.flatMap((point) => [point.deposit, point.portfolio, point.kospi, point.sp500]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return ["auto", "auto"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.02, 1);
  return [min - range * 0.08, max + range * 0.08];
}

function Kpi({ label, value, rate }: { label: string; value: number | null | undefined; rate?: number | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#263033] dark:bg-[#11181a]">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="num mt-1 text-[15px] font-extrabold text-slate-900 dark:text-slate-100">{won(value)}</div>
      {rate != null && <div className="num mt-0.5 text-[11px] text-blue-500">{formatPercent(rate, 1)}</div>}
    </div>
  );
}

export default function DividendPerformanceSection({ result }: Props) {
  const [selectedYear, setSelectedYear] = useState<number | null>(result.availableYears.at(-1) ?? null);
  useEffect(() => setSelectedYear(result.availableYears.at(-1) ?? null), [result.availableYears]);
  const monthlyRows = useMemo(() => {
    if (selectedYear == null) return result.points;
    const byMonth = new Map(result.points.filter((point) => point.year === selectedYear).map((point) => [Number(point.date.slice(5, 7)), point]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const found = byMonth.get(month);
      return found ?? { date: `${selectedYear}-${String(month).padStart(2, "0")}`, deposit: null, portfolio: null, kospi: null, sp500: null, monthlyProfit: null, totalAssets: null, netInvestment: null, year: selectedYear };
    });
  }, [result.points, selectedYear]);
  const annualProfit = useMemo(() => monthlyRows.reduce((sum, row) => sum + (typeof row.monthlyProfit === "number" ? row.monthlyProfit : 0), 0), [monthlyRows]);
  const profitDomain = useMemo(() => paddedDomain(monthlyRows.map((row) => typeof row.monthlyProfit === "number" ? row.monthlyProfit : null), true), [monthlyRows]);
  const assetDomain = useMemo(() => paddedDomain(monthlyRows.map((row) => typeof row.totalAssets === "number" ? row.totalAssets : null), false), [monthlyRows]);

  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold text-slate-700 dark:text-slate-300">전체 합산 성과 (참고)</h2>
          <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">최신 보유 기준 역산</span>
        </div>
        <p className="mb-4 text-[12px] text-slate-500">최신 보유종목을 현재 수량으로 고정하고, 과거 가격을 대입해 역산한 참고 성과입니다.</p>

        {!result.available || !result.kpis ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[13px] text-slate-500 dark:border-[#334044] dark:bg-[#11181a]">
            <div className="font-semibold text-slate-700 dark:text-slate-300">{result.unavailableReason ?? "성과분석 데이터 부족"}</div>
            <div className="mt-1">과거 가격 데이터를 불러오지 못했습니다. 샘플/가짜 그래프는 표시하지 않습니다.</div>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="누적 입금" value={result.kpis.cumulativeDepositKRW} />
              <Kpi label="내 포트폴리오" value={result.kpis.portfolioValueKRW} rate={result.kpis.portfolioReturnPct} />
              <Kpi label="KOSPI 투자 시" value={result.kpis.kospiValueKRW} rate={result.kpis.kospiReturnPct} />
              <Kpi label="S&P 500 투자 시" value={result.kpis.sp500ValueKRW} rate={result.kpis.sp500ReturnPct} />
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.points} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} minTickGap={24} />
                  <YAxis domain={performanceDomain(result.points)} tickFormatter={eokFmt} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                  <Legend wrapperStyle={LEGEND_WRAPPER} />
                  <Line type="monotone" dataKey="deposit" name="누적 입금" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="portfolio" name="내 포트폴리오" stroke="#3b82f6" strokeWidth={2.2} dot={false} />
                  <Line type="monotone" dataKey="kospi" name="KOSPI 투자 시" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="sp500" name="S&P 500 투자 시" stroke="#10b981" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[13px] font-bold text-slate-700 dark:text-slate-300">월별 수익/손실 추이</h3>
              <select value={selectedYear ?? ""} onChange={(e) => setSelectedYear(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] dark:border-[#2a3336] dark:bg-[#11181a]">
                {result.availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
              </select>
            </div>
            <div className="mt-2 text-[12px] text-slate-500">연간 손익: {selectedYear == null ? "-" : won(annualProfit)}</div>
            <div className="mt-3 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyRows} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} />
                  <YAxis yAxisId="profit" orientation="left" domain={profitDomain} tickFormatter={manFmt} label={{ value: "월별 손익(만원)", angle: -90, position: "insideLeft" }} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={56} />
                  <YAxis yAxisId="asset" orientation="right" domain={assetDomain} tickFormatter={eokFmt} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                  <Legend wrapperStyle={LEGEND_WRAPPER} />
                  <Bar yAxisId="profit" dataKey="monthlyProfit" name="월별 손익" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="asset" type="monotone" dataKey="totalAssets" name="총자산" stroke="#2DD4BF" strokeWidth={2} dot={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        {result.warnings.length > 0 && <div className="mt-3 text-[11.5px] text-slate-500">{result.warnings.join(" · ")}</div>}
      </div>
    </section>
  );
}
