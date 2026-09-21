import assert from "node:assert/strict";

import { resolveForestHouseAsset } from "../lib/money-level/forest/scene-config";
import type { HouseVisualFrame } from "../lib/money-level/forest/tax-artwork";

const MASTER_GROUND = { x: 768, y: 900 };
const MASTER_WIDTH = 1536;
const campCases = [
  { season: "spring", art: "camp-plus", src: "temporary-camp-spring-summer.webp" },
  { season: "summer", art: "camp-plus", src: "temporary-camp-spring-summer.webp" },
  { season: "fall", art: "camp-plus", src: "temporary-camp-fall.webp" },
  { season: "winter", art: "camp-plus", src: "temporary-camp-winter.webp" },
] as const;

const tentCases = [
  { season: "spring", art: "tent-small", src: "temporary-tent-neutral.webp", master: [159, 224, 1254, 969] },
  { season: "spring", art: "tent-large", src: "temporary-tent-neutral.webp", master: [157, 70, 1417, 967] },
  { season: "spring", art: "tent-color", src: "temporary-tent-yellow.webp", master: [57, 71, 1482, 969] },
] as const;

function mapBounds(frame: HouseVisualFrame) {
  const scale = MASTER_WIDTH / frame.reference.width;
  const translateX = MASTER_GROUND.x - frame.ground.x * scale;
  const translateY = MASTER_GROUND.y - frame.ground.y * scale;
  const [x0, y0, x1, y1] = frame.visibleBounds;
  return [x0 * scale + translateX, y0 * scale + translateY, x1 * scale + translateX, y1 * scale + translateY] as const;
}

// Camp size/placement is baked into the WebP pixels after browser-first visual
// comparison with the alpha-v2 master. Do not reintroduce the old alpha-area
// fit here: unlike tents, the replacement camps have different silhouettes,
// so equal alpha area is not equal perceived size.
for (const testCase of campCases) {
  const asset = resolveForestHouseAsset(testCase.season, testCase.art);
  assert.ok(asset?.src.endsWith(testCase.src), `${testCase.season}/${testCase.art} source mapping`);
  assert.ok(asset.visualFrame, `${testCase.season}/${testCase.art} visual frame`);
  assert.equal(asset.visualFrame.reference.width, 1536, `${testCase.season}/${testCase.art} identity width`);
  assert.equal(asset.visualFrame.reference.height, 1024, `${testCase.season}/${testCase.art} identity height`);
  assert.deepEqual(asset.visualFrame.reference.ground, MASTER_GROUND, `${testCase.season}/${testCase.art} identity reference ground`);
  assert.deepEqual(asset.visualFrame.ground, MASTER_GROUND, `${testCase.season}/${testCase.art} identity ground`);
  assert.equal(MASTER_WIDTH / asset.visualFrame.reference.width, 1, `${testCase.season}/${testCase.art} no runtime scale`);
}

for (const testCase of tentCases) {
  const asset = resolveForestHouseAsset(testCase.season, testCase.art);
  assert.ok(asset?.src.endsWith(testCase.src), `${testCase.season}/${testCase.art} source mapping`);
  assert.ok(asset.visualFrame, `${testCase.season}/${testCase.art} visual frame`);
  const actual = mapBounds(asset.visualFrame);
  const [mx0, my0, mx1, my1] = testCase.master;
  const masterWidth = mx1 - mx0;
  const masterHeight = my1 - my0;
  const actualWidth = actual[2] - actual[0];
  const actualHeight = actual[3] - actual[1];
  const widthRatio = actualWidth / masterWidth;
  const heightRatio = actualHeight / masterHeight;
  const areaRatio = widthRatio * heightRatio;
  assert.ok(Math.abs(areaRatio - 1) < 0.0002, `${testCase.art} alpha area: ${areaRatio}`);
  assert.ok(Math.abs(widthRatio - 1) < 0.06, `${testCase.art} width: ${widthRatio}`);
  assert.ok(Math.abs(heightRatio - 1) < 0.06, `${testCase.art} height: ${heightRatio}`);
  assert.ok(Math.abs((actual[0] + actual[2]) / 2 - (mx0 + mx1) / 2) < 0.01, `${testCase.art} centre`);
  assert.ok(Math.abs(actual[3] - my1) < 0.01, `${testCase.art} bottom baseline`);
}

const small = resolveForestHouseAsset("spring", "tent-small");
const large = resolveForestHouseAsset("spring", "tent-large");
assert.equal(small?.src, large?.src, "one approved neutral tent file is intentionally reused");
assert.notEqual(small?.visualFrame, large?.visualFrame, "small and large stages require distinct alpha-v2 master frames");

console.log("PASS: 4 direct-pixel camp mappings use identity frames; 3 tent mappings retain alpha-v2 frame regression checks");
