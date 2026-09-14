import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BROKERAGE_LABEL, brokerageLabelPoint, FISHING_BOBBER, fishingLineAngleDeg, projectForestPoint, STATUE_SLOTS, statueSlotPlacement, DOCK_WAYPOINTS } from "../lib/money-level/forest/landmarks";
import { auditNavigation, getWaypoint, isPointInWalkableRegion, setForestSceneViewport, waypointPoint } from "../lib/money-level/forest/navigation";
import { getActivityZone } from "../lib/money-level/forest/activity-zones";
import { FOREST_SCENE, HOUSE_ART_FAMILY, resolveForestBackground } from "../lib/money-level/forest/scene-config";
import { houseWorldToViewport, HOUSE_WORLD_GEOMETRY } from "../lib/money-level/forest/house-geometry";
import { getWorldObjectLighting } from "../lib/money-level/forest/world-object-lighting";
import { MONEY_LEVEL_HOUSE_STAGES } from "../lib/money-level/house-stages";
import { DEFAULT_MONEY_LEVEL_SETTINGS, isValidMoneyLevelSettings, normalizeMoneyLevelSettings, STATUE_OPTIONS } from "../lib/money-level/settings";
import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "../lib/money-level/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const master = readFileSync(path.join(root, "reference/new_reference.png"));
assert.equal(master.readUInt32BE(16), 1683);
assert.equal(master.readUInt32BE(20), 935);

