"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2 } from "lucide-react";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import {
  DEFAULT_RETURN_PERIOD,
  RETURN_PERIODS,
  buildReturnComparePriceSeries,
  fetchReturnCompareRaw,
  formatReturnPct,
  periodDaysOf,
  type ReturnCompareRaw,
} from "@/lib/market-return-compare";
import type { ActiveReturns } from "./ReturnCompareChart";

// lightweight-charts 는 DOM 에 직접 접근하므로 client-only 로 로드한다.
const ReturnCompareChart = dynamic(() => import("./ReturnCompareChart"), { ssr: false });
const ReturnCompareDetailModal = dynamic(() => import("./ReturnCompareDetailModal"), { ssr: false });

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]";

// 시장 현황: QQQ / SPY / SCHD 누적 수익률 비교 차트(TradingView 스타일).
// 기준일 0% 기준 상대 성과를 한 화면에서 비교한다. 기간 변경은 클라이언트
// 재계산만 수행하므로 추가 API 호출이 없다.
export default function MarketReturnCompareSection() {
  const dark = useResolvedTheme() === "dark";
  const [raw, setRaw] = useState<ReturnCompareRaw | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(DEFAULT_RETURN_PERIOD);
  const [open, setOpen] = useState(false);
  // 차트가 통지하는 "현재 화면 기준" 수익률(확대/축소/드래그 시 갱신).
  const [active, setActive] = useState<ActiveReturns | null>(null);

  // 전체 일별 히스토리를 한 번만 받는다(심볼별 캐시 공유).
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchReturnCompareRaw()
      .then((data) => {
        if (!active) return;
        setRaw(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setRaw({ byKey: {}, source: "empty", warnings: ["fetch failed"] });
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 선택 기간의 일별 종가 시계열(메모이제이션). 차트가 화면 기준으로 % 재계산.
  const series = useMemo(
    () => buildReturnComparePriceSeries(raw, periodDaysOf(period)),
    [raw, period],
  );
  const hasData = series.some((s) => s.prices.length > 0);
  const unavailable = !loading && !hasData;

  // 기간이 바뀌면 화면 기준 수익률을 초기화(차트가 새 기준으로 다시 통지).
  useEffect(() => {
    setActive(null);
  }, [period]);

  // 범례 표시값: 차트가 통지한 화면 기준값 우선, 없으면 기간 시작 기준 폴백.
  const returnFor = (key: string, prices: { close: number }[]): number | null => {
    const fromChart = active?.byKey[key];
    if (fromChart !== undefined) return fromChart;
    if (prices.length < 1) return null;
    const base = prices[0].close;
    const last = prices[prices.length - 1].close;
    if (!base || base <= 0) return null;
    return Number(((last / base - 1) * 100).toFixed(4));
  };

  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-bold text-slate-700 dark:text-slate-300">
              수익률 비교 (QQQ · SPY · SCHD)
            </h3>
            <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-500">
              선택 기간 시작 = 0% 기준 누적 수익률 · 일별 데이터
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#2a3336] dark:text-slate-300 dark:hover:bg-white/10"
          >
            <Maximize2 size={13} />
            상세 보기
          </button>
        </div>

        {/* 기간 선택 + 현재 수익률 범례 */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700/60 dark:bg-[#111516]">
            {RETURN_PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                  period === p.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {series.map((s) => {
              const latest = returnFor(s.key, s.prices);
              return (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{s.label}</span>
                  <span
                    className="num text-[12px] font-semibold"
                    style={{ color: latest != null && latest < 0 ? "#dc2626" : "#16a34a" }}
                  >
                    {formatReturnPct(latest)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* 인라인 차트(클릭 시 상세 보기) */}
        <div className="relative h-[300px] w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center text-[13px] text-slate-500 dark:text-slate-400">
              수익률 비교 데이터를 불러오는 중…
            </div>
          ) : unavailable ? (
            <div className="flex h-full items-center justify-center text-[13px] text-slate-500 dark:text-slate-400">
              수익률 비교 데이터를 조회할 수 없습니다.
            </div>
          ) : (
            <ReturnCompareChart
              series={series}
              dark={dark}
              onClick={() => setOpen(true)}
              onActiveReturns={setActive}
            />
          )}
        </div>
      </div>

      {open && (
        <ReturnCompareDetailModal
          raw={raw}
          loading={loading}
          initialPeriod={period}
          dark={dark}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
