import type { MoneyLevelHouseArt } from "../house-stages";
import type { MoneyLevelSceneWeather, MoneyLevelSeason, MoneyLevelTimeOfDay } from "../types";
import { FOREST_SEASONS, FOREST_TIMES, isSeasonWeatherAvailable } from "./seasonal-backgrounds";
import { HOUSE_STAGE_VISUAL_FRAMES, TEMPORARY_HOUSE_VISUAL_FRAMES, type HouseVisualFrame } from "./tax-artwork";

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

type TemporaryHouseSource = "camp-spring-summer" | "camp-fall" | "camp-winter" | "tent-neutral" | "tent-yellow" | "house-fall" | "house-winter";

const temporaryAsset = (source: TemporaryHouseSource, frame: keyof typeof TEMPORARY_HOUSE_VISUAL_FRAMES, alt: string): SceneAsset => ({
  src: `/money-level/art/houses/temporary-${source}.webp`,
  alt,
  composite: "alpha",
  visualFrame: TEMPORARY_HOUSE_VISUAL_FRAMES[frame],
});

export const TEMPORARY_HOUSE_ASSETS = {
  "camp-spring-summer": temporaryAsset("camp-spring-summer", "camp-spring-summer", "모닥불과 돗자리, 바구니와 랜턴이 있는 포근한 야영지"),
  "camp-fall": temporaryAsset("camp-fall", "camp-fall", "가을 낙엽 사이 모닥불과 돗자리가 있는 야영지"),
  "camp-winter": temporaryAsset("camp-winter", "camp-winter", "눈밭의 모닥불과 돗자리, 랜턴이 있는 겨울 야영지"),
  "tent-neutral": temporaryAsset("tent-neutral", "tent-neutral-small", "하얀 천막과 모닥불이 있는 야영지"),
  "tent-yellow": temporaryAsset("tent-yellow", "tent-yellow", "노란 천막과 모닥불, 생활 소품이 있는 야영지"),
  "house-fall": temporaryAsset("house-fall", "house-fall", "가을 낙엽과 꽃으로 둘러싸인 아늑한 집"),
  "house-winter": temporaryAsset("house-winter", "house-winter", "눈 덮인 지붕과 따뜻한 창문이 있는 겨울 집"),
} as const;

const TEMPORARY_LARGE_TENT_ASSET: SceneAsset = {
  ...TEMPORARY_HOUSE_ASSETS["tent-neutral"],
  visualFrame: TEMPORARY_HOUSE_VISUAL_FRAMES["tent-neutral-large"],
};

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

type RuntimeHouseKind = "brokerage" | "tax";

const HOUSE_ART_ALT: Record<Exclude<MoneyLevelHouseArt, "clearing">, string> = {
  camp: "작은 모닥불과 돗자리가 있는 야영지",
  "camp-plus": "생활 소품이 놓인 야영지",
  "tent-small": "작은 하얀 천막",
  "tent-large": "큰 하얀 천막",
  "tent-color": "생활 소품이 있는 색깔 천막",
  "micro-house": "초소형 목조 임시주택",
  cabin: "작은 오두막",
  "cabin-expanded": "확장 오두막",
  house: "정식 주택",
  "workshop-house": "작업실이 딸린 주택",
  "two-story": "2층집",
  "two-story-garden": "작은 정원이 있는 2층집",
  "two-story-veranda": "베란다가 있는 2층집",
  "two-story-large": "큰 2층집",
  "two-story-annex": "별채가 있는 큰 2층집",
  mansion: "저택",
  "mansion-garden": "큰 정원이 있는 저택",
  "grand-mansion": "대저택",
  "grand-mansion-annex": "부속건물이 있는 대저택",
};

const dedicatedAsset = (filename: string, art: Exclude<MoneyLevelHouseArt, "clearing">, composite: SceneAsset["composite"] = "alpha"): SceneAsset => ({
  src: `/money-level/art/houses/${filename}.webp`,
  alt: HOUSE_ART_ALT[art],
  composite,
  visualFrame: HOUSE_STAGE_VISUAL_FRAMES[filename],
});

