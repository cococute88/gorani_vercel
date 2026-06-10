import type { SimulatorInputs, YearPlanRow } from "./asset-simulator-types";

export const ASSET_SIMULATOR_STORAGE_KEY = "gorani.asset-simulator.preview";

export const DEFAULT_SIMULATOR_INPUTS: SimulatorInputs = {
  startYear: 2026,
  years: 30,
  initialIsa: 2000,
  initialPension: 11897,
  reserveCash: 0,
  initialTaxableDividend: 0,
  annualReturnRate: 6,
  inflationRate: 3,
  withdrawalRate: 3.5,
  withdrawalGrowthRate: 3,
  withdrawalDelayYears: 1,
};

export function buildDefaultYearPlans(
  startYear = DEFAULT_SIMULATOR_INPUTS.startYear,
  years = DEFAULT_SIMULATOR_INPUTS.years,
): YearPlanRow[] {
  return Array.from({ length: years }, (_, index) => ({
    year: startYear + index,
    monthlyContribution: index < 8 ? 300 : 0,
    isaContribution: index < 8,
    pensionContribution: index < 8,
    isaToPensionTransfer: index === 3 || index === 6,
  }));
}

export const DEFAULT_YEAR_PLANS = buildDefaultYearPlans();
