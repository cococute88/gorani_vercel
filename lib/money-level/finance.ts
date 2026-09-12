import type {
  HeartBreakdown,
  HpHeartBreakdown,
  MoneyLevelPortfolioSnapshot,
  MoneyLevelSettings,
} from "./types";

export const HP_FULL_HEART_VALUE = 100_000;
export const HP_HALF_HEART_VALUE = 50_000;
export const HP_SPECIAL_HEART_VALUE = 1_000_000;
export const HP_SPECIAL_HEART_EQUIVALENT = 10;

export interface MoneyLevelIncome {
  brokerageMonthlyIncome: number;
  isaMonthlyIncome: number;
  pensionMonthlyIncome: number;
  totalMonthlyIncome: number;
}

export function calculateMoneyLevelIncome(
  snapshot: MoneyLevelPortfolioSnapshot,
  settings: MoneyLevelSettings,
): MoneyLevelIncome {
  const brokerageMonthlyIncome = snapshot.brokerageValue
    * settings.brokerageYield
    * (1 - settings.brokerageTaxRate)
    / 12;
  const isaMonthlyIncome = snapshot.isaPrincipal * settings.isaWithdrawalRate / 12;
  const pensionMonthlyIncome = snapshot.pensionPrincipal * settings.pensionWithdrawalRate / 12;

  return {
    brokerageMonthlyIncome,
    isaMonthlyIncome,
    pensionMonthlyIncome,
    totalMonthlyIncome: brokerageMonthlyIncome + isaMonthlyIncome + pensionMonthlyIncome,
  };
}

export function calculateMoneyLevelMp(snapshot: MoneyLevelPortfolioSnapshot): number {
  return snapshot.brokerageValue + snapshot.isaPrincipal + snapshot.pensionPrincipal;
}

export function toHalfHearts(value: number, fullHeartValue = HP_FULL_HEART_VALUE): HeartBreakdown {
  const halfUnits = Math.max(0, Math.floor(value / (fullHeartValue / 2)));
  return {
    full: Math.floor(halfUnits / 2),
    fraction: halfUnits % 2 === 1 ? 0.5 : 0,
    value,
  };
}

export function toHpHearts(value: number): HpHeartBreakdown {
  const safeValue = Math.max(0, value);
  const special = Math.floor(safeValue / HP_SPECIAL_HEART_VALUE);
  const remainingAfterSpecial = safeValue % HP_SPECIAL_HEART_VALUE;
  const full = Math.floor(remainingAfterSpecial / HP_FULL_HEART_VALUE);
  const remainingAfterFull = remainingAfterSpecial % HP_FULL_HEART_VALUE;

  return {
    special,
    full,
    fraction: remainingAfterFull >= HP_HALF_HEART_VALUE ? 0.5 : 0,
    value,
  };
}

export function hpHeartEquivalent(breakdown: HpHeartBreakdown): number {
  return breakdown.special * HP_SPECIAL_HEART_EQUIVALENT + breakdown.full + breakdown.fraction;
}

export function houseDisplayLevel(...breakdowns: readonly HpHeartBreakdown[]): number {
  return Math.floor(
    breakdowns.reduce((sum, breakdown) => sum + hpHeartEquivalent(breakdown), 0),
  );
}

export function toTenthHearts(value: number, fullHeartValue = 100_000_000): HeartBreakdown {
  const tenthUnits = Math.max(0, Math.floor(value / (fullHeartValue / 10)));
  return {
    full: Math.floor(tenthUnits / 10),
    fraction: (tenthUnits % 10) / 10,
    value,
  };
}
