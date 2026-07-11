import type { SimulationTimeline, SimulatorInputs, YearPlanRow } from "./asset-simulator-types";

const RETIREMENT_ANNUAL_CONTRIBUTION_THRESHOLD = 1000;

/**
 * 현재 자산 시뮬레이터의 은퇴/인출 경계 규칙을 한 번만 해석한다.
 *
 * 이 함수는 legacy 계산 정책을 의도적으로 보존한다. 연간 적립액이 처음으로
 * 1,000만원 미만인 행을 은퇴연도로 보고, withdrawalDelayYears 뒤의 행부터
 * 실제 인출을 시작한다. 정책 변경은 후속 금융 계산 교정 PR의 범위다.
 */
export function resolveSimulationTimeline(
  inputs: SimulatorInputs,
  normalizedYearPlans: YearPlanRow[],
): SimulationTimeline {
  const simulationYears = inputs.years;
  let retirementIndex: number | null = null;

  for (let index = 0; index < Math.min(simulationYears, normalizedYearPlans.length); index += 1) {
    if (normalizedYearPlans[index].monthlyContribution * 12 < RETIREMENT_ANNUAL_CONTRIBUTION_THRESHOLD) {
      retirementIndex = index;
      break;
    }
  }

  const delay = Math.max(1, Math.min(15, inputs.withdrawalDelayYears));
  const candidateWithdrawalStartIndex = retirementIndex === null ? null : retirementIndex + delay;
  const withdrawalStartIndex =
    candidateWithdrawalStartIndex !== null && candidateWithdrawalStartIndex < simulationYears
      ? candidateWithdrawalStartIndex
      : null;

  return {
    startYear: inputs.startYear,
    simulationYears,
    endYear: inputs.startYear + simulationYears - 1,
    retirementIndex,
    retirementYear: retirementIndex === null ? null : normalizedYearPlans[retirementIndex]?.year ?? null,
    withdrawalStartIndex,
    withdrawalStartYear: withdrawalStartIndex === null ? null : normalizedYearPlans[withdrawalStartIndex]?.year ?? null,
    yearsBeforeRetirement: retirementIndex ?? simulationYears,
    yearsAfterRetirement: retirementIndex === null ? 0 : Math.max(0, simulationYears - retirementIndex - 1),
  };
}
