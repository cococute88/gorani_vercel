"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { Holding, PortfolioSnapshot } from "@/lib/portfolio-types";
import {
  buildBacktestDailyCurves,
  buildSnapshotBacktest,
  type BacktestEntry,
  type BacktestPricePoint,
  type BacktestSeriesKey,
} from "@/lib/snapshot-backtest";
import { normalizeHoldingTickerInfo } from "@/lib/holding-ticker-normalizer";
import { getQuoteTickerForHolding } from "@/lib/ticker-mapper";
import {
  MIN_HOLDING_VALUE_KRW,
  matchesAccountTab,
  resolveHoldingDisplayName,
  type AccountTabKey,
} from "@/lib/account-holding-weights";
import { quoteHistoryPath } from "@/lib/quote-client";
import type { QuoteHistoryResponse } from "@/lib/quote-types";
import {
  COMPARE_TICKER_OPTIONS,
  DEFAULT_COMPARE_TICKER,
  normalizeCompareTicker,
} from "@/lib/backtest-compare-tickers";
import { AXIS_LINE, AXIS_TICK_SM, CHART_GRID, CHART_MARGIN, TOOLTIP_STYLE } from "@/lib/chart-style";
import { formatPercent } from "@/lib/format";
import { computeBacktestRiskMetrics, type BacktestRiskMetrics } from "@/lib/backtest-risk-metrics";

interface Props {
  snapshots: PortfolioSnapshot[];
  // 선택된 스냅샷 id. null 이면 최신 스냅샷을 기준으로 한다.
  selectedSnapshotId?: string | null;
  // 상단 "계좌별 종목 비중 조회"와 공유하는 계좌 필터. 기본값은 전체.
  accountTab?: AccountTabKey;
}

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const LEGEND_WRAPPER = { fontSize: 12, paddingTop: 8 };

// 벤치마크/환율 티커: 기존 quote/history API 를 그대로 재사용한다.
const SPY_TICKER = "SPY";
const QQQ_TICKER = "QQQ";
const FX_TICKER = "KRW=X";

// 기간 선택(세그먼트 토글). 기본값 2년(24개월).
const PERIOD_OPTIONS: Array<{ months: number; label: string }> = [
  { months: 24, label: "2년" },
  { months: 12, label: "1년" },
  { months: 6, label: "6개월" },
];
const DEFAULT_MONTHS = 24;

// 마지막 선택값 복원용 localStorage 키.
const STORE_KEY_TICKER = "gorani.backtest.compareTicker";
const STORE_KEY_MONTHS = "gorani.backtest.months";

function eokFmt(value: number): string {
  return `${(value / 100000000).toFixed(1)}억`;
}

function won(value: number | null | undefined): string {
  return value == null ? "계산 불가" : `₩ ${Math.round(value).toLocaleString("ko-KR")}`;
}

