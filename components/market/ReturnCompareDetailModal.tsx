"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  DEFAULT_RETURN_PERIOD,
  RETURN_PERIODS,
  computeReturnCompareSeries,
  formatReturnPct,
  periodDaysOf,
  type ReturnCompareRaw,
} from "@/lib/market-return-compare";
import ReturnCompareChart from "./ReturnCompareChart";

interface Props {
  raw: ReturnCompareRaw | null;
  loading: boolean;
  initialPeriod?: string;
  dark: boolean;
  onClose: () => void;
}

// 누적 수익률 비교 "상세 보기" 모달.
// 인라인 차트와 동일 데이터(raw)를 공유하므로 추가 API 호출이 없다.
// 대형 차트에서 휠 확대 / 드래그 이동 / 긴 기간 탐색이 자유롭게 가능하다.
export default function ReturnCompareDetailModal({
  raw,
  loading,
  initialPeriod = DEFAULT_RETURN_PERIOD,
  dark,
  onClose,
}: Props) {
  const [period, setPeriod] = useState(initialPeriod);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const series = useMemo(() => computeReturnCompareSeries(raw, periodDaysOf(period)), [raw, period]);
  const empty = !loading && series.every((s) => s.points.length === 0);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a3336] dark:bg-[#15191a]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#2a3336] sm:px-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-extrabold text-slate-900 dark:text-white">수익률 비교 상세</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              QQQ · SPY · SCHD · 선택 기간 시작 = 0% · 일별 데이터 · 휠 확대 / 드래그 이동
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls: 기간 버튼 + 현재 수익률 범례 */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 px-4 py-2 dark:border-[#2a3336] sm:px-5">
          <div className="flex flex-nowrap items-center gap-1 overflow-x-auto">
            {RETURN_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  period === p.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {series.map((s) => {
              const latest = s.points.length ? s.points[s.points.length - 1].value : null;
              return (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-200">{s.label}</span>
                  <span
                    className="num text-[11.5px] font-semibold"
                    style={{ color: latest != null && latest < 0 ? "#dc2626" : "#16a34a" }}
                  >
                    {formatReturnPct(latest)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Chart */}
        <div className="relative min-h-0 flex-1 px-2 py-2 sm:px-3">
          <ReturnCompareChart series={series} dark={dark} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-500 dark:text-slate-400">
              차트 데이터를 불러오는 중…
            </div>
          )}
          {empty && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-400">
              표시할 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
