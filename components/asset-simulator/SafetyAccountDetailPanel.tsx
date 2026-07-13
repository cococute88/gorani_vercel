"use client";

import {
  describeSafety,
  formatCoverageRatio,
  formatPct,
  formatPreservationRatio,
} from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney } from "@/lib/format";
import type { SafetyResult } from "@/lib/asset-simulator-types";
import SafetyGradeBadge from "./SafetyGradeBadge";

// 계좌 상세 아코디언 안의 한 시나리오(기본 또는 하락장) 열.
// 기존 카드에서 보여주던 등급/점수/positives/warnings/metrics 를 삭제하지 않고 이 열에 모은다.
// raw metrics(shortfall 등)는 중첩 details 로 접어 첫 화면을 짧게 유지한다.
type Props = {
  // "기본 시나리오" | "하락장 시나리오"
  label: string;
  result: SafetyResult;
  // 하락장 열은 옅은 호박 배경으로 구분한다.
  stress?: boolean;
};

export default function SafetyAccountDetailPanel({ label, result, stress = false }: Props) {
  const display = describeSafety(result);
  const evaluated = result.status === "evaluated";
  const { metrics } = result;
  const coverage = metrics.monthlyIncomeCoverageRatio;
  const positives = result.positives.slice(0, 3);
  const warnings = result.warnings.slice(0, 3);

  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl border p-3 ${
        stress
          ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/[0.04]"
          : "border-slate-200 bg-slate-50/60 dark:border-[#273032] dark:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11.5px] font-semibold uppercase tracking-wide ${
            stress ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <SafetyGradeBadge display={display} size="sm" />
          {display.showScore && (
            <span className="text-[11px] text-slate-600 dark:text-slate-300">{result.score}점</span>
          )}
        </div>
      </div>

      <p className={`mt-1 text-[11.5px] font-medium ${stress ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-400"}`}>
        {display.toneLabel}
      </p>

      {evaluated ? (
        <>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
            <div className="flex items-center justify-between gap-1">
              <dt className="text-slate-600 dark:text-slate-400">자산 보존율</dt>
              <dd
                className="font-semibold text-slate-800 dark:text-slate-200"
                title={metrics.preservationRatio >= 10 ? formatPct(metrics.preservationRatio * 100, 0) : undefined}
              >
                {formatPreservationRatio(metrics.preservationRatio)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-1">
              <dt className="text-slate-600 dark:text-slate-400">평가 연수</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">{metrics.yearsEvaluated}년</dd>
            </div>
            {typeof coverage === "number" && Number.isFinite(coverage) && (
              <div className="flex items-center justify-between gap-1">
                <dt className="text-slate-600 dark:text-slate-400">월생활비 충당률</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-200">{formatCoverageRatio(coverage)}</dd>
              </div>
            )}
          </dl>

          {positives.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {positives.map((text, index) => (
                <li key={index} className="break-keep text-[11.5px] leading-relaxed text-emerald-700 dark:text-emerald-400">✓ {text}</li>
              ))}
            </ul>
          )}
          {warnings.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {warnings.map((text, index) => (
                <li key={index} className="break-keep text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-400">• {text}</li>
              ))}
            </ul>
          )}

          {/* raw metrics: 기본 접힘. 삭제하지 않고 필요할 때만 펼쳐 본다. */}
          <details className="group mt-2">
            <summary className="cursor-pointer list-none text-[10.5px] font-medium text-slate-600 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-dotted underline-offset-2">원자료 보기</span>
            </summary>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
              <div className="flex items-center justify-between gap-1">
                <dt className="text-slate-600 dark:text-slate-300">부족 연수</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">{metrics.shortfallYears}년</dd>
              </div>
              <div className="flex items-center justify-between gap-1">
                <dt className="text-slate-600 dark:text-slate-300">연속 부족</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">{metrics.consecutiveShortfallYears}년</dd>
              </div>
              <div className="flex items-center justify-between gap-1">
                <dt className="text-slate-600 dark:text-slate-300">시작 실질자산</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">{formatManwonMoney(metrics.startingRealAssets)}</dd>
              </div>
              <div className="flex items-center justify-between gap-1">
                <dt className="text-slate-600 dark:text-slate-300">종료 실질자산</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">{formatManwonMoney(metrics.endingRealAssets)}</dd>
              </div>
            </dl>
          </details>
        </>
      ) : (
        <p className="mt-2 break-keep text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          {display.toneLabel}. 데이터를 보완하면 이 시나리오도 평가할 수 있습니다.
        </p>
      )}
    </div>
  );
}