function webpSize(file: string): { width: number; height: number } {
  const data = readFileSync(file);
  assert.equal(data.toString("ascii", 0, 4), "RIFF");
  assert.equal(data.toString("ascii", 8, 12), "WEBP");
  if (data.toString("ascii", 12, 16) === "VP8L") {
    // Night dock color patches use lossless WebP so outside-mask decoded pixels
    // remain exact. Validate its signature and packed canvas dimensions too.
    assert.equal(data[20], 0x2f);
    const bits = data.readUInt32LE(21);
    assert.equal(bits >>> 29, 0, "supported lossless WebP version");
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
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
  const card = brokerageLabelPoint({ width, height }, layout === "mobile");
  const left = projectForestPoint(STATUE_SLOTS.left, { width, height }, layout === "mobile");
  const right = projectForestPoint(STATUE_SLOTS.right, { width, height }, layout === "mobile");
  for (const slot of ["left", "right"] as const) {
    const config = STATUE_SLOTS[slot];
    const originalWidth = layout === "mobile" ? config.mobileBaseWidth : config.baseWidth;
    const originalPoint = projectForestPoint(config, { width, height }, layout === "mobile");
    const placement = statueSlotPlacement(slot, { width, height }, layout === "mobile");
    assert.equal(placement.width, originalWidth * config.scale, `${name} ${slot} scale`);
    assert.ok(Math.abs(placement.visibleBottomY - (originalPoint.y - originalWidth * 52 / 1219 - config.bottomLiftPx)) < 1e-8, `${name} ${slot} screen-space lift`);
    assert.ok(Math.abs(placement.y - placement.width * 52 / 1219 - placement.visibleBottomY) < 1e-8, `${name} ${slot} visible baseline`);
    assert.ok(Math.abs(placement.x - originalPoint.x - config.screenOffsetXPx) < 1e-8, `${name} ${slot} screen-space x offset`);
  }
  const tax = houseWorldToViewport("tax", { width, height }, layout === "mobile");
  const taxVisibleRight = tax.x + tax.width * .39;
  assert.ok(taxVisibleRight < right.x, `${name} tax art stays left of right pedestal in world space`);
  const halfCard = layout === "mobile" ? 67 : 80;
  assert.ok(card.x >= halfCard && card.x <= width - halfCard, `${name} brokerage card in frame`);
  assert.ok(card.y > 40 && card.y < height - 150, `${name} brokerage card above pedestal`);
  assert.ok(Math.abs(card.x - left.x) > halfCard + 38 || Math.abs(card.y - (left.y - 40)) > 80, `${name} card/statue separated`);
  assert.ok(right.x > left.x, `${name} distinct statue slots preserve forest order`);
  if (layout === "mobile") assert.ok(right.x > width, "right pedestal is intentionally outside the mobile cover crop");
}
setForestSceneViewport(null);
assert.deepEqual(getActivityZone("fishing_dock").walkableRegionIds, ["wooden-dock"]);

assert.ok(STATUE_SLOTS.left.x > 530 && STATUE_SLOTS.left.x < 655 && STATUE_SLOTS.left.y >= 690 && STATUE_SLOTS.left.y < 760);
assert.ok(STATUE_SLOTS.right.x > 1412 && STATUE_SLOTS.right.x < 1545);
assert.equal(STATUE_SLOTS.left.y, 735);
assert.equal(STATUE_SLOTS.left.scale, 1.5);
assert.equal(STATUE_SLOTS.left.bottomLiftPx, 2);
assert.ok(Math.abs(STATUE_SLOTS.right.scale - 1.3 * 1.1) < 1e-12);
assert.equal(STATUE_SLOTS.right.bottomLiftPx, 3);
assert.equal(STATUE_SLOTS.right.screenOffsetXPx, 1);
assert.equal(HOUSE_WORLD_GEOMETRY.tax.x, 1258.884);
for (const stage of MONEY_LEVEL_HOUSE_STAGES) {
  const explicit = FOREST_SCENE.stageAssets.tax as Record<string, { src: string } | undefined>;
  const fallback = FOREST_SCENE.familyFallbackAssets.tax[HOUSE_ART_FAMILY[stage.art]];
  const asset = explicit[stage.art] ?? fallback;
  assert.ok(asset.src.startsWith("/money-level/art/houses/"), `tax stage ${stage.level} uses the shared right-lot anchor`);
  assert.deepEqual(webpSize(path.join(root, "public", asset.src)), { width: 1536, height: 1024 }, `tax stage ${stage.level} source size`);
}
const representativeLighting = [
  ["day", "sunny"], ["evening", "sunny"], ["evening", "rain"], ["night", "sunny"], ["night", "thunderstorm"],
] as const;
for (const [time, weather] of representativeLighting) {
  const lighting = getWorldObjectLighting(time, weather);
  assert.ok(lighting.house.filter.includes("brightness("));
  assert.ok(lighting.statue.filter.includes("sepia("));
  assert.ok(lighting.statue.brightness >= lighting.house.brightness, `${time}/${weather} small statues stay readable`);
}
for (const time of ["morning", "day", "evening", "night"] as const) {
  for (const weather of ["sunny", "cloudy", "rain", "thunderstorm"] as const) {
    const lighting = getWorldObjectLighting(time, weather);
    assert.ok(lighting.house.brightness >= .549 && lighting.house.brightness <= 1, `${time}/${weather} house exposure`);
    assert.ok(lighting.statue.brightness >= .565 && lighting.statue.brightness <= 1, `${time}/${weather} statue exposure`);
    assert.ok(lighting.house.saturation >= .59, `${time}/${weather} material colors remain distinct`);
    if (time === "day" || time === "morning") assert.equal(lighting.house.colorMatrix, lighting.statue.colorMatrix, `${time}/${weather} preserved ambient`);
  }
}
assert.equal(getWorldObjectLighting("day", "sunny").house.brightness, 1);
assert.equal(getWorldObjectLighting("evening", "sunny").house.brightness, .82);
assert.equal(getWorldObjectLighting("night", "thunderstorm").house.brightness, .549);
assert.equal(BROKERAGE_LABEL.desktop.x, 200);
const wideCardRight = brokerageLabelPoint({ width: 1320, height: 520 }, false).x + 155 / 2;
assert.ok(245 - wideCardRight >= 6 && 245 - wideCardRight <= 12, "wide card must leave 6–12px to the measured house silhouette");
assert.equal(STATUE_OPTIONS.length, 7);
for (const option of STATUE_OPTIONS.filter((item) => item.value !== "none")) {
  const png = readFileSync(path.join(root, `public/money-level/art/statues/${option.value}.png`));
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1219);
  assert.equal(png.readUInt32BE(20), 1290);
  assert.equal(png[25], 6, `${option.value} must have alpha`);
}
assert.equal(normalizeMoneyLevelSettings(undefined).leftStatue, "none");
assert.equal(normalizeMoneyLevelSettings({ ...DEFAULT_MONEY_LEVEL_SETTINGS, leftStatue: "stone-bear" }).leftStatue, "stone-bear");
assert.equal(normalizeMoneyLevelSettings({ ...DEFAULT_MONEY_LEVEL_SETTINGS, leftStatue: "bad" as "none" }).leftStatue, "none");
assert.equal(normalizeMoneyLevelSettings({ leftStatue: "stone-bear" }).rightStatue, "none", "legacy v1 settings migration");
assert.equal(isValidMoneyLevelSettings({ ...DEFAULT_MONEY_LEVEL_SETTINGS, rightStatue: "crystal-bear" }), true);
assert.equal(isValidMoneyLevelSettings({ ...DEFAULT_MONEY_LEVEL_SETTINGS, rightStatue: "unknown" }), false);
for (const option of STATUE_OPTIONS) {
  assert.equal(normalizeMoneyLevelSettings({ leftStatue: option.value, rightStatue: option.value }).leftStatue, option.value);
  assert.equal(normalizeMoneyLevelSettings({ leftStatue: option.value, rightStatue: option.value }).rightStatue, option.value);
}
const tip = { x: 12, y: 10 }, bobber = { x: 48, y: 75 };
const angle = fishingLineAngleDeg(tip, bobber) * Math.PI / 180;
const length = Math.hypot(bobber.x - tip.x, bobber.y - tip.y);
assert.ok(Math.abs(tip.x - Math.sin(angle) * length - bobber.x) < 1e-9);
assert.ok(Math.abs(tip.y + Math.cos(angle) * length - bobber.y) < 1e-9);

console.log("Money Level geometry, 16 canvas/mapping, dock routes, statue and fishing line checks passed");
