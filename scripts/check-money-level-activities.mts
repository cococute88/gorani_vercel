import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CharacterActivityCoordinator } from "../lib/money-level/forest/activity-coordinator";
import { BENCH_SLOT, FISHING_VISUAL_CONFIG, fishingRodGeometry, GORANI_BENCH_VISUAL_OFFSET_Y_PX, getActivityZone, resolveManualActivityIntent, resolveZoneAnchor } from "../lib/money-level/forest/activity-zones";
import { FISHING_BOBBER, fishingLineAngleDeg, projectForestPoint } from "../lib/money-level/forest/landmarks";
import { getWaypoint, imagePointToScene, isPointSafe, isSegmentSafe, resolveDrop, setForestSceneViewport, waypointPoint } from "../lib/money-level/forest/navigation";
import type { CharacterId } from "../lib/money-level/forest/character-types";
import { GORANI_BENCH_POSE, normalGroundFacing } from "../lib/money-level/forest/character-pose";
import { NO_STATUES, CEREMONY_SLOTS, STATUE_CEREMONY_OFFSET_Y_PX, STATUE_VIEW_ANCHORS, STATUE_VIEW_EXITS, type StatueSelection } from "../lib/money-level/forest/statue-view";
import { ForestBehaviorController } from "../lib/money-level/forest/behavior";
import { initialCharacterState } from "../lib/money-level/forest/forest-character-config";

assert.deepEqual(BENCH_SLOT, { x: 302, y: 616 }, "visual calibration must not move the shared seat");
assert.ok(GORANI_BENCH_VISUAL_OFFSET_Y_PX >= 8 && GORANI_BENCH_VISUAL_OFFSET_Y_PX <= 16, "Gorani downward screen-pixel calibration");
assert.equal(GORANI_BENCH_POSE.animation, "idle");
assert.ok(GORANI_BENCH_POSE.rotationDeg >= -14 && GORANI_BENCH_POSE.rotationDeg <= -8);
assert.equal(GORANI_BENCH_POSE.pivotBone, "center");
assert.equal(getActivityZone("bench_slot").animationByCharacter?.daramji, "idle_front");
assert.deepEqual(Array.from({ length: 10 }, (_, i) => normalGroundFacing("right", 1, i / 10)), ["right", "right", "right", "right", "right", "right", "right", "left", "left", "left"]);
assert.equal(normalGroundFacing("right", -1, .1), "left");

for (const id of ["gorani", "daramji"] as const) {
  const spine = JSON.parse(readFileSync(`public/money-level/spine/${id}/character_${id}.json`, "utf8")) as { animations: Record<string, unknown>; bones: { name: string }[] };
  for (const animation of ["idle", "idle_front", "run", getActivityZone("fishing_dock").animationByCharacter?.[id], getActivityZone("bench_slot").animationByCharacter?.[id], getActivityZone("STATUE_VIEW_LEFT").animationByCharacter?.[id]]) {
    assert.ok(animation && animation in spine.animations, `${id}: actual Spine animation ${animation}`);
  }
  assert.ok(spine.bones.some((bone) => bone.name === FISHING_VISUAL_CONFIG[id].handBone), `${id}: tracked hand bone`);
  assert.ok(spine.bones.some((bone) => bone.name === "leg_L1") && spine.bones.some((bone) => bone.name === "leg_R1"), `${id}: bench pose bones`);
}

