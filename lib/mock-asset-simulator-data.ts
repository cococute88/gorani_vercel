import type { SimulatorInputs, YearPlanRow } from "./asset-simulator-types";

export const ASSET_SIMULATOR_STORAGE_KEY = "gorani.asset-simulator.preview";

export const DEFAULT_SIMULATOR_INPUTS: SimulatorInputs = {
  startYear: 2026,
  years: 30,
  initialIsa: 20000000,
  initialPension: 118970000,
  initialTaxable: 0,
  annualReturnRate: 6,
  inflationRate: 3,
  withdrawalRate: 3.5,
  withdrawalGrowthRate: 3,
  withdrawalDelayYears: 1,
};

export function buildDefaultYearPlans(
  startYear = DEFAULT_SIMULATOR_INPUTS.startYear,
  years = DEFAULT_SIMULATOR_INPUTS.years,
  withdrawalDelayYears = DEFAULT_SIMULATOR_INPUTS.withdrawalDelayYears,
): YearPlanRow[] {
  return Array.from({ length: years }, (_, index) => {
    const year = startYear + index;
    const isSavingPhase = index < 8;
    const isWithdrawalPhase = index >= 8 + withdrawalDelayYears;

    if (isSavingPhase) {
      return {
        year,
        monthlyContribution: 3000000,
        isaContribution: 1000000,
        pensionContribution: 1000000,
        taxableContribution: 1000000,
        isaToPensionTransfer: index >= 3 ? 2000000 : 0,
        note: index === 0 ? "3A Preview 시작" : "초기 8년 적립 계획",
      };
    }

    return {
      year,
      monthlyContribution: 0,
      isaContribution: 0,
      pensionContribution: 0,
      taxableContribution: 0,
      isaToPensionTransfer: 0,
      note: isWithdrawalPhase ? "은퇴/인출 단계" : "인출 시작 대기",
    };
  });
}

export const DEFAULT_YEAR_PLANS = buildDefaultYearPlans();
