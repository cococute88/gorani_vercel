import type {
  MoneyLevelForestSpecialEvent,
  MoneyLevelSceneWeather,
  MoneyLevelSeason,
  MoneyLevelTimeOfDay,
  MoneyLevelWeather,
} from "../types";
import { getActualPayday, getKoreanHolidayDataQuality } from "./payday-calendar";
import { formatCalendarDate, type SeoulCalendarDate } from "./seoul-time";

export type SeasonalBackgroundState = {
  season: MoneyLevelSeason;
  weather: MoneyLevelSceneWeather;
  specialEvent: MoneyLevelForestSpecialEvent;
  actualPayday: SeoulCalendarDate;
  isPayday: boolean;
  holidayDataQuality: "official" | "statutory-projection";
};

export type SeasonalBackgroundOverrides = {
  weather?: MoneyLevelSceneWeather | null;
  specialEvent?: Exclude<MoneyLevelForestSpecialEvent, "none"> | null;
};

export const FOREST_SEASONS: readonly MoneyLevelSeason[] = ["spring", "summer", "fall", "winter"];
export const FOREST_TIMES: readonly MoneyLevelTimeOfDay[] = ["morning", "day", "evening", "night"];
export const FOREST_SCENE_WEATHERS: readonly MoneyLevelSceneWeather[] = ["sunny", "cloudy", "rain", "thunderstorm", "snow"];

export function resolveMoneyLevelSeason(month: number): MoneyLevelSeason {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`Season month must be 1-12; received ${month}`);
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export function isSeasonWeatherAvailable(season: MoneyLevelSeason, weather: MoneyLevelSceneWeather): boolean {
  return !(season === "summer" && weather === "snow");
}

export function resolveSeasonalBackgroundState(
  date: SeoulCalendarDate,
  normalWeather: MoneyLevelWeather,
  overrides: SeasonalBackgroundOverrides = {},
): SeasonalBackgroundState {
  const season = resolveMoneyLevelSeason(date.month);
  const actualPayday = getActualPayday(date.year, date.month);
  const isPayday = formatCalendarDate(date) === formatCalendarDate(actualPayday);
  const holidayDataQuality = getKoreanHolidayDataQuality(date.year);

  // Development/Preview is the only layer allowed to bypass production event priority.
  if (overrides.specialEvent === "payday-leaf-shower") {
    return { season, weather: "sunny", specialEvent: "payday-leaf-shower", actualPayday, isPayday, holidayDataQuality };
  }
  if (overrides.weather) {
    const weather = isSeasonWeatherAvailable(season, overrides.weather) ? overrides.weather : "sunny";
    return { season, weather, specialEvent: overrides.specialEvent ?? "none", actualPayday, isPayday, holidayDataQuality };
  }
  if (overrides.specialEvent === "normal-windy") {
    return { season, weather: normalWeather, specialEvent: "normal-windy", actualPayday, isPayday, holidayDataQuality };
  }

  if ((season === "spring" || season === "fall") && isPayday) {
    return { season, weather: "snow", specialEvent: "none", actualPayday, isPayday, holidayDataQuality };
  }
  if (season === "summer" && isPayday) {
    return { season, weather: "sunny", specialEvent: "payday-leaf-shower", actualPayday, isPayday, holidayDataQuality };
  }

  // Winter precipitation uses the winter snow rendition. Other seasons never
  // admit snow through their normal production weather pool.
  const weather: MoneyLevelSceneWeather = season === "winter" && normalWeather === "rain" ? "snow" : normalWeather;
  return { season, weather, specialEvent: "none", actualPayday, isPayday, holidayDataQuality };
}
