import { parsePreviewCalendarDate, type SeoulCalendarDate } from "./forest/seoul-time";
import type { MoneyLevelForestSpecialEvent, MoneyLevelSceneWeather, MoneyLevelTimeOfDay } from "./types";

const PREVIEW_WEATHERS: readonly MoneyLevelSceneWeather[] = ["sunny", "cloudy", "rain", "thunderstorm", "snow"];
const PREVIEW_TIMES: readonly MoneyLevelTimeOfDay[] = ["morning", "day", "evening", "night"];
const PREVIEW_SPECIAL_EVENTS = ["normal-windy", "payday-leaf-shower"] as const;

export type MoneyLevelPreviewOverrides = {
  weather: MoneyLevelSceneWeather | null;
  time: MoneyLevelTimeOfDay | null;
  date: SeoulCalendarDate | null;
  specialEvent: Exclude<MoneyLevelForestSpecialEvent, "none"> | null;
  debug: boolean;
  ambientEnabled: boolean;
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
  if (!enabled) return { weather: null, time: null, date: null, specialEvent: null, debug: false, ambientEnabled: true };
  const params = new URLSearchParams(search);
  const weather = params.get("weather") as MoneyLevelSceneWeather | null;
  const requestedTime = params.get("time");
  const aliasedTime = requestedTime === "am" || requestedTime === "pm" ? "day" : requestedTime;
  const time = aliasedTime as MoneyLevelTimeOfDay | null;
  const requestedSpecialEvent = params.get("leafEffect");
  const specialEvent = PREVIEW_SPECIAL_EVENTS.includes(requestedSpecialEvent as (typeof PREVIEW_SPECIAL_EVENTS)[number])
    ? requestedSpecialEvent as (typeof PREVIEW_SPECIAL_EVENTS)[number]
    : null;
  return {
    weather: weather && PREVIEW_WEATHERS.includes(weather) ? weather : null,
    time: time && PREVIEW_TIMES.includes(time) ? time : null,
    date: parsePreviewCalendarDate(params.get("date")),
    specialEvent,
    debug: params.get("weatherdebug") === "1",
    ambientEnabled: params.get("ambient") !== "off",
  };
}
