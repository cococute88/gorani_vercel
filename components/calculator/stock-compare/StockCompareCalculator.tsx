"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Info } from "lucide-react";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { fetchCompareData, type CompareData } from "@/lib/stock-compare/service";
import { buildCompareSeries, toTrLevels, type TrLevels } from "@/lib/stock-compare/total-return";
import { computeRollingPointsMulti, computeSeriesMetrics } from "@/lib/stock-compare/metrics";
import { computeContribution } from "@/lib/stock-compare/contribution";
import {
  COMPARE_PERIODS,
  DEFAULT_COMPARE_A,
  DEFAULT_COMPARE_B,
  DEFAULT_COMPARE_PERIOD,
  DEFAULT_RISK_PERIOD,
  RISK_METRIC_PERIODS,
  normalizeCompareTicker,
} from "@/lib/stock-compare/constants";
import type { ComparePeriodKey, CompareSeries, SeriesMetrics } from "@/lib/stock-compare/types";
import TickerSelector from "./TickerSelector";
import CompareOptionsBar, { DEFAULT_COMPARE_OPTIONS, type CompareOptions } from "./CompareOptionsBar";
import OverlapSummary from "./OverlapSummary";
import HoldingsComparisonTable from "./HoldingsComparisonTable";
import PerformanceCards from "./PerformanceCards";
import MetricsTable from "./MetricsTable";
import ContributionCard from "./ContributionCard";
import RollingScatterChart from "./RollingScatterChart";
import RollingHeatmap from "./RollingHeatmap";

// lightweight-charts 는 브라우저 전용 → SSR 비활성 동적 로드.
const PerformanceChart = dynamic(() => import("./PerformanceChart"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[12.5px] text-slate-400">차트 로딩 중…</div>,
});

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const cardTitle = "text-[15px] font-bold text-slate-900 dark:text-white";

// Rolling 1Y TR Heatmap 비활성화 플래그.
// 활용도가 낮아 Rolling 3Y TR Scatter 로 대체했으나, 컴포넌트(RollingHeatmap)는
// 향후 재사용을 위해 보존한다. true 로 바꾸면 Heatmap 섹션이 다시 렌더된다.
const SHOW_ROLLING_HEATMAP = false;

