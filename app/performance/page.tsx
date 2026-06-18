"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import TopNav from "@/components/TopNav";
import MetricCard from "@/components/MetricCard";
import QldAssetSummaryCard from "@/components/qld/QldAssetSummaryCard";
import QldValueFxChart from "@/components/qld/QldValueFxChart";
import QldHoldingsRankTable from "@/components/qld/QldHoldingsRankTable";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { usePortfolioSnapshots } from "@/lib/portfolio-store";
import { buildPerformanceFromSnapshots } from "@/lib/performance-from-snapshots";
import { buildPerformanceQldFromSnapshots } from "@/lib/performance-qld-from-snapshots";
import {
  buildPerformanceDividendBars,
  collectPerformanceDividendTickers,
} from "@/lib/performance-dividend-bars";
import { isKrwTicker, type DividendEstimateMarketData } from "@/lib/dividend-estimates";
import { quoteDividendsPath, quoteFxPath, quoteLastPath } from "@/lib/quote-client";
import type { QuoteDividendsResponse, QuoteFxResponse, QuoteLastResponse } from "@/lib/quote-types";
import { formatKoreanMoney, formatPercent } from "@/lib/format";

type MetricTone = "gray" | "green" | "orange" | "blue";

function moneyOrDash(value: number | null): string {
  return value === null ? "—" : formatKoreanMoney(value);
}

