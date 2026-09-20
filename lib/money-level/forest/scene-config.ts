import type { MoneyLevelHouseArt } from "../house-stages";
import type { MoneyLevelSceneWeather, MoneyLevelSeason, MoneyLevelTimeOfDay } from "../types";
import { FOREST_SEASONS, FOREST_TIMES, isSeasonWeatherAvailable } from "./seasonal-backgrounds";
import { TEMPORARY_HOUSE_VISUAL_FRAMES, type HouseVisualFrame } from "./tax-artwork";

export interface SceneAsset {
  src: string;
  alt: string;
  composite?: "masked" | "alpha";
  visualFrame?: HouseVisualFrame;
}

export const FOREST_BACKGROUND_FALLBACK = "/money-level/art/background/seasonal/forest-spring-day-sunny.webp";
const WEATHER_FILE_SUFFIX: Record<MoneyLevelSceneWeather, string> = {
  sunny: "sunny",
  cloudy: "cloudy",
  rain: "rain",
  thunderstorm: "storm",
  snow: "snow",
};

export type ForestBackgroundKey = `${MoneyLevelSeason}/${MoneyLevelTimeOfDay}/${MoneyLevelSceneWeather}`;

export const FOREST_SEASONAL_BACKGROUND_MANIFEST: Readonly<Partial<Record<ForestBackgroundKey, string>>> = Object.freeze(
  Object.fromEntries(FOREST_SEASONS.flatMap((season) => FOREST_TIMES.flatMap((time) =>
    (Object.keys(WEATHER_FILE_SUFFIX) as MoneyLevelSceneWeather[])
      .filter((weather) => isSeasonWeatherAvailable(season, weather))
      .map((weather) => [
        `${season}/${time}/${weather}`,
        `/money-level/art/background/seasonal/forest-${season}-${time}-${WEATHER_FILE_SUFFIX[weather]}.webp`,
      ]),
  ))) as Partial<Record<ForestBackgroundKey, string>>,
);

export function resolveForestBackground(
  season: MoneyLevelSeason,
  time: MoneyLevelTimeOfDay,
  weather: MoneyLevelSceneWeather,
): string {
  return FOREST_SEASONAL_BACKGROUND_MANIFEST[`${season}/${time}/${weather}`] ?? FOREST_BACKGROUND_FALLBACK;
}

const temporaryAsset = (name: keyof typeof TEMPORARY_HOUSE_VISUAL_FRAMES, alt: string): SceneAsset => ({
  src: `/money-level/art/houses/temporary-${name}.webp`,
  alt,
  composite: "alpha",
  visualFrame: TEMPORARY_HOUSE_VISUAL_FRAMES[name],
});

export const TEMPORARY_HOUSE_ASSETS = {
  "camp-spring-summer": temporaryAsset("camp-spring-summer", "모닥불과 돗자리, 바구니와 랜턴이 있는 포근한 야영지"),
  "camp-fall": temporaryAsset("camp-fall", "가을 낙엽 사이 모닥불과 돗자리가 있는 야영지"),
  "camp-winter": temporaryAsset("camp-winter", "눈밭의 모닥불과 돗자리, 랜턴이 있는 겨울 야영지"),
  "tent-neutral": temporaryAsset("tent-neutral", "하얀 천막과 모닥불이 있는 야영지"),
  "tent-yellow": temporaryAsset("tent-yellow", "노란 천막과 모닥불, 생활 소품이 있는 야영지"),
  "house-fall": temporaryAsset("house-fall", "가을 낙엽과 꽃으로 둘러싸인 아늑한 집"),
  "house-winter": temporaryAsset("house-winter", "눈 덮인 지붕과 따뜻한 창문이 있는 겨울 집"),
} as const;

const CAMP_ASSET_BY_SEASON = {
  spring: TEMPORARY_HOUSE_ASSETS["camp-spring-summer"],
  summer: TEMPORARY_HOUSE_ASSETS["camp-spring-summer"],
  fall: TEMPORARY_HOUSE_ASSETS["camp-fall"],
  winter: TEMPORARY_HOUSE_ASSETS["camp-winter"],
} satisfies Record<MoneyLevelSeason, SceneAsset>;

const HOUSE_ASSET_BY_SEASON = {
  // Temporary art fallback until additional user-approved Spring/Summer stage assets are supplied.
  spring: TEMPORARY_HOUSE_ASSETS["house-fall"],
  summer: TEMPORARY_HOUSE_ASSETS["house-fall"],
  fall: TEMPORARY_HOUSE_ASSETS["house-fall"],
  winter: TEMPORARY_HOUSE_ASSETS["house-winter"],
} satisfies Record<MoneyLevelSeason, SceneAsset>;

export function resolveForestHouseAsset(season: MoneyLevelSeason, art: MoneyLevelHouseArt): SceneAsset | null {
  if (art === "clearing") return null;
  if (art === "camp" || art === "camp-plus") return CAMP_ASSET_BY_SEASON[season];
  if (art === "tent-small" || art === "tent-large") return TEMPORARY_HOUSE_ASSETS["tent-neutral"];
  if (art === "tent-color") return TEMPORARY_HOUSE_ASSETS["tent-yellow"];
  return HOUSE_ASSET_BY_SEASON[season];
}

export const FOREST_SCENE = {
  background: {
    src: "/money-level/art/background/cozy-forest-base.webp",
    alt: "민트빛 산과 꽃, 오솔길, 연못이 있는 따뜻한 숲",
  },
  backgroundPosition: {
    desktop: "50% 50%",
    mobile: "51% 50%",
  },
} as const;

/**
 * Visual family remains a CSS concern. Asset selection is centralized in
 * resolveForestHouseAsset so no runtime stage can fall back to legacy art.
 */
export const HOUSE_ART_FAMILY: Record<MoneyLevelHouseArt, "camp" | "cottage"> = {
  clearing: "camp",
  camp: "camp",
  "camp-plus": "camp",
  "tent-small": "camp",
  "tent-large": "camp",
  "tent-color": "camp",
  "micro-house": "cottage",
  cabin: "cottage",
  "cabin-expanded": "cottage",
  house: "cottage",
  "workshop-house": "cottage",
  "two-story": "cottage",
  "two-story-garden": "cottage",
  "two-story-veranda": "cottage",
  "two-story-large": "cottage",
  "two-story-annex": "cottage",
  mansion: "cottage",
  "mansion-garden": "cottage",
  "grand-mansion": "cottage",
  "grand-mansion-annex": "cottage",
};
