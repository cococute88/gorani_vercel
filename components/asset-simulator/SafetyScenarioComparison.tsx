"use client";

import { formatManwonMoney } from "@/lib/format";
import {
  describeSafety,
  describeSafetyBasis,
  formatCoverageRatio,
  formatPreservationRatio,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SafetyResult } from "@/lib/asset-simulator-types";

// 기본/하락장 통합 안전성을 나란히 비교하는 헤드라인 카드 2장.
// 계좌별 상세는 아래 은퇴 안전성 분석(RetirementSafetySection)의 접기/펼치기 영역에서 확인한다.
type Props = {
  basic: SafetyResult;
  // 표시용으로 보정된 하락장 통합 결과(기본 점수를 넘지 않도록 cap 처리됨).
  stress: SafetyResult;
  hasTarget: boolean;
  // 통합 안전성 평가 기준 문구(목표 월생활비 300만원 / 임시 인출 기준)에 사용.
  targetMonthlyExpenseReal: number | null;
  // 최종 실질자산(만원). 하락장 카드에서 기본 대비 변화량을 보여준다.
  basicFinalReal: number;
  stressFinalReal: number;
};

const TONE_ACCENT: Record<UiTone, string> = {
  positive: "border-emerald-200 dark:border-emerald-500/30",
  neutral: "border-slate-200 dark:border-[#273032]",
  caution: "border-amber-200 dark:border-amber-500/30",
  warning: "border-rose-200 dark:border-rose-500/30",
  muted: "border-slate-200 dark:border-[#273032]",
};

const TONE_GRADE: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-800 dark:text-slate-100",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-500 dark:text-slate-400",
};

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[12px] text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="text-right">
        <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100">{value}</span>
        {sub && <span className="ml-1.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">{sub}</span>}
      </dd>
    </div>
  );
}

function ScenarioCard({
  title,
  badge,
  badgeTone,
  result,
  hasTarget,
  targetMonthlyExpenseReal,
  delta,
}: {
  title: string;
  badge: string;
  badgeTone: "base" | "stress";
  result: SafetyResult;
  hasTarget: boolean;
  targetMonthlyExpenseReal: number | null;
  // 하락장 카드에만 전달되는 기본 대비 변화량 요약.
  delta?: { scoreDelta: number; assetDelta: number };
}) {
  const display = describeSafety(result);
  const basis = describeSafetyBasis("combined", targetMonthlyExpenseReal);
  const evaluated = result.status === "evaluated";
  const coverage = result.metrics.monthlyIncomeCoverageRatio;
  // 핵심 경고 1~2개만 노출한다.
  const keyWarnings = result.warnings.slice(0, 2);

  return (
    <div className={`flex min-w-0 flex-col rounded-2xl border bg-white p-4 shadow-sm dark:bg-[#171d1e] ${TONE_ACCENT[display.tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
              badgeTone === "stress"
                ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
                : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-500/30"
            }`}
          >
            {badge}
          </span>
          <h4 className="mt-1.5 text-[15px] font-bold text-slate-900 dark:text-white">{title}</h4>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-[26px] font-extrabold leading-none ${TONE_GRADE[display.tone]}`}>{display.gradeLabel}</div>
          {display.showScore && (
            <div className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">점수 {result.score}</div>
          )}
        </div>
      </div>

      <p className={`mt-2 text-[12.5px] font-semibold ${TONE_GRADE[display.tone]}`}>{display.toneLabel}</p>

      {/* 통합 안전성 평가 기준 안내(목표 월생활비 반영 여부). */}
      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-white/[0.03]">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{basis.label}</p>
        {basis.sub && (
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-400">{basis.sub}</p>
        )}
      </div>

      {evaluated && (
        <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-[#232b2d]">
          <StatRow
            label="월생활비 충당률"
            value={hasTarget && typeof coverage === "number" ? formatCoverageRatio(coverage) : "목표 입력 필요"}
          />
          <StatRow label="자산 보존율" value={formatPreservationRatio(result.metrics.preservationRatio)} />
          {delta && (
            <StatRow
              label="기본 대비"
              value={`${delta.scoreDelta > 0 ? "+" : ""}${delta.scoreDelta.toFixed(0)}점`}
              sub={delta.assetDelta !== 0
                ? `${delta.assetDelta > 0 ? "-" : "+"}${formatManwonMoney(Math.abs(delta.assetDelta))}`
                : "동일"}
            />
          )}
        </dl>
      )}

      {keyWarnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {keyWarnings.map((text, index) => (
            <li key={index} className="text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-300">• {text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SafetyScenarioComparison({
  basic,
  stress,
  hasTarget,
  targetMonthlyExpenseReal,
  basicFinalReal,
  stressFinalReal,
}: Props) {
  // 표시 점수는 이미 calibrateStressSafetyForDisplay 로 base 이하로 제한된 값을 받는다.
  const scoreDelta = basic.status === "evaluated" && stress.status === "evaluated"
    ? Math.round((stress.score - basic.score) * 10) / 10
    : 0;
  const assetDelta = Math.round(basicFinalReal - stressFinalReal);

  return (
    <section aria-label="기본·하락장 통합 안전성 비교" className="min-w-0">
      <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">기본 · 하락장 한눈 비교</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
        통합 안전성 관점의 핵심 판단입니다. 계좌별 상세는 아래에서 펼쳐 볼 수 있습니다.
      </p>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <ScenarioCard
          title="기본 시나리오"
          badge="현재 입력 기준"
          badgeTone="base"
          result={basic}
          hasTarget={hasTarget}
          targetMonthlyExpenseReal={targetMonthlyExpenseReal}
        />
        <ScenarioCard
          title="하락장 시나리오"
          badge="보수적 점검"
          badgeTone="stress"
          result={stress}
          hasTarget={hasTarget}
          targetMonthlyExpenseReal={targetMonthlyExpenseReal}
          delta={{ scoreDelta, assetDelta }}
        />
      </div>
    </section>
  );
}
