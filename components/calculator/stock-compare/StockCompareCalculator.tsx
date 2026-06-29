"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Info } from "lucide-react";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { fetchCompareData, type CompareData } from "@/lib/stock-compare/service";
import { buildCompareSeries, toTrLevels, windowCompareSeries, type TrLevels } from "@/lib/stock-compare/total-return";
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
import TrPrToggle, { type TrPrMode } from "@/components/common/TrPrToggle";
import OverlapSummary from "./OverlapSummary";
import HoldingsComparisonTable from "./HoldingsComparisonTable";
import PerformanceCards from "./PerformanceCards";
import MetricsTable from "./MetricsTable";
import ContributionCard from "./ContributionCard";
import RollingScatterChart from "./RollingScatterChart";

// lightweight-charts 는 브라우저 전용 → SSR 비활성 동적 로드.
const PerformanceChart = dynamic(() => import("./PerformanceChart"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[12.5px] text-slate-400">차트 로딩 중…</div>,
});

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const cardTitle = "text-[15px] font-bold text-slate-900 dark:text-white";

// Rolling TR 기간 탭 정의. 단일 RollingScatterChart 를 재사용하며 "월말 곡선에서
// 직전 N개월 누적 TR" 의 N(monthsBack)만 바꾼다(1Y=12, 3Y=36, 5Y=60).
// 세 기간의 포인트는 computed 단계에서 한 번에(중복 연산 없이) 미리 계산해 두므로,
// 탭 전환은 추가 API 호출/재계산 없이 미리 계산된 배열을 선택만 한다.
const ROLLING_TABS: ReadonlyArray<{ key: number; label: string; sub: string }> = [
  { key: 12, label: "1Y", sub: "월말 기준 직전 1년 누적 수익률(TR)" },
  { key: 36, label: "3Y", sub: "월말 기준 직전 3년 누적 수익률(TR)" },
  { key: 60, label: "5Y", sub: "월말 기준 직전 5년 누적 수익률(TR)" },
];
const ROLLING_WINDOWS = ROLLING_TABS.map((t) => t.key);