export default function StockCompareCalculator() {
  const theme = useResolvedTheme();
  const dark = theme === "dark";

  const [inputA, setInputA] = useState(DEFAULT_COMPARE_A);
  const [inputB, setInputB] = useState(DEFAULT_COMPARE_B);
  const [options, setOptions] = useState<CompareOptions>(DEFAULT_COMPARE_OPTIONS);
  const [period, setPeriod] = useState<ComparePeriodKey>(DEFAULT_COMPARE_PERIOD);
  // 위험지표 전용 기간(성과 그래프 기간과 독립). API 재호출 없이 클라이언트 재계산만.
  const [metricsPeriod, setMetricsPeriod] = useState<ComparePeriodKey>(DEFAULT_RISK_PERIOD);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 최신 요청만 반영(경쟁 상태 방지).
  const reqIdRef = useRef(0);

  const runCompare = useCallback(async (rawA: string, rawB: string) => {
    const a = normalizeCompareTicker(rawA);
    const b = normalizeCompareTicker(rawB);
    if (!a || !b) {
      setError("두 티커를 모두 입력해 주세요.");
      return;
    }
    const reqId = reqIdRef.current + 1;
    reqIdRef.current = reqId;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCompareData(a, b);
      if (reqIdRef.current !== reqId) return; // 더 최신 요청이 있으면 폐기.
      if (result.sourceA === "empty" && result.sourceB === "empty") {
        setData(null);
        setError(`'${a}' 와 '${b}' 의 가격 데이터를 찾을 수 없습니다. 티커를 확인해 주세요.`);
        return;
      }
      setData(result);
    } catch (e) {
      if (reqIdRef.current !== reqId) return;
      setData(null);
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    } finally {
      if (reqIdRef.current === reqId) setLoading(false);
    }
  }, []);

  // 첫 진입 시 기본 비교(SPY vs QQQ) 자동 실행.
  useEffect(() => {
    void runCompare(DEFAULT_COMPARE_A, DEFAULT_COMPARE_B);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = () => void runCompare(inputA, inputB);
  const handleSwap = () => {
    setInputA(inputB);
    setInputB(inputA);
    void runCompare(inputB, inputA);
  };

  // ── 파생 계산(기간/옵션 변경 시 재계산만, API 호출 없음) ──
  const computed = useMemo(() => {
    if (!data) return null;
    const useTr = options.totalReturn;
    const aLevels: TrLevels = toTrLevels(data.tickerA, data.pointsA, useTr);
    const bLevels: TrLevels = toTrLevels(data.tickerB, data.pointsB, useTr);
    const commonLevels = new Map<string, TrLevels>();
    data.commonPoints.forEach((pts, t) => commonLevels.set(t, toTrLevels(t, pts, useTr)));

    const buildOpts = { removeOverlap: options.removeOverlap, weighted: options.weighted };
    const periodDays = COMPARE_PERIODS.find((p) => p.key === period)?.days ?? 365;

    const { series, exMeta } = buildCompareSeries({
      tickerA: data.tickerA,
      tickerB: data.tickerB,
      aLevels,
      bLevels,
      overlap: data.overlap,
      commonLevels,
      periodDays,
      options: buildOpts,
    });

    const metricsByKey: Record<string, SeriesMetrics> = {};
    for (const s of series) metricsByKey[s.key] = computeSeriesMetrics(s);

    // Rolling TR: 1Y(12개월)·3Y(36개월)를 한 번에 계산.
    // 월말 곡선은 시리즈당 한 번만 계산되어 두 기간이 공유한다(중복 연산 제거).
    const rollingByWindow = computeRollingPointsMulti(series, [12, 36]);
    const rolling1Y = rollingByWindow[12] ?? [];
    const rolling3Y = rollingByWindow[36] ?? [];

    const contributionA = computeContribution({
      trPct: metricsByKey.a?.trPct ?? null,
      trExPct: metricsByKey.aEx?.trPct ?? null,
      wFund: exMeta.aWFund,
      available: exMeta.aAvailable,
    });
    const contributionB = computeContribution({
      trPct: metricsByKey.b?.trPct ?? null,
      trExPct: metricsByKey.bEx?.trPct ?? null,
      wFund: exMeta.bWFund,
      available: exMeta.bAvailable,
    });

    // 위험지표 전용 시리즈(독립 기간). 같은 입력 데이터로 클라이언트 재계산만 한다.
    const riskDays = COMPARE_PERIODS.find((p) => p.key === metricsPeriod)?.days ?? Infinity;
    const { series: riskSeries } = buildCompareSeries({
      tickerA: data.tickerA,
      tickerB: data.tickerB,
      aLevels,
      bLevels,
      overlap: data.overlap,
      commonLevels,
      periodDays: riskDays,
      options: buildOpts,
    });
    const riskMetricsByKey: Record<string, SeriesMetrics> = {};
    for (const s of riskSeries) riskMetricsByKey[s.key] = computeSeriesMetrics(s);

    return { series, metricsByKey, rolling1Y, rolling3Y, contributionA, contributionB, riskSeries, riskMetricsByKey };
  }, [data, options, period, metricsPeriod]);

  const series: CompareSeries[] = computed?.series ?? [];
  const periodLabel = COMPARE_PERIODS.find((p) => p.key === period)?.label ?? "";

  const toggleHidden = (key: string) => setHidden((prev) => ({ ...prev, [key]: !prev[key] }));

  const dataSourceNote = data
    ? `데이터: Yahoo Finance 일별 ${options.totalReturn ? "조정종가(배당 재투자)" : "종가"} · 구성종목: 상위 보유 비중표`
    : null;

  return (
    <div className="space-y-5">
      {/* 입력 + 옵션 */}
      <section className={panel}>
        <h2 className={cardTitle}>종목 성과 비교</h2>
        <p className="mb-4 mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Yahoo Finance 티커 2개를 Total Return 기준으로 비교합니다. ETF 는 구성종목 중복을 비중까지 반영해 중복 제거
          성과를 함께 보여줍니다.
        </p>
        <TickerSelector
          valueA={inputA}
          valueB={inputB}
          onChangeA={setInputA}
          onChangeB={setInputB}
          onSwap={handleSwap}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-[#222a2c]">
          <CompareOptionsBar options={options} onChange={setOptions} disabled={loading} />
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data?.identical && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>동일한 티커를 비교하고 있습니다. 두 시리즈는 동일하게 표시됩니다.</span>
        </div>
      )}

      {computed && series.length > 0 && (
        <>
          {/* 성과 카드 */}
          <PerformanceCards series={series} metricsByKey={computed.metricsByKey} periodLabel={periodLabel} />

          {/* ① Rolling 1Y TR — Scatter / ② Rolling 3Y TR (동일 컴포넌트·스타일, 기간만 다름) */}
          <section className={panel}>
            <h2 className={`${cardTitle} mb-1`}>Rolling 1Y TR — Scatter</h2>
            <p className="mb-3 text-[12px] text-slate-400">월말 기준 직전 1년 누적 수익률</p>
            <div className="h-[300px] w-full">
              <RollingScatterChart points={computed.rolling1Y} series={series} hidden={hidden} dark={dark} />
            </div>
          </section>
          <section className={panel}>
            <h2 className={`${cardTitle} mb-1`}>Rolling 3Y TR</h2>
            <p className="mb-3 text-[12px] text-slate-400">월말 기준 직전 3년 누적 수익률(TR)</p>
            <div className="h-[300px] w-full">
              <RollingScatterChart points={computed.rolling3Y} series={series} hidden={hidden} dark={dark} />
            </div>
          </section>
          {/* (비활성) Rolling 1Y TR — Heatmap. 활용도가 낮아 숨김 처리했으나
              컴포넌트는 보존한다. SHOW_ROLLING_HEATMAP=true 로 즉시 복구 가능. */}
          {SHOW_ROLLING_HEATMAP && (
            <section className={panel}>
              <h2 className={`${cardTitle} mb-1`}>Rolling 1Y TR — Heatmap</h2>
              <p className="mb-3 text-[12px] text-slate-400">월 단위 Rolling TR 색상 강도(초록=양 / 빨강=음)</p>
              <div className="h-[300px] w-full">
                <RollingHeatmap points={computed.rolling1Y} series={series} hidden={hidden} />
              </div>
            </section>
          )}

          {/* ③ TradingView 스타일 메인 그래프 */}
          <section className={panel}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className={cardTitle}>성과 비교 (Total Return)</h2>
              <div className="flex gap-1">
                {COMPARE_PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-bold transition-colors ${
                      period === p.key
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 범례 On/Off */}
            <div className="mb-3 flex flex-wrap gap-2">
              {series.map((s) => {
                const off = hidden[s.key];
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleHidden(s.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                      off
                        ? "border-slate-200 bg-transparent text-slate-400 line-through dark:border-[#2a3336]"
                        : "border-slate-200 bg-white text-slate-700 dark:border-[#2a3336] dark:bg-[#11171a] dark:text-slate-200"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: off ? "#94a3b8" : s.color }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="h-[340px] w-full sm:h-[420px]">
              <PerformanceChart series={series} dark={dark} hidden={hidden} />
            </div>
          </section>

          {/* 구성종목 중복 분석 */}
          <OverlapSummary tickerA={data!.tickerA} tickerB={data!.tickerB} overlap={data!.overlap} />

          {/* 상위 구성종목 비교 */}
          <HoldingsComparisonTable tickerA={data!.tickerA} tickerB={data!.tickerB} overlap={data!.overlap} />

          {/* 구성종목 기여도 */}
          <ContributionCard
            tickerA={data!.tickerA}
            tickerB={data!.tickerB}
            a={computed.contributionA}
            b={computed.contributionB}
          />

          {/* 위험지표(독립 기간 선택) */}
          <MetricsTable
            series={computed.riskSeries.length > 0 ? computed.riskSeries : series}
            metricsByKey={
              computed.riskSeries.length > 0 ? computed.riskMetricsByKey : computed.metricsByKey
            }
            period={metricsPeriod}
            periods={RISK_METRIC_PERIODS}
            onPeriodChange={setMetricsPeriod}
          />

          {dataSourceNote && <p className="px-1 text-[11.5px] text-slate-400">{dataSourceNote}</p>}
        </>
      )}

      {loading && !computed && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-[13px] text-slate-400 dark:border-[#2a3336] dark:bg-[#191f20]">
          데이터를 불러오는 중입니다…
        </div>
      )}
    </div>
  );
}
