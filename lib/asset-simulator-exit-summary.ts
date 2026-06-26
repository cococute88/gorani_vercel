// "🚪 당장탈출" 요약 모달용 데이터 빌더.
//
// 핵심 원칙: 새로운 계산식을 만들지 않는다.
// 기존 calculateAssetSimulatorPreview() 결과(projection)에서 대표 행을 골라 4개 지표를 구성하고,
// "1년 더 근무" 시나리오만 동일한 calculateAssetSimulatorPreview() 를 한 번 더 호출해 재계산한다.
//
// 모든 금액은 시뮬레이터 내부 단위(만원)이며, 월 단위 값이다.

import { calculateAssetSimulatorPreview } from "./asset-simulator";
import type {
  SimulatorInputs,
  SimulatorProjection,
  YearPlanRow,
} from "./asset-simulator-types";

// ---------------------------------------------------------------------------
// 추가 적립금 기본 스케줄 (월 단위, 만원)
//   2026: 280 / 2027: 290 / 2028: 300 / 2029: 310 / 2030 이후: 전년 +10
//   => 2026년 기준 base 280 에서 매년 +10 (선형) 으로 일반화된다.
//
// 향후 환경설정/사용자 정의 적립금 기능을 붙이기 쉽도록 overrides 맵을 받는다.
// (override 가 주어지면 해당 연도는 사용자 값으로 대체된다.)
// ---------------------------------------------------------------------------
export const ADDITIONAL_CONTRIBUTION_BASE_YEAR = 2026;
export const ADDITIONAL_CONTRIBUTION_BASE_MONTHLY = 280;
export const ADDITIONAL_CONTRIBUTION_YEARLY_STEP = 10;

export function getAdditionalMonthlyContribution(
  year: number,
  overrides?: Record<number, number>,
): number {
  if (overrides && typeof overrides[year] === "number" && Number.isFinite(overrides[year])) {
    return overrides[year];
  }
  const steps = year - ADDITIONAL_CONTRIBUTION_BASE_YEAR;
  if (steps <= 0) return ADDITIONAL_CONTRIBUTION_BASE_MONTHLY;
  return ADDITIONAL_CONTRIBUTION_BASE_MONTHLY + steps * ADDITIONAL_CONTRIBUTION_YEARLY_STEP;
}

export type ExitSummary = {
  // 카드1: 위탁 배당 (세후·실질가치, 월, 만원)
  brokerageMonthlyReal: number;
  // 카드2: 절세 인출 (세후·실질가치, 월, 만원)
  taxSavingMonthlyReal: number;
  // 카드3: 1년 더 근무 시 절세 인출 증가분 (명목가치, +월, 만원)
  oneMoreYearMonthlyDeltaNominal: number;
  // 카드4: 55세 이후(2051~ 과세구간) 인출 (현재가치=실질, 월, 만원)
  afterFiftyFiveMonthlyReal: number;

  // 부가 설명용 메타데이터 (UI 보조 표기 / 향후 확장 포인트)
  firstWithdrawYear: number | null;
  oneMoreYearWorkYear: number | null;
  oneMoreYearMonthlyContribution: number | null;
};

export type ExitSummaryOptions = {
  // 향후 환경설정에서 주입할 사용자 정의 추가 적립금 (연도 -> 월 만원)
  additionalContributionOverrides?: Record<number, number>;
};

// 첫 실제 인출(대기 제외) 연도의 절세계좌 월 인출(명목, 만원).
function firstActualWithdrawMonthlyNominal(projection: SimulatorProjection): number {
  const row = projection.taxWithdrawRows.find((r) => !r.isDelay);
  return row ? row.monthlyNominal : 0;
}

export function buildExitSummary(
  projection: SimulatorProjection,
  inputs: SimulatorInputs,
  options: ExitSummaryOptions = {},
): ExitSummary {
  // 카드1: 위탁 배당 — 첫 인출(배당 발생) 연도의 세후 월 배당(실질).
  const brokerageRow = projection.dividendRows.find((r) => r.afterTaxMonthlyDividendReal > 0);
  const brokerageMonthlyReal = brokerageRow?.afterTaxMonthlyDividendReal ?? 0;

  // 카드2: 절세 인출 — 첫 실제 인출(대기 제외) 연도의 세후 월 인출(실질).
  const firstWithdrawRow = projection.taxWithdrawRows.find((r) => !r.isDelay);
  const taxSavingMonthlyReal = firstWithdrawRow?.monthlyReal ?? 0;
  const firstWithdrawYear = firstWithdrawRow?.year ?? null;

  // 카드4: 55세 이후 — 2051~ (과세) 구간 첫 연도의 세후 월 인출(현재가치=실질).
  const afterFiftyFiveRow = projection.taxWithdrawRows.find((r) => r.category === "2051~" && !r.isDelay);
  const afterFiftyFiveMonthlyReal = afterFiftyFiveRow?.monthlyReal ?? 0;

  // 카드3: 1년 더 근무 — 현재 은퇴 연도를 "적립 1년"으로 전환해 동일 계산식으로 재계산하고,
  //        첫 인출 월액(명목)의 증가분을 구한다. (실질 변환 미적용 = 명목 기준)
  const baselineMonthlyNominal = firstActualWithdrawMonthlyNominal(projection);
  let oneMoreYearMonthlyDeltaNominal = 0;
  let oneMoreYearWorkYear: number | null = null;
  let oneMoreYearMonthlyContribution: number | null = null;

  const retireIndex = projection.yearPlans.findIndex((p) => p.status === "은퇴");
  if (retireIndex >= 0) {
    const retireYear = projection.yearPlans[retireIndex].year;
    const additionalMonthly = getAdditionalMonthlyContribution(
      retireYear,
      options.additionalContributionOverrides,
    );
    oneMoreYearWorkYear = retireYear;
    oneMoreYearMonthlyContribution = additionalMonthly;

    // 은퇴 연도를 1년 더 적립으로 바꾼 계획표를 만들어 기존 계산식을 그대로 재사용한다.
    const extendedPlans: YearPlanRow[] = projection.yearPlans.map((plan) =>
      plan.year === retireYear
        ? {
            year: plan.year,
            monthlyContribution: additionalMonthly,
            isaContribution: true,
            pensionContribution: true,
            isaToPensionTransfer: plan.isaToPensionTransfer,
          }
        : {
            year: plan.year,
            monthlyContribution: plan.monthlyContribution,
            isaContribution: plan.isaContribution,
            pensionContribution: plan.pensionContribution,
            isaToPensionTransfer: plan.isaToPensionTransfer,
          },
    );

    const extendedProjection = calculateAssetSimulatorPreview(inputs, extendedPlans);
    const extendedMonthlyNominal = firstActualWithdrawMonthlyNominal(extendedProjection);
    oneMoreYearMonthlyDeltaNominal = Math.max(0, extendedMonthlyNominal - baselineMonthlyNominal);
  }

  return {
    brokerageMonthlyReal,
    taxSavingMonthlyReal,
    oneMoreYearMonthlyDeltaNominal,
    afterFiftyFiveMonthlyReal,
    firstWithdrawYear,
    oneMoreYearWorkYear,
    oneMoreYearMonthlyContribution,
  };
}

// 월 금액(만원)을 "월 53만" / "+월 53만" / "현재가치 월 53만" 형태로 표기하기 위한 정수 만원 변환.
export function toManwon(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value));
}
