export interface MoneyLevelPortfolioSnapshot {
  brokerageValue: number;
  isaPrincipal: number;
  pensionPrincipal: number;
  updatedAt: string;
}

export interface MoneyLevelPortfolioSource {
  getSnapshot(): Promise<MoneyLevelPortfolioSnapshot>;
}

export type MoneyLevelStatue = "none" | "stone-bear" | "marble-bear" | "wood-bear" | "gold-bear" | "whitegold-bear" | "crystal-bear";

export interface MoneyLevelSettings {
  retirementDate: string;
  brokerageYield: number;
  brokerageTaxRate: number;
  isaWithdrawalRate: number;
  pensionWithdrawalRate: number;
  leftStatue: MoneyLevelStatue;
  rightStatue: MoneyLevelStatue;
  brokerageTextMode: "DEFAULT" | "CUSTOM";
  brokerageCustomText: string;
  taxTextMode: "DEFAULT" | "CUSTOM";
  taxCustomText: string;
}

export interface HeartBreakdown {
  full: number;
  fraction: number;
  value: number;
}

export interface HpHeartBreakdown extends HeartBreakdown {
  special: number;
}

export type MoneyLevelWeather = "sunny" | "cloudy" | "rain" | "thunderstorm";
export type MoneyLevelSceneWeather = MoneyLevelWeather | "snow";
export type MoneyLevelTimeOfDay = "morning" | "day" | "evening" | "night";
export type MoneyLevelWindIntensity = "none" | "breeze" | "strong";
export type MoneyLevelSeason = "spring" | "summer" | "fall" | "winter";
export type MoneyLevelForestSpecialEvent = "none" | "normal-windy" | "payday-leaf-shower";
