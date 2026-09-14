import type { CharacterId } from "./character-types";
import { WAYPOINTS, type Waypoint } from "./forest-character-config";
import { BENCH_EXIT_MASTER, DOCK_ACCESS_POLYGON, DOCK_MAIN_POLYGON, DOCK_WAYPOINTS, FOREST_MASTER_SIZE, projectForestPoint } from "./landmarks";
import { createForestCamera } from "./camera";
import { STATUE_VIEW_GRASS } from "./statue-view";
import { OPENED_WORLD_REGIONS, WORLD_WAYPOINTS, WORLD_OBSTACLES, POND_WORLD_POLYGON } from "./world-navigation";

export type SceneLayout = "desktop" | "mobile";

export interface ScenePoint { x: number; y: number; }
export interface SceneRect { x: number; y: number; width: number; height: number; }
export interface ScenePolygon { points: readonly ScenePoint[]; }
export interface ResolvedDrop { point: ScenePoint; waypoint: Waypoint; snapped: boolean; }

let sceneViewport: { width: number; height: number } | null = null;

export const OPENED_WAYPOINTS: Record<string, Waypoint> = Object.fromEntries(
  ["left_grass", "left_access", "ceremony_left_a", "ceremony_left_b", "tax_front", "tax_corridor", "fence_opening", "right_grass", "ceremony_right"]
    .map(id => [id, { id, ...WORLD_WAYPOINTS[id], facing: "right" as const, supportedActions: ["idle", "look"] as const, weight: .45 }]),
);

export function legacyPolygonToWorld(points: readonly ScenePoint[]): ScenePoint[] {
  return points.map(p => ({ x: p.x * 16.83, y: p.y * 6.63 + 136 }));
}

export function scenePointToImage(point: ScenePoint, layout: SceneLayout): ScenePoint {
  if (!sceneViewport) return { x: point.x * 16.83, y: point.y * 9.35 };
  const camera = createForestCamera(sceneViewport.width, sceneViewport.height, layout === "mobile");
  return { x: (point.x * sceneViewport.width / 100 + camera.cropX) / camera.scale,
    y: (point.y * sceneViewport.height / 100 + camera.cropY) / camera.scale };
}

/** Runtime projection for fixed art landmarks; null retains pure legacy unit-test coordinates. */
export function setForestSceneViewport(viewport: { width: number; height: number } | null): void {
  sceneViewport = viewport;
}

export function clampWorldPoint(point: ScenePoint, layout: SceneLayout): ScenePoint {
  if (!sceneViewport) return { x: Math.max(0, Math.min(100, point.x)), y: Math.max(0, Math.min(100, point.y)) };
  const camera = createForestCamera(sceneViewport.width, sceneViewport.height, layout === "mobile");
  return { x: Math.max(-camera.cropX / camera.width * 100, Math.min((camera.worldWidth - camera.cropX) / camera.width * 100, point.x)),
    y: Math.max(0, Math.min(100, point.y)) };
}

/** Master-image point in normalized scene coordinates, including cover crop. */
export function imagePointToScene(point: ScenePoint, layout: SceneLayout, offsetPx: ScenePoint = { x: 0, y: 0 }): ScenePoint {
  if (!sceneViewport) return { x: (point.x + offsetPx.x) / FOREST_MASTER_SIZE.width * 100, y: (point.y + offsetPx.y) / FOREST_MASTER_SIZE.height * 100 };
  const projected = projectForestPoint(point, sceneViewport, layout === "mobile");
  return { x: (projected.x + offsetPx.x) / sceneViewport.width * 100, y: (projected.y + offsetPx.y) / sceneViewport.height * 100 };
}

function projectedDockPolygon(layout: SceneLayout, mainOnly = false): readonly ScenePoint[] | null {
  if (!sceneViewport) return null;
  const viewport = sceneViewport;
  return (mainOnly ? DOCK_MAIN_POLYGON : DOCK_ACCESS_POLYGON).map((point) => {
    const projected = projectForestPoint(point, viewport, layout === "mobile");
    return { x: projected.x / viewport.width * 100, y: projected.y / viewport.height * 100 };
  });
}

export interface WalkableRegion {
  id: string;
  kind: "meadow" | "yard" | "trail" | "pond-side" | "dock";
  desktop: ScenePolygon;
  mobile: ScenePolygon;
  allows?: readonly ExclusionZone["kind"][];
  master?: readonly ScenePoint[];
}

