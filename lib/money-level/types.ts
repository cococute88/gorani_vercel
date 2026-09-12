export interface MoneyLevelPortfolioSnapshot {
  brokerageValue: number;
  isaPrincipal: number;
  pensionPrincipal: number;
  updatedAt: string;
}

export interface MoneyLevelPortfolioSource {
  getSnapshot(): Promise<MoneyLevelPortfolioSnapshot>;
}

export interface MoneyLevelSettings {
  retirementDate: string;
  brokerageYield: number;
  brokerageTaxRate: number;
  isaWithdrawalRate: number;
  pensionWithdrawalRate: number;
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
export type MoneyLevelTimeOfDay = "morning" | "day" | "evening" | "night";
