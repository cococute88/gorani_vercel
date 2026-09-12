import type { CharacterId, CharacterState } from "./character-types";

export type ForestAction = "idle" | "look" | "read" | "nap" | "garden" | "flowers" | "fishing" | "pond-watch" | "event";

export interface Waypoint {
  id: string;
  x: number;
  y: number;
  mobile?: { x: number; y: number };
  facing: "left" | "right";
  supportedActions: readonly ForestAction[];
  weight: number;
}

export interface CharacterForestConfig {
  defaultSkin: string;
  optionalSkins: readonly string[];
  everydayAccessories: readonly string[];
  actionAccessoryMap: Partial<Record<ForestAction, string>>;
  eventAccessories: readonly string[];
  dailyAnimations: readonly string[];
  eventAnimations: readonly string[];
  rejectedBrokenAssets: readonly string[];
  homeWaypoint: string;
  scale: number;
  interactionBounds: {
    widthPx: number;
    heightPx: number;
    mobileWidthPx: number;
    mobileHeightPx: number;
  };
  animationSpeeds: Record<"idle" | "idle_front" | "run" | "event", number>;
}

export const BEHAVIOR_CONFIG = {
  initialStayMinMs: 22_000,
  initialStayMaxMs: 42_000,
  minStayMs: 20_000,
  maxStayMs: 60_000,
  eventChance: 0.05,
  accessoryChance: 0.24,
  actionAccessoryChance: 0.3,
  interactionChance: 0.04,
  minMoveMs: 4_000,
  minRouteSegmentMs: 900,
  maxMoveMs: 13_000,
  moveMsPerSceneUnit: 180,
  homeWeightMultiplier: 1.7,
  rainShelterMultiplier: 1.8,
  longPressMs: 320,
  dragMoveThresholdPx: 5,
  postDragStayMinMs: 15_000,
  postDragStayMaxMs: 30_000,
  postActivityStayMinMs: 4_000,
  postActivityStayMaxMs: 7_000,
  manualActivitySnapMs: 320,
  invalidDropSnapMs: 520,
  facingThreshold: 0.75,
  fishingChance: 0.08,
  pondWatchChance: 0.08,
} as const;

export const WAYPOINTS: readonly Waypoint[] = [
  { id: "gorani_home", x: 46, y: 68, mobile: { x: 40, y: 71 }, facing: "right", supportedActions: ["idle", "nap", "read"], weight: 1.35 },
  { id: "brokerage_yard", x: 46, y: 76, mobile: { x: 43, y: 75 }, facing: "left", supportedActions: ["idle", "garden", "flowers"], weight: 1 },
  { id: "bench", x: 42, y: 82, mobile: { x: 37, y: 82 }, facing: "right", supportedActions: ["idle", "read", "nap"], weight: 0.72 },
  { id: "garden", x: 48, y: 72, mobile: { x: 49, y: 72 }, facing: "left", supportedActions: ["idle", "garden"], weight: 0.9 },
  { id: "daramji_home", x: 58, y: 67, mobile: { x: 53, y: 76 }, facing: "left", supportedActions: ["idle", "nap", "garden"], weight: 1.35 },
  { id: "campfire", x: 57, y: 60, mobile: { x: 52, y: 72 }, facing: "left", supportedActions: ["idle", "look"], weight: 0.72 },
  { id: "tax_clearing", x: 56, y: 54, mobile: { x: 53, y: 74 }, facing: "right", supportedActions: ["idle", "look", "garden"], weight: 0.74 },
  { id: "meadow", x: 53, y: 55, mobile: { x: 52, y: 42 }, facing: "right", supportedActions: ["idle", "flowers", "look"], weight: 1.1 },
  { id: "flower_patch", x: 53, y: 63, mobile: { x: 52, y: 67 }, facing: "left", supportedActions: ["idle", "flowers", "look"], weight: 0.78 },
  { id: "path_front", x: 48, y: 84, mobile: { x: 43, y: 84 }, facing: "right", supportedActions: ["idle", "look"], weight: 0.82 },
  { id: "path_center", x: 49, y: 72, mobile: { x: 49, y: 76 }, facing: "right", supportedActions: ["idle", "look"], weight: 0.86 },
  { id: "path_mid", x: 50, y: 59, mobile: { x: 52, y: 64 }, facing: "left", supportedActions: ["idle", "look"], weight: 0.82 },
  { id: "path_back_lower", x: 52, y: 49, mobile: { x: 52, y: 54 }, facing: "right", supportedActions: ["idle", "look"], weight: 0.62 },
  { id: "path_back_mid", x: 55, y: 41, mobile: { x: 52, y: 43 }, facing: "left", supportedActions: ["idle", "look"], weight: 0.48 },
  { id: "path_back_upper", x: 57, y: 33, mobile: { x: 55, y: 33 }, facing: "right", supportedActions: ["idle", "look"], weight: 0.38 },
  { id: "pond_edge", x: 55, y: 77, mobile: { x: 53, y: 78 }, facing: "right", supportedActions: ["idle", "look", "pond-watch"], weight: 0.64 },
  { id: "pond_land", x: 58.5, y: 79, mobile: { x: 68, y: 78.5 }, facing: "right", supportedActions: ["idle", "look", "pond-watch"], weight: 0.42 },
  { id: "dock_connector", x: 61.5, y: 84.1, mobile: { x: 74, y: 81 }, facing: "right", supportedActions: ["idle", "look", "pond-watch"], weight: 0.3 },
  { id: "dock_start", x: 66, y: 86.6, mobile: { x: 82, y: 83.5 }, facing: "right", supportedActions: ["idle", "look", "pond-watch"], weight: 0.5 },
  { id: "dock_mid", x: 70.2, y: 90, mobile: { x: 84.5, y: 86 }, facing: "right", supportedActions: ["idle", "look", "pond-watch"], weight: 0.34 },
  { id: "dock_end", x: 74.7, y: 94.1, mobile: { x: 91.5, y: 82.7 }, facing: "right", supportedActions: ["idle", "fishing"], weight: 0.42 },
];

