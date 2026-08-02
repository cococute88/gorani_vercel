"use client";

import { Info } from "lucide-react";
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
  correlationMode: "TR" | "PR";
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
  mode,
  state,
}: {
  result: ReturnCorrelationResult | null;
  mode: "TR" | "PR";
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
  const reason = result?.status === "zero-variance"
    ? "일별 수익률의 변동이 없어 계산할 수 없습니다."
    : result?.status === "invalid-result"
      ? "상관계수를 계산할 수 없습니다."
      : "공통 거래일 데이터가 부족합니다.";

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-[#2a3336] dark:bg-[#202627]">
      <details className="group">
        <summary
          className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="수익률 상관계수 도움말"
        >
          <span className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">수익률 상관계수</span>
          <Info className="h-3.5 w-3.5 shrink-0" />
        </summary>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11.5px] leading-relaxed text-slate-500 dark:border-[#2a3336] dark:bg-[#11171a] dark:text-slate-400">
          <p>+1에 가까울수록 같은 방향과 비슷한 폭으로, -1에 가까울수록 반대 방향으로 움직이는 경향이 강합니다. 0에 가까우면 일별 움직임의 선형 관계가 약합니다.</p>
          <p className="mt-1.5">상관계수는 수익률 수준이나 미래 성과를 뜻하지 않으며, 구성종목 중복도와는 별개의 지표입니다.</p>
        </div>
      </details>
      <div className="num mt-2 text-[22px] font-extrabold leading-tight text-slate-900 dark:text-white">{value}</div>
      <p className="mt-0.5 text-[11.5px] text-slate-400">선택 기간의 일별 {mode} 수익률 기준</p>
      {state === "ready" && result && (
        <p className="mt-0.5 text-[11.5px] text-slate-400">공통 거래일 {result.observations}일</p>
      )}
      {!calculating && !idle && !available && <p className="mt-0.5 text-[11.5px] text-slate-400">{reason}</p>}
      {idle && <p className="mt-0.5 text-[11.5px] text-slate-400">변경한 티커로 비교를 실행하면 다시 계산합니다.</p>}
      <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
        두 종목의 일별 움직임 지표이며, 구성종목 중복도와는 별개입니다.
      </p>
    </div>
  );
}

export default function PerformanceCards({
  series,
  metricsByKey,
  periodLabel,
  correlation,
  correlationMode,
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
        <CorrelationCard result={correlation} mode={correlationMode} state={correlationState} />
      </div>
    </section>
  );
}
