/** Separate visual canvas from the contact point: padding must not move feet
 * or change artwork size in the immutable source world. */
export interface HouseVisualFrame {
  canvas: { width: number; height: number };
  reference: { width: number; height: number; ground: { x: number; y: number } };
  ground: { x: number; y: number };
  visibleBounds: readonly [number, number, number, number];
}

const temporaryFrame = (
  canvas: HouseVisualFrame["canvas"],
  visibleBounds: HouseVisualFrame["visibleBounds"],
  ground: HouseVisualFrame["ground"],
  referenceWidth = 1536,
): HouseVisualFrame => {
  const referenceScale = referenceWidth / 1536;
  return {
    canvas,
    reference: {
      width: referenceWidth,
      height: 1024 * referenceScale,
      ground: { x: referenceWidth / 2, y: 900 * referenceScale },
    },
    ground,
    visibleBounds,
  };
};

/** Temporary user-approved art frames. Source pixels remain unwarped; only
 * render scale and the real ground contact are normalized. */
export const TEMPORARY_HOUSE_VISUAL_FRAMES = {
  "camp-spring-summer": temporaryFrame({ width: 1536, height: 1024 }, [65, 241, 1436, 926], { x: 751, y: 925 }),
  "camp-fall": temporaryFrame({ width: 1536, height: 1024 }, [65, 160, 1450, 942], { x: 758, y: 941 }),
  // The winter camp's source illustration is about 12% narrower than the
  // other seasonal camps, so normalize it with uniform scale only.
  "camp-winter": temporaryFrame({ width: 1536, height: 1024 }, [124, 306, 1325, 930], { x: 725, y: 929 }, 1345),
  "tent-neutral": temporaryFrame({ width: 1448, height: 1086 }, [126, 72, 1369, 1017], { x: 748, y: 1016 }),
  "tent-yellow": temporaryFrame({ width: 1536, height: 1024 }, [35, 20, 1493, 977], { x: 764, y: 976 }),
  "house-fall": temporaryFrame({ width: 1448, height: 1086 }, [2, 11, 1444, 1049], { x: 723, y: 1048 }),
  "house-winter": temporaryFrame({ width: 1536, height: 1024 }, [50, 13, 1486, 971], { x: 768, y: 970 }),
} satisfies Record<string, HouseVisualFrame>;

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
