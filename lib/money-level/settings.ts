import type { MoneyLevelSettings } from "./types";

export const DEFAULT_MONEY_LEVEL_SETTINGS: Readonly<MoneyLevelSettings> = {
  retirementDate: "2030-02-28",
  brokerageYield: 0.035,
  brokerageTaxRate: 0.154,
  isaWithdrawalRate: 0.033,
  pensionWithdrawalRate: 0.033,
};

export function isValidMoneyLevelDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeRate(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : fallback;
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isValidMoneyLevelSettings(value: unknown): value is MoneyLevelSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const settings = value as Partial<MoneyLevelSettings>;
  return isValidMoneyLevelDate(settings.retirementDate)
    && isValidRate(settings.brokerageYield)
    && isValidRate(settings.brokerageTaxRate)
    && isValidRate(settings.isaWithdrawalRate)
    && isValidRate(settings.pensionWithdrawalRate);
}

export function normalizeMoneyLevelSettings(
  value: Partial<MoneyLevelSettings> | null | undefined,
): MoneyLevelSettings {
  return {
    retirementDate: isValidMoneyLevelDate(value?.retirementDate)
      ? value.retirementDate
      : DEFAULT_MONEY_LEVEL_SETTINGS.retirementDate,
    brokerageYield: normalizeRate(value?.brokerageYield, DEFAULT_MONEY_LEVEL_SETTINGS.brokerageYield),
    brokerageTaxRate: normalizeRate(value?.brokerageTaxRate, DEFAULT_MONEY_LEVEL_SETTINGS.brokerageTaxRate),
    isaWithdrawalRate: normalizeRate(value?.isaWithdrawalRate, DEFAULT_MONEY_LEVEL_SETTINGS.isaWithdrawalRate),
    pensionWithdrawalRate: normalizeRate(
      value?.pensionWithdrawalRate,
      DEFAULT_MONEY_LEVEL_SETTINGS.pensionWithdrawalRate,
    ),
  };
}
