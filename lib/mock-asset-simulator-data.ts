import type { SimulatorInputs, YearPlanRow } from "./asset-simulator-types";
import { STORAGE_KEYS } from "./storage-keys";

export const ASSET_SIMULATOR_STORAGE_KEY = STORAGE_KEYS.assetSimulatorConfigs;

export const DEFAULT_SIMULATOR_INPUTS: SimulatorInputs = {
  startYear: 2026,
  years: 70,
  initialIsa: 0,
  initialPension: 11900,
  reserveCash: 0,
  initialTaxableDividend: 15000,
  annualReturnRate: 6,
  inflationRate: 3,
  withdrawalRate: 3.5,
  withdrawalGrowthRate: 3,
  withdrawalDelayYears: 1,
};

// 기본 투자 계획의 초기 적립 기간/월 적립액. 계획 생성 로직과 안내 문구가
// 동일한 상수를 공유하도록 하여, 값이 바뀌어도 둘이 어긋나지 않게 한다.
export const DEFAULT_CONTRIBUTION_YEARS = 5;
export const DEFAULT_MONTHLY_CONTRIBUTION = 300;

export function buildDefaultYearPlans(
  startYear = DEFAULT_SIMULATOR_INPUTS.startYear,
  years = DEFAULT_SIMULATOR_INPUTS.years,
): YearPlanRow[] {
  return Array.from({ length: years }, (_, index) => {
    const isContributionYear = index < DEFAULT_CONTRIBUTION_YEARS;
    return {
      year: startYear + index,
      monthlyContribution: isContributionYear ? DEFAULT_MONTHLY_CONTRIBUTION : 0,
      isaContribution: isContributionYear,
      pensionContribution: isContributionYear,
      isaToPensionTransfer: false,
    };
  });
}

export const DEFAULT_YEAR_PLANS = buildDefaultYearPlans();
