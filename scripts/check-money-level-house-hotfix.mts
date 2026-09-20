import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { MONEY_LEVEL_HOUSE_STAGES, resolveMoneyLevelHouseStage } from "../lib/money-level/house-stages";
import { resolveForestHouseAsset, TEMPORARY_HOUSE_ASSETS } from "../lib/money-level/forest/scene-config";
import { houseWorldToViewport } from "../lib/money-level/forest/house-geometry";
import { resolveHouseVisualFrame, TEMPORARY_HOUSE_VISUAL_FRAMES } from "../lib/money-level/forest/tax-artwork";

const seasons = ["spring", "summer", "fall", "winter"] as const;
const root = process.cwd();
const expectedBySeason = {
  spring: { camp: "camp-spring-summer", house: "house-fall" },
  summer: { camp: "camp-spring-summer", house: "house-fall" },
  fall: { camp: "camp-fall", house: "house-fall" },
  winter: { camp: "camp-winter", house: "house-winter" },
} as const;

assert.equal(Object.keys(TEMPORARY_HOUSE_ASSETS).length, 7);
assert.equal(new Set(Object.values(TEMPORARY_HOUSE_ASSETS).map((asset) => asset.src)).size, 7, "one WebP per approved illustration");

for (const asset of Object.values(TEMPORARY_HOUSE_ASSETS)) {
  assert.equal(asset.composite, "alpha");
  assert.ok(asset.visualFrame);
  assert.ok(!asset.src.match(/tax-stage|brokerage-stage/), "legacy art is not a temporary resolver target");
  const absolute = path.join(root, "public", asset.src);
  const data = readFileSync(absolute);
  assert.equal(data.toString("ascii", 0, 4), "RIFF");
  assert.equal(data.toString("ascii", 8, 12), "WEBP");
  assert.ok(statSync(absolute).size > 500_000);
}

for (const season of seasons) {
  for (const stage of MONEY_LEVEL_HOUSE_STAGES) {
    const asset = resolveForestHouseAsset(season, stage.art);
    if (stage.art === "clearing") {
      assert.equal(asset, null, `${season} clearing has no illustration`);
      continue;
    }
    assert.ok(asset?.src.startsWith("/money-level/art/houses/temporary-"), `${season}/${stage.art} cannot use legacy art`);
    const expected = stage.art === "camp" || stage.art === "camp-plus"
      ? expectedBySeason[season].camp
      : stage.art === "tent-small" || stage.art === "tent-large"
        ? "tent-neutral"
        : stage.art === "tent-color" ? "tent-yellow" : expectedBySeason[season].house;
    assert.equal(asset, TEMPORARY_HOUSE_ASSETS[expected], `${season}/${stage.art}`);
  }
}

for (const [value, art] of [
  [.25e8, "clearing"], [.75e8, "camp"], [1.25e8, "camp-plus"], [1.75e8, "tent-small"],
  [2.25e8, "tent-large"], [2.75e8, "tent-color"], [3.25e8, "micro-house"], [3.75e8, "cabin"],
  [4.25e8, "cabin-expanded"], [4.75e8, "house"], [5.25e8, "workshop-house"], [5.75e8, "two-story"],
  [8.25e8, "mansion"],
] as const) assert.equal(resolveMoneyLevelHouseStage(value).art, art);

for (const kind of ["brokerage", "tax"] as const) {
  const placement = houseWorldToViewport(kind, { width: 1320, height: 520 }, false);
  for (const frame of Object.values(TEMPORARY_HOUSE_VISUAL_FRAMES)) {
    const resolved = resolveHouseVisualFrame(placement, frame);
    const scale = resolved.width / frame.canvas.width;
    const actualGround = {
      x: resolved.x + (frame.ground.x - frame.canvas.width / 2) * scale,
      y: resolved.y + (frame.ground.y - frame.canvas.height / 2) * scale,
    };
    const referenceScale = placement.width / frame.reference.width;
    const expectedGround = {
      x: placement.x + (frame.reference.ground.x - frame.reference.width / 2) * referenceScale,
      y: placement.y + (frame.reference.ground.y - frame.reference.height / 2) * referenceScale,
    };
    assert.ok(Math.abs(actualGround.x - expectedGround.x) < 1e-8);
    assert.ok(Math.abs(actualGround.y - expectedGround.y) < 1e-8);
  }
}

console.log("PASS: 7 approved transparent WebPs; 20 stages × 4 seasons; clearing empty; legacy fallback blocked; ground anchors normalized");
