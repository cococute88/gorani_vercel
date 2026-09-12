import type { MoneyLevelPortfolioSnapshot } from "./types";

export type MoneyLevelHouseKind = "brokerage" | "taxAdvantaged";
export type MoneyLevelHouseArt =
  | "clearing"
  | "camp"
  | "camp-plus"
  | "tent-small"
  | "tent-large"
  | "tent-color"
  | "micro-house"
  | "cabin"
  | "cabin-expanded"
  | "house"
  | "workshop-house"
  | "two-story"
  | "two-story-garden"
  | "two-story-veranda"
  | "two-story-large"
  | "two-story-annex"
  | "mansion"
  | "mansion-garden"
  | "grand-mansion"
  | "grand-mansion-annex";

export interface MoneyLevelHouseStage {
  level: number;
  min: number;
  max: number | null;
  label: string;
  art: MoneyLevelHouseArt;
}

const EOK = 100_000_000;

export const MONEY_LEVEL_HOUSE_STAGES: readonly MoneyLevelHouseStage[] = [
  { level: 0, min: 0, max: 0.5 * EOK, label: "빈터", art: "clearing" },
  { level: 1, min: 0.5 * EOK, max: 1 * EOK, label: "작은 모닥불과 돗자리", art: "camp" },
  { level: 2, min: 1 * EOK, max: 1.5 * EOK, label: "생활 소품이 놓인 캠프", art: "camp-plus" },
  { level: 3, min: 1.5 * EOK, max: 2 * EOK, label: "작은 하얀 천막", art: "tent-small" },
  { level: 4, min: 2 * EOK, max: 2.5 * EOK, label: "큰 하얀 천막", art: "tent-large" },
  { level: 5, min: 2.5 * EOK, max: 3 * EOK, label: "생활 소품이 있는 색깔 천막", art: "tent-color" },
  { level: 6, min: 3 * EOK, max: 3.5 * EOK, label: "초소형 목조 임시주택", art: "micro-house" },
  { level: 7, min: 3.5 * EOK, max: 4 * EOK, label: "작은 오두막", art: "cabin" },
  { level: 8, min: 4 * EOK, max: 4.5 * EOK, label: "확장 오두막", art: "cabin-expanded" },
  { level: 9, min: 4.5 * EOK, max: 5 * EOK, label: "정식 주택", art: "house" },
  { level: 10, min: 5 * EOK, max: 5.5 * EOK, label: "작업실이 딸린 주택", art: "workshop-house" },
  { level: 11, min: 5.5 * EOK, max: 6 * EOK, label: "2층집", art: "two-story" },
  { level: 12, min: 6 * EOK, max: 6.5 * EOK, label: "2층집과 작은 정원", art: "two-story-garden" },
  { level: 13, min: 6.5 * EOK, max: 7 * EOK, label: "베란다가 있는 2층집", art: "two-story-veranda" },
  { level: 14, min: 7 * EOK, max: 7.5 * EOK, label: "큰 2층집", art: "two-story-large" },
  { level: 15, min: 7.5 * EOK, max: 8 * EOK, label: "별채가 있는 큰 2층집", art: "two-story-annex" },
  { level: 16, min: 8 * EOK, max: 8.5 * EOK, label: "저택", art: "mansion" },
  { level: 17, min: 8.5 * EOK, max: 9 * EOK, label: "큰 정원이 있는 저택", art: "mansion-garden" },
  { level: 18, min: 9 * EOK, max: 9.5 * EOK, label: "대저택", art: "grand-mansion" },
  { level: 19, min: 9.5 * EOK, max: 10 * EOK, label: "부속건물이 있는 대저택", art: "grand-mansion-annex" },
];

export function resolveMoneyLevelHouseStage(value: number): MoneyLevelHouseStage {
  const normalized = Math.max(0, value);
  const configured = MONEY_LEVEL_HOUSE_STAGES.find(
    (stage) => normalized >= stage.min && (stage.max === null || normalized < stage.max),
  );
  if (configured) return configured;

  const extraLevel = Math.floor((normalized - 10 * EOK) / (0.5 * EOK));
  return {
    level: MONEY_LEVEL_HOUSE_STAGES.length + extraLevel,
    min: 10 * EOK + extraLevel * 0.5 * EOK,
    max: 10 * EOK + (extraLevel + 1) * 0.5 * EOK,
    label: `대저택 확장 ${extraLevel + 1}단계`,
    art: "grand-mansion-annex",
  };
}

export function resolveMoneyLevelPortfolioHouses(
  snapshot: MoneyLevelPortfolioSnapshot,
): Record<MoneyLevelHouseKind, MoneyLevelHouseStage> {
  return {
    brokerage: resolveMoneyLevelHouseStage(snapshot.brokerageValue),
    taxAdvantaged: resolveMoneyLevelHouseStage(snapshot.isaPrincipal + snapshot.pensionPrincipal),
  };
}
