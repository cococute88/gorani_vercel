"use client";

import { useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import {
  calibrateStressSafetyForDisplay,
  describeSafety,
  describeSafetyBasis,
  formatPct,
  formatPreservationRatio,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";

// 목표 월생활비 입력은 이 섹션에서 SafetyHeroCard 로 이동했다.
// 이 섹션은 목표 값을 읽어 Safety 계산에 반영하기만 하고, 입력 UI 는 두지 않는다.
type Props = {
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  portfolioApplied: boolean;
  targetMonthlyExpenseReal: number | null;
};

type AccountKey = "taxSaving" | "brokerage" | "combined";

const CARD_META: Array<{ key: AccountKey; title: string; hint: string }> = [
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

function SafetyCard({
  account,
  title,
  hint,
  result,
  targetMonthlyExpenseReal,
}: {
  account: AccountKey;
  title: string;
  hint: string;
  result: SafetyResult;
  targetMonthlyExpenseReal: number | null;
}) {
  const display = describeSafety(result);
  const basis = describeSafetyBasis(account, targetMonthlyExpenseReal);
  return (
    <div className={`flex flex-col rounded-xl border bg-white p-3.5 shadow-sm dark:bg-[#171d1e] ${TONE_RING[display.tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="mt-0.5 text-[11.5px] text-slate-600 dark:text-slate-400">{hint}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className={`max-w-[132px] break-keep text-[20px] font-extrabold leading-tight sm:text-[26px] ${TONE_GRADE[display.tone]}`}>{display.gradeLabel}</div>
          {display.showScore && (
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">점수 {result.score}</div>
          )}
        </div>
      </div>

      {/* 평가 기준 안내: 목표 월생활비가 어느 평가에 반영되는지 오해하지 않도록 명시한다. */}
      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-white/[0.03]">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{basis.label}</p>
        {basis.sub && (
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-400">{basis.sub}</p>
        )}
      </div>

      <p className={`mt-2 text-[12.5px] font-semibold ${TONE_GRADE[display.tone]}`}>{display.toneLabel}</p>

      {result.status === "evaluated" && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
          <div className="flex items-center justify-between gap-1">
            <dt className="text-slate-600 dark:text-slate-400">자산 보존율</dt>
            <dd
              className="font-semibold text-slate-800 dark:text-slate-200"
              title={result.metrics.preservationRatio >= 10 ? formatPct(result.metrics.preservationRatio * 100, 0) : undefined}
            >
              {formatPreservationRatio(result.metrics.preservationRatio)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-1">
            <dt className="text-slate-600 dark:text-slate-400">평가 연수</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-200">{result.metrics.yearsEvaluated}년</dd>
          </div>
        </dl>
      )}

      {result.positives.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {result.positives.map((text, index) => (
            <li key={index} className="text-[11.5px] leading-relaxed text-emerald-700 dark:text-emerald-400">✓ {text}</li>
          ))}
        </ul>
      )}
      {result.warnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {result.warnings.map((text, index) => (
            <li key={index} className="text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-400">• {text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 계좌별 상세는 기본 접힘 상태의 아코디언으로 제공한다. 요약(summary)에는 통합 등급만 노출해
// 첫 화면에서는 핵심 판단만 보이게 하고, 필요할 때 절세/위탁/통합 상세를 펼쳐 볼 수 있게 한다.
function ScenarioSafetyGroup({
  title,
  description,
  safety,
  targetMonthlyExpenseReal,
  stress = false,
}: {
  title: string;
  description: string;
  safety: ReturnType<typeof calculateRetirementSafety>;
  targetMonthlyExpenseReal: number | null;
  stress?: boolean;
}) {
  const combined = describeSafety(safety.combined);
  return (
    <details
      className={`group min-w-0 overflow-hidden rounded-2xl border ${
        stress
          ? "border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/[0.04]"
          : "border-slate-200 bg-slate-50/70 dark:border-[#273032] dark:bg-[#12181a]"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="text-right">
            <div className={`text-[18px] font-extrabold leading-none ${TONE_GRADE[combined.tone]}`}>{combined.gradeLabel}</div>
            <div className="mt-0.5 text-[10.5px] font-medium text-slate-600 dark:text-slate-400">계좌별 상세</div>
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180 dark:text-slate-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </summary>
      <div className="grid min-w-0 grid-cols-1 gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
        {CARD_META.map((meta) => (
          <SafetyCard
            key={meta.key}
            account={meta.key}
            title={meta.title}
            hint={meta.hint}
            result={safety[meta.key]}
            targetMonthlyExpenseReal={targetMonthlyExpenseReal}
          />
        ))}
      </div>
    </details>
  );
}

export default function RetirementSafetySection({
  projection,
  stressProjection,
  portfolioApplied,
  targetMonthlyExpenseReal,
}: Props) {
  const safety = useMemo(
    () => calculateRetirementSafety(projection, { targetMonthlyExpenseReal }),
    [projection, targetMonthlyExpenseReal],
  );
  const stressSafety = useMemo(
    () => calculateRetirementSafety(stressProjection, { targetMonthlyExpenseReal }),
    [stressProjection, targetMonthlyExpenseReal],
  );
  const displayedStressSafety = useMemo(
    () => calibrateStressSafetyForDisplay(safety, stressSafety),
    [safety, stressSafety],
  );

  return (
    <section
      aria-labelledby="retirement-safety-heading"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5"
    >
      <div className="min-w-0">
        <h2 id="retirement-safety-heading" className="text-[17px] font-bold text-slate-900 dark:text-white">
          은퇴 안전성 분석
        </h2>
        <p className="mt-1 text-[13px] leading-6 text-slate-600 dark:text-slate-400">
          위 요약·KPI의 근거가 되는 상세 분석입니다. 은퇴 기간의 실질 자산과 현금흐름을 계좌별로 살펴봅니다.
          목표 월생활비는 위 요약 영역에서 입력합니다.
          {portfolioApplied
            ? " 적용된 포트폴리오 가정을 반영한 결과입니다."
            : " 아직 포트폴리오 가정은 적용되지 않았습니다."}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-relaxed text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/[0.06] dark:text-amber-200">
        <p className="font-semibold">하락장 시나리오는 보수적으로 점검하기 위한 가정입니다.</p>
        <p className="mt-0.5 text-amber-700/80 dark:text-amber-200/70">
          은퇴 직후 하락장과 첫 3년 저수익을 가정해 손상 정도를 확인합니다. 점수와 함께 기본 대비 약해진 항목을 확인해 주세요.
        </p>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <ScenarioSafetyGroup
          title="기본 시나리오"
          description="현재 입력과 적용된 가정을 반영한 기준 결과입니다."
          safety={safety}
          targetMonthlyExpenseReal={targetMonthlyExpenseReal}
        />
        <ScenarioSafetyGroup
          title="하락장 시나리오"
          description="보수적 점검용 · 은퇴 초반 하락, 3년 저수익, 배당 20% 삭감"
          safety={displayedStressSafety}
          targetMonthlyExpenseReal={targetMonthlyExpenseReal}
          stress
        />
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-500">
        본 분석은 참고용 시뮬레이션이며, 목표 월생활비 입력 등 세부 조건에 따라 결과가 달라질 수 있습니다. 투자 권유가 아닙니다.
      </p>
    </section>
  );
}