export interface ExclusionZone {
  id: string;
  kind: "label" | "water" | "building" | "prop" | "hud";
  desktop: SceneRect;
  mobile: SceneRect;
}

const CHARACTER_CLEARANCE: Record<CharacterId, { x: number; above: number; below: number }> = {
  gorani: { x: 2.4, above: 7.1, below: 1.2 },
  daramji: { x: 1.7, above: 5, below: 1 },
};

const polygon = (...coordinates: number[]): ScenePolygon => ({
  points: Array.from({ length: coordinates.length / 2 }, (_, index) => ({
    x: coordinates[index * 2], y: coordinates[index * 2 + 1],
  })),
});

export const WALKABLE_REGIONS: readonly WalkableRegion[] = [
  { id: "main-meadow", kind: "meadow", desktop: polygon(38, 48, 61, 47, 65, 66, 61, 88, 37, 90, 38, 70), mobile: polygon(28, 58, 56, 58, 63, 83, 55, 88, 28, 88) },
  { id: "brokerage-yard-path", kind: "yard", desktop: polygon(39, 60, 56, 48, 56, 84, 34, 90, 39, 78), mobile: polygon(28, 57, 54, 57, 55, 87, 30, 90) },
  { id: "tax-camp-clearing", kind: "yard", desktop: polygon(50, 45, 62, 43, 64, 68, 58, 80, 50, 78), mobile: polygon(48, 57, 63, 57, 66, 83, 56, 88, 49, 82) },
  { id: "center-trail", kind: "trail", desktop: polygon(43, 44, 61, 40, 59, 73, 54, 90, 42, 90, 45, 70), mobile: polygon(47, 42, 58, 41, 57, 69, 53, 87, 40, 88, 47, 70) },
  { id: "back-trail", kind: "trail", desktop: polygon(48, 26, 64, 25, 61, 51, 47, 54), mobile: polygon(48, 27, 61, 27, 58, 58, 47, 58) },
  { id: "pond-side-grass", kind: "pond-side", desktop: polygon(41, 63, 66, 61, 66, 78, 61, 83, 42, 88), mobile: polygon(45, 67, 72, 65, 72, 80, 66, 83, 56, 88, 43, 85), allows: ["water"] },
  { id: "dock-connector", kind: "dock", desktop: polygon(57.2, 79.2, 60.3, 77.2, 68.3, 84.2, 67.1, 91.1, 62.1, 88.8, 58, 84.7), mobile: polygon(67.2, 77.2, 71.8, 75.3, 87, 82.3, 84.5, 89.1, 76.1, 86.2, 69, 82.1), allows: ["water"] },
  { id: "wooden-dock", kind: "dock", desktop: polygon(64.1, 82.4, 67.8, 81.7, 79.7, 92.3, 80, 99.4, 72.8, 98.1, 64, 87.7), mobile: polygon(80, 79.3, 85, 79.1, 100, 86, 100, 95.2, 88, 94.2, 80, 86.2), allows: ["water"] },
  ...Object.entries(OPENED_WORLD_REGIONS).map(([id, master]): WalkableRegion => ({
    id, kind: "meadow", master,
    desktop: { points: master.map(p => ({ x: p.x / 16.83, y: p.y / 9.35 })) },
    mobile: { points: master.map(p => ({ x: p.x / 16.83, y: p.y / 9.35 })) },
  })),
] as const;

