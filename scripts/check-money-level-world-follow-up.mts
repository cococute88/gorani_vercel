import assert from "node:assert/strict";
import { houseWorldToViewport, HOUSE_WORLD_GEOMETRY, HOUSE_BACKGROUND_LANDMARKS } from "../lib/money-level/forest/house-geometry";
import { projectForestPoint } from "../lib/money-level/forest/landmarks";
import { STATUE_CEREMONY_DROP_ZONES, STATUE_VIEW_GRASS, STATUE_VIEW_ANCHORS, STATUE_CEREMONY_OFFSET_Y_PX } from "../lib/money-level/forest/statue-view";
import { imagePointToScene, resolveDrop, setForestSceneViewport } from "../lib/money-level/forest/navigation";
import { resolveActivityDrop, resolveManualActivityIntent } from "../lib/money-level/forest/activity-zones";
import { getHouseAmbientLighting } from "../lib/money-level/forest/world-object-lighting";
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
for (const width of [1440, 1320, 1100, 980, 768, 390]) for (const height of [520, 610]) {
  const scene = { width, height }, mobile = width === 390, layout = mobile ? "mobile" : "desktop";
  setForestSceneViewport(scene);
  for (const kind of ["brokerage", "tax"] as const) {
    const house = houseWorldToViewport(kind, scene, mobile), world = HOUSE_WORLD_GEOMETRY[kind];
    const landmark = projectForestPoint(HOUSE_BACKGROUND_LANDMARKS[kind], scene, mobile);
    near((house.x - landmark.x) / house.scale, world.x - HOUSE_BACKGROUND_LANDMARKS[kind].x);
    near((house.y - landmark.y) / house.scale, world.y - HOUSE_BACKGROUND_LANDMARKS[kind].y);
    near(house.width / house.scale, world.width);
  }
  for (const slot of ["left", "right"] as const) for (const id of ["gorani", "daramji"] as const) {
    const statues = { left: "stone-bear", right: "gold-bear" } as const;
    const anchor = imagePointToScene(STATUE_VIEW_ANCHORS[slot], layout, { x: 0, y: STATUE_CEREMONY_OFFSET_Y_PX[slot] });
    // Interior points across the old grass plus a new upper point. A 54-master
    // radius cannot accept the latter, but the new polygon can.
    const upper = slot === "left" ? { x: 475, y: 684 } : { x: 1560, y: 562 };
    for (const p of [upper, STATUE_VIEW_ANCHORS[slot], ...STATUE_VIEW_GRASS[slot].map(p => ({ x: p.x + (p.x < STATUE_VIEW_ANCHORS[slot].x ? 1 : -1), y: p.y + (p.y < STATUE_VIEW_ANCHORS[slot].y ? 1 : -1) }))]) {
      const point = imagePointToScene(p, layout);
      const result = resolveManualActivityIntent(point, resolveDrop(point, layout, id), layout, id, statues);
      assert.equal(result?.zone.statueSlot, slot, `${width}/${height} ${slot} accepts old grass and upper extension`);
      near(result!.point.x, anchor.x); near(result!.point.y, anchor.y);
      assert.equal(resolveActivityDrop(point, layout, id, { left: "none", right: "none" }), null, "none disables both ceremony zones");
    }
  }
}
setForestSceneViewport(null);
for (const slot of ["left", "right"] as const) {
  const top = Math.min(...STATUE_CEREMONY_DROP_ZONES[slot].map(p => p.y));
  const legacyTop = Math.min(...STATUE_VIEW_GRASS[slot].map(p => p.y));
  assert.ok((legacyTop - top) * 1320 / 1683 >= (slot === "left" ? 40 : 30), "source polygon expands above existing trigger terrain");
  assert.equal(resolveActivityDrop(imagePointToScene({ x: slot === "left" ? 590 : 1470, y: slot === "left" ? 735 : 568 }, "desktop"), "desktop", "gorani", { left: "stone-bear", right: "gold-bear" }), null, "pedestals are not drop zones");
}
for (const time of ["morning", "day", "evening", "night"] as const) for (const weather of ["sunny", "cloudy", "rain", "thunderstorm"] as const) {
  const ambient = getHouseAmbientLighting(time, weather);
  assert.match(ambient.color, /^#[0-9a-f]{6}$/);
  assert.ok(ambient.opacity >= 0 && ambient.opacity <= .075);
  assert.equal(ambient.blendMode, "multiply");
}
assert.equal(getHouseAmbientLighting("day", "sunny").opacity, 0);
assert.equal(getHouseAmbientLighting("morning", "sunny").opacity, 0);
assert.equal(getHouseAmbientLighting("evening", "sunny").opacity, .035);
assert.equal(getHouseAmbientLighting("night", "thunderstorm").opacity, .075);
console.log("World house/landmark invariance across 12 ratios, broad ceremony intent → fixed anchor, none/pedestal exclusion and ambient resolver PASS");
