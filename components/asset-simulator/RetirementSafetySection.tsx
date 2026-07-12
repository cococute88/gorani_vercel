"use client";

import { useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import { describeSafety, formatPct, type UiTone } from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";

type Props = {
  projection: SimulatorProjection;
  portfolioApplied: boolean;
};

const CARD_META: Array<{ key: "taxSaving" | "brokerage" | "combined"; title: string; hint: string }> = [
  { key: "taxSaving", title: "절세계좌 안전성", hint: "연금·ISA 실질 자산 보존" },
  { key: "brokerage", title: "위탁계좌 안전성", hint: "배당 현금흐름 지속성" },
  { key: "combined", title: "통합 안전성", hint: "전체 은퇴 자산 관점" },
];

const TONE_RING: Record<UiTone, string> = {
  positive: "border-emerald-200 dark:border-emerald-500/30",
  neutral: "border-slate-200 dark:border-[#2c3638]",
  caution: "border-amber-200 dark:border-amber-500/30",
  warning: "border-rose-200 dark:border-rose-500/30",
  muted: "border-slate-200 dark:border-[#2c3638]",
};

const TONE_GRADE: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-700 dark:text-slate-200",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-400 dark:text-slate-500",
};

function SafetyCard({ title, hint, result }: { title: string; hint: string; result: SafetyResult }) {
  const display = describeSafety(result);
  return (
    <div className={`flex flex-col rounded-xl border bg-white p-3.5 shadow-sm dark:bg-[#171d1e] ${TONE_RING[display.tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="mt-0.5 text-[11.5px] text-slate-400 dark:text-slate-500">{hint}</p>
        </div>
        <div className="text-right">
          <div className={`text-[26px] font-extrabold leading-none ${TONE_GRADE[display.tone]}`}>{display.gradeLabel}</div>
          {display.showScore && (
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">점수 {result.score}</div>
          )}
        </div>
      </div>

      <p className={`mt-2 text-[12.5px] font-semibold ${TONE_GRADE[display.tone]}`}>{display.toneLabel}</p>

      {result.status === "evaluated" && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
          <div className="flex items-center justify-between gap-1">
            <dt className="text-slate-500 dark:text-slate-400">자산 보존율</dt>
            <dd className="font-semibold text-slate-700 dark:text-slate-200">{formatPct(result.metrics.preservationRatio * 100, 0)}</dd>
          </div>
          <div className="flex items-center justify-between gap-1">
            <dt className="text-slate-500 dark:text-slate-400">평가 연수</dt>
            <dd className="font-semibold text-slate-700 dark:text-slate-200">{result.metrics.yearsEvaluated}년</dd>
          </div>
        </dl>
      )}

      {result.positives.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {result.positives.map((text, index) => (
            <li key={index} className="text-[11.5px] leading-relaxed text-emerald-600 dark:text-emerald-400">✓ {text}</li>
          ))}
        </ul>
      )}
      {result.warnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {result.warnings.map((text, index) => (
            <li key={index} className="text-[11.5px] leading-relaxed text-amber-600 dark:text-amber-400">• {text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RetirementSafetySection({ projection, portfolioApplied }: Props) {
  const safety = useMemo(() => calculateRetirementSafety(projection), [projection]);

  return (
    <section
      aria-labelledby="retirement-safety-heading"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5"
    >
      <div className="min-w-0">
        <h2 id="retirement-safety-heading" className="text-[17px] font-bold text-slate-900 dark:text-white">
          은퇴 안전성 분석
        </h2>
        <p className="mt-1 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
          은퇴 기간 동안 실질 자산과 현금흐름이 얼마나 안정적으로 유지되는지 계좌별로 살펴봅니다.
          {portfolioApplied
            ? " 적용된 포트폴리오 가정을 반영한 결과입니다."
            : " 포트폴리오 가정을 적용하면 더 정확한 결과를 볼 수 있습니다."}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {CARD_META.map((meta) => (
          <SafetyCard key={meta.key} title={meta.title} hint={meta.hint} result={safety[meta.key]} />
        ))}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-500">
        본 분석은 참고용 시뮬레이션이며, 목표 월생활비 입력 등 세부 조건에 따라 결과가 달라질 수 있습니다. 투자 권유가 아닙니다.
      </p>
    </section>
  );
}
