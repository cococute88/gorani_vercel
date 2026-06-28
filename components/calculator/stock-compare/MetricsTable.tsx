"use client";

import { useState } from "react";
import type { CompareSeries, MetricKey, SeriesMetrics } from "@/lib/stock-compare/types";
import type { ComparePeriod, ComparePeriodKey } from "@/lib/stock-compare/types";
import { METRIC_DEFS } from "@/lib/stock-compare/constants";

// =============================================================
// 위험지표 표. 기본적으로 모든 지표(TR/CAGR/MDD/Sharpe/Sortino/Calmar)가
// 활성화된 상태로 표시된다. 우측 상단 기간 선택(1Y/3Y/5Y/MAX)은 성과 그래프
// 기간과 독립적으로 위험지표만 다시 계산한다.
// METRIC_DEFS 레지스트리를 그대로 사용하므로 지표 추가가 쉽다(확장 가능).
// =============================================================

interface Props {
  series: CompareSeries[];
  metricsByKey: Record<string, SeriesMetrics>;
  period: ComparePeriodKey;
  periods: ComparePeriod[];
  onPeriodChange: (key: ComparePeriodKey) => void;
}

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";

export default function MetricsTable({ series, metricsByKey, period, periods, onPeriodChange }: Props) {
  const [enabled, setEnabled] = useState<Record<MetricKey, boolean>>(() => {
    const init = {} as Record<MetricKey, boolean>;
    METRIC_DEFS.forEach((d) => {
      init[d.key] = d.defaultOn;
    });
    return init;
  });

  if (series.length === 0) return null;

  const activeDefs = METRIC_DEFS.filter((d) => d.key === "tr" || enabled[d.key]);

  // 각 지표 행에서 최고/최저값 강조용 best key 계산.
  const bestByMetric: Record<string, string | null> = {};
  for (const def of activeDefs) {
    let bestKey: string | null = null;
    let bestVal = -Infinity;
    for (const s of series) {
      const v = def.pick(metricsByKey[s.key] ?? ({} as SeriesMetrics));
      if (v == null || !Number.isFinite(v)) continue;
      const score = def.higherIsBetter ? v : -v;
      if (score > bestVal) {
        bestVal = score;
        bestKey = s.key;
      }
    }
    bestByMetric[def.key] = bestKey;
  }

  return (
    <section className={panel}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">위험지표 비교</h2>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11.5px] text-slate-400 sm:inline">위험지표 기간</span>
          <div className="flex gap-1">
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onPeriodChange(p.key)}
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
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {METRIC_DEFS.filter((d) => d.key !== "tr").map((d) => {
          const on = enabled[d.key];
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setEnabled((prev) => ({ ...prev, [d.key]: !prev[d.key] }))}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                on
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-300"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-[#2a3336] dark:bg-[#11171a] dark:text-slate-400 dark:hover:bg-white/5"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-[#2a3336] dark:text-slate-400">
              <th className="px-2 py-2 text-left font-semibold">지표</th>
              {series.map((s) => (
                <th key={s.key} className="px-2 py-2 text-right font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDefs.map((def) => (
              <tr key={def.key} className="border-b border-slate-100 last:border-0 dark:border-[#222a2c]">
                <td className="px-2 py-2 font-semibold text-slate-600 dark:text-slate-300">{def.label}</td>
                {series.map((s) => {
                  const m = metricsByKey[s.key] ?? ({} as SeriesMetrics);
                  const isBest = bestByMetric[def.key] === s.key;
                  return (
                    <td
                      key={s.key}
                      className={`num px-2 py-2 text-right font-semibold ${
                        isBest ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {def.format(m)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] text-slate-400">
        Sharpe·Sortino·Calmar 은 일별 시계열을 252 거래일로 연율화했으며 무위험수익률 0% 를 가정합니다. 파란색은 각 지표
        최우수 시리즈입니다.
      </p>
    </section>
  );
}
