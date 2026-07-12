"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import { describeSafety, formatPct, type UiTone } from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney } from "@/lib/format";
import type { SafetyResult, SimulatorProjection } from "@/lib/asset-simulator-types";

type Props = {
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  portfolioApplied: boolean;
  targetMonthlyExpenseReal: number | null;
  onTargetMonthlyExpenseChange: (value: number | null) => void;
};

// 입력 문자열 <-> 목표 월생활비(만원, 양수) 변환.
function formatTargetInput(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? String(value) : "";
}

function parseTargetInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

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
        <div className="shrink-0 text-right">
          <div className={`max-w-[132px] break-keep text-[20px] font-extrabold leading-tight sm:text-[26px] ${TONE_GRADE[display.tone]}`}>{display.gradeLabel}</div>
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

function ScenarioSafetyGroup({
  title,
  description,
  safety,
  stress = false,
}: {
  title: string;
  description: string;
  safety: ReturnType<typeof calculateRetirementSafety>;
  stress?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${
      stress
        ? "border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/[0.04]"
        : "border-slate-200 bg-slate-50/70 dark:border-[#273032] dark:bg-[#12181a]"
    }`}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3">
        {CARD_META.map((meta) => (
          <SafetyCard key={meta.key} title={meta.title} hint={meta.hint} result={safety[meta.key]} />
        ))}
      </div>
    </div>
  );
}

export default function RetirementSafetySection({
  projection,
  stressProjection,
  portfolioApplied,
  targetMonthlyExpenseReal,
  onTargetMonthlyExpenseChange,
}: Props) {
  const safety = useMemo(
    () => calculateRetirementSafety(projection, { targetMonthlyExpenseReal }),
    [projection, targetMonthlyExpenseReal],
  );
  const stressSafety = useMemo(
    () => calculateRetirementSafety(stressProjection, { targetMonthlyExpenseReal }),
    [stressProjection, targetMonthlyExpenseReal],
  );

  // 부드러운 타이핑을 위해 로컬 문자열 상태를 두고, 파싱된 값만 상위로 전달한다.
  // 외부(하이드레이션/초기화)로 값이 바뀔 때만 입력창을 동기화한다.
  const [rawInput, setRawInput] = useState(() => formatTargetInput(targetMonthlyExpenseReal));
  useEffect(() => {
    setRawInput((prev) => (parseTargetInput(prev) === targetMonthlyExpenseReal ? prev : formatTargetInput(targetMonthlyExpenseReal)));
  }, [targetMonthlyExpenseReal]);

  const handleTargetChange = (next: string) => {
    setRawInput(next);
    onTargetMonthlyExpenseChange(parseTargetInput(next));
  };

  const hasTarget = targetMonthlyExpenseReal !== null;
  const coverageRatio = safety.combined.metrics.monthlyIncomeCoverageRatio;
  const stressCoverageRatio = stressSafety.combined.metrics.monthlyIncomeCoverageRatio;

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
          은퇴 기간의 실질 자산과 현금흐름을 계좌별로 살펴봅니다.
          {portfolioApplied
            ? " 적용된 포트폴리오 가정을 반영한 결과입니다."
            : " 아직 포트폴리오 가정은 적용되지 않았습니다."}
        </p>
      </div>

      {/* 목표 월생활비 입력 + 평가 기준 안내 */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#273032] dark:bg-[#12181a]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <label htmlFor="target-monthly-expense" className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              목표 월생활비
            </label>
            <p className="mt-0.5 text-[11.5px] text-slate-400 dark:text-slate-500">현재 가치 기준 · 만원 단위</p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              id="target-monthly-expense"
              type="number"
              inputMode="decimal"
              min={0}
              step={10}
              value={rawInput}
              onChange={(event) => handleTargetChange(event.target.value)}
              placeholder="예: 300"
              aria-describedby="target-monthly-expense-hint"
              className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-[14px] font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-[#324043] dark:bg-[#0f1416] dark:text-slate-100 dark:focus:ring-emerald-500/20"
            />
            <span className="text-[13px] text-slate-500 dark:text-slate-400">만원</span>
          </div>
        </div>
        <p id="target-monthly-expense-hint" className="mt-2 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          {hasTarget ? (
            <>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">목표 {formatManwonMoney(targetMonthlyExpenseReal)} 기준으로 평가 중</span>
              {typeof coverageRatio === "number"
                ? ` · 기본 충당률 ${formatPct(coverageRatio * 100, 0)}`
                : ""}
              {typeof stressCoverageRatio === "number"
                ? ` · 하락장 충당률 ${formatPct(stressCoverageRatio * 100, 0)}`
                : ""}
              .
            </>
          ) : (
            <>입력하면 목표 생활비 기준으로 평가합니다. 입력 전에는 현재 인출 조건을 바탕으로 참고용 임시 평가를 보여줍니다.</>
          )}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-relaxed text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/[0.06] dark:text-amber-200">
        <p className="font-semibold">하락장 시나리오는 보수적으로 점검하기 위한 가정입니다.</p>
        <p className="mt-0.5 text-amber-700/80 dark:text-amber-200/70">
          은퇴 직후 하락장, 첫 3년 저수익, 위탁 배당 20% 삭감을 가정합니다. 미래를 예측하는 값은 아닙니다.
        </p>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <ScenarioSafetyGroup
          title="기본 시나리오"
          description="현재 입력과 적용된 가정을 반영한 기준 결과입니다."
          safety={safety}
        />
        <ScenarioSafetyGroup
          title="하락장 시나리오"
          description="보수적 점검용 · 은퇴 초반 하락, 3년 저수익, 배당 20% 삭감"
          safety={stressSafety}
          stress
        />
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-500">
        본 분석은 참고용 시뮬레이션이며, 목표 월생활비 입력 등 세부 조건에 따라 결과가 달라질 수 있습니다. 투자 권유가 아닙니다.
      </p>
    </section>
  );
}
