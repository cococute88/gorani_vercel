import type { MoneyLevelStatue } from "../types";

export type StatueSelection = Record<"left" | "right", MoneyLevelStatue>;
export const NO_STATUES: StatueSelection = { left: "none", right: "none" };

/** Safe grass beside the baked pedestals, never on their top surfaces. */
export const STATUE_VIEW_ANCHORS = {
  left: { x: 470, y: 772 },
  right: { x: 1550, y: 621 },
} as const;
export const STATUE_VIEW_RADIUS_MASTER = 54;
/** Independent screen-pixel grounding calibration; background/pedestals never move. */
export const STATUE_CEREMONY_OFFSET_Y_PX = { left: -16, right: 0 } as const;
export const LEFT_STATUE_CEREMONY_ANCHOR = { ...STATUE_VIEW_ANCHORS.left, offsetYPx: STATUE_CEREMONY_OFFSET_Y_PX.left } as const;
export const RIGHT_STATUE_CEREMONY_ANCHOR = { ...STATUE_VIEW_ANCHORS.right, offsetYPx: STATUE_CEREMONY_OFFSET_Y_PX.right } as const;
export const STATUE_VIEW_EXITS = { left: { x: 375, y: 735 }, right: { x: 1370, y: 618 } } as const;
export const STATUE_VIEW_GRASS = {
  left: [{ x: 430, y: 728 }, { x: 510, y: 728 }, { x: 510, y: 800 }, { x: 430, y: 800 }],
  right: [{ x: 1515, y: 598 }, { x: 1580, y: 598 }, { x: 1580, y: 645 }, { x: 1515, y: 645 }],
  leftExit: [{ x: 350, y: 714 }, { x: 398, y: 714 }, { x: 398, y: 752 }, { x: 350, y: 752 }],
  rightExit: [{ x: 1346, y: 600 }, { x: 1394, y: 600 }, { x: 1394, y: 637 }, { x: 1346, y: 637 }],
} as const;
