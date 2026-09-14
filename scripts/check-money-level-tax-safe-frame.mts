import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOREST_SCENE, HOUSE_ART_FAMILY, type SceneAsset } from "../lib/money-level/forest/scene-config";
import { TAX_VISUAL_FRAMES, resolveHouseVisualFrame } from "../lib/money-level/forest/tax-artwork";
import { houseWorldToViewport, HOUSE_WORLD_GEOMETRY, taxHouseLabelPoint } from "../lib/money-level/forest/house-geometry";
import { MONEY_LEVEL_HOUSE_STAGES } from "../lib/money-level/house-stages";
const assets = FOREST_SCENE.stageAssets.tax as Partial<Record<string, SceneAsset>>;
const used = new Set<string>();
for (const stage of MONEY_LEVEL_HOUSE_STAGES) {
  const asset = assets[stage.art] ?? FOREST_SCENE.familyFallbackAssets.tax[HOUSE_ART_FAMILY[stage.art]];
  assert.equal(asset.composite, "alpha"); assert.ok(asset.visualFrame);
  used.add(asset.src);
}
assert.equal(used.size, 4);
assert.equal(FOREST_SCENE.familyFallbackAssets.brokerage.camp.src, "/money-level/art/houses/tax-stage-10-15-camp-plus.webp");
for (const width of [1440,1320,1100,980,768,390]) {
  const scene = { width, height: 520 };
  const placement = houseWorldToViewport("tax", scene, width === 390);
  for (const frame of Object.values(TAX_VISUAL_FRAMES)) {
    const resolved = resolveHouseVisualFrame(placement, frame);
    assert.ok(Math.abs(resolved.x-placement.x)<1e-9 && Math.abs(resolved.y-placement.y)<1e-9);
    assert.equal(resolved.width,placement.width);
    const top = placement.y+(frame.visibleBounds[1]-512)*placement.width/1536;
    for(const camera of [-300,0,300]) {
      const label = taxHouseLabelPoint(scene,width===390,camera,frame);
      assert.ok(label.y+32<=top-8);
    }
    // Hypothetical padding preserves world contact and original visual scale.
    const padded = { ...frame, canvas: {width:1736,height:1224}, ground:{x:868,y:1000} };
    const p = resolveHouseVisualFrame(placement,padded);
    const scale = placement.width/frame.reference.width;
    assert.ok(Math.abs((p.y+(padded.ground.y-padded.canvas.height/2)*scale)
      -(placement.y+(frame.ground.y-frame.canvas.height/2)*scale))<1e-9);
  }
}
assert.deepEqual(HOUSE_WORLD_GEOMETRY.tax, {x:1246.884,y:414.905,width:495.6435});
const audit = JSON.parse(readFileSync("art-review/money-level/tax-safe-frame-v2/safe-frame-audit.json","utf8"));
for (const entry of audit) {
  assert.deepEqual(entry.visibleAlphaBounds,TAX_VISUAL_FRAMES[entry.name].visibleBounds);
  assert.equal(entry.visibleRgbDiff,0);
  assert.ok(Object.values(entry.margins).every(n=>Number(n)>=40));
}
console.log("PASS: 20 stage mappings / four safe-frame assets; preserved Tax ground and scale at six widths; padding invariant; Brokerage unchanged");
