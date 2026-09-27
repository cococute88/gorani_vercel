import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { MONEY_LEVEL_HOUSE_STAGES, resolveMoneyLevelHouseStage } from "../lib/money-level/house-stages";
import { HOUSE_STAGE_ASSETS, resolveForestHouseAsset, TEMPORARY_HOUSE_ASSETS } from "../lib/money-level/forest/scene-config";
import { houseWorldToViewport } from "../lib/money-level/forest/house-geometry";
import { HOUSE_STAGE_VISUAL_FRAMES, resolveHouseVisualFrame, TEMPORARY_HOUSE_VISUAL_FRAMES } from "../lib/money-level/forest/tax-artwork";

const seasons = ["spring", "summer", "fall", "winter"] as const;
const kinds = ["brokerage", "tax"] as const;
const root = process.cwd();
const expectedCampBySeason = {
  spring: "camp-spring-summer",
  summer: "camp-spring-summer",
  fall: "camp-fall",
  winter: "camp-winter",
} as const;

assert.equal(Object.keys(TEMPORARY_HOUSE_ASSETS).length, 7);
assert.equal(new Set(Object.values(TEMPORARY_HOUSE_ASSETS).map((asset) => asset.src)).size, 7, "one WebP per approved temporary illustration");

for (const asset of Object.values(TEMPORARY_HOUSE_ASSETS)) {
  assert.equal(asset.composite, "alpha");
  assert.ok(asset.visualFrame);
  const absolute = path.join(root, "public", asset.src);
  const data = readFileSync(absolute);
  assert.equal(data.toString("ascii", 0, 4), "RIFF");
  assert.equal(data.toString("ascii", 8, 12), "WEBP");
  assert.ok(statSync(absolute).size > 250_000);
}

for (const kind of kinds) {
  const dedicated = Object.values(HOUSE_STAGE_ASSETS[kind]);
  assert.equal(dedicated.length, 14, `${kind} has one dedicated asset for every house stage`);
  assert.equal(new Set(dedicated.map((asset) => asset.src)).size, 14, `${kind} house stages do not share art`);
  for (const asset of dedicated) {
    assert.ok(asset.src.includes(`/houses/${kind}-stage-`));
    const absolute = path.join(root, "public", asset.src);
    const data = readFileSync(absolute);
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.toString("ascii", 8, 12), "WEBP");
    assert.ok(statSync(absolute).size > 80_000, `${asset.src} is not truncated`);
  }

  for (const season of seasons) {
    for (const stage of MONEY_LEVEL_HOUSE_STAGES) {
      const asset = resolveForestHouseAsset(kind, season, stage.art);
      if (stage.art === "clearing") {
        assert.equal(asset, null, `${kind}/${season} clearing has no illustration`);
        continue;
      }
      if (stage.level <= 5) {
        const expected = stage.art === "camp" || stage.art === "camp-plus"
          ? expectedCampBySeason[season]
          : stage.art === "tent-color" ? "tent-yellow" : "tent-neutral";
        assert.equal(asset?.src, TEMPORARY_HOUSE_ASSETS[expected].src, `${kind}/${season}/${stage.art}`);
        if (stage.art === "tent-large") {
          assert.equal(asset?.visualFrame, TEMPORARY_HOUSE_VISUAL_FRAMES["tent-neutral-large"]);
        }
        continue;
      }
      assert.ok(asset?.src.includes(`/houses/${kind}-stage-`), `${kind}/${season}/${stage.art} uses dedicated art`);
      assert.ok(!asset?.src.includes("temporary-house"), `${kind}/${season}/${stage.art} does not use the old house fallback`);
      assert.equal(asset, HOUSE_STAGE_ASSETS[kind][stage.art]);
    }
  }
}

for (const [value, art] of [
  [.25e8, "clearing"], [.75e8, "camp"], [1.25e8, "camp-plus"], [1.75e8, "tent-small"],
  [2.25e8, "tent-large"], [2.75e8, "tent-color"], [3.25e8, "micro-house"], [3.75e8, "cabin"],
  [4.25e8, "cabin-expanded"], [4.75e8, "house"], [5.25e8, "workshop-house"], [5.75e8, "two-story"],
  [8.25e8, "mansion"], [10e8, "grand-mansion-annex"],
] as const) assert.equal(resolveMoneyLevelHouseStage(value).art, art);

for (const kind of kinds) {
  const placement = houseWorldToViewport(kind, { width: 1320, height: 520 }, false);
  for (const frame of [...Object.values(TEMPORARY_HOUSE_VISUAL_FRAMES), ...Object.values(HOUSE_STAGE_VISUAL_FRAMES)]) {
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

console.log("PASS: early approved art preserved; 28 dedicated Lv.6-19 mappings; 20 stages x 2 accounts x 4 seasons; ground anchors normalized");
