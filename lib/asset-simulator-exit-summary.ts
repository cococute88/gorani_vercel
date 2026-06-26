// "🚪 당장탈출" 요약 모달용 데이터 빌더.
//
// 핵심 원칙: 새로운 계산식을 만들지 않는다.
// 기존 calculateAssetSimulatorPreview() 결과(projection)에서 대표 행을 골라 4개 지표를 구성하고,
// "1년 더 근무" 시나리오만 동일한 calculateAssetSimulatorPreview() 를 한 번 더 호출해 재계산한다.
//
// 모든 금액은 시뮬레이터 내부 단위(만원)이며, 월 단위 값이다.

import type {
  SimulatorInputs,
  SimulatorProjection,
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
  oneMoreYearContributionYear: number | null;
  oneMoreYearMonthlyContribution: number | null;
};

export type ExitSummaryOptions = {
  // 향후 환경설정에서 주입할 사용자 정의 추가 적립금 (연도 -> 월 만원)
  additionalContributionOverrides?: Record<number, number>;
};
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

  // 카드4: 55세 이후 — "2051~" 라는 문자열이 아니라, 실제로 연금/ISA 과세가 적용되기 시작하는
  //   (= 55세 이후 연금 인출 과세 단계) 첫 인출 행을 로직 기준으로 찾는다.
  //   과세 단계 행은 isaTaxRate / pensionTaxRate 가 0보다 크다(비과세 ~2050 구간은 0).
  const afterFiftyFiveRow = projection.taxWithdrawRows.find(
    (r) => !r.isDelay && (r.pensionTaxRate > 0 || r.isaTaxRate > 0),
  );
  const afterFiftyFiveMonthlyReal = afterFiftyFiveRow?.monthlyReal ?? 0;

  // 카드3: 1년 더 근무 — "추가 적립금만큼 절세계좌 자산이 늘었을 때, 기존 인출률을 그대로
  //   적용하면 월 얼마 증가하는가" 를 보여준다.
  //   재시뮬레이션을 하지 않으므로 은퇴시점·CAGR·배당·인출구간·할인기준 등 다른 변수는 일절 변하지 않고,
  //   오직 추가 적립금에 의한 절세계좌 자산 증가분만 반영된다.
  //     · 추가 적립금(연) = 스케줄 월적립금 × 12
  //     · 인출 시작 시점까지 기존 CAGR 로 성장 → 추가 잔고
  //     · 기존 인출률 = 기존 첫 월 인출(명목) ÷ 인출 시작 시 절세계좌 잔고(명목) (실효 인출률)
  //     · 월 증가분(명목) = 기존 인출률 × 추가 잔고
  // 카드3: 1년 더 근무 — "현재 연도(시뮬레이터 시작연도)에 1년 더 일해서 추가로 모은 적립금"만
  //   기준으로, 기존 인출률을 그대로 적용하면 월 얼마 증가하는가를 보여준다.
  //   ※ 은퇴연도가 아니라 "현재 연도" 기준 추가 적립금을 사용한다(예: 2026→280, 2027→290 ...).
  //   ※ 추가 적립금은 성장(CAGR)시키지 않고 "원금 그대로" 사용한다(1년 더 모은 돈만 반영).
  //   재시뮬레이션을 하지 않으므로 은퇴시점·CAGR·배당·인출구간·할인기준 등 다른 변수는 일절 변하지 않는다.
  const plan = projection.withdrawPlan;
  let oneMoreYearMonthlyDeltaNominal = 0;
  let oneMoreYearContributionYear: number | null = null;
  let oneMoreYearMonthlyContribution: number | null = null;

  if (plan && firstWithdrawRow) {
    // 현재 연도 = 시뮬레이터 시작연도. 그 해에 맞는 추가 적립금(월, 만원)을 사용한다.
    const currentYear = inputs.startYear;
    const additionalMonthly = getAdditionalMonthlyContribution(
      currentYear,
      options.additionalContributionOverrides,
    );
    oneMoreYearContributionYear = currentYear;
    oneMoreYearMonthlyContribution = additionalMonthly;

    // 인출 시작 시점의 절세계좌(연금+ISA) 잔고(명목). 기존 인출 계산이 사용하는 값과 동일하다.
    const balanceAtStart = plan.isaBalanceAtStart + plan.pensionBalanceAtStart;
    const baselineMonthlyNominal = firstWithdrawRow.monthlyNominal;

    if (balanceAtStart > 0) {
      // 추가 적립 "원금 그대로" 사용 — 성장(CAGR) 시키지 않는다(1년 더 모은 돈만 반영).
      const addedPrincipal = additionalMonthly * 12;
      const effectiveMonthlyRate = baselineMonthlyNominal / balanceAtStart;
      oneMoreYearMonthlyDeltaNominal = Math.max(0, effectiveMonthlyRate * addedPrincipal);
    }
  }

  return {
    brokerageMonthlyReal,
    taxSavingMonthlyReal,
    oneMoreYearMonthlyDeltaNominal,
    afterFiftyFiveMonthlyReal,
    firstWithdrawYear,
    oneMoreYearContributionYear,
    oneMoreYearMonthlyContribution,
  };
}

// 월 금액(만원)을 "월 53만" / "+월 53만" / "현재가치 월 53만" 형태로 표기하기 위한 정수 만원 변환.
export function toManwon(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value));
}
