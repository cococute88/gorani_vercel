import { brokerageLabelPoint, FOREST_MASTER_SIZE, projectForestPoint } from "./landmarks";

export type HouseKind = "brokerage" | "tax";
// Image-box centers/widths in the immutable 1683×935 background. Calibrated
// from the existing 1320×520 composition; Tax's former -6px lift is baked into
// its source Y, so it scales with the scene rather than drifting at each ratio.
export const HOUSE_WORLD_GEOMETRY = {
  brokerage: { x: 563.805, y: 434.35, width: 622.71 },
  tax: { x: 1258.884, y: 449.905, width: 521.73 },
} as const;
export const TAX_LABEL_WORLD = { x: 1208.394, y: 596.785 } as const;
export const HOUSE_BACKGROUND_LANDMARKS = {
  brokerage: { x: 435, y: 602 }, // stump beside the baked bench
  tax: { x: 1415, y: 520 }, // right-lot fence/stump corner
} as const;

/** Same cover/crop projection as all fixed forest landmarks and background. */
export function houseWorldToViewport(kind: HouseKind, scene: { width: number; height: number }, mobile: boolean) {
  const world = HOUSE_WORLD_GEOMETRY[kind];
  const scale = Math.max(scene.width / FOREST_MASTER_SIZE.width, scene.height / FOREST_MASTER_SIZE.height);
  return { ...projectForestPoint(world, scene, mobile), width: world.width * scale, scale };
}

/** Labels are viewport UI: when clamping a card would cover the house in a
 * tight crop, put it above the image. The world object itself never moves. */
export function brokerageHouseLabelPoint(scene: { width: number; height: number }, mobile: boolean) {
  const point = brokerageLabelPoint(scene, mobile);
  const house = houseWorldToViewport("brokerage", scene, mobile);
  const halfWidth = mobile ? 67 : 80;
  // Shared 1536×1024 art frame, with transparent/feathered side margins.
  const top = house.y - house.width / 3;
  if (point.x + halfWidth > house.x - house.width * .35
    && point.x - halfWidth < house.x + house.width * .4
    && point.y + 36 > top && point.y - 36 < house.y + house.width / 3) {
    return { x: point.x, y: Math.max(44, top - 44) };
  }
  return point;
}
