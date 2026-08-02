"use client";

import type { CompareSeries, ReturnCorrelationResult, SeriesMetrics } from "@/lib/stock-compare/types";
import { formatSignedPct } from "@/lib/stock-compare/constants";

// =============================================================
// 성과 카드: 티커A / 티커B / 티커A(중복 제거) / 티커B(중복 제거) / 수익률 상관계수.
// 표시: 기간 TR(%), 상승=초록 / 하락=빨강.
// =============================================================

interface Props {
  series: CompareSeries[];
  metricsByKey: Record<string, SeriesMetrics>;
  periodLabel: string;
  correlation: ReturnCorrelationResult | null;
  correlationState: "idle" | "loading" | "ready";
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

function CorrelationCard({
  result,
  state,
}: {
  result: ReturnCorrelationResult | null;
  state: Props["correlationState"];
}) {
  const calculating = state === "loading";
  const idle = state === "idle";
  const correlationValue = state === "ready" && result?.status === "ok" ? result.correlation : null;
  const available = correlationValue != null;
  const value = calculating
    ? "계산 중…"
    : idle
      ? "비교 후 계산"
      : available
        ? correlationValue.toFixed(3)
        : "계산 불가";
  const caption = calculating
    ? "공통 거래일 확인 중"
    : idle
      ? "공통 거래일 확인 전"
      : available && result
        ? `공통 거래일 ${result.observations}일 기준`
        : "공통 거래일 부족";

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-[#2a3336] dark:bg-[#202627]">
      <div className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">수익률 상관계수</div>
      <div className="num mt-2 text-[22px] font-extrabold leading-tight text-slate-900 dark:text-white">{value}</div>
      <p className="mt-0.5 text-[11.5px] text-slate-400">{caption}</p>
    </div>
  );
}

export default function PerformanceCards({
  series,
  metricsByKey,
  periodLabel,
  correlation,
  correlationState,
}: Props) {
  if (series.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">성과 요약</h2>
        <span className="text-[12px] text-slate-400">기간: {periodLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {series.map((s) => (
          <Card
            key={s.key}
            label={s.label}
            color={s.color}
            dashed={s.overlapAdjusted}
            tr={metricsByKey[s.key]?.trPct ?? null}
          />
        ))}
        <CorrelationCard result={correlation} state={correlationState} />
      </div>
    </section>
  );
}
