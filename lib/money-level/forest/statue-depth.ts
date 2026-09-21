export type ForestDepthKind = "character" | "statue";
export type StatueDepthRelation = "behind" | "aligned" | "front";

/**
 * Quantize ground contact into a stable DOM stacking order. The statue wins an
 * exact tie so a character cannot shimmer through the pedestal at the crossing
 * threshold. Screen Y grows downward, therefore larger ground Y is nearer.
 */
export function forestGroundDepthZ(groundPercent: number, kind: ForestDepthKind): number {
  const safeGround = Math.max(-100, Math.min(200, groundPercent));
  const band = Math.round(safeGround * 20);
  return 10_000 + band * 2 + (kind === "statue" ? 1 : 0);
}

export function screenGroundPercent(groundY: number, sceneHeight: number): number {
  return groundY / Math.max(sceneHeight, 1) * 100;
}

/** A small aligned band documents and stabilizes the visual crossing point. */
export function compareStatueGroundDepth(
  characterGroundPercent: number,
  statueGroundPercent: number,
  alignedTolerancePercent = 0.15,
): StatueDepthRelation {
  if (characterGroundPercent < statueGroundPercent - alignedTolerancePercent) return "behind";
  if (characterGroundPercent > statueGroundPercent + alignedTolerancePercent) return "front";
  return "aligned";
}