export const EXCLUSION_ZONES: readonly ExclusionZone[] = [
  { id: "brokerage-house-info", kind: "label", desktop: { x: 24.2, y: 66.5, width: 13.2, height: 12.4 }, mobile: { x: 11, y: 47, width: 34, height: 15 } },
  { id: "bottom-phrase", kind: "label", desktop: { x: 42.5, y: 90.2, width: 15, height: 7.8 }, mobile: { x: 27, y: 91.5, width: 46, height: 7.5 } },
  { id: "scene-weather", kind: "hud", desktop: { x: 90.6, y: 2.5, width: 8.2, height: 8.5 }, mobile: { x: 75, y: 1.4, width: 22.5, height: 8.5 } },
  { id: "brokerage-cottage", kind: "building", desktop: { x: 16, y: 16, width: 27, height: 47 }, mobile: { x: 0, y: 27, width: 47, height: 23 } },
  { id: "tax-camp", kind: "building", desktop: { x: 62, y: 41, width: 21, height: 20 }, mobile: { x: 58, y: 38, width: 34, height: 18 } },
  { id: "pond-water", kind: "water", desktop: { x: 58.5, y: 69, width: 41.5, height: 31 }, mobile: { x: 57, y: 69, width: 43, height: 31 } },
  { id: "left-foreground-fence", kind: "prop", desktop: { x: 11, y: 79, width: 17, height: 12 }, mobile: { x: 0, y: 80, width: 25, height: 11 } },
  { id: "foreground-rocks", kind: "prop", desktop: { x: 29, y: 84, width: 13, height: 16 }, mobile: { x: 4, y: 82, width: 22, height: 18 } },
  { id: "statue-base-left", kind: "prop", desktop: { x: 31.4, y: 84.5, width: 7.5, height: 8.5 }, mobile: { x: 5, y: 74, width: 18, height: 7 } },
  { id: "statue-base-right", kind: "prop", desktop: { x: 84, y: 59, width: 8, height: 11 }, mobile: { x: 110, y: 57, width: 18, height: 10 } },
] as const;

export const NAVIGATION_GRAPH: Readonly<Record<string, readonly string[]>> = {
  gorani_home: ["brokerage_yard", "garden"],
  brokerage_yard: ["gorani_home", "bench", "garden", "path_front"],
  bench: ["brokerage_yard", "path_front"],
  garden: ["gorani_home", "brokerage_yard", "meadow", "pond_edge", "path_center"],
  daramji_home: ["campfire", "tax_front"],
  campfire: ["daramji_home", "tax_clearing", "meadow", "flower_patch"],
  tax_clearing: ["campfire"],
  meadow: ["garden", "campfire", "flower_patch", "path_mid"],
  flower_patch: ["campfire", "meadow", "path_center"],
  path_front: ["brokerage_yard", "bench", "path_center", "left_access", "ceremony_left_b"],
  left_access: ["path_front", "left_grass", "ceremony_left_b"],
  left_grass: ["left_access", "ceremony_left_a"],
  ceremony_left_a: ["left_grass"],
  ceremony_left_b: ["left_access", "path_front"],
  tax_front: ["daramji_home", "pond_edge", "tax_corridor"],
  tax_corridor: ["tax_front", "fence_opening"],
  fence_opening: ["tax_corridor", "right_grass"],
  right_grass: ["fence_opening", "ceremony_right"],
  ceremony_right: ["right_grass"],
  path_center: ["garden", "flower_patch", "path_front", "path_mid", "pond_edge"],
  path_mid: ["meadow", "path_center", "path_back_lower"],
  path_back_lower: ["path_mid", "path_back_mid"],
  path_back_mid: ["path_back_lower", "path_back_upper"],
  path_back_upper: ["path_back_mid"],
  pond_edge: ["garden", "path_center", "pond_land", "tax_front"],
  pond_land: ["pond_edge", "dock_connector"],
  dock_connector: ["pond_land", "dock_start"],
  dock_start: ["dock_connector", "dock_mid"],
  dock_mid: ["dock_start", "dock_end"],
  dock_end: ["dock_mid"],
};

export function waypointPoint(waypoint: Waypoint, layout: SceneLayout): ScenePoint {
  if (waypoint.id in WORLD_WAYPOINTS && (sceneViewport || waypoint.id.startsWith("ceremony_") || waypoint.id in OPENED_WAYPOINTS)) return imagePointToScene(WORLD_WAYPOINTS[waypoint.id], layout);
  if (waypoint.id === "bench_exit") return imagePointToScene(BENCH_EXIT_MASTER, layout);
  if (sceneViewport && waypoint.id in DOCK_WAYPOINTS) {
    const source = DOCK_WAYPOINTS[waypoint.id as keyof typeof DOCK_WAYPOINTS][layout];
    const projected = projectForestPoint(source, sceneViewport, layout === "mobile");
    return { x: projected.x / sceneViewport.width * 100, y: projected.y / sceneViewport.height * 100 };
  }
  const source = layout === "mobile" && waypoint.mobile ? waypoint.mobile : waypoint;
  return { x: source.x, y: source.y };
}

