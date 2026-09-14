/** Separate visual canvas from the contact point: padding must not move feet
 * or change artwork size in the immutable source world. */
export interface HouseVisualFrame {
  canvas: { width: number; height: number };
  reference: { width: number; height: number; ground: { x: number; y: number } };
  ground: { x: number; y: number };
  visibleBounds: readonly [number, number, number, number];
}
const frame = (visibleBounds: HouseVisualFrame["visibleBounds"]): HouseVisualFrame => ({
  canvas: { width: 1536, height: 1024 },
  reference: { width: 1536, height: 1024, ground: { x: 768, y: 900 } },
  ground: { x: 768, y: 900 }, visibleBounds,
});
export const TAX_VISUAL_FRAMES: Record<string, HouseVisualFrame> = {
  "tax-stage-10-15-camp-plus": frame([149, 337, 1309, 967]),
  "tax-stage-15-20-small-white-tent": frame([150, 224, 1262, 977]),
  "tax-stage-20-25-large-white-tent": frame([149, 70, 1428, 975]),
  "tax-stage-25-30-colored-tent": frame([49, 71, 1491, 977]),
};
export function resolveHouseVisualFrame(placement: { x: number; y: number; width: number }, frame?: HouseVisualFrame) {
  if (!frame) return placement;
  if (frame.canvas.width === frame.reference.width && frame.canvas.height === frame.reference.height
    && frame.ground.x === frame.reference.ground.x && frame.ground.y === frame.reference.ground.y) return placement;
  const pixelScale = placement.width / frame.reference.width;
  const groundX = placement.x + (frame.reference.ground.x - frame.reference.width / 2) * pixelScale;
  const groundY = placement.y + (frame.reference.ground.y - frame.reference.height / 2) * pixelScale;
  return { x: groundX + (frame.canvas.width / 2 - frame.ground.x) * pixelScale,
    y: groundY + (frame.canvas.height / 2 - frame.ground.y) * pixelScale,
    width: frame.canvas.width * pixelScale };
}
