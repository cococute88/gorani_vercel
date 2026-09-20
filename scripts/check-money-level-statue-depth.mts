import assert from "node:assert/strict";
import { compareStatueGroundDepth, forestGroundDepthZ, screenGroundPercent } from "../lib/money-level/forest/statue-depth";

assert.equal(compareStatueGroundDepth(54, 60), "behind");
assert.equal(compareStatueGroundDepth(66, 60), "front");
assert.equal(compareStatueGroundDepth(60, 60), "aligned");
assert.ok(forestGroundDepthZ(54, "character") < forestGroundDepthZ(60, "statue"));
assert.ok(forestGroundDepthZ(66, "character") > forestGroundDepthZ(60, "statue"));
assert.ok(forestGroundDepthZ(60, "character") < forestGroundDepthZ(60, "statue"), "statue wins an exact ground-depth tie");
assert.equal(screenGroundPercent(360, 600), 60);

for (const statueGround of [35, 60, 85]) {
  for (const characterGround of [statueGround - 8, statueGround, statueGround + 8]) {
    const relation = compareStatueGroundDepth(characterGround, statueGround);
    const characterZ = forestGroundDepthZ(characterGround, "character");
    const statueZ = forestGroundDepthZ(statueGround, "statue");
    if (relation === "front") assert.ok(characterZ > statueZ);
    else assert.ok(characterZ < statueZ);
  }
}

console.log("Money Level per-character statue ground-depth ordering passed");
