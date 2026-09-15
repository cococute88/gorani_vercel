import type { MoneyLevelSettings, MoneyLevelStatue } from "./types";

export const STATUE_OPTIONS: ReadonlyArray<{ value: MoneyLevelStatue; label: string }> = [
  { value: "none", label: "없음" },
  { value: "stone-bear", label: "돌곰" },
  { value: "marble-bear", label: "대리석곰" },
  { value: "wood-bear", label: "나무곰" },
  { value: "gold-bear", label: "황금곰" },
  { value: "whitegold-bear", label: "백금곰" },
  { value: "crystal-bear", label: "크리스탈곰" },
] as const;

function isStatue(value: unknown): value is MoneyLevelStatue {
  return STATUE_OPTIONS.some((option) => option.value === value);
}

export const DEFAULT_MONEY_LEVEL_SETTINGS: Readonly<MoneyLevelSettings> = {
  retirementDate: "2030-02-28",
  brokerageYield: 0.035,
  brokerageTaxRate: 0.154,
  isaWithdrawalRate: 0.033,
  pensionWithdrawalRate: 0.033,
  leftStatue: "none",
  rightStatue: "none",
  brokerageTextMode: "DEFAULT",
  brokerageCustomText: "",
  taxTextMode: "DEFAULT",
  taxCustomText: "",
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
    && isValidRate(settings.pensionWithdrawalRate)
    && isStatue(settings.leftStatue)
    && isStatue(settings.rightStatue);
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
    leftStatue: isStatue(value?.leftStatue) ? value.leftStatue : "none",
    rightStatue: isStatue(value?.rightStatue) ? value.rightStatue : "none",
    brokerageTextMode: value?.brokerageTextMode === "CUSTOM" ? "CUSTOM" : "DEFAULT",
    brokerageCustomText: normalizeHouseText(value?.brokerageCustomText, 2),
    taxTextMode: value?.taxTextMode === "CUSTOM" ? "CUSTOM" : "DEFAULT",
    taxCustomText: normalizeHouseText(value?.taxCustomText, 1),
  };
}

/** 18 Unicode characters per line keeps banners legible even on mobile. */
export function normalizeHouseText(value: unknown, lines: 1 | 2): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .split("\n").slice(0, lines).map(line => Array.from(line).slice(0, 18).join("")).join("\n");
}

export function resolveHouseText(settings: MoneyLevelSettings, kind: "brokerage" | "tax", stageDescription: string): string {
  return settings[`${kind}TextMode`] === "CUSTOM" ? settings[`${kind}CustomText`] : stageDescription;
}

/** Editing limits do not reinterpret or truncate previously saved preferences. */
export function houseTextDraftError(value: string, previous: string, kind: "brokerage" | "tax"): string {
  if (value === previous) return "";
  const lines = kind === "brokerage" ? 2 : 1;
  const characters = kind === "brokerage" ? 12 : 18;
  const parts = value.replace(/\r\n?/g, "\n").split("\n");
  return parts.length > lines || parts.some(part => Array.from(part).length > characters)
    ? `최대 ${lines}줄, 줄당 ${characters}자로 입력해주세요.` : "";
}
