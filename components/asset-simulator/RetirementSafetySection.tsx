"use client";

import { useMemo } from "react";
import { calculateRetirementSafety } from "@/lib/asset-simulator-safety";
import {
  calibrateStressSafetyForDisplay,
  type SafetyAccountKey,
} from "@/lib/asset-simulator-portfolio-ui";
import type { SimulatorProjection } from "@/lib/asset-simulator-types";
import SafetyAccountDiagnosis, { type DiagnosisAccount } from "./SafetyAccountDiagnosis";
import SafetyAccountDetailAccordion from "./SafetyAccountDetailAccordion";

// 목표 월생활비 입력은 이 섹션에서 SafetyHeroCard 로 이동했다.
// 이 섹션은 목표 값을 읽어 Safety 계산에 반영하기만 하고, 입력 UI 는 두지 않는다.
//
// PR-3 재구성: 기존 "시나리오 → 계좌 3개" 구조를 "계좌 진단 행 + 계좌 → 기본/하락장 상세"로 뒤집는다.
// - 계좌 진단 행: 어느 계좌가 문제인지 한눈에 본다(SafetyAccountDiagnosis).
// - 계좌 기준 상세 아코디언: 한 계좌의 기본/하락장을 나란히 비교한다(SafetyAccountDetailAccordion).
// 계산 로직·Safety 판정·stress 정책은 바꾸지 않고, 표시 구조와 문구만 정리한다.
type Props = {
  projection: SimulatorProjection;
  stressProjection: SimulatorProjection;
  portfolioApplied: boolean;
  targetMonthlyExpenseReal: number | null;
};

// 계좌 진단/상세에서 공유하는 계좌 메타.
// fullTitle 은 기존 카드 명칭(절세계좌 안전성 / 위탁계좌 안전성 / 통합 안전성)을 유지한다.
const ACCOUNTS: Array<{ key: SafetyAccountKey; name: string; fullTitle: string }> = [
  { key: "taxSaving", name: "절세계좌", fullTitle: "절세계좌 안전성" },
  { key: "brokerage", name: "위탁계좌", fullTitle: "위탁계좌 안전성" },
  { key: "combined", name: "통합", fullTitle: "통합 안전성" },
];

// 상세 아코디언 열 라벨. 이 파일에 문자열을 두어 계좌별 상세가 기본/하락장을 비교함을 명시한다.
const BASIC_SCENARIO_LABEL = "기본 시나리오";
const STRESS_SCENARIO_LABEL = "하락장 시나리오";

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
  const hasTarget = targetMonthlyExpenseReal !== null;

  // 진단 행은 계좌명을 "절세계좌 안전성"처럼 기준을 담은 명칭으로 노출한다.
  const diagnosisAccounts: DiagnosisAccount[] = useMemo(
    () =>
      ACCOUNTS.map(({ key, fullTitle }) => ({
        key,
        name: fullTitle,
        basic: safety[key],
        stress: displayedStressSafety[key],
      })),
    [safety, displayedStressSafety],
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
        <p className="mt-1 break-keep text-[13px] leading-6 text-slate-600 dark:text-slate-400">
          계좌별 진단과 상세를 계좌 기준으로 정리했습니다. 어느 계좌가 문제인지 먼저 보고, 필요할 때 상세를 펼쳐 기본·하락장을 비교합니다.
          목표 월생활비는 위 요약 영역에서 입력합니다.
          {portfolioApplied
            ? " 적용된 포트폴리오 가정을 반영한 결과입니다."
            : " 아직 포트폴리오 가정은 적용되지 않았습니다."}
        </p>
      </div>

      {/* 계좌 진단 3행: 절세 / 위탁 / 통합의 기본→하락장 변화를 한눈에 본다. */}
      <div className="mt-4 min-w-0">
        <h3 className="mb-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300">계좌 진단</h3>
        <SafetyAccountDiagnosis
          accounts={diagnosisAccounts}
          hasTarget={hasTarget}
          targetMonthlyExpenseReal={targetMonthlyExpenseReal}
        />
      </div>

      {/* 하락장 컨텍스트는 여기 한 줄로만 노출한다(중복 배너 방지). */}
      <p className="mt-3 break-keep text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-500">
        하락장은 은퇴 초반 하락·첫 3년 저수익·배당 20% 삭감을 가정한 보수적 점검입니다. 각 계좌의 기본 대비 손상 정도를 확인해 주세요.
      </p>

      {/* 계좌 기준 상세 아코디언: 기본 접힘. 펼치면 기본/하락장 2열(모바일 1열)로 비교한다. */}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3">
        {ACCOUNTS.map(({ key, name }) => (
          <SafetyAccountDetailAccordion
            key={key}
            accountKey={key}
            name={name}
            basic={safety[key]}
            stress={displayedStressSafety[key]}
            hasTarget={hasTarget}
            targetMonthlyExpenseReal={targetMonthlyExpenseReal}
            basicLabel={BASIC_SCENARIO_LABEL}
            stressLabel={STRESS_SCENARIO_LABEL}
            projection={key === "combined" ? projection : undefined}
            stressProjection={key === "combined" ? stressProjection : undefined}
          />
        ))}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-500">
        본 분석은 참고용 시뮬레이션이며, 목표 월생활비 입력 등 세부 조건에 따라 결과가 달라질 수 있습니다. 투자 권유가 아닙니다.
      </p>
    </section>
  );
}