function tooltipFormatter(value: number, name: string): [string, string] {
  return [won(value), name];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthHistoryStart(latestDate: string, months: number): string {
  const date = new Date(`${latestDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

function periodLabel(months: number): string {
  return PERIOD_OPTIONS.find((option) => option.months === months)?.label ?? `${months}개월`;
}

function performanceDomain(
  points: Array<Record<BacktestSeriesKey | "date", number | string | null>>,
): [number | string, number | string] {
  const values = points
    .flatMap((point) => [point.portfolio, point.spy, point.qqq, point.custom])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return ["auto", "auto"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.02, 1);
  return [min - range * 0.08, max + range * 0.08];
}

// Quote history 응답을 가격 시계열로 변환한다. sample/빈 응답은 null(=fake 금지).
function toPriceSeries(response: QuoteHistoryResponse | undefined): BacktestPricePoint[] | null {
  if (!response || response.source === "sample") return null;
  const points = (response.prices ?? [])
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

// 스냅샷 보유종목 → 백테스트 엔트리. 표시되는 "계좌별 종목 비중"과 동일한 기준
// (동일 티커 합산, 100만원 미만 제외)을 사용한다.
function buildEntries(holdings: Holding[]): BacktestEntry[] {
  const map = new Map<string, BacktestEntry>();
  for (const holding of holdings ?? []) {
    const valueKRW =
      typeof holding.valueKRW === "number" && Number.isFinite(holding.valueKRW) && holding.valueKRW > 0
        ? holding.valueKRW
        : 0;
    if (valueKRW <= 0) continue;

    const info = normalizeHoldingTickerInfo(holding);
    const quoteTicker = getQuoteTickerForHolding(holding);
    const isCash = !quoteTicker;
    const tickerUpper = (quoteTicker ?? "").toUpperCase();
    const isUsd =
      !isCash &&
      !/^\d{6}(\.(KS|KQ))?$/.test(tickerUpper) &&
      (holding.currency ?? "").toUpperCase() !== "KRW";
    const proxy =
      info.exposureProxy && info.exposureProxy.toUpperCase() !== tickerUpper
        ? info.exposureProxy.toUpperCase()
        : undefined;
    const label = resolveHoldingDisplayName(holding);
    const key = quoteTicker ?? `name:${(holding.cleanName ?? holding.productName ?? label).toUpperCase()}`;

    const existing = map.get(key);
    if (existing) {
      existing.valueKRW += valueKRW;
    } else {
      map.set(key, { key, label, valueKRW, ticker: quoteTicker, proxyTicker: proxy, isUsd, isCash });
    }
  }
  // 표시 비중과 동일하게 100만원 미만 종목은 제외한다.
  return Array.from(map.values()).filter((entry) => entry.valueKRW >= MIN_HOLDING_VALUE_KRW);
}

// 위험조정수익률 비율(소수 2자리). 계산 불가 시 "—".
function ratioFmt(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}

// MDD 등 % 지표(소수 1자리). MDD 는 음수라 부호는 toFixed 가 그대로 붙인다.
function pct1Fmt(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function Kpi({
  label,
  value,
  rate,
  metrics,
  accent,
  unavailable,
}: {
  label: string;
  value: number | null | undefined;
  rate?: number | null;
  metrics: BacktestRiskMetrics;
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
      {!unavailable && (
        <>
          {/* 수익률 + 해당 기간 MDD (기존 원금 자리). 좁은 폭에서는 줄바꿈된다. */}
          <div className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
            {rate != null && <span style={{ color: accent }}>{formatPercent(rate, 1)}</span>}
            <span className="whitespace-nowrap text-slate-500">MDD {pct1Fmt(metrics.mddPct)}</span>
          </div>
          {/* 위험조정수익률 지표. 각 지표를 줄바꿈 단위(whitespace-nowrap)로 묶어
              좁은 모바일 폭(360~430px)에서도 Calmar 가 잘리지 않고 자연 줄바꿈된다. */}
          <div className="num mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] leading-tight text-slate-500">
            <span className="whitespace-nowrap">Sharpe {ratioFmt(metrics.sharpe)}</span>
            <span className="whitespace-nowrap">Sortino {ratioFmt(metrics.sortino)}</span>
            <span className="whitespace-nowrap">Calmar {ratioFmt(metrics.calmar)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function SnapshotBacktestSection({
  snapshots,
  selectedSnapshotId,
  accountTab = "전체",
}: Props) {
  // 기간 / 비교 티커 상태 (마지막 선택값은 localStorage 로 복원).
  const [months, setMonths] = useState<number>(DEFAULT_MONTHS);
  const [customTicker, setCustomTicker] = useState<string>(DEFAULT_COMPARE_TICKER);
  const [tickerInput, setTickerInput] = useState<string>(DEFAULT_COMPARE_TICKER);

  // 최초 마운트 시 마지막 선택값 복원.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedTicker = window.localStorage.getItem(STORE_KEY_TICKER);
      if (savedTicker) {
        const normalized = normalizeCompareTicker(savedTicker);
        if (normalized) {
          setCustomTicker(normalized);
          setTickerInput(normalized);
        }
      }
      const savedMonths = Number(window.localStorage.getItem(STORE_KEY_MONTHS));
      if (PERIOD_OPTIONS.some((option) => option.months === savedMonths)) {
        setMonths(savedMonths);
      }
    } catch {
      // localStorage 접근 불가(시크릿 모드 등)는 무시하고 기본값 사용.
    }
  }, []);

  // 입력값을 디바운스하여 비교 티커로 확정 → 즉시 재계산/재조회.
  useEffect(() => {
    const normalized = normalizeCompareTicker(tickerInput);
    if (!normalized) return;
    const timer = setTimeout(() => setCustomTicker(normalized), 400);
    return () => clearTimeout(timer);
  }, [tickerInput]);

  // 선택값 저장.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORE_KEY_TICKER, customTicker);
      window.localStorage.setItem(STORE_KEY_MONTHS, String(months));
    } catch {
      // 저장 실패는 무시.
    }
  }, [customTicker, months]);

  const latestSnapshot = useMemo(
    () =>
      snapshots.length > 0
        ? snapshots.reduce((latest, item) => (item.snapshotDate >= latest.snapshotDate ? item : latest))
        : null,
    [snapshots],
  );

  const activeSnapshot = useMemo(() => {
    if (selectedSnapshotId) {
      const found = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId);
      if (found) return found;
    }
    return latestSnapshot;
  }, [latestSnapshot, selectedSnapshotId, snapshots]);

  // 상단 계좌 필터와 동일한 기준(matchesAccountTab)으로 보유종목을 거른 뒤 역산한다.
  // → 전체/국내/해외/ISA/연금 선택에 따라 종목 비중·총평가액·원금·그래프가 모두 달라진다.
  const entries = useMemo(() => {
    const all = activeSnapshot?.holdings ?? [];
    const filtered = accountTab === "전체" ? all : all.filter((holding) => matchesAccountTab(holding, accountTab));
    return buildEntries(filtered);
  }, [activeSnapshot, accountTab]);

  // 가격 조회가 필요한 티커 목록(보유 + 대체 프록시). 현금성은 제외.
  const holdingTickers = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (entry.ticker) set.add(entry.ticker.toUpperCase());
      if (entry.proxyTicker) set.add(entry.proxyTicker.toUpperCase());
    }
    return Array.from(set).sort();
  }, [entries]);

  // 기간 선택에 맞춰 조회 시작일을 다시 계산 → API 재조회 범위와 그래프 범위를 일치시킨다.
  const start = useMemo(() => monthHistoryStart(todayISO(), months + 1), [months]);
  const fetchKey = useMemo(
    () => `${activeSnapshot?.id ?? "none"}|${months}|${customTicker}|${holdingTickers.join(",")}`,
    [activeSnapshot, months, customTicker, holdingTickers],
  );

  const [histories, setHistories] = useState<{
    holdingPrices: Record<string, BacktestPricePoint[]>;
    spy: BacktestPricePoint[] | null;
    qqq: BacktestPricePoint[] | null;
    custom: BacktestPricePoint[] | null;
    customInvalid: boolean;
    fx: BacktestPricePoint[] | null;
    loaded: boolean;
  }>({ holdingPrices: {}, spy: null, qqq: null, custom: null, customInvalid: false, fx: null, loaded: false });

  useEffect(() => {
    if (!activeSnapshot) {
      setHistories({
        holdingPrices: {},
        spy: null,
        qqq: null,
        custom: null,
        customInvalid: false,
        fx: null,
        loaded: false,
      });
      return;
    }
    let active = true;
    setHistories((prev) => ({ ...prev, loaded: false }));
    async function load() {
      const [spy, qqq, customResponse, fx, holdingEntries] = await Promise.all([
        fetchHistory(SPY_TICKER, start),
        fetchHistory(QQQ_TICKER, start),
        fetchHistory(customTicker, start),
        fetchHistory(FX_TICKER, start),
        Promise.all(
          holdingTickers.map(async (ticker) => [ticker, toPriceSeries(await fetchHistory(ticker, start)) ?? []] as const),
        ),
      ]);
      if (!active) return;
      // 존재하지 않는 티커는 quote API 가 source="sample" 로 응답한다 → 유효하지 않은 티커로 처리.
      const customInvalid = customResponse != null && customResponse.source === "sample";
      setHistories({
        holdingPrices: Object.fromEntries(holdingEntries),
        spy: toPriceSeries(spy),
        qqq: toPriceSeries(qqq),
        custom: toPriceSeries(customResponse),
        customInvalid,
        fx: toPriceSeries(fx),
        loaded: true,
      });
    }
    void load();
    return () => {
      active = false;
    };
    // fetchKey 가 티커/스냅샷/기간 변경을 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, start]);

  const customLabel = `${customTicker} 투자 시`;

  const result = useMemo(
    () =>
      buildSnapshotBacktest({
        entries,
        priceHistories: histories.holdingPrices,
        benchmarkHistories: { spy: histories.spy, qqq: histories.qqq, custom: histories.custom },
        fxHistory: histories.fx,
        months,
        asOfDate: todayISO(),
        customTicker,
        customLabel,
        customIsUsd: true,
      }),
    [entries, histories, months, customTicker, customLabel],
  );

  // 위험지표 전용 "일별" 평가액 곡선. 차트(월별 축약)와 달리 기간 내 모든 거래일을
  // 축으로 사용한다 → MDD 가 기간 내 최대 낙폭(월중 하락)을 정확히 반영한다.
  // 차트는 result.points(월별)를, 지표는 dailyCurves(일별)를 쓴다(요구사항 4·5: 분리).
  const dailyCurves = useMemo(
    () =>
      buildBacktestDailyCurves({
        entries,
        priceHistories: histories.holdingPrices,
        benchmarkHistories: { spy: histories.spy, qqq: histories.qqq, custom: histories.custom },
        fxHistory: histories.fx,
        months,
        asOfDate: todayISO(),
        customTicker,
        customLabel,
        customIsUsd: true,
      }),
    [entries, histories, months, customTicker, customLabel],
  );

  // 카드별 위험/위험조정수익률 지표. 일별 곡선에서 각 시리즈를 독립 계산한다
  // → 기간 변경 시 즉시 재계산되고, 모든 비교군(포트/SPY/QQQ/custom)이 동일 기준이다.
  const cardMetrics = useMemo<Record<BacktestSeriesKey, BacktestRiskMetrics>>(
    () => ({
      portfolio: computeBacktestRiskMetrics(dailyCurves.portfolio),
      spy: computeBacktestRiskMetrics(dailyCurves.spy),
      qqq: computeBacktestRiskMetrics(dailyCurves.qqq),
      custom: computeBacktestRiskMetrics(dailyCurves.custom),
    }),
    [dailyCurves],
  );

  const seriesMeta = useMemo<
    Array<{ key: BacktestSeriesKey; name: string; color: string; width: number; dashed: boolean }>
  >(
    () => [
      { key: "portfolio", name: "내 포트폴리오", color: "#3b82f6", width: 2.4, dashed: false },
      { key: "spy", name: "SPY 투자 시", color: "#10b981", width: 1.6, dashed: true },
      { key: "qqq", name: "QQQ 투자 시", color: "#f97316", width: 1.6, dashed: true },
      { key: "custom", name: customLabel, color: "#a855f7", width: 1.6, dashed: true },
    ],
    [customLabel],
  );

  const chartPoints = useMemo(
    () =>
      result.points.map((point) => ({
        date: point.date,
        portfolio: point.portfolio,
        spy: point.spy,
        qqq: point.qqq,
        custom: point.custom,
      })),
    [result.points],
  );

  const cardWarnings = result.warnings.filter((warning) => warning !== "환율 미반영");
  const showFxNotice = !result.fxApplied;
  const titleLabel = periodLabel(months);

  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-extrabold text-slate-900 dark:text-white">{titleLabel} 역산 성과 분석</h2>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">스냅샷 비중 기준 역산</span>
            {/* 현재 적용 중인 조건(스냅샷·계좌·기간·비교티커)을 즉시 확인할 수 있게 표시한다. */}
            <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              계좌 {accountTab}
            </span>
            {activeSnapshot && (
              <span className="text-[12px] text-slate-500">
                {activeSnapshot.snapshotDate} 스냅샷 · 계좌 {accountTab} · {titleLabel} · 비교 {customTicker}
                {/* 원금은 카드마다 반복하지 않고 상단 분석 정보 영역에서 한 번만 표시한다. */}
                {result.available && result.basePrincipalKRW > 0 && (
                  <> · 원금 {won(result.basePrincipalKRW)}</>
                )}
              </span>
            )}
          </div>

          {/* 기간 / 비교 티커 선택 — 우측 상단. 모바일에서는 줄바꿈된다. */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-[#2a3336] dark:bg-[#11181a]"
              role="group"
              aria-label="기간 선택"
            >
              {PERIOD_OPTIONS.map((option) => {
                const activePeriod = option.months === months;
                return (
                  <button
                    key={option.months}
                    type="button"
                    onClick={() => setMonths(option.months)}
                    aria-pressed={activePeriod}
                    className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                      activePeriod
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
              비교 티커
              <input
                list="snapshot-compare-tickers"
                value={tickerInput}
                onChange={(event) => setTickerInput(event.target.value.toUpperCase())}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder="SCHD"
                aria-label="비교 티커 입력"
                className="w-[120px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] font-bold uppercase text-slate-900 outline-none focus:border-blue-400 dark:border-[#2a3336] dark:bg-[#11181a] dark:text-slate-100"
              />
            </label>
            <datalist id="snapshot-compare-tickers">
              {COMPARE_TICKER_OPTIONS.map((option) => (
                <option key={option.ticker} value={option.ticker}>
                  {option.name}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        {histories.loaded && histories.customInvalid && (
          <div className="mt-2 inline-block rounded-md bg-rose-500/10 px-2 py-0.5 text-[11.5px] text-rose-500">
            유효하지 않은 티커입니다. (비교 티커 가격 데이터를 찾을 수 없습니다)
          </div>
        )}

        {!activeSnapshot ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[13px] text-slate-500 dark:border-[#334044] dark:bg-[#11181a]">
            등록된 스냅샷이 없습니다. 엑셀을 업로드하고 스냅샷을 등록하면 역산 성과를 분석할 수 있습니다.
          </div>
        ) : !histories.loaded ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[13px] text-slate-500 dark:border-[#334044] dark:bg-[#11181a]">
            과거 가격 데이터를 불러오는 중입니다…
          </div>
        ) : !result.available ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[13px] text-slate-500 dark:border-[#334044] dark:bg-[#11181a]">
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              {result.unavailableReason ?? "성과분석 데이터 부족"}
            </div>
            <div className="mt-1">과거 가격 데이터를 불러오지 못했습니다. 샘플/가짜 그래프는 표시하지 않습니다.</div>
          </div>
        ) : (
          <>
            <p className="mb-4 mt-1 text-[12px] text-slate-500">
              선택한 스냅샷의 종목 비중을 {titleLabel} 전에 그대로 매수했다고 가정하고, 동일 원금을 SPY · QQQ · {customTicker} 에 전액 투자한 경우와 비교합니다.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {seriesMeta.map((meta) => {
                const c = result.cards[meta.key];
                return (
                  <Kpi
                    key={meta.key}
                    label={meta.name}
                    value={c.currentValueKRW}
                    rate={c.returnPct}
                    metrics={cardMetrics[meta.key]}
                    accent={meta.color}
                    unavailable={!c.available}
                  />
                );
              })}
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPoints} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK_SM} tickLine={false} axisLine={AXIS_LINE} minTickGap={24} />
                  <YAxis
                    domain={performanceDomain(chartPoints)}
                    tickFormatter={eokFmt}
                    tick={AXIS_TICK_SM}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                  <Legend wrapperStyle={LEGEND_WRAPPER} />
                  {seriesMeta.map((meta) => (
                    <Line
                      key={meta.key}
                      type="monotone"
                      dataKey={meta.key}
                      name={meta.name}
                      stroke={meta.color}
                      strokeWidth={meta.width}
                      strokeDasharray={meta.dashed ? "5 4" : undefined}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {showFxNotice && (
              <div className="mt-3 inline-block rounded-md bg-amber-500/10 px-2 py-0.5 text-[11.5px] text-amber-500">
                환율 미반영 (USD/KRW 환율 데이터를 불러오지 못해 달러 종목은 환율 변동을 반영하지 않았습니다)
              </div>
            )}
            {cardWarnings.length > 0 && (
              <div className="mt-2 text-[11.5px] text-slate-500">{cardWarnings.join(" · ")}</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