export function getWaypoint(id: string): Waypoint {
  if (id in OPENED_WAYPOINTS) return OPENED_WAYPOINTS[id];
  // Local post-bench idle anchor, not an unsafe shortcut through the house/fence
  // into the roaming graph. A later drag can carry the character back to a path.
  if (id === "bench_exit") return { ...getWaypoint("bench"), id, weight: 0 };
  const waypoint = WAYPOINTS.find((candidate) => candidate.id === id);
  if (!waypoint) throw new Error(`알 수 없는 waypoint: ${id}`);
  return waypoint;
}

export function perspectiveScale(y: number): number {
  if (y <= 34) return 0.74;
  if (y >= 76) return 1;
  return 0.74 + ((y - 34) / 42) * 0.26;
}

export function isPointSafe(point: ScenePoint, layout: SceneLayout, character: CharacterId): boolean {
  if (sceneViewport) {
    const project = (polygon: readonly ScenePoint[]) => polygon.map(p => imagePointToScene(p, layout));
    const dock = projectedDockPolygon(layout);
    if (dock && pointInPolygon(point, dock)) return true;
    const world = scenePointToImage(point, layout);
    const inOpened = Object.values(OPENED_WORLD_REGIONS).some(polygon => pointInPolygon(world, polygon));
    const inLegacy = WALKABLE_REGIONS.some(region => pointInPolygon(point, project(region.master ?? legacyPolygonToWorld(region.desktop.points))));
    const inStatueGrass = Object.values(STATUE_VIEW_GRASS).some(polygon => pointInPolygon(world, polygon));
    if (!inOpened && !inLegacy && !inStatueGrass) return false;
    if (pointInPolygon(world, POND_WORLD_POLYGON)) return false;
    const margin = character === "gorani" ? 8 : 6;
    return !WORLD_OBSTACLES.some(rect => world.x >= rect.x - margin && world.x <= rect.x + rect.width + margin
      && world.y >= rect.y - 3 && world.y <= rect.y + rect.height + 3);
  }
  // These curated master-local grass patches remain ordinary ground with no statue.
  // Legacy percentage exclusions do not describe these crop-dependent landmarks.
  if (sceneViewport && Object.values(STATUE_VIEW_GRASS).some((grass) => pointInPolygon(point, grass.map((p) => imagePointToScene(p, layout))))) return true;
  const regions = WALKABLE_REGIONS.filter((region) => pointInPolygon(point, region[layout].points));
  const projectedDock = projectedDockPolygon(layout);
  const inProjectedDock = Boolean(projectedDock && pointInPolygon(point, projectedDock));
  // The baked left bench is outside the old roaming polygons. This narrow grass
  // corridor lets an occupant step away before rejoining the existing path.
  const benchGrass = [{ x: 332, y: 642 }, { x: 396, y: 642 }, { x: 396, y: 674 }, { x: 332, y: 674 }]
    .map((source) => imagePointToScene(source, layout));
  const inBenchAccess = sceneViewport !== null && pointInPolygon(point, benchGrass);
  if (regions.length === 0 && !inProjectedDock && !inBenchAccess) return false;
  const allowedKinds = new Set(regions.flatMap((region) => region.allows ?? []));
  if (inProjectedDock) {
    allowedKinds.add("water");
    // At tablet cover crops the baked dock rises under the fixed tax-label
    // clearance rectangle; that broad rectangle must not invalidate wood.
    allowedKinds.add("label");
  }
  const clearance = CHARACTER_CLEARANCE[character];
  return !EXCLUSION_ZONES.some((zone) => {
    // The legacy percentage fence box includes clear grass above the baked
    // fence under wide vertical crops. This master-local patch is above it.
    if (inBenchAccess && zone.id === "left-foreground-fence") return false;
    return !allowedKinds.has(zone.kind) && pointIntersectsExpandedRect(point, zone[layout], clearance);
  });
}

export function isPointInWalkableRegion(point: ScenePoint, layout: SceneLayout, regionId: string): boolean {
  if (regionId in OPENED_WORLD_REGIONS) return pointInPolygon(point, OPENED_WORLD_REGIONS[regionId as keyof typeof OPENED_WORLD_REGIONS].map(p => imagePointToScene(p, layout)));
  if (sceneViewport && regionId !== "dock-connector" && regionId !== "wooden-dock") {
    const region = WALKABLE_REGIONS.find(({ id }) => id === regionId);
    return Boolean(region && pointInPolygon(point, (region.master ?? legacyPolygonToWorld(region.desktop.points)).map(p => imagePointToScene(p, layout))));
  }
  if (regionId === "dock-connector" || regionId === "wooden-dock") {
    const projected = projectedDockPolygon(layout, regionId === "wooden-dock");
    if (projected) return pointInPolygon(point, projected);
  }
  const region = WALKABLE_REGIONS.find(({ id }) => id === regionId);
  return Boolean(region && pointInPolygon(point, region[layout].points));
}

