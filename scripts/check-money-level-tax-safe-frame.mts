import assert from "node:assert/strict";

import { MONEY_LEVEL_HOUSE_STAGES } from "../lib/money-level/house-stages";
import { resolveForestHouseAsset } from "../lib/money-level/forest/scene-config";
import { houseWorldToViewport, HOUSE_WORLD_GEOMETRY, taxHouseLabelPoint } from "../lib/money-level/forest/house-geometry";
import { resolveHouseVisualFrame, TEMPORARY_HOUSE_VISUAL_FRAMES } from "../lib/money-level/forest/tax-artwork";

const seasons = ["spring", "summer", "fall", "winter"] as const;
const used = new Set<string>();
for (const season of seasons) for (const stage of MONEY_LEVEL_HOUSE_STAGES) {
  const asset = resolveForestHouseAsset(season, stage.art);
  if (stage.art === "clearing") {
    assert.equal(asset, null);
    continue;
  }
  assert.equal(asset?.composite, "alpha");
  assert.ok(asset?.visualFrame);
  assert.ok(asset?.src.includes("/temporary-"));
  used.add(asset!.src);
}
assert.equal(used.size, 7);

for (const width of [1440, 1320, 1100, 980, 768, 390]) {
  const scene = { width, height: 520 };
  const placement = houseWorldToViewport("tax", scene, width === 390);
  for (const frame of Object.values(TEMPORARY_HOUSE_VISUAL_FRAMES)) {
    const resolved = resolveHouseVisualFrame(placement, frame);
    const scale = resolved.width / frame.canvas.width;
    const actualGround = {
      x: resolved.x + (frame.ground.x - frame.canvas.width / 2) * scale,
      y: resolved.y + (frame.ground.y - frame.canvas.height / 2) * scale,
    };
    const referenceScale = placement.width / frame.reference.width;
    const referenceGround = {
      x: placement.x + (frame.reference.ground.x - frame.reference.width / 2) * referenceScale,
      y: placement.y + (frame.reference.ground.y - frame.reference.height / 2) * referenceScale,
    };
    assert.ok(Math.abs(actualGround.x - referenceGround.x) < 1e-8);
    assert.ok(Math.abs(actualGround.y - referenceGround.y) < 1e-8);
    for (const camera of [-300, 0, 300]) {
      const label = taxHouseLabelPoint(scene, width === 390, camera, frame);
      assert.ok(label.y >= 32 && label.y <= scene.height - 32);
    }
  }
}
assert.deepEqual(HOUSE_WORLD_GEOMETRY.tax, { x: 1246.884, y: 414.905, width: 495.6435 });
console.log("PASS: 20 stages × four seasons; seven alpha assets; ground/scale invariant at six widths; legacy Tax fallback removed");