async function exchange(first: CharacterId, second: CharacterId, activity: "fishing" | "bench-sit" | "statue-ceremony") {
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
    for (const slot of ["left", "right"] as const) {
      const zone = getActivityZone(slot === "left" ? "STATUE_VIEW_LEFT" : "STATUE_VIEW_RIGHT");
      const raw = imagePointToScene(STATUE_VIEW_ANCHORS[slot], layout);
      const resolved = resolveDrop(raw, layout, id);
      const selected = resolveManualActivityIntent(raw, resolved, layout, id, { left: "marble-bear", right: "gold-bear" });
      assert.equal(selected?.zone.id, zone.id, `${label} ${id} selected ${slot} ceremony`);
      assert.equal(resolveManualActivityIntent(raw, resolved, layout, id, NO_STATUES), null, "none disables ceremony");
      assert.equal(resolved.snapped, false, "none leaves this curated patch as ordinary ground");
      assert.ok(selected && Math.abs((selected.point.y - raw.y) * height / 100 - STATUE_CEREMONY_OFFSET_Y_PX[slot]) < 1e-8, `${label} exact independent Y lift`);
      assert.equal(selected?.point.x, raw.x, "ceremony X unchanged");
      assert.ok(selected && isPointSafe(selected.point, layout, id), "raised ceremony anchor is safe grass");
      assert.ok(isPointSafe(imagePointToScene(STATUE_VIEW_EXITS[slot], layout), layout, id), "nearby ceremony exit is safe grass");
    }
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

// Run the real controllers through synchronous fake browser timers/RAF. This
// catches slot redirects and blocked straight-line shortcuts that a
// coordinator-only test misses.
const frames: FrameRequestCallback[] = [];
Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout: () => {}, matchMedia: () => ({ matches: false }) } });
Object.defineProperty(globalThis, "document", { configurable: true, value: { hidden: false } });
Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; } });
Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: () => {} });
setForestSceneViewport({ width: 1320, height: 520 });
const controllers = {} as Record<CharacterId, ForestBehaviorController>;
const states = { gorani: initialCharacterState("gorani"), daramji: initialCharacterState("daramji") };
let statues: StatueSelection = { left: "marble-bear", right: "gold-bear" };
const globalCeremony = new CharacterActivityCoordinator((id, activity) => controllers[id].leaveOccupiedSlot(activity));
const previousMovement: Partial<Record<CharacterId, { x: number; y: number }>> = {};
for (const id of ["gorani", "daramji"] as const) controllers[id] = new ForestBehaviorController({ id, state: states[id], weather: () => "sunny", mobile: () => false, activities: globalCeremony, statues: () => statues, onChange: (point, phase) => {
  if (phase === "moving") {
    assert.ok(isPointSafe(point, "desktop", id), "ceremony walk stays on safe ground");
    const previous = previousMovement[id];
    if (previous) assert.ok(isSegmentSafe(previous, point, "desktop", id), "redirect cannot cut through pond/house/retained obstacles");
    previousMovement[id] = { x: point.x, y: point.y };
  } else delete previousMovement[id];
} });
async function settle() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    for (const frame of frames.splice(0)) frame(performance.now() + 100_000);
  }
}
for (const [id, slot] of [["gorani", "CEREMONY_LEFT_A"], ["daramji", "CEREMONY_LEFT_B"], ["daramji", "CEREMONY_LEFT_A"], ["daramji", "CEREMONY_RIGHT"], ["gorani", "CEREMONY_RIGHT"], ["gorani", "CEREMONY_LEFT_A"]] as const) {
  controllers[id].beginDrag();
  const result = controllers[id].endDrag(imagePointToScene(CEREMONY_SLOTS[slot].anchor, "desktop"));
  await settle();
  const assigned = globalCeremony.getCeremonySlot(id)!;
  assert.equal(result.activityZoneId, assigned);
  assert.equal(controllers[id].getPhase(), "statue-appreciation");
  assert.equal(states[id].animation, getActivityZone(assigned).animationByCharacter?.[id]);
  assert.equal(controllers[id].position.facing, CEREMONY_SLOTS[assigned].facing);
  assert.ok(Object.values(globalCeremony.getCeremonyOwners()).filter(Boolean).length <= 2);
  const anchor = imagePointToScene(CEREMONY_SLOTS[assigned].anchor, "desktop");
  assert.ok(Math.hypot(controllers[id].position.x-anchor.x,controllers[id].position.y-anchor.y)<1e-8);
  assert.ok(Math.hypot(controllers.gorani.position.x-controllers.daramji.position.x,controllers.gorani.position.y-controllers.daramji.position.y)>.1);
}
statues = { left: "none", right: "gold-bear" };
controllers.gorani.refreshStatueAvailability();
controllers.daramji.refreshStatueAvailability();
controllers.daramji.beginDrag();
controllers.daramji.endDrag(imagePointToScene(CEREMONY_SLOTS.CEREMONY_RIGHT.anchor, "desktop"));
await settle();
controllers.gorani.beginDrag();
const rejected = controllers.gorani.endDrag(imagePointToScene(CEREMONY_SLOTS.CEREMONY_RIGHT.anchor, "desktop"));
await settle();
assert.equal(rejected.activity, null, "occupied sole visible slot cannot redirect onto an unavailable statue");
assert.equal(globalCeremony.getCeremonySlot("gorani"), null);
assert.equal(globalCeremony.getCeremonySlot("daramji"), "CEREMONY_RIGHT");
assert.notDeepEqual(controllers.gorani.position, controllers.daramji.position);
statues = NO_STATUES;
controllers.gorani.refreshStatueAvailability();
controllers.daramji.refreshStatueAvailability();
assert.equal(controllers.daramji.getPhase(), "daily", "removing selected statue ends active ceremony");
assert.equal(globalCeremony.getOwner("statue-ceremony"), null, "none releases global ceremony owner");
assert.equal(controllers.gorani.startActivityAtZone("STATUE_VIEW_LEFT"), false, "none blocks programmatic activity too");
controllers.daramji.beginDrag();
assert.equal(globalCeremony.getOwner("statue-ceremony"), null, "drag releases ceremony slot");
await globalCeremony.setCharacterActivity("gorani", "fishing");
await globalCeremony.setCharacterActivity("gorani", "statue-ceremony");
assert.equal(globalCeremony.getOwner("fishing"), null, "ceremony releases prior exclusive fishing");
await globalCeremony.setCharacterActivity("gorani", "bench-sit");
assert.equal(globalCeremony.getOwner("statue-ceremony"), null, "bench releases ceremony");
controllers.gorani.stop(); controllers.daramji.stop();
setForestSceneViewport(null);
assert.notEqual(fishingRodGeometry("gorani", { x: 0, y: 0, flipped: true }, "desktop").size, fishingRodGeometry("daramji", { x: 0, y: 0, flipped: true }, "desktop").size);
console.log("Money Level fishing/bench exchanges, 3 ceremony slots with max 2 owners, real controllers, none/release, Spine pose/facing and responsive anchors passed");