export function isSegmentSafe(start: ScenePoint, end: ScenePoint, layout: SceneLayout, character: CharacterId): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 0.5));
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    if (!isPointSafe({ x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress }, layout, character)) return false;
  }
  return true;
}

export function routeWaypoints(fromId: string, toId: string, layout: SceneLayout, character: CharacterId): Waypoint[] {
  if (fromId === toId) return [getWaypoint(toId)];
  const queue: string[][] = [[fromId]];
  const visited = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    for (const next of NAVIGATION_GRAPH[current] ?? []) {
      if (visited.has(next)) continue;
      if (!isSegmentSafe(waypointPoint(getWaypoint(current), layout), waypointPoint(getWaypoint(next), layout), layout, character)) continue;
      const candidate = [...path, next];
      if (next === toId) return candidate.slice(1).map(getWaypoint);
      visited.add(next);
      queue.push(candidate);
    }
  }
  return [];
}

export function nearestSafeWaypoint(point: ScenePoint, layout: SceneLayout, character: CharacterId, requireReachableSegment = false): Waypoint {
  const candidates = [...WAYPOINTS, ...Object.values(OPENED_WAYPOINTS)]
    .filter((waypoint) => {
      const target = waypointPoint(waypoint, layout);
      return isPointSafe(target, layout, character) && (!requireReachableSegment || isSegmentSafe(point, target, layout, character));
    })
    .sort((left, right) => distance(point, waypointPoint(left, layout)) - distance(point, waypointPoint(right, layout)));
  if (!candidates[0]) throw new Error(`${layout}에서 사용할 수 있는 안전 waypoint가 없습니다.`);
  return candidates[0];
}

export function resolveDrop(point: ScenePoint, layout: SceneLayout, character: CharacterId): ResolvedDrop {
  if (isPointSafe(point, layout, character)) {
    try { return { point, waypoint: nearestSafeWaypoint(point, layout, character, true), snapped: false }; }
    catch { return { point, waypoint: nearestSafeWaypoint(point, layout, character), snapped: false }; }
  }
  const waypoint = nearestSafeWaypoint(point, layout, character);
  return { point: waypointPoint(waypoint, layout), waypoint, snapped: true };
}

export function auditNavigation(layout: SceneLayout, character: CharacterId): { invalidWaypoints: string[]; invalidSegments: string[]; unreachablePairs: string[] } {
  const invalidWaypoints = WAYPOINTS.filter((waypoint) => !isPointSafe(waypointPoint(waypoint, layout), layout, character)).map((waypoint) => waypoint.id);
  const invalidSegments: string[] = [];
  for (const [from, neighbors] of Object.entries(NAVIGATION_GRAPH)) {
    for (const to of neighbors) {
      if (from > to) continue;
      if (!isSegmentSafe(waypointPoint(getWaypoint(from), layout), waypointPoint(getWaypoint(to), layout), layout, character)) invalidSegments.push(`${from}->${to}`);
    }
  }
  const unreachablePairs: string[] = [];
  for (const from of WAYPOINTS) {
    for (const to of WAYPOINTS) {
      if (from.id < to.id && routeWaypoints(from.id, to.id, layout, character).length === 0) unreachablePairs.push(`${from.id}->${to.id}`);
    }
  }
  return { invalidWaypoints, invalidSegments, unreachablePairs };
}

function pointIntersectsExpandedRect(point: ScenePoint, rect: SceneRect, clearance: { x: number; above: number; below: number }): boolean {
  return point.x >= rect.x - clearance.x && point.x <= rect.x + rect.width + clearance.x
    && point.y >= rect.y - clearance.below && point.y <= rect.y + rect.height + clearance.above;
}

function pointInPolygon(point: ScenePoint, points: readonly ScenePoint[]): boolean {
  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current, current += 1) {
    const a = points[current];
    const b = points[previous];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distance(left: ScenePoint, right: ScenePoint): number { return Math.hypot(right.x - left.x, right.y - left.y); }