function signedMoneyOrDash(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatKoreanMoney(value)}`;
}

function percentOrDash(value: number | null): string {
  return value === null ? "—" : formatPercent(value, 2);
}

function cagrSub(snapshotCount: number): string {
  return snapshotCount < 2 ? "스냅샷 2개 이상 필요" : "입출금 데이터 없음";
}

type DividendMarketData = {
  quotes: Record<string, QuoteLastResponse | undefined>;
  dividends: Record<string, QuoteDividendsResponse | undefined>;
  fx?: QuoteFxResponse;
};

const EMPTY_DIVIDEND_MARKET_DATA: DividendMarketData = { quotes: {}, dividends: {} };

async function fetchQuoteJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

// 투자 성과 = 시간에 따른 성과/투자 결과 분석 (PORTFOLIO-PERF-UI-1)
export default function PerformancePage() {
  const theme = useResolvedTheme();
  const router = useRouter();
  const snapshots = usePortfolioSnapshots();
  // 세전/세후 토글: 평가금 추이 차트의 배당 막대에만 적용 (기본 세후).
  const [afterTax, setAfterTax] = useState(true);
  const [dividendMarketData, setDividendMarketData] = useState<DividendMarketData>(EMPTY_DIVIDEND_MARKET_DATA);
  const performance = useMemo(() => buildPerformanceFromSnapshots(snapshots), [snapshots]);
  const qldPerformance = useMemo(() => buildPerformanceQldFromSnapshots(snapshots), [snapshots]);
  const { metrics } = performance;

  // 평가금 추이 차트의 누적투자원금 라인용 (날짜별 원금).
  const principalByDate = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const point of performance.series) map[point.date] = point.principalKRW;
    return map;
  }, [performance.series]);

  // 위탁 연간예상배당(초록 막대)에 필요한 배당 버킷 티커.
  const dividendTickers = useMemo(() => collectPerformanceDividendTickers(snapshots), [snapshots]);
  const dividendTickerKey = dividendTickers.join("|");

  // 배당현황과 동일한 quote/dividend/fx 데이터를 받아 위탁 연간예상배당을 추정한다.
  useEffect(() => {
    if (!dividendTickerKey) {
      setDividendMarketData(EMPTY_DIVIDEND_MARKET_DATA);
      return;
    }
    let active = true;
    const tickers = dividendTickerKey.split("|");
    const needsUsdKrw = tickers.some((ticker) => !isKrwTicker(ticker));

    async function load() {
      const quoteEntries = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            return [ticker, await fetchQuoteJson<QuoteLastResponse>(quoteLastPath({ ticker }))] as const;
          } catch {
            return [ticker, undefined] as const;
          }
        }),
      );
      const dividendEntries = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            return [ticker, await fetchQuoteJson<QuoteDividendsResponse>(quoteDividendsPath({ ticker, range: "1y" }))] as const;
          } catch {
            return [ticker, undefined] as const;
          }
        }),
      );
      let fx: QuoteFxResponse | undefined;
      if (needsUsdKrw) {
        try {
          fx = await fetchQuoteJson<QuoteFxResponse>(quoteFxPath());
        } catch {
          fx = undefined;
        }
      }
      if (!active) return;
      setDividendMarketData({
        quotes: Object.fromEntries(quoteEntries),
        dividends: Object.fromEntries(dividendEntries),
        fx,
      });
    }

    void load();
    return () => {
      active = false;
    };
  }, [dividendTickerKey]);

  const dividendBars = useMemo(() => {
    const marketDataByTicker: Record<string, DividendEstimateMarketData> = {};
    for (const ticker of dividendTickers) {
      marketDataByTicker[ticker] = {
        quote: dividendMarketData.quotes[ticker],
        dividends: dividendMarketData.dividends[ticker],
        fx: dividendMarketData.fx,
      };
    }
    return buildPerformanceDividendBars(snapshots, marketDataByTicker, { afterTax });
  }, [snapshots, dividendTickers, dividendMarketData, afterTax]);
  const hasSnapshots = metrics.snapshotCount > 0;

  const metricCards: Array<{
    label: string;
    value: string;
    sub?: string;
    tone: MetricTone;
    valueColor?: string;
  }> = [
    {
      label: "투자 평가금액",
      value: moneyOrDash(metrics.currentValueKRW),
      sub: metrics.latestSnapshotDate ? `${metrics.latestSnapshotDate} 스냅샷` : "스냅샷 데이터 없음",
      tone: "gray",
    },
    {
      label: "누적투자원금",
      value: moneyOrDash(metrics.investedPrincipalKRW),
      sub: hasSnapshots ? "투자원금 합계" : "스냅샷 데이터 없음",
      tone: "green",
      valueColor: "#4ade80",
    },
    {
      label: "누적 손익",
      value: signedMoneyOrDash(metrics.cumulativeGainKRW),
      sub: metrics.cumulativeGainKRW === null ? "평가액/원금 필요" : "평가액 - 투자원금",
      tone: "orange",
      valueColor: "#fb923c",
    },
    {
      label: "누적 수익률",
      value: percentOrDash(metrics.cumulativeReturnPct),
      sub: metrics.cumulativeReturnPct === null ? "투자원금 필요" : "누적 손익 / 투자원금",
      tone: "green",
      valueColor: "#4ade80",
    },
    {
      label: "CAGR (자금가중)",
      value: percentOrDash(metrics.moneyWeightedCagrPct),
      sub: cagrSub(metrics.snapshotCount),
      tone: "gray",
    },
    {
      label: "CAGR (시간가중)",
      value: percentOrDash(metrics.timeWeightedCagrPct),
      sub: cagrSub(metrics.snapshotCount),
      tone: "gray",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#181c1d] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {/* 제목줄 */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-[22px] font-extrabold text-slate-900 dark:text-white">
            📈 투자 성과
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/portfolio-manager")}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={15} /> 데이터 입력
            </button>
          </div>
        </div>
        <p className="mb-5 text-[12.5px] text-slate-500">
          저장된 포트폴리오 스냅샷 히스토리로 누적원금 · 투자 평가금액 · 배당금을 분석합니다.
          {!hasSnapshots && " 저장된 스냅샷이 없어 계산 가능한 성과 데이터가 없습니다."}
        </p>

        {/* KPI 6개 */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {metricCards.map((k) => (
            <MetricCard
              key={k.label}
              label={k.label}
              value={k.value}
              sub={k.sub}
              tone={k.tone}
              valueColor={
                k.tone === "green"
                  ? "#4ade80"
                  : k.tone === "orange"
                    ? "#fb923c"
                    : undefined
              }
            />
          ))}
        </div>

        {/* 좌: 투자 평가금액 도넛 / 우: 평가금 추이 (2열) */}
        <section>
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-extrabold text-slate-900 dark:text-white">투자 평가금액 분석</h2>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-[#2a3336] dark:bg-[#1e2324] dark:text-slate-300">
                스냅샷 실데이터
              </span>
              {!qldPerformance.flags.hasValidEvaluation && (
                <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  평가금액 없음
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-slate-500">
              최신 포트폴리오 스냅샷의 투자 평가금액과 보유종목으로 분석합니다.
            </p>
            {qldPerformance.warnings.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {qldPerformance.warnings.slice(0, 3).map((warning) => (
                  <span
                    key={warning}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-[#2a3336] dark:bg-[#171b1c] dark:text-slate-400"
                  >
                    {warning.split(": ")[1] ?? warning}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <QldAssetSummaryCard data={qldPerformance} />
            <QldValueFxChart
              data={qldPerformance}
              principalByDate={principalByDate}
              dividendBars={dividendBars}
              afterTax={afterTax}
              onToggleTax={setAfterTax}
            />
          </div>
          <div className="mt-4">
            <QldHoldingsRankTable data={qldPerformance} />
          </div>
        </section>
      </main>
    </div>
  );
}
