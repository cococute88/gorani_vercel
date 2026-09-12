import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "./types";

export function hashMoneyLevelDate(dateKey: string): number {
  let hash = 2166136261;
  for (const character of dateKey) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveMoneyLevelSeededWeather(date: Date): MoneyLevelWeather {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const roll = hashMoneyLevelDate(key) / 0x1_0000_0000;
  if (roll < 0.6) return "sunny";
  if (roll < 0.85) return "cloudy";
  return "rain";
}

/** Backwards-compatible name for the deterministic market-data fallback. */
export const resolveMoneyLevelWeather = resolveMoneyLevelSeededWeather;

export function resolveMoneyLevelTimeOfDay(date: Date): MoneyLevelTimeOfDay {
  const hour = date.getHours();
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}
