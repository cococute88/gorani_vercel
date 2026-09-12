import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "./types";

const PREVIEW_WEATHERS: readonly MoneyLevelWeather[] = ["sunny", "cloudy", "rain", "thunderstorm"];
const PREVIEW_TIMES: readonly MoneyLevelTimeOfDay[] = ["morning", "am", "pm", "evening", "night"];

export type MoneyLevelPreviewOverrides = {
  weather: MoneyLevelWeather | null;
  time: MoneyLevelTimeOfDay | null;
  debug: boolean;
};

export function moneyLevelPreviewOverridesEnabled(environment: {
  nodeEnv?: string;
  vercelEnv?: string;
}): boolean {
  return environment.nodeEnv === "development" || environment.vercelEnv === "preview";
}

export function parseMoneyLevelPreviewOverrides(
  search: string,
  enabled: boolean,
): MoneyLevelPreviewOverrides {
  if (!enabled) return { weather: null, time: null, debug: false };
  const params = new URLSearchParams(search);
  const weather = params.get("weather") as MoneyLevelWeather | null;
  const time = params.get("time") as MoneyLevelTimeOfDay | null;
  return {
    weather: weather && PREVIEW_WEATHERS.includes(weather) ? weather : null,
    time: time && PREVIEW_TIMES.includes(time) ? time : null,
    debug: params.get("weatherdebug") === "1",
  };
}