export default function StockCompareCalculator() {
  const theme = useResolvedTheme();
  const dark = theme === "dark";

  const [inputA, setInputA] = useState(DEFAULT_COMPARE_A);
  const [inputB, setInputB] = useState(DEFAULT_COMPARE_B);
  const [options, setOptions] = useState<CompareOptions>(DEFAULT_COMPARE_OPTIONS);
  const [period, setPeriod] = useState<ComparePeriodKey>(DEFAULT_COMPARE_PERIOD);
  // 위험지표 전용 기간(성과 그래프 기간과 독립). API 재호출 없이 클라이언트 재계산만.
  const [metricsPeriod, setMetricsPeriod] = useState<ComparePeriodKey>(DEFAULT_RISK_PERIOD);
  // Rolling TR 기간 탭(1Y=12 / 3Y=36 / 5Y=60). 탭 전환은 미리 계산된 배열 선택만 한다.
  const [rollingWindow, setRollingWindow] = useState<number>(12);
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

  // ── 파생 계산 ──
  // base: MAX(전체) 시리즈 + Rolling 을 한 번만 계산한다. 기간(period)에는
  // 의존하지 않으므로 기간 버튼을 눌러도 무거운 buildCompareSeries/중복 제거
  // 인덱스가 다시 계산되지 않는다(데이터/옵션 변경 시에만 재계산).
  const base = useMemo(() => {
    if (!data) return null;
    const useTr = options.totalReturn;
    const aLevels: TrLevels = toTrLevels(data.tickerA, data.pointsA, useTr);
    const bLevels: TrLevels = toTrLevels(data.tickerB, data.pointsB, useTr);
    const commonLevels = new Map<string, TrLevels>();
    data.commonPoints.forEach((pts, t) => commonLevels.set(t, toTrLevels(t, pts, useTr)));

    const buildOpts = { removeOverlap: options.removeOverlap, weighted: options.weighted };

    // MAX(전체) 누적수익률 시리즈. 차트는 이 MAX 를 받아 기간 버튼만큼 Zoom 한다.
    const { series: maxSeries, exMeta } = buildCompareSeries({
      tickerA: data.tickerA,
      tickerB: data.tickerB,
      aLevels,
      bLevels,
      overlap: data.overlap,
      commonLevels,
      periodDays: Infinity,
      options: buildOpts,
    });

    // Rolling TR(1Y/3Y/5Y): MAX 시리즈에서 계산 → 상단 그래프 기간/Zoom 과 완전히
    // 독립적이다. 월말 곡선은 시리즈당 한 번만 계산되어 세 기간이 공유한다.
    const rollingByWindow = computeRollingPointsMulti(maxSeries, ROLLING_WINDOWS);

    return { maxSeries, exMeta, rollingByWindow };
  }, [data, options]);

  // view: 성과 카드/범례용 "기간 윈도" 시리즈·지표. MAX 시리즈를 잘라 0% 재기준화만
  // 하므로(가벼운 연산) 기간 변경 시 누적수익률을 다시 만들지 않는다.
  const view = useMemo(() => {
    if (!base) return null;
    const periodDays = COMPARE_PERIODS.find((p) => p.key === period)?.days ?? 365;
    const series = windowCompareSeries(base.maxSeries, periodDays);

    const metricsByKey: Record<string, SeriesMetrics> = {};
    for (const s of series) metricsByKey[s.key] = computeSeriesMetrics(s);

    const contributionA = computeContribution({
      trPct: metricsByKey.a?.trPct ?? null,
      trExPct: metricsByKey.aEx?.trPct ?? null,
      wFund: base.exMeta.aWFund,
      available: base.exMeta.aAvailable,
    });
    const contributionB = computeContribution({
      trPct: metricsByKey.b?.trPct ?? null,
      trExPct: metricsByKey.bEx?.trPct ?? null,
      wFund: base.exMeta.bWFund,
      available: base.exMeta.bAvailable,
    });

    return { series, metricsByKey, contributionA, contributionB };
  }, [base, period]);

  // 위험지표 전용 시리즈(독립 기간). 동일하게 MAX 시리즈를 잘라 재기준화만 한다.
  const riskView = useMemo(() => {
    if (!base) return null;
    const riskDays = COMPARE_PERIODS.find((p) => p.key === metricsPeriod)?.days ?? Infinity;
    const riskSeries = windowCompareSeries(base.maxSeries, riskDays);
    const riskMetricsByKey: Record<string, SeriesMetrics> = {};
    for (const s of riskSeries) riskMetricsByKey[s.key] = computeSeriesMetrics(s);
    return { riskSeries, riskMetricsByKey };
  }, [base, metricsPeriod]);

  // 성과 그래프(차트)는 MAX 시리즈를 받아 기간만큼 Zoom 한다.
  const maxSeries: CompareSeries[] = base?.maxSeries ?? [];
  const series: CompareSeries[] = view?.series ?? [];
  const periodLabel = COMPARE_PERIODS.find((p) => p.key === period)?.label ?? "";
  const periodDays = COMPARE_PERIODS.find((p) => p.key === period)?.days ?? 365;

  // 현재 선택된 Rolling 탭의 미리 계산된 포인트(없으면 빈 배열) + 부제 텍스트.
  const rollingPoints = base?.rollingByWindow[rollingWindow] ?? [];
  const activeRollingTab = ROLLING_TABS.find((t) => t.key === rollingWindow) ?? ROLLING_TABS[0];

  // TR/PR 토글은 옵션의 totalReturn 과 동기화된다(기본 TR).
  const trMode: TrPrMode = options.totalReturn ? "tr" : "pr";
  const setTrMode = (mode: TrPrMode) => setOptions((prev) => ({ ...prev, totalReturn: mode === "tr" }));

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

      {view && series.length > 0 && (
        <>
          {/* 성과 카드 */}
          <PerformanceCards series={series} metricsByKey={view.metricsByKey} periodLabel={periodLabel} />

          {/* ① TradingView 스타일 성과 비교 메인 그래프 (성과 카드 바로 아래 = 원래 위치) */}
          <section className={panel}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className={cardTitle}>성과 비교 ({trMode === "tr" ? "Total Return" : "Price Return"})</h2>
              <div className="flex flex-wrap items-center gap-2">
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
                <TrPrToggle mode={trMode} onChange={setTrMode} disabled={loading} />
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
              {/* 차트는 MAX 시리즈를 받고 viewDays(기간)만큼 Zoom 한다. */}
              <PerformanceChart series={maxSeries} dark={dark} hidden={hidden} viewDays={periodDays} />
            </div>
          </section>

          {/* ② Rolling TR — Scatter (1Y / 3Y / 5Y 탭). 단일 RollingScatterChart 를
              재사용하고 탭으로 Rolling 기간(monthsBack)만 바꾼다. 포인트는 MAX
              시리즈에서 미리 계산되어 상단 그래프의 기간/Zoom 과 완전히 독립적이다. */}
          <section className={panel}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className={cardTitle}>Rolling TR — Scatter</h2>
              <div className="flex gap-1" role="tablist" aria-label="Rolling TR 기간">
                {ROLLING_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={rollingWindow === t.key}
                    onClick={() => setRollingWindow(t.key)}
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-bold transition-colors ${
                      rollingWindow === t.key
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mb-3 text-[12px] text-slate-400">{activeRollingTab.sub}</p>
            <div className="h-[300px] w-full">
              <RollingScatterChart points={rollingPoints} series={series} hidden={hidden} dark={dark} />
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
            a={view.contributionA}
            b={view.contributionB}
          />

          {/* 위험지표(독립 기간 선택) */}
          <MetricsTable
            series={riskView && riskView.riskSeries.length > 0 ? riskView.riskSeries : series}
            metricsByKey={
              riskView && riskView.riskSeries.length > 0 ? riskView.riskMetricsByKey : view.metricsByKey
            }
            period={metricsPeriod}
            periods={RISK_METRIC_PERIODS}
            onPeriodChange={setMetricsPeriod}
          />

          {dataSourceNote && <p className="px-1 text-[11.5px] text-slate-400">{dataSourceNote}</p>}
        </>
      )}

      {loading && !view && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-[13px] text-slate-400 dark:border-[#2a3336] dark:bg-[#191f20]">
          데이터를 불러오는 중입니다…
        </div>
      )}
    </div>
  );
}