export const HOUSE_STAGE_ASSETS = {
  brokerage: {
    "micro-house": dedicatedAsset("brokerage-stage-30-35-micro-house", "micro-house"),
    cabin: dedicatedAsset("brokerage-stage-35-40-small-cabin", "cabin", "masked"),
    "cabin-expanded": dedicatedAsset("brokerage-stage-40-45-expanded-cabin-alpha", "cabin-expanded"),
    house: dedicatedAsset("brokerage-stage-45-50-proper-house", "house", "masked"),
    "workshop-house": dedicatedAsset("brokerage-stage-50-55-workshop-house", "workshop-house"),
    "two-story": dedicatedAsset("brokerage-stage-55-60-two-story", "two-story"),
    "two-story-garden": dedicatedAsset("brokerage-stage-60-65-two-story-garden", "two-story-garden"),
    "two-story-veranda": dedicatedAsset("brokerage-stage-65-70-two-story-veranda", "two-story-veranda"),
    "two-story-large": dedicatedAsset("brokerage-stage-70-75-two-story-large", "two-story-large"),
    "two-story-annex": dedicatedAsset("brokerage-stage-75-80-two-story-annex", "two-story-annex"),
    mansion: dedicatedAsset("brokerage-stage-80-85-mansion", "mansion"),
    "mansion-garden": dedicatedAsset("brokerage-stage-85-90-mansion-garden", "mansion-garden"),
    "grand-mansion": dedicatedAsset("brokerage-stage-90-95-grand-mansion", "grand-mansion"),
    "grand-mansion-annex": dedicatedAsset("brokerage-stage-95-100-grand-mansion-annex", "grand-mansion-annex"),
  },
  tax: {
    "micro-house": dedicatedAsset("tax-stage-30-35-micro-house", "micro-house"),
    cabin: dedicatedAsset("tax-stage-35-40-small-cabin", "cabin"),
    "cabin-expanded": dedicatedAsset("tax-stage-40-45-expanded-cabin", "cabin-expanded"),
    house: dedicatedAsset("tax-stage-45-50-proper-house", "house"),
    "workshop-house": dedicatedAsset("tax-stage-50-55-workshop-house", "workshop-house"),
    "two-story": dedicatedAsset("tax-stage-55-60-two-story", "two-story"),
    "two-story-garden": dedicatedAsset("tax-stage-60-65-two-story-garden", "two-story-garden"),
    "two-story-veranda": dedicatedAsset("tax-stage-65-70-two-story-veranda", "two-story-veranda"),
    "two-story-large": dedicatedAsset("tax-stage-70-75-two-story-large", "two-story-large"),
    "two-story-annex": dedicatedAsset("tax-stage-75-80-two-story-annex", "two-story-annex"),
    mansion: dedicatedAsset("tax-stage-80-85-mansion", "mansion"),
    "mansion-garden": dedicatedAsset("tax-stage-85-90-mansion-garden", "mansion-garden"),
    "grand-mansion": dedicatedAsset("tax-stage-90-95-grand-mansion", "grand-mansion"),
    "grand-mansion-annex": dedicatedAsset("tax-stage-95-100-grand-mansion-annex", "grand-mansion-annex"),
  },
} satisfies Record<RuntimeHouseKind, Partial<Record<MoneyLevelHouseArt, SceneAsset>>>;

export function resolveForestHouseAsset(kind: RuntimeHouseKind, season: MoneyLevelSeason, art: MoneyLevelHouseArt): SceneAsset | null {
  if (art === "clearing") return null;
  if (art === "camp" || art === "camp-plus") return CAMP_ASSET_BY_SEASON[season];
  if (art === "tent-small") return TEMPORARY_HOUSE_ASSETS["tent-neutral"];
  if (art === "tent-large") return TEMPORARY_LARGE_TENT_ASSET;
  if (art === "tent-color") return TEMPORARY_HOUSE_ASSETS["tent-yellow"];
  return HOUSE_STAGE_ASSETS[kind][art] ?? HOUSE_ASSET_BY_SEASON[season];
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
