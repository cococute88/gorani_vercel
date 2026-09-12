import type { MoneyLevelHouseArt } from "../house-stages";
import type { MoneyLevelTimeOfDay } from "../types";

export interface SceneAsset {
  src: string;
  alt: string;
  composite?: "masked" | "alpha";
}

export interface ScenePlacement {
  x: number;
  y: number;
  width: number;
  mobile: { x: number; y: number; width: number };
}

export const FOREST_TIME_BACKGROUNDS: Record<MoneyLevelTimeOfDay, string> = {
  morning: "/money-level/art/background/forest-morning.webp",
  am: "/money-level/art/background/forest-am.webp",
  pm: "/money-level/art/background/forest-pm.webp",
  evening: "/money-level/art/background/forest-evening.webp",
  night: "/money-level/art/background/forest-night.webp",
};

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
  housePlacements: {
    brokerage: {
      x: 30.5, y: 45, width: 39, mobile: { x: 28, y: 43, width: 55 },
    },
    tax: {
      x: 71.8, y: 48.5, width: 31, mobile: { x: 73, y: 48, width: 46 },
    },
  },
  labelPlacements: {
    brokerage: { x: 30.5, y: 72.5, mobile: { x: 28, y: 54.5 } },
    tax: { x: 71.8, y: 69.5, mobile: { x: 73, y: 57 } },
  },
  props: {
    dockConnector: {
      asset: {
        src: "/money-level/art/props/dock-connector.webp",
        alt: "육지와 연못 데크를 잇는 짧은 목재 연결부",
        composite: "alpha",
      },
      placement: {
        x: 61.8, y: 81.8, width: 10.5, mobile: { x: 76.2, y: 80.5, width: 16.5 },
      },
    },
  },
  stageAssets: {
    brokerage: {
      cabin: BROKERAGE_SMALL_CABIN,
      "cabin-expanded": BROKERAGE_EXPANDED_CABIN,
      house: BROKERAGE_PROPER_HOUSE,
    },
    tax: {
      "camp-plus": TAX_CAMP_PLUS,
      "tent-small": TAX_SMALL_WHITE_TENT,
      "tent-large": TAX_LARGE_WHITE_TENT,
      "tent-color": TAX_COLORED_TENT,
    },
  } satisfies Record<"brokerage" | "tax", Partial<Record<MoneyLevelHouseArt, SceneAsset>>>,
  familyFallbackAssets: {
    brokerage: { camp: TAX_CAMP_PLUS, cottage: BROKERAGE_EXPANDED_CABIN },
    tax: { camp: TAX_CAMP_PLUS, cottage: TAX_COLORED_TENT },
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
