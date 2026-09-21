import { getSeoulCalendarDate, resolveSeoulTimeOfDay } from "./forest/seoul-time";
import type { MoneyLevelSceneWeather, MoneyLevelTimeOfDay, MoneyLevelWeather, MoneyLevelWindIntensity } from "./types";

export function hashMoneyLevelDate(dateKey: string): number {
  let hash = 2166136261;
  for (const character of dateKey) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveMoneyLevelSeededWeather(date: Date): MoneyLevelWeather {
  const seoul = getSeoulCalendarDate(date);
  const key = `${seoul.year}-${seoul.month}-${seoul.day}`;
  const roll = hashMoneyLevelDate(key) / 0x1_0000_0000;
  if (roll < 0.6) return "sunny";
  if (roll < 0.85) return "cloudy";
  return "rain";
}

/** Backwards-compatible name for the deterministic market-data fallback. */
export const resolveMoneyLevelWeather = resolveMoneyLevelSeededWeather;

export function resolveMoneyLevelTimeOfDay(date: Date): MoneyLevelTimeOfDay {
  return resolveSeoulTimeOfDay(date);
}

export function resolveMoneyLevelWindIntensity(weather: MoneyLevelSceneWeather): MoneyLevelWindIntensity {
  if (weather === "thunderstorm") return "strong";
  if (weather === "cloudy" || weather === "rain") return "breeze";
  return "none";
}
