"use client";

import type { CompareSeries, SeriesMetrics } from "@/lib/stock-compare/types";
import { formatSignedPct } from "@/lib/stock-compare/constants";

// =============================================================
// 성과 카드 4개: 티커A / 티커B / 티커A(중복 제거) / 티커B(중복 제거).
// 표시: 기간 TR(%), 상승=초록 / 하락=빨강.
// =============================================================

interface Props {
  series: CompareSeries[];
  metricsByKey: Record<string, SeriesMetrics>;
  periodLabel: string;
}

const UP = "#16a34a";
const DOWN = "#dc2626";

function Card({
  label,
  color,
  tr,
  dashed,
}: {
  label: string;
  color: string;
  tr: number | null;
  dashed: boolean;
}) {
  const valueColor = tr == null ? undefined : tr >= 0 ? UP : DOWN;
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-[#2a3336] dark:bg-[#202627]">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: color,
            ...(dashed ? { boxShadow: `0 0 0 2px ${color}33` } : {}),
          }}
        />
        <span className="truncate text-[12.5px] font-semibold text-slate-500 dark:text-slate-400" title={label}>
          {label}
        </span>
      </div>
      <div className="num mt-2 text-[22px] font-extrabold leading-tight" style={{ color: valueColor }}>
        {formatSignedPct(tr)}
      </div>
      <div className="mt-0.5 text-[11.5px] text-slate-400">기간 Total Return</div>
    </div>
  );
}

export default function PerformanceCards({ series, metricsByKey, periodLabel }: Props) {
  if (series.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">성과 요약</h2>
        <span className="text-[12px] text-slate-400">기간: {periodLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {series.map((s) => (
          <Card
            key={s.key}
            label={s.label}
            color={s.color}
            dashed={s.overlapAdjusted}
            tr={metricsByKey[s.key]?.trPct ?? null}
          />
        ))}
      </div>
    </section>
  );
}