export const CHARACTER_CONFIG: Record<CharacterId, CharacterForestConfig> = {
  gorani: {
    defaultSkin: "skin_default",
    optionalSkins: ["skin_raincoat", "skin_sleeppants"],
    everydayAccessories: ["Acc_Gorani_Hat_Flower", "Acc_Gorani_Hat_Sprout", "Acc_Gorani_Face_blush"],
    actionAccessoryMap: {
      read: "Acc_Gorani_Face_Readingglasses",
      nap: "Acc_Gorani_Face_Sleepingeyemask",
      garden: "Acc_Gorani_Hat_Strawhat",
      flowers: "Acc_Gorani_Hat_Flower",
    },
    eventAccessories: ["Acc_Gorani_Hat_Partyhat", "Acc_Gorani_Hat_Ribbon", "Acc_Gorani_Face_Hart"],
    dailyAnimations: ["idle", "idle_front"],
    eventAnimations: ["respect", "highfive", "ceremony01", "ceremony02", "ceremony03"],
    rejectedBrokenAssets: ["die", "die_fall", "dash", "wall_idle", "Gimmick_Coopsaw_Left"],
    homeWaypoint: "gorani_home",
    scale: 0.2,
    interactionBounds: { widthPx: 58, heightPx: 78, mobileWidthPx: 48, mobileHeightPx: 66 },
    animationSpeeds: { idle: 0.34, idle_front: 0.32, run: 0.4, event: 0.5 },
  },
  daramji: {
    defaultSkin: "skin_default",
    optionalSkins: ["skin_raincoat", "skin_sleeppants"],
    everydayAccessories: ["Acc_Daramji_Hat_Flower", "Acc_Daramji_Hat_Sprout", "Acc_Daramji_Face_Blush"],
    actionAccessoryMap: {
      read: "Acc_Daramji_Face_Readingglasses",
      nap: "Acc_Daramji_Face_Sleepingeyemask",
      garden: "Acc_Daramji_Hat_Strawhat",
      flowers: "Acc_Daramji_Hat_Flower",
    },
    eventAccessories: ["Acc_Daramji_Hat_Partyhat", "Acc_Daramji_Hat_Ribbon", "Acc_Daramji_Face_Hart"],
    dailyAnimations: ["idle", "idle_front"],
    eventAnimations: ["respect", "ceremony01", "ceremony02", "ceremony03", "tag_showup"],
    rejectedBrokenAssets: ["die", "die_fall", "wall_idle", "wall_to_fall", "tag_hide"],
    homeWaypoint: "daramji_home",
    scale: 0.22,
    interactionBounds: { widthPx: 54, heightPx: 72, mobileWidthPx: 46, mobileHeightPx: 62 },
    animationSpeeds: { idle: 0.34, idle_front: 0.32, run: 0.4, event: 0.48 },
  },
};

export function initialCharacterState(id: CharacterId): CharacterState {
  return {
    skin: CHARACTER_CONFIG[id].defaultSkin,
    animation: "idle_front",
    hat: "",
    face: "",
    playing: true,
    speed: CHARACTER_CONFIG[id].animationSpeeds.idle_front,
    loop: true,
  };
}
