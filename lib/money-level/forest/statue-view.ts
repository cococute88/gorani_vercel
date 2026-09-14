import type { MoneyLevelStatue } from "../types";

export type StatueSelection = Record<"left" | "right", MoneyLevelStatue>;
export const NO_STATUES: StatueSelection = { left: "none", right: "none" };

export const CEREMONY_SLOTS = {
  CEREMONY_LEFT_A: {
    statueSlot: "left", waypoint: "ceremony_left_a", facing: "right",
    anchor: { x: 470, y: 751.6 }, exit: { x: 470, y: 663 }, exitWaypoint: "left_grass",
    polygon: [{ x: 410, y: 660 }, { x: 510, y: 660 }, { x: 528, y: 706 },
      { x: 528, y: 804 }, { x: 430, y: 810 }, { x: 410, y: 780 }],
  },
  CEREMONY_LEFT_B: {
    statueSlot: "left", waypoint: "ceremony_left_b", facing: "left",
    anchor: { x: 694, y: 736 }, exit: { x: 686, y: 661 }, exitWaypoint: "left_access",
    polygon: [{ x: 654, y: 678 }, { x: 730, y: 676 }, { x: 753, y: 705 },
      { x: 748, y: 774 }, { x: 665, y: 780 }, { x: 649, y: 750 }],
  },
  CEREMONY_RIGHT: {
    statueSlot: "right", waypoint: "ceremony_right", facing: "right",
    anchor: { x: 1370, y: 593 }, exit: { x: 1320, y: 593 }, exitWaypoint: "right_grass",
    polygon: [{ x: 1305, y: 555 }, { x: 1378, y: 548 }, { x: 1403, y: 575 },
      { x: 1401, y: 610 }, { x: 1348, y: 616 }, { x: 1305, y: 598 }],
  },
} as const;
export type CeremonySlotId = keyof typeof CEREMONY_SLOTS;
export const CEREMONY_SLOT_IDS = Object.keys(CEREMONY_SLOTS) as CeremonySlotId[];

/** Safe grass beside the baked pedestals, never on their top surfaces. */
export const STATUE_VIEW_ANCHORS = {
  left: CEREMONY_SLOTS.CEREMONY_LEFT_A.anchor,
  right: CEREMONY_SLOTS.CEREMONY_RIGHT.anchor,
} as const;
/** Drop intent polygons are wider than the fixed safe performance anchors.
 * At 1320×520 their upper reach is ≈72px LEFT / 54px RIGHT above the dance
 * anchor. Tapers avoid the bench, pedestal, fence, tree trunk and shoreline.
 * These are input acceptance areas, not roaming/walkable terrain. */
export const STATUE_CEREMONY_DROP_ZONES = {
  left: CEREMONY_SLOTS.CEREMONY_LEFT_A.polygon,
  right: CEREMONY_SLOTS.CEREMONY_RIGHT.polygon,
} as const;
/** Compatibility exports: grounding is now baked into the source anchor. */
export const STATUE_CEREMONY_OFFSET_Y_PX = { left: 0, right: 0 } as const;
export const LEFT_STATUE_CEREMONY_ANCHOR = { ...STATUE_VIEW_ANCHORS.left, offsetYPx: STATUE_CEREMONY_OFFSET_Y_PX.left } as const;
export const RIGHT_STATUE_CEREMONY_ANCHOR = { ...STATUE_VIEW_ANCHORS.right, offsetYPx: STATUE_CEREMONY_OFFSET_Y_PX.right } as const;
export const STATUE_VIEW_EXITS = { left: CEREMONY_SLOTS.CEREMONY_LEFT_A.exit, right: CEREMONY_SLOTS.CEREMONY_RIGHT.exit } as const;
export const STATUE_VIEW_GRASS = {
  left: [{ x: 430, y: 728 }, { x: 510, y: 728 }, { x: 510, y: 800 }, { x: 430, y: 800 }],
  right: [{ x: 1330, y: 580 }, { x: 1390, y: 580 }, { x: 1390, y: 609 }, { x: 1330, y: 609 }],
  leftExit: [{ x: 350, y: 714 }, { x: 398, y: 714 }, { x: 398, y: 752 }, { x: 350, y: 752 }],
  rightExit: [{ x: 1346, y: 600 }, { x: 1394, y: 600 }, { x: 1394, y: 637 }, { x: 1346, y: 637 }],
} as const;
