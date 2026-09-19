import type { MoneyLevelHouseArt } from "../house-stages";
import type { MoneyLevelSceneWeather, MoneyLevelSeason, MoneyLevelTimeOfDay } from "../types";
import { FOREST_SEASONS, FOREST_TIMES, isSeasonWeatherAvailable } from "./seasonal-backgrounds";
import { TAX_VISUAL_FRAMES, type HouseVisualFrame } from "./tax-artwork";

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

const TAX_CAMP_PLUS: SceneAsset = {
  src: "/money-level/art/houses/tax-stage-10-15-camp-plus.webp",
  alt: "모닥불과 돗자리, 작은 생활 소품이 있는 소박한 야영지",
};

const TAX_SMALL_WHITE_TENT: SceneAsset = {
  src: "/money-level/art/houses/tax-stage-15-20-small-white-tent.webp",
  alt: "작은 하얀 천막과 모닥불이 있는 야영지",
};

const TAX_LARGE_WHITE_TENT: SceneAsset = {
  src: "/money-level/art/houses/tax-stage-20-25-large-white-tent.webp",
  alt: "큰 하얀 천막과 간단한 침구가 있는 야영지",
};

const TAX_COLORED_TENT: SceneAsset = {
  src: "/money-level/art/houses/tax-stage-25-30-colored-tent.webp",
  alt: "노란 천막과 모닥불, 풍성한 생활 소품이 있는 캠프",
};

const BROKERAGE_SMALL_CABIN: SceneAsset = {
  src: "/money-level/art/houses/brokerage-stage-35-40-small-cabin.webp",
  alt: "꽃과 초록 지붕이 있는 작은 오두막",
};

// Tax only; Brokerage's shared early-camp fallback retains approved art.
function taxAlphaAsset(asset: SceneAsset): SceneAsset {
  const name = asset.src.split("/").pop()!.replace(".webp", "");
  return { ...asset, src: asset.src.replace(".webp", "-alpha-v2.webp"),
    composite: "alpha", visualFrame: TAX_VISUAL_FRAMES[name] };
}

const BROKERAGE_EXPANDED_CABIN: SceneAsset = {
  src: "/money-level/art/houses/brokerage-stage-40-45-expanded-cabin-alpha.webp",
  alt: "꽃과 초록 지붕이 있는 확장 오두막",
  composite: "alpha",
};

const BROKERAGE_PROPER_HOUSE: SceneAsset = {
  src: "/money-level/art/houses/brokerage-stage-45-50-proper-house.webp",
  alt: "넓은 현관과 정원이 있는 정식 초록 지붕 주택",
};

export const FOREST_SCENE = {
  background: {
    src: "/money-level/art/background/cozy-forest-base.webp",
    alt: "민트빛 산과 꽃, 오솔길, 연못이 있는 따뜻한 숲",
  },
  backgroundPosition: {
    desktop: "50% 50%",
    mobile: "51% 50%",
  },
  stageAssets: {
    brokerage: {
      cabin: BROKERAGE_SMALL_CABIN,
      "cabin-expanded": BROKERAGE_EXPANDED_CABIN,
      house: BROKERAGE_PROPER_HOUSE,
    },
    tax: {
      "camp-plus": taxAlphaAsset(TAX_CAMP_PLUS),
      "tent-small": taxAlphaAsset(TAX_SMALL_WHITE_TENT),
      "tent-large": taxAlphaAsset(TAX_LARGE_WHITE_TENT),
      "tent-color": taxAlphaAsset(TAX_COLORED_TENT),
    },
  } satisfies Record<"brokerage" | "tax", Partial<Record<MoneyLevelHouseArt, SceneAsset>>>,
  familyFallbackAssets: {
    brokerage: { camp: TAX_CAMP_PLUS, cottage: BROKERAGE_EXPANDED_CABIN },
    tax: { camp: taxAlphaAsset(TAX_CAMP_PLUS), cottage: taxAlphaAsset(TAX_COLORED_TENT) },
  } satisfies Record<"brokerage" | "tax", Record<"camp" | "cottage", SceneAsset>>,
} as const;

/**
 * Current MVP ships production art for the two stages visible with the mock data.
 * Every stage still resolves through this table, so future art drops only replace URLs.
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
