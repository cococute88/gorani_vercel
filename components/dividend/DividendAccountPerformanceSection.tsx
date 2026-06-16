"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import type { DividendPerformanceHoldingInput } from "@/lib/dividend-performance-from-snapshots";
import {
  ACCOUNT_PERF_GROUPS,
  type AccountPerfBase,
  type AccountPerfGroup,
  type BenchmarkPricePoint,
  benchmarkReturnPct,
  buildAccountGroupPerformance,
  computeBenchmarkSeries,
} from "@/lib/dividend-ledger-performance";
import { quoteHistoryPath } from "@/lib/quote-client";
import { normalizeHoldingTickerInfo } from "@/lib/holding-ticker-normalizer";
import type { QuoteHistoryResponse } from "@/lib/quote-types";
import { AXIS_LINE, AXIS_TICK_SM, CHART_GRID, CHART_MARGIN, TOOLTIP_STYLE } from "@/lib/chart-style";
import { formatPercent } from "@/lib/format";

interface Props {
  snapshots: PortfolioSnapshot[];
  latestBackcastHoldings?: Record<AccountPerfGroup, DividendPerformanceHoldingInput[]>;
}

// 원본 Streamlit 색상 그대로 유지한다.
const COLOR_PORTFOLIO = "#2DD4BF"; // 청록 실선
const COLOR_DEPOSIT = "#CBD5E1"; // 연회색 점선
const COLOR_SP500 = "#F97316"; // 주황 점선
const COLOR_KOSPI = "#3B82F6"; // 파랑 점선
const COLOR_PROFIT = "#EF4444"; // 수익 bar (빨강)
const COLOR_LOSS = "#3B82F6"; // 손실 bar (파랑)

// 벤치마크 티커: 기존 quote/history API를 재사용한다 (신규 의존성 없음).
const SP500_TICKER = "SPY";
const KOSPI_TICKER = "^KS11";
const FX_TICKER = "KRW=X";

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const LEGEND_WRAPPER = { fontSize: 12, paddingTop: 8 };

function eokFmt(value: number): string {
  return `${(value / 100000000).toFixed(1)}억`;
}

function manFmt(value: number): string {
  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;
}

function won(value: number | null | undefined): string {
  return value == null ? "계산 불가" : `₩ ${Math.round(value).toLocaleString("ko-KR")}`;
}

function tooltipFormatter(value: number, name: string): [string, string] {
  return [won(value), name];
}

type BenchmarkLine = {
  key: "sp500" | "kospi";
  name: string;
  color: string;
  available: boolean;
  values: Array<number | null>;
  latestValue: number | null;
  returnPct: number | null;
};

type GroupView = {
  group: AccountPerfGroup;
  base: AccountPerfBase;
  benchmarks: BenchmarkLine[];
};

// Quote history 응답을 벤치마크 가격 시계열로 변환한다.
// source === "sample" 이거나 비어 있으면 null(=fake 금지, unavailable 처리).
function toPriceSeries(response: QuoteHistoryResponse | undefined): BenchmarkPricePoint[] | null {
  if (!response || response.source === "sample") return null;
  const points = response.prices
    .filter((price) => Number.isFinite(price.close) && price.close > 0)
    .map((price) => ({ date: price.date, close: price.close }));
  return points.length > 0 ? points : null;
}

