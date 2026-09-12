import type { MoneyLevelTimeOfDay, MoneyLevelWeather, MoneyLevelWindIntensity } from "./types";

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
  if (hour >= 5 && hour < 9) return "morning";
  if (hour >= 9 && hour < 12) return "am";
  if (hour >= 12 && hour < 16) return "pm";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

export function resolveMoneyLevelWindIntensity(weather: MoneyLevelWeather): MoneyLevelWindIntensity {
  if (weather === "thunderstorm") return "strong";
  if (weather === "cloudy" || weather === "rain") return "breeze";
  return "none";
}
