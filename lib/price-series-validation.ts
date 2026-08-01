export type PricePointLike = { date?: unknown; close?: unknown };

export function hasUsablePricePoints(points: PricePointLike[], minimum = 2): boolean {
  const dates = new Set<string>();
  for (const point of points) {
    if (typeof point.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(point.date)) continue;
    if (typeof point.close !== "number" || !Number.isFinite(point.close) || point.close <= 0) continue;
    dates.add(point.date);
    if (dates.size >= minimum) return true;
  }
  return false;
}