async function fetchHistory(ticker: string, start: string): Promise<QuoteHistoryResponse | undefined> {
  try {
    const response = await fetch(quoteHistoryPath({ ticker, start, range: "max" }), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as QuoteHistoryResponse;
  } catch {
    return undefined;
  }
}

function Kpi({
  label,
  value,
  rate,
  accent,
  unavailable,
}: {
  label: string;
  value: number | null | undefined;
  rate?: number | null;
  accent: string;
  unavailable?: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#263033] dark:bg-[#11181a]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="num mt-1 text-[15px] font-extrabold text-slate-900 dark:text-slate-100">
        {unavailable ? "비교 불가" : won(value)}
      </div>
      {!unavailable && rate != null && (
        <div className="num mt-0.5 text-[11px]" style={{ color: accent }}>
          {formatPercent(rate, 1)}
        </div>
      )}
    </div>
  );
}


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

function monthHistoryStart(latestDate: string, months: number): string {
  const date = new Date(`${latestDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}
function performanceDomain(rows: Array<Record<string, number | string | null>>): [number | string, number | string] {
  const values = rows.flatMap((row) => [row.deposit, row.portfolio, row.sp500, row.kospi]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return ["auto", "auto"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.02, 1);
  return [min - range * 0.08, max + range * 0.08];
}

function GroupBlock({ view }: { view: GroupView }) {
  const { group, base, benchmarks } = view;
  const sourceBadge = base.available ? "최신 보유 기준 역산" : "데이터 부족";
  const badgeClass = base.available
    ? "bg-blue-500/10 text-blue-400"
    : "bg-amber-500/10 text-amber-400";

  const chartData = useMemo(() => {
    return base.points.map((point, index) => {
      const row: Record<string, number | string | null> = {
        date: point.label,
        deposit: point.depositKRW,
        portfolio: point.portfolioKRW,
        monthlyProfit: point.monthlyProfitKRW,
        totalAssets: point.totalAssetsKRW,
        netInvestment: point.netInvestmentKRW,
        year: point.year,
      };
      for (const benchmark of benchmarks) {
        row[benchmark.key] = benchmark.available ? benchmark.values[index] ?? null : null;
      }
      return row;
    });
  }, [base.points, benchmarks]);

  const [selectedYear, setSelectedYear] = useState<number | null>(base.availableYears.at(-1) ?? null);
  useEffect(() => setSelectedYear(base.availableYears.at(-1) ?? null), [base.availableYears]);
  const monthlyRows = useMemo(() => {
    if (selectedYear == null) return chartData;
    const byMonth = new Map(chartData.filter((row) => row.year === selectedYear).map((row) => [Number(String(row.date).split("/").at(-1)), row]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return byMonth.get(month) ?? { date: `${month}월`, deposit: null, portfolio: null, sp500: null, kospi: null, monthlyProfit: null, totalAssets: null, netInvestment: null, year: selectedYear };
    });
  }, [chartData, selectedYear]);
  const annualProfit = selectedYear == null ? null : monthlyRows.reduce((sum, row) => sum + (typeof row.monthlyProfit === "number" ? row.monthlyProfit : 0), 0);
  const profitDomain = useMemo(() => paddedDomain(monthlyRows.map((row) => typeof row.monthlyProfit === "number" ? row.monthlyProfit : null), true), [monthlyRows]);
  const assetDomain = useMemo(() => paddedDomain(monthlyRows.map((row) => typeof row.totalAssets === "number" ? row.totalAssets : null), false), [monthlyRows]);

  const sp500 = benchmarks.find((benchmark) => benchmark.key === "sp500");
  const extraBenchmark = benchmarks.find((benchmark) => benchmark.key === "kospi");

  return (
    <div className={card}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-bold text-slate-700 dark:text-slate-300">
          {group === "위탁" ? "위탁 계좌 성과" : "절세 계좌 성과"}
        </h3>
        <span className={`rounded-md px-2 py-0.5 text-[11px] ${badgeClass}`}>{sourceBadge}</span>
      </div>

      {!base.available ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[13px] text-slate-500 dark:border-[#334044] dark:bg-[#11181a]">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            {base.unavailableReason ?? "성과분석 데이터 부족"}
          </div>
          <div className="mt-1">과거 가격 데이터를 불러오지 못했습니다. 샘플/가짜 그래프는 표시하지 않습니다.</div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[12px] text-slate-500">
            최신 보유종목을 현재 수량으로 고정하고, 과거 가격을 대입해 역산한 참고 성과입니다.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="누적 입금" value={base.latest?.depositKRW} accent={COLOR_DEPOSIT} />
            <Kpi
              label="내 포트폴리오"
              value={base.latest?.portfolioKRW}
              rate={base.latest?.portfolioReturnPct}
              accent={COLOR_PORTFOLIO}
            />
            <Kpi
              label="S&P 500 투자 시"
              value={sp500?.latestValue}
              rate={sp500?.returnPct}
              accent={COLOR_SP500}
              unavailable={!sp500?.available}
            />
            <Kpi
              label="KOSPI 투자 시"
              value={extraBenchmark?.latestValue}
              rate={extraBenchmark?.returnPct}
              accent={COLOR_KOSPI}
              unavailable={!extraBenchmark?.available}
            />
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} minTickGap={24} />
                <YAxis domain={performanceDomain(chartData)} tickFormatter={eokFmt} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                <Legend wrapperStyle={LEGEND_WRAPPER} />
                <Line
                  type="monotone"
                  dataKey="deposit"
                  name="누적 입금"
                  stroke={COLOR_DEPOSIT}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="내 포트폴리오"
                  stroke={COLOR_PORTFOLIO}
                  strokeWidth={2.4}
                  dot={false}
                />
                {sp500?.available && (
                  <Line
                    type="monotone"
                    dataKey="sp500"
                    name="S&P 500 투자 시"
                    stroke={COLOR_SP500}
                    strokeWidth={1.6}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                  />
                )}
                {extraBenchmark?.available && (
                  <Line
                    type="monotone"
                    dataKey="kospi"
                    name="KOSPI 투자 시"
                    stroke={COLOR_KOSPI}
                    strokeWidth={1.6}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {benchmarks.some((benchmark) => !benchmark.available) && (
            <div className="mt-2 text-[11.5px] text-slate-500">
              {benchmarks
                .filter((benchmark) => !benchmark.available)
                .map((benchmark) => `${benchmark.name}: 벤치마크 가격/환율 데이터를 불러오지 못해 표시하지 않습니다`)
                .join(" · ")}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-300">월별 수익/손실 추이</h4>
            <div className="flex items-center gap-3">
              <span
                className="num text-[12px] font-bold"
                style={{ color: (annualProfit ?? 0) >= 0 ? COLOR_PROFIT : COLOR_LOSS }}
              >
                연간 손익 {annualProfit == null ? "-" : won(annualProfit)}
              </span>
              <select
                value={selectedYear ?? ""}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] dark:border-[#2a3336] dark:bg-[#11181a]"
              >
                {base.availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyRows} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} />
                <YAxis yAxisId="profit" orientation="left" domain={profitDomain} tickFormatter={manFmt} label={{ value: "월별 손익(만원)", angle: -90, position: "insideLeft" }} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={56} />
                <YAxis yAxisId="asset" orientation="right" domain={assetDomain} tickFormatter={eokFmt} tick={AXIS_TICK_SM} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                <Legend wrapperStyle={LEGEND_WRAPPER} />
                <Bar yAxisId="profit" dataKey="monthlyProfit" name="월별 손익" radius={[4, 4, 0, 0]}>
                  {monthlyRows.map((row, index) => (
                    <Cell
                      key={index}
                      fill={Number(row.monthlyProfit ?? 0) >= 0 ? COLOR_PROFIT : COLOR_LOSS}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="asset"
                  type="monotone"
                  dataKey="totalAssets"
                  name="총자산"
                  stroke={COLOR_PORTFOLIO}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11.5px] text-slate-500">
            월별 손익 = 이번 달 말 평가액 - 지난 달 말 평가액 - 이번 달 순투자금
          </p>
          {base.warnings.length > 0 && (
            <div className="mt-2 text-[11.5px] text-slate-500">{base.warnings.join(" · ")}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function DividendAccountPerformanceSection({ snapshots, latestBackcastHoldings }: Props) {
  const latestSnapshot = useMemo(() => [...snapshots].filter((snapshot) => snapshot.snapshotDate).sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1))[0], [snapshots]);
  const accountTickers = useMemo(() => Array.from(new Set((latestBackcastHoldings ? [...latestBackcastHoldings["위탁"], ...latestBackcastHoldings["절세"]] : (latestSnapshot?.holdings ?? [])).map((holding) => ((holding as { normalizedTicker?: string }).normalizedTicker ?? holding.ticker ?? normalizeHoldingTickerInfo(holding).quoteTicker ?? "").trim().toUpperCase()).filter(Boolean))).sort(), [latestBackcastHoldings, latestSnapshot]);


  const earliestDate = latestSnapshot?.snapshotDate ? monthHistoryStart(latestSnapshot.snapshotDate, 25) : null;

  const [histories, setHistories] = useState<{
    sp500: BenchmarkPricePoint[] | null;
    kospi: BenchmarkPricePoint[] | null;
    fx: BenchmarkPricePoint[] | null;
    holdingPrices: Record<string, BenchmarkPricePoint[]>;
    loaded: boolean;
  }>({ sp500: null, kospi: null, fx: null, holdingPrices: {}, loaded: false });

  useEffect(() => {
    if (!earliestDate) {
      setHistories({ sp500: null, kospi: null, fx: null, holdingPrices: {}, loaded: false });
      return;
    }
    let active = true;
    async function load(start: string) {
      const [sp500, kospi, fx, holdingEntries] = await Promise.all([
        fetchHistory(SP500_TICKER, start),
        fetchHistory(KOSPI_TICKER, start),
        fetchHistory(FX_TICKER, start),
        Promise.all(accountTickers.map(async (ticker) => [ticker, toPriceSeries(await fetchHistory(ticker, start)) ?? []] as const)),
      ]);
      if (!active) return;
      setHistories({
        sp500: toPriceSeries(sp500),
        kospi: toPriceSeries(kospi),
        fx: toPriceSeries(fx),
        holdingPrices: Object.fromEntries(holdingEntries),
        loaded: true,
      });
    }
    void load(earliestDate);
    return () => {
      active = false;
    };
  }, [earliestDate, accountTickers]);


  const bases = useMemo(
    () => ACCOUNT_PERF_GROUPS.map((group) => buildAccountGroupPerformance(snapshots, group, { priceHistories: histories.holdingPrices, fxHistory: histories.fx, latestDate: latestSnapshot?.snapshotDate, months: 24, holdings: latestBackcastHoldings?.[group] })),
    [histories.fx, histories.holdingPrices, latestBackcastHoldings, latestSnapshot?.snapshotDate, snapshots],
  );

  const views: GroupView[] = useMemo(() => {
    return bases.map((base) => {
      const flowPoints = base.points.map((point) => ({ date: point.date, netInvestmentKRW: point.netInvestmentKRW }));

      function makeLine(
        key: BenchmarkLine["key"],
        name: string,
        color: string,
        prices: BenchmarkPricePoint[] | null,
        isUsd: boolean,
      ): BenchmarkLine {
        const series = computeBenchmarkSeries({
          points: flowPoints,
          prices: prices ?? [],
          fx: isUsd ? histories.fx : null,
          isUsd,
          startPrincipalKRW: base.points[0]?.depositKRW ?? base.latest?.depositKRW,
        });
        return {
          key,
          name,
          color,
          available: series.available,
          values: series.values,
          latestValue: series.latestValue,
          returnPct: benchmarkReturnPct(series.latestValue, base.latest?.depositKRW ?? 0),
        };
      }

      const benchmarks: BenchmarkLine[] = [
        makeLine("sp500", "S&P 500 투자 시", COLOR_SP500, histories.sp500, true),
        makeLine("kospi", "KOSPI 투자 시", COLOR_KOSPI, histories.kospi, false),
      ];

      return { group: base.group, base, benchmarks };
    });
  }, [bases, histories]);

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-extrabold text-slate-900 dark:text-white">성과 분석</h2>
        <span className="text-[12px] text-slate-500">위탁 / 절세 계좌별 누적 성과 (원본 배당금가계부 이식)</span>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {views.map((view) => (
          <GroupBlock key={view.group} view={view} />
        ))}
      </div>
    </section>
  );
}
