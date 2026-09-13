import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FISHING_BOBBER, fishingLineAngleDeg, projectForestPoint, STATUE_SLOTS, DOCK_WAYPOINTS } from "../lib/money-level/forest/landmarks";
import { auditNavigation, getWaypoint, isPointInWalkableRegion, setForestSceneViewport, waypointPoint } from "../lib/money-level/forest/navigation";
import { getActivityZone } from "../lib/money-level/forest/activity-zones";
import { resolveForestBackground } from "../lib/money-level/forest/scene-config";
import { DEFAULT_MONEY_LEVEL_SETTINGS, normalizeMoneyLevelSettings } from "../lib/money-level/settings";
import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "../lib/money-level/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const master = readFileSync(path.join(root, "reference/new_reference.png"));
assert.equal(master.readUInt32BE(16), 1683);
assert.equal(master.readUInt32BE(20), 935);

function webpSize(file: string): { width: number; height: number } {
  const data = readFileSync(file);
  assert.equal(data.toString("ascii", 0, 4), "RIFF");
  assert.equal(data.toString("ascii", 8, 12), "WEBP");
  assert.equal(data.toString("ascii", 12, 16), "VP8 ");
  assert.equal(data.toString("hex", 23, 26), "9d012a");
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
}

for (const time of ["morning", "day", "evening", "night"] as const) {
  for (const [weather, fileWeather] of [["sunny", "sunny"], ["cloudy", "cloudy"], ["rain", "rain"], ["thunderstorm", "storm"]] as const) {
    const url = `/money-level/art/background/forest-${time}-${fileWeather}-docked.webp`;
    assert.equal(resolveForestBackground(time as MoneyLevelTimeOfDay, weather as MoneyLevelWeather), url);
    assert.deepEqual(webpSize(path.join(root, "public", url)), { width: 1683, height: 935 });
    const candidate = readFileSync(path.join(root, `art-review/money-level/new-layout/hybrid/forest-${time}-${fileWeather}.png`));
    assert.equal(candidate.readUInt32BE(16), 1683);
    assert.equal(candidate.readUInt32BE(20), 935);
  }
}

for (const [name, width, height, layout] of [
  ["wide", 1320, 520, "desktop"],
  ["narrow", 980, 520, "desktop"],
  ["tablet", 768, 520, "desktop"],
  ["mobile", 390, 512, "mobile"],
] as const) {
  setForestSceneViewport({ width, height });
  for (const character of ["gorani", "daramji"] as const) {
    const audit = auditNavigation(layout, character);
    assert.deepEqual(audit, { invalidWaypoints: [], invalidSegments: [], unreachablePairs: [] }, `${name} ${character}`);
  }
  for (const [id, source] of Object.entries(DOCK_WAYPOINTS)) {
    const projected = projectForestPoint(source[layout], { width, height }, layout === "mobile");
    const waypoint = waypointPoint(getWaypoint(id), layout);
    assert.ok(Math.abs(waypoint.x - projected.x / width * 100) < .001, `${name} ${id} x`);
    assert.ok(Math.abs(waypoint.y - projected.y / height * 100) < .001, `${name} ${id} y`);
  }
  const fishing = waypointPoint(getWaypoint("dock_end"), layout);
  assert.equal(isPointInWalkableRegion(fishing, layout, "wooden-dock"), true, `${name} fishing feet on dock`);
  const bobber = projectForestPoint(FISHING_BOBBER[layout], { width, height }, layout === "mobile");
  assert.ok(bobber.x >= 0 && bobber.x <= width && bobber.y >= 0 && bobber.y <= height, `${name} bobber visible`);
  assert.equal(isPointInWalkableRegion({ x: bobber.x / width * 100, y: bobber.y / height * 100 }, layout, "wooden-dock"), false, `${name} bobber in pond`);
}
setForestSceneViewport(null);
assert.deepEqual(getActivityZone("fishing_dock").walkableRegionIds, ["wooden-dock"]);

assert.ok(STATUE_SLOTS.left.x > 530 && STATUE_SLOTS.left.x < 655 && STATUE_SLOTS.left.y >= 690 && STATUE_SLOTS.left.y < 760);
assert.ok(STATUE_SLOTS.right.x > 1412 && STATUE_SLOTS.right.x < 1545);
const stone = readFileSync(path.join(root, "public/money-level/art/statues/stone-bear.png"));
assert.equal(stone.toString("hex", 0, 8), "89504e470d0a1a0a");
assert.equal(stone[25], 6, "Stone bear must have an alpha channel");
assert.equal(normalizeMoneyLevelSettings(undefined).leftStatue, "none");
assert.equal(normalizeMoneyLevelSettings({ ...DEFAULT_MONEY_LEVEL_SETTINGS, leftStatue: "stone-bear" }).leftStatue, "stone-bear");
assert.equal(normalizeMoneyLevelSettings({ ...DEFAULT_MONEY_LEVEL_SETTINGS, leftStatue: "bad" as "none" }).leftStatue, "none");
const tip = { x: 12, y: 10 }, bobber = { x: 48, y: 75 };
const angle = fishingLineAngleDeg(tip, bobber) * Math.PI / 180;
const length = Math.hypot(bobber.x - tip.x, bobber.y - tip.y);
assert.ok(Math.abs(tip.x - Math.sin(angle) * length - bobber.x) < 1e-9);
assert.ok(Math.abs(tip.y + Math.cos(angle) * length - bobber.y) < 1e-9);

console.log("Money Level geometry, 16 canvas/mapping, dock routes, statue and fishing line checks passed");
