export const GORANI_BENCH_POSE = {
  animation: "idle",
  rotationDeg: -12,
  pivotBone: "center",
  offsetXPx: 0,
  offsetYPx: 12,
} as const;

/** Generic ground only: favor the last meaningful movement, occasionally turn. */
export function normalGroundFacing(previous: "left" | "right", dx = 0, roll = Math.random()): "left" | "right" {
  const direction = Math.abs(dx) >= .75 ? dx < 0 ? "left" : "right" : previous;
  return roll < .65 ? direction : direction === "left" ? "right" : "left";
}
