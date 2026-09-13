import assert from "node:assert/strict";
import { cameraTranslation, clampCameraX, createForestCamera, EDGE_MAX_SPEED_PX, edgePanSpeed, resolveGestureIntent, screenToWorld, TOUCH_SLOP_PX, worldToScreen } from "../lib/money-level/forest/camera";
import { BENCH_EXIT_MASTER, BENCH_SEAT_MASTER, DOCK_WAYPOINTS } from "../lib/money-level/forest/landmarks";
import { clampWorldPoint, imagePointToScene, isPointSafe, setForestSceneViewport } from "../lib/money-level/forest/navigation";

assert.ok(TOUCH_SLOP_PX > Math.hypot(6, 2), "actual touch tremor regression");
assert.equal(resolveGestureIntent(6, 2), "pending");
assert.equal(resolveGestureIntent(20, 3), "horizontal");
assert.equal(resolveGestureIntent(3, 20), "vertical");
assert.equal(resolveGestureIntent(30, 90, "horizontal"), "horizontal", "intent never flips");
assert.equal(resolveGestureIntent(90, 30, "vertical"), "vertical");
assert.equal(resolveGestureIntent(11, 11), "pending", "ambiguous diagonal waits");

for (const [width, height, mobile] of [[390, 508, true], [768, 556, false], [1320, 516, false]] as const) {
  const layout = mobile ? "mobile" : "desktop";
  const camera = createForestCamera(width, height, mobile);
  setForestSceneViewport({ width, height });
  assert.equal(cameraTranslation(camera), 0, "initial visual framing unchanged");
  assert.equal(clampCameraX(camera, -100), 0);
  assert.equal(clampCameraX(camera, 1e6), camera.maxX);
  for (const x of [0, camera.cropX, camera.maxX]) {
    camera.x = x;
    const left = -camera.cropX + cameraTranslation(camera);
    assert.ok(left <= 1e-9 && left + camera.worldWidth >= width - 1e-9, "no blank background at bounds");
    for (const point of [{ x: 17, y: 71 }, { x: -50, y: 66 }, { x: 135, y: 82 }]) {
      const result = screenToWorld(worldToScreen(point, camera), camera);
      assert.ok(Math.abs(result.x - point.x) < 1e-8 && Math.abs(result.y - point.y) < 1e-8, "screen/world roundtrip");
    }
    const finger = { x: width - 8, y: height * .65 };
    const before = screenToWorld(finger, camera);
    camera.x = clampCameraX(camera, x + 20);
    const after = screenToWorld(finger, camera);
    assert.ok(Math.abs(worldToScreen(after, camera).x - finger.x) < 1e-8, "moving camera keeps held character under finger");
    assert.ok(after.x >= before.x);
  }
  for (const id of ["gorani", "daramji"] as const) {
    const exit = imagePointToScene(BENCH_EXIT_MASTER, layout);
    assert.ok(isPointSafe(exit, layout, id), `${width}px ${id} local bench grass exit is safe`);
    assert.deepEqual(clampWorldPoint(exit, layout), exit, "offscreen world point is not viewport-clamped");
  }
  for (const master of [BENCH_SEAT_MASTER, DOCK_WAYPOINTS.dock_end[layout]]) {
    const point = imagePointToScene(master, layout);
    camera.x = clampCameraX(camera, master.x * camera.scale - width / 2);
    const screen = worldToScreen(point, camera);
    assert.ok(screen.x >= 0 && screen.x <= width, `${width}px bench/dock reachable`);
  }
  assert.equal(edgePanSpeed(width / 2, width), 0);
  assert.equal(edgePanSpeed(0, width), -EDGE_MAX_SPEED_PX);
  assert.equal(edgePanSpeed(width, width), EDGE_MAX_SPEED_PX);
  assert.ok(edgePanSpeed(width - 8, width) > edgePanSpeed(width - 40, width));
}
setForestSceneViewport(null);
console.log("Money Level camera bounds, intent lock, screen/world, moving-camera drag, edge speed and bench/dock reachability passed");
