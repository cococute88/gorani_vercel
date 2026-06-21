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
  buildSnapshotBacktest,
  type BacktestEntry,
  type BacktestPricePoint,
  type BacktestSeriesKey,
} from "@/lib/snapshot-backtest";
import { normalizeHoldingTickerInfo } from "@/lib/holding-ticker-normalizer";
import { getQuoteTickerForHolding } from "@/lib/ticker-mapper";
import {
  MIN_HOLDING_VALUE_KRW,
  resolveHoldingDisplayName,
} from "@/lib/account-holding-weights";
import { quoteHistoryPath } from "@/lib/quote-client";
import type { QuoteHistoryResponse } from "@/lib/quote-types";
import { AXIS_LINE, AXIS_TICK_SM, CHART_GRID, CHART_MARGIN, TOOLTIP_STYLE } from "@/lib/chart-style";
import { formatPercent } from "@/lib/format";

interface Props {
  snapshots: PortfolioSnapshot[];
  // 선택된 스냅샷 id. null 이면 최신 스냅샷을 기준으로 한다.
  selectedSnapshotId?: string | null;
}

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const LEGEND_WRAPPER = { fontSize: 12, paddingTop: 8 };
const BACKTEST_MONTHS = 24;

// 벤치마크/환율 티커: 기존 quote/history API 를 그대로 재사용한다.
const SPY_TICKER = "SPY";
const QQQ_TICKER = "QQQ";
const KOSPI_TICKER = "^KS11";
const FX_TICKER = "KRW=X";

const SERIES_META: Array<{ key: BacktestSeriesKey; name: string; color: string; width: number; dashed: boolean }> = [
  { key: "portfolio", name: "내 포트폴리오", color: "#3b82f6", width: 2.4, dashed: false },
  { key: "spy", name: "SPY 투자 시", color: "#10b981", width: 1.6, dashed: true },
  { key: "qqq", name: "QQQ 투자 시", color: "#f97316", width: 1.6, dashed: true },
  { key: "kospi", name: "KOSPI 투자 시", color: "#f59e0b", width: 1.6, dashed: true },
];

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

function performanceDomain(
  points: Array<Record<BacktestSeriesKey | "date", number | string | null>>,
): [number | string, number | string] {
  const values = points
    .flatMap((point) => [point.portfolio, point.spy, point.qqq, point.kospi])
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

function Kpi({
  label,
  principal,
  value,
  rate,
  accent,
  unavailable,
}: {
  label: string;
  principal: number;
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
      {!unavailable && (
        <div className="num mt-0.5 flex items-center gap-1.5 text-[11px]">
          {rate != null && <span style={{ color: accent }}>{formatPercent(rate, 1)}</span>}
          <span className="text-slate-500">원금 {won(principal)}</span>
        </div>
      )}
    </div>
  );
}

export default function SnapshotBacktestSection({ snapshots, selectedSnapshotId }: Props) {
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

  const entries = useMemo(() => buildEntries(activeSnapshot?.holdings ?? []), [activeSnapshot]);

  // 가격 조회가 필요한 티커 목록(보유 + 대체 프록시). 현금성은 제외.
  const holdingTickers = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (entry.ticker) set.add(entry.ticker.toUpperCase());
      if (entry.proxyTicker) set.add(entry.proxyTicker.toUpperCase());
    }
    return Array.from(set).sort();
  }, [entries]);

  const start = useMemo(() => monthHistoryStart(todayISO(), BACKTEST_MONTHS + 1), []);
  const fetchKey = useMemo(() => `${activeSnapshot?.id ?? "none"}|${holdingTickers.join(",")}`, [activeSnapshot, holdingTickers]);

  const [histories, setHistories] = useState<{
    holdingPrices: Record<string, BacktestPricePoint[]>;
    spy: BacktestPricePoint[] | null;
    qqq: BacktestPricePoint[] | null;
    kospi: BacktestPricePoint[] | null;
    fx: BacktestPricePoint[] | null;
    loaded: boolean;
  }>({ holdingPrices: {}, spy: null, qqq: null, kospi: null, fx: null, loaded: false });

  useEffect(() => {
    if (!activeSnapshot) {
      setHistories({ holdingPrices: {}, spy: null, qqq: null, kospi: null, fx: null, loaded: false });
      return;
    }
    let active = true;
    setHistories((prev) => ({ ...prev, loaded: false }));
    async function load() {
      const [spy, qqq, kospi, fx, holdingEntries] = await Promise.all([
        fetchHistory(SPY_TICKER, start),
        fetchHistory(QQQ_TICKER, start),
        fetchHistory(KOSPI_TICKER, start),
        fetchHistory(FX_TICKER, start),
        Promise.all(
          holdingTickers.map(async (ticker) => [ticker, toPriceSeries(await fetchHistory(ticker, start)) ?? []] as const),
        ),
      ]);
      if (!active) return;
      setHistories({
        holdingPrices: Object.fromEntries(holdingEntries),
        spy: toPriceSeries(spy),
        qqq: toPriceSeries(qqq),
        kospi: toPriceSeries(kospi),
        fx: toPriceSeries(fx),
        loaded: true,
      });
    }
    void load();
    return () => {
      active = false;
    };
    // fetchKey 가 티커/스냅샷 변경을 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, start]);

  const result = useMemo(
    () =>
      buildSnapshotBacktest({
        entries,
        priceHistories: histories.holdingPrices,
        benchmarkHistories: { spy: histories.spy, qqq: histories.qqq, kospi: histories.kospi },
        fxHistory: histories.fx,
        months: BACKTEST_MONTHS,
        asOfDate: todayISO(),
      }),
    [entries, histories],
  );

  const chartPoints = useMemo(
    () =>
      result.points.map((point) => ({
        date: point.date,
        portfolio: point.portfolio,
        spy: point.spy,
        qqq: point.qqq,
        kospi: point.kospi,
      })),
    [result.points],
  );

  const cardWarnings = result.warnings.filter((warning) => warning !== "환율 미반영");
  const showFxNotice = !result.fxApplied;

  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-extrabold text-slate-900 dark:text-white">2년 역산 성과 분석</h2>
          <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">스냅샷 비중 기준 역산</span>
          {activeSnapshot && (
            <span className="text-[12px] text-slate-500">
              {activeSnapshot.snapshotDate} 스냅샷 비중 · 2년 전 동일 비중 매수 가정
            </span>
          )}
        </div>

        {!activeSnapshot ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[13px] text-slate-500 dark:border-[#334044] dark:bg-[#11181a]">
            등록된 스냅샷이 없습니다. 엑셀을 업로드하고 스냅샷을 등록하면 2년 역산 성과를 분석할 수 있습니다.
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
              선택한 스냅샷의 종목 비중을 2년 전에 그대로 매수했다고 가정하고, 동일 원금을 SPY · QQQ · KOSPI 에 전액 투자한 경우와 비교합니다.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {SERIES_META.map((meta) => {
                const c = result.cards[meta.key];
                return (
                  <Kpi
                    key={meta.key}
                    label={meta.name}
                    principal={result.basePrincipalKRW}
                    value={c.currentValueKRW}
                    rate={c.returnPct}
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
                  {SERIES_META.map((meta) => (
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
