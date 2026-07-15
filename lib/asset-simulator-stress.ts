import type {
  RetirementStressScenarioConfigV1,
  RetirementStressScenarioPreset,
  SimulationTimeline,
} from "./asset-simulator-types";

// early_downturn 프리셋 정책 상수 (계좌 단위 스트레스).
// 현재 projection 은 holding 별 세부 자산 시계열이 아니라 effective assumptions 기반이므로,
// 이번 PR 에서는 은퇴 직후 구간에 계좌(절세/위탁) 단위 스트레스를 적용한다.
//
// 인출 시작 연도(offset 0)부터 EARLY_DOWNTURN_STRESS_YEARS(3년) 동안:
//   offset 0        → 주식성 자산/가격 총수익 -30% shock (은퇴·인출 첫해 하락장)
//   offset 1, 2     → 0% 정체 (은퇴 초반 회복 지연)
//   offset 0 ~ 2    → 위탁 배당률 20% 삭감
// 현금/예비금(reserve)에는 이번 PR 에서 별도 shock 을 적용하지 않는다.
export const EARLY_DOWNTURN_SHOCK_RETURN_PCT = -30;
export const EARLY_DOWNTURN_LOW_RETURN_PCT = 0;
export const EARLY_DOWNTURN_DIVIDEND_CUT_MULTIPLIER = 0.8;
export const EARLY_DOWNTURN_STRESS_YEARS = 3;

// 은퇴 직후 구간에만 적용되는 스트레스 일정.
// 모든 조회 함수는 result index 를 받아 은퇴 인덱스로부터의 offset 을 계산해 판정한다.
export type StressSchedule = {
  preset: RetirementStressScenarioPreset;
  retirementIndex: number;
  // 해당 index 의 절세계좌(주식성) 총수익률(%)을 스트레스로 대체한다. 대체 없으면 null.
  taxSavingReturnPctAt(index: number): number | null;
  // 해당 index 의 위탁계좌 가격 수익률(%)을 스트레스로 대체한다. 대체 없으면 null.
  brokeragePriceReturnPctAt(index: number): number | null;
  // 해당 index 의 위탁 배당률 배수(기본 1). 스트레스 구간은 삭감 배수.
  brokerageDividendMultiplierAt(index: number): number;
};

// 저장/외부 입력에서 온 스트레스 설정을 방어적으로 해석한다.
// version 이 1 이 아니거나 알 수 없는 preset 이면 "none" 으로 본다.
export function resolveStressPreset(
  config: RetirementStressScenarioConfigV1 | null | undefined,
): RetirementStressScenarioPreset {
  if (!config || config.version !== 1) return "none";
  return config.preset === "early_downturn" ? "early_downturn" : "none";
}

// 스트레스 일정을 만든다. 은퇴 시점이 없거나 preset 이 "none" 이면 null 을 반환하고,
// 호출부는 null 일 때 기존(무스트레스) 계산 경로를 그대로 사용한다.
export function buildStressSchedule(
  config: RetirementStressScenarioConfigV1 | null | undefined,
  timeline: SimulationTimeline,
): StressSchedule | null {
  const preset = resolveStressPreset(config);
  if (preset !== "early_downturn") return null;
  // 안전성 탭과 일반 projection 모두 실제 인출 시작 연도를 기준으로 한다.
  // 따라서 은퇴 준비·인출 대기 구간은 shock 대상이 아니다.
  const retirementIndex = timeline.withdrawalStartIndex ?? timeline.retirementIndex;
  if (retirementIndex === null || retirementIndex < 0) return null;

  // 주식성 자산(절세)과 위탁 가격은 동일한 시퀀스(-30% shock → 0% 저수익)를 따른다.
  const equityReturnPctAt = (index: number): number | null => {
    const offset = index - retirementIndex;
    if (offset === 0) return EARLY_DOWNTURN_SHOCK_RETURN_PCT;
    if (offset > 0 && offset < EARLY_DOWNTURN_STRESS_YEARS) return EARLY_DOWNTURN_LOW_RETURN_PCT;
    return null;
  };

  return {
    preset,
    retirementIndex,
    taxSavingReturnPctAt: equityReturnPctAt,
    brokeragePriceReturnPctAt: equityReturnPctAt,
    brokerageDividendMultiplierAt: (index: number): number => {
      const offset = index - retirementIndex;
      return offset >= 0 && offset < EARLY_DOWNTURN_STRESS_YEARS
        ? EARLY_DOWNTURN_DIVIDEND_CUT_MULTIPLIER
        : 1;
    },
  };
}
