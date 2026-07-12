"use client";

import { formatManwonMoney } from "@/lib/format";
import {
  formatCoverageRatio,
  type SafetyDisplay,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";

// 안전성 체크 결과 상단에 노출하는 KPI 4장.
// 모든 값은 기존 projection/safety 결과에서 파생한 UI 표시값이며, 새 계산 로직이 아니다.
type Props = {
  // 통합 안전성 등급(기본 시나리오).
  overallGrade: SafetyDisplay;
  // 월생활비 충당률(기본 시나리오, 0~1). 목표 미입력이면 null.
  coverageRatio: number | null | undefined;
  hasTarget: boolean;
  // 기본 시나리오 최종 실질 자산(만원).
  finalRealAsset: number;
  // 하락장 손상폭 = 기본 최종 실질자산 − 하락장 최종 실질자산(만원, 양수면 감소).
  downturnDamage: number;
  // 손상폭 비율(0~1). 기본 대비 감소 비율. 계산 불가 시 null.
  downturnDamageRatio: number | null;
};

const TONE_VALUE: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-900 dark:text-slate-100",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-500 dark:text-slate-400",
};

function KpiCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: UiTone;
  hint: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-[#273032] dark:bg-[#171d1e]">
      <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      <p className={`mt-1.5 break-keep text-[22px] font-extrabold leading-tight ${TONE_VALUE[tone]}`}>{value}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

export default function SafetyKpiCards({
  overallGrade,
  coverageRatio,
  hasTarget,
  finalRealAsset,
  downturnDamage,
  downturnDamageRatio,
}: Props) {
  // 충당률: 목표 입력 전에는 안내 문구로 대체한다.
  const coverageTone: UiTone = !hasTarget || typeof coverageRatio !== "number"
    ? "muted"
    : coverageRatio >= 1
      ? "positive"
      : coverageRatio >= 0.9
        ? "caution"
        : "warning";
  const coverageValue = !hasTarget
    ? "목표 입력 필요"
    : formatCoverageRatio(coverageRatio);
  const coverageHint = !hasTarget
    ? "목표 월생활비를 입력하면 계산됩니다."
    : "월 수요 대비 월 공급 평균(기본 시나리오)";

  // 손상폭: 값이 클수록(감소폭이 클수록) 주의 톤으로 표시한다. 음수(개선)는 안정 톤.
  const damageTone: UiTone = downturnDamage <= 0
    ? "positive"
    : typeof downturnDamageRatio === "number" && downturnDamageRatio >= 0.25
      ? "warning"
      : "caution";
  const damageValue = downturnDamage <= 0
    ? "손상 없음"
    : `-${formatManwonMoney(downturnDamage)}`;
  const damageHint = typeof downturnDamageRatio === "number" && downturnDamage > 0
    ? `기본 대비 약 ${formatCoverageRatio(downturnDamageRatio)} 감소`
    : "기본 대비 하락장 최종 실질자산 차이";

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard
        label="통합 안전성 등급"
        value={overallGrade.gradeLabel}
        tone={overallGrade.tone}
        hint={overallGrade.toneLabel}
      />
      <KpiCard label="월생활비 충당률" value={coverageValue} tone={coverageTone} hint={coverageHint} />
      <KpiCard
        label="최종 실질자산"
        value={formatManwonMoney(finalRealAsset)}
        tone="neutral"
        hint="은퇴 계획 종료 시점(현재 가치 기준)"
      />
      <KpiCard label="하락장 손상폭" value={damageValue} tone={damageTone} hint={damageHint} />
    </div>
  );
}
