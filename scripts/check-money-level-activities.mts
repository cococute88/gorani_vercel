import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CharacterActivityCoordinator } from "../lib/money-level/forest/activity-coordinator";
import { BENCH_SLOT, FISHING_VISUAL_CONFIG, fishingRodGeometry, GORANI_BENCH_VISUAL_OFFSET_Y_PX, getActivityZone, resolveManualActivityIntent, resolveZoneAnchor } from "../lib/money-level/forest/activity-zones";
import { FISHING_BOBBER, fishingLineAngleDeg, projectForestPoint } from "../lib/money-level/forest/landmarks";
import { getWaypoint, imagePointToScene, isPointSafe, resolveDrop, setForestSceneViewport, waypointPoint } from "../lib/money-level/forest/navigation";
import type { CharacterId } from "../lib/money-level/forest/character-types";

assert.deepEqual(BENCH_SLOT, { x: 302, y: 616 }, "visual calibration must not move the shared seat");
assert.ok(GORANI_BENCH_VISUAL_OFFSET_Y_PX >= 8 && GORANI_BENCH_VISUAL_OFFSET_Y_PX <= 16, "Gorani downward screen-pixel calibration");

for (const id of ["gorani", "daramji"] as const) {
  const spine = JSON.parse(readFileSync(`public/money-level/spine/${id}/character_${id}.json`, "utf8")) as { animations: Record<string, unknown>; bones: { name: string }[] };
  for (const animation of ["idle", "idle_front", "run", getActivityZone("fishing_dock").animationByCharacter?.[id], getActivityZone("bench_slot").animationByCharacter?.[id]]) {
    assert.ok(animation && animation in spine.animations, `${id}: actual Spine animation ${animation}`);
  }
  assert.ok(spine.bones.some((bone) => bone.name === FISHING_VISUAL_CONFIG[id].handBone), `${id}: tracked hand bone`);
  assert.ok(spine.bones.some((bone) => bone.name === "leg_L1") && spine.bones.some((bone) => bone.name === "leg_R1"), `${id}: bench pose bones`);
}

async function exchange(first: CharacterId, second: CharacterId, activity: "fishing" | "bench-sit") {
  let finishDeparture: (() => void) | undefined;
  const departures: string[] = [];
  const coordinator = new CharacterActivityCoordinator((id, from) => {
    departures.push(`${id}:${from}`);
    if (from === "fishing") void coordinator.setCharacterActivity(id, "pond-watch");
    return new Promise<void>((resolve) => { finishDeparture = resolve; });
  });
  await coordinator.setCharacterActivity(first, activity);
  assert.equal(coordinator.getOwner(activity), first);
  const arrival = coordinator.setCharacterActivity(second, activity);
  assert.equal(coordinator.getOwner(activity), second, "new owner is exclusive immediately");
  assert.equal(coordinator.getActivity(first), activity === "fishing" ? "pond-watch" : "roaming");
  assert.equal(coordinator.getActivity(second), activity);
  assert.deepEqual(departures, [`${first}:${activity}`]);
  let arrived = false;
  void arrival.then(() => { arrived = true; });
  await Promise.resolve();
  assert.equal(arrived, false, "replacement waits for departure");
  finishDeparture?.();
  await arrival;
  assert.equal(coordinator.getOwner(activity), second);
  await coordinator.setCharacterActivity(second, "roaming");
  assert.equal(coordinator.getOwner(activity), null);
}

await exchange("gorani", "daramji", "fishing"); // A
await exchange("daramji", "gorani", "fishing"); // B
await exchange("gorani", "daramji", "bench-sit"); // C
await exchange("daramji", "gorani", "bench-sit"); // D

for (const [from, to] of [["fishing", "bench-sit"], ["bench-sit", "fishing"]] as const) {
  const coordinator = new CharacterActivityCoordinator(async () => {});
  await coordinator.setCharacterActivity("gorani", from);
  await coordinator.setCharacterActivity("gorani", to);
  assert.equal(coordinator.getActivity("gorani"), to, `${from} → ${to}`);
  assert.equal(coordinator.getOwner(from), null, "previous slot released");
  assert.equal(coordinator.getOwner(to), "gorani");
}

for (const [label, width, height, layout] of [
  ["wide", 1320, 520, "desktop"], ["narrow", 980, 520, "desktop"],
  ["tablet", 768, 520, "desktop"], ["390px", 390, 512, "mobile"],
] as const) {
  setForestSceneViewport({ width, height });
  const bench = imagePointToScene(BENCH_SLOT, layout);
  const pixelBench = projectForestPoint(BENCH_SLOT, { width, height }, layout === "mobile");
  assert.ok(Math.abs(bench.x * width / 100 - pixelBench.x) < 1e-9, `${label} bench x projection`);
  assert.ok(Math.abs(bench.y * height / 100 - pixelBench.y) < 1e-9, `${label} bench y projection`);
  const fishing = waypointPoint(getWaypoint("dock_end"), layout);
  for (const id of ["gorani", "daramji"] as const) {
    const seat = resolveZoneAnchor(getActivityZone("bench_slot"), bench, layout, id);
    assert.deepEqual(seat?.point, bench, `${label} ${id} seat anchor`);
    assert.equal(resolveManualActivityIntent(bench, resolveDrop(bench, layout, id), layout, id)?.zone.id, "bench_slot", `${label} ${id} bench drop`);
    assert.equal(resolveManualActivityIntent(fishing, resolveDrop(fishing, layout, id), layout, id)?.zone.id, "fishing_dock", `${label} ${id} dock drop`);
    const water = { x: 95, y: 97 };
    const fallback = resolveDrop(water, layout, id);
    assert.equal(fallback.snapped, true, `${label} ${id} invalid water drop snaps`);
    assert.equal(isPointSafe(fallback.point, layout, id), true, `${label} ${id} fallback is safe`);
    assert.equal(resolveManualActivityIntent(water, fallback, layout, id), null, `${label} ${id} invalid water is not an activity`);
    const hand = { x: 300, y: 350, flipped: id === "gorani" };
    const rod = fishingRodGeometry(id, hand, layout);
    assert.equal(rod.left + rod.handle.x, hand.x + FISHING_VISUAL_CONFIG[id].handOffset.x, `${id} hand to rod handle`);
    assert.equal(rod.top + rod.handle.y, hand.y + FISHING_VISUAL_CONFIG[id].handOffset.y, `${id} hand to rod handle y`);
    const bobber = projectForestPoint(FISHING_BOBBER[layout], { width, height }, layout === "mobile");
    const angle = fishingLineAngleDeg(rod.tip, bobber) * Math.PI / 180;
    const length = Math.hypot(bobber.x - rod.tip.x, bobber.y - rod.tip.y);
    assert.ok(Math.abs(rod.tip.x - Math.sin(angle) * length - bobber.x) < 1e-8, `${id} line joins bobber x`);
    assert.ok(Math.abs(rod.tip.y + Math.cos(angle) * length - bobber.y) < 1e-8, `${id} line joins bobber y`);
  }
  if (layout === "mobile") assert.ok(pixelBench.x < 0, "390px cover crop leaves the baked left bench offscreen");
}
setForestSceneViewport(null);
assert.notEqual(fishingRodGeometry("gorani", { x: 0, y: 0, flipped: true }, "desktop").size, fishingRodGeometry("daramji", { x: 0, y: 0, flipped: true }, "desktop").size);
console.log("Money Level character activity slots, A–F replacements, Spine calibration, drag safety and responsive anchors passed");
