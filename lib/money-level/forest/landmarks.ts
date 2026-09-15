/** Coordinates in the immutable 1683 × 935 forest geometry master. */
export const FOREST_MASTER_SIZE = { width: 1683, height: 935 } as const;

export const STATUE_SLOTS = {
  /** Image bottom is transparent-padded; visible throne bottom touches the pedestal top at y≈732. */
  left: { x: 590, y: 735, baseWidth: 76, mobileBaseWidth: 70, scale: 1.5, bottomLiftPx: 2, screenOffsetXPx: 0 },
  right: { x: 1470, y: 568, baseWidth: 62, mobileBaseWidth: 58, scale: 1.43, bottomLiftPx: 3, screenOffsetXPx: 1 },
} as const;

/** All six normalized PNGs have 52 transparent source pixels below the visible base. */
const STATUE_BOTTOM_PADDING_PER_WIDTH = 52 / 1219;

export function statueSlotPlacement(
  slot: keyof typeof STATUE_SLOTS,
  scene: { width: number; height: number },
  mobile: boolean,
) {
  const config = STATUE_SLOTS[slot];
  const source = projectForestPoint(config, scene, mobile);
  const baseWidth = mobile ? config.mobileBaseWidth : config.baseWidth;
  const width = baseWidth * config.scale;
  // Compensate for transparent PNG padding as width changes, so the *visible*
  // statue bottom—not the CSS image box—moves upward by exactly bottomLiftPx.
  return {
    x: source.x + config.screenOffsetXPx,
    y: source.y + (width - baseWidth) * STATUE_BOTTOM_PADDING_PER_WIDTH - config.bottomLiftPx,
    width,
    visibleBottomY: source.y - baseWidth * STATUE_BOTTOM_PADDING_PER_WIDTH - config.bottomLiftPx,
  };
}

/** Brokerage card follows forest landmarks, with a mobile-specific crop-safe position. */
export const BROKERAGE_LABEL = {
  // At 1320×520, the house silhouette starts near x=245 at card-bottom level.
  // This places the card right edge near x=235: a 10px visual gap.
  desktop: { x: 170, y: 375 },
  mobile: { x: 170, y: 375 },
} as const;

export function brokerageLabelPoint(scene: { width: number; height: number }, mobile: boolean) {
  const point = projectForestPoint(BROKERAGE_LABEL[mobile ? "mobile" : "desktop"], scene, mobile);
  // Keep the compact banner inside a shared 24px outer inset on every viewport.
  const halfCard = 96; // 144px card half-width + common 24px outer inset.
  return { x: Math.max(halfCard, Math.min(scene.width - halfCard, point.x)), y: point.y };
}

export const FISHING_BOBBER = {
  desktop: { x: 1390, y: 788 },
  mobile: { x: 1080, y: 804 },
} as const;

/** Baked left bench seat and the nearby clear grass used when yielding it. */
export const BENCH_SEAT_MASTER = { x: 302, y: 616 } as const;
export const BENCH_EXIT_MASTER = { x: 355, y: 662 } as const;

export const DOCK_WAYPOINTS = {
  pond_edge: { desktop: { x: 926, y: 646 }, mobile: { x: 916, y: 674 } },
  pond_land: { desktop: { x: 985, y: 660 }, mobile: { x: 961, y: 682 } },
  dock_connector: { desktop: { x: 1035, y: 693 }, mobile: { x: 1016, y: 710 } },
  dock_start: { desktop: { x: 1111, y: 709 }, mobile: { x: 1065, y: 742 } },
  dock_mid: { desktop: { x: 1181, y: 733 }, mobile: { x: 1115, y: 762 } },
  dock_end: { desktop: { x: 1258, y: 777 }, mobile: { x: 1150, y: 781 } },
} as const;

export const DOCK_ACCESS_POLYGON = [
  { x: 910, y: 620 }, { x: 980, y: 630 }, { x: 1080, y: 680 },
  { x: 1290, y: 750 }, { x: 1285, y: 830 }, { x: 1170, y: 790 },
  { x: 1040, y: 745 }, { x: 940, y: 695 },
] as const;

/** Wooden walking surface only; excludes shoreline grass and adjacent water. */
export const DOCK_MAIN_POLYGON = [
  { x: 1070, y: 687 }, { x: 1290, y: 758 }, { x: 1290, y: 800 },
  { x: 1245, y: 825 }, { x: 1070, y: 760 },
] as const;

export function projectForestPoint(
  point: { x: number; y: number },
  scene: { width: number; height: number },
  mobile: boolean,
): { x: number; y: number } {
  const scale = Math.max(scene.width / FOREST_MASTER_SIZE.width, scene.height / FOREST_MASTER_SIZE.height);
  const cropX = (FOREST_MASTER_SIZE.width * scale - scene.width) * (mobile ? 0.51 : 0.5);
  const cropY = (FOREST_MASTER_SIZE.height * scale - scene.height) * 0.5;
  return { x: point.x * scale - cropX, y: point.y * scale - cropY };
}

/** CSS rotates a downward line clockwise, so positive target X needs a negative angle. */
export function fishingLineAngleDeg(tip: { x: number; y: number }, bobber: { x: number; y: number }): number {
  return -Math.atan2(bobber.x - tip.x, bobber.y - tip.y) * 180 / Math.PI;
}
