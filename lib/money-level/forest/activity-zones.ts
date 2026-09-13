import type { CharacterId } from "./character-types";
import { GORANI_BENCH_POSE } from "./character-pose";
import { NO_STATUES, STATUE_VIEW_ANCHORS, STATUE_VIEW_RADIUS_MASTER, STATUE_CEREMONY_OFFSET_Y_PX, type StatueSelection } from "./statue-view";
import { BENCH_SEAT_MASTER } from "./landmarks";
import {
  getWaypoint,
  isPointInWalkableRegion,
  isPointSafe,
  imagePointToScene,
  WALKABLE_REGIONS,
  waypointPoint,
  type ResolvedDrop,
  type SceneLayout,
  type ScenePoint,
} from "./navigation";
import type { Waypoint } from "./forest-character-config";

export type SemanticActivity = "fishing" | "bench-sit" | "pond-watch" | "statue-appreciation";

export interface ActivityActivationCircle extends ScenePoint {
  radius: number;
}

export interface SemanticActivityZone {
  id: "fishing_dock" | "bench_slot" | "pond_watch" | "STATUE_VIEW_LEFT" | "STATUE_VIEW_RIGHT";
  statueSlot?: "left" | "right";
  activity: SemanticActivity;
  allowedCharacters: readonly CharacterId[];
  activation: Record<SceneLayout, readonly ActivityActivationCircle[]>;
  activationPolygons?: Partial<Record<SceneLayout, readonly (readonly ScenePoint[])[]>>;
  walkableRegionIds: readonly string[];
  anchorWaypointIds: Partial<Record<CharacterId, readonly string[]>>;
  anchorPoints?: Partial<Record<string, Record<SceneLayout, ScenePoint>>>;
  durationMs: { min: number; max: number };
  manualDurationMs?: { min: number; max: number };
  preferredFacing: "left" | "right";
  preferredFacingByLayout?: Partial<Record<SceneLayout, "left" | "right">>;
  animation?: string;
  animationByCharacter?: Partial<Record<CharacterId, string>>;
  animationSpeed?: number;
}

export const FISHING_VISUAL_CONFIG = {
  gorani: { handBone: "arm_R2", handPoint: "end" as const, rodTip: { x: 0.94, y: 0.10 }, handle: { x: 0.16, y: 0.84 }, rodSizePx: { desktop: 50, mobile: 42 }, angleDeg: 2, handOffset: { x: 0, y: 0 } },
  daramji: { handBone: "arm_R2", handPoint: "end" as const, rodTip: { x: 0.94, y: 0.10 }, handle: { x: 0.16, y: 0.84 }, rodSizePx: { desktop: 39, mobile: 33 }, angleDeg: 6, handOffset: { x: -2, y: 1 } },
} as const;

export function fishingRodGeometry(
  character: CharacterId,
  hand: { x: number; y: number; flipped: boolean },
  layout: SceneLayout,
) {
  const config = FISHING_VISUAL_CONFIG[character];
  const size = config.rodSizePx[layout];
  const direction = hand.flipped ? 1 : -1;
  const angle = direction * config.angleDeg;
  const radians = angle * Math.PI / 180;
  const handle = { x: size * config.handle.x, y: size * config.handle.y };
  const wrist = { x: hand.x + config.handOffset.x, y: hand.y + config.handOffset.y };
  const localTip = { x: direction * (size * config.rodTip.x - handle.x), y: size * config.rodTip.y - handle.y };
  return {
    size, direction, angle, handle,
    left: wrist.x - handle.x,
    top: wrist.y - handle.y,
    tip: {
      x: wrist.x + localTip.x * Math.cos(radians) - localTip.y * Math.sin(radians),
      y: wrist.y + localTip.x * Math.sin(radians) + localTip.y * Math.cos(radians),
    },
  };
}

/** Seat center in the immutable 1683 × 935 background, not a DOM object. */
export const BENCH_SLOT = BENCH_SEAT_MASTER;
/** Screen-space pose calibration only; never changes the shared seat/drop geometry. */
export const GORANI_BENCH_VISUAL_OFFSET_Y_PX = GORANI_BENCH_POSE.offsetYPx;
export const FISHING_SLOT = "dock_end";
export const BENCH_EXIT_WAYPOINT = "bench";
export const POND_WATCH_ANCHOR = "pond_edge";

const dockActivityPolygons = {
  desktop: WALKABLE_REGIONS.filter(({ id }) => id === "dock-connector" || id === "wooden-dock").map(({ desktop }) => desktop.points),
  mobile: WALKABLE_REGIONS.filter(({ id }) => id === "dock-connector" || id === "wooden-dock").map(({ mobile }) => mobile.points),
} as const;

export interface ResolvedActivityDrop {
  zone: SemanticActivityZone;
  waypoint: Waypoint;
  point: ScenePoint;
}

export const ACTIVITY_ZONES: readonly SemanticActivityZone[] = [
  {
    id: "fishing_dock",
    activity: "fishing",
    allowedCharacters: ["gorani", "daramji"],
    activation: {
      desktop: [],
      mobile: [],
    },
    walkableRegionIds: ["wooden-dock"],
    anchorWaypointIds: { gorani: [FISHING_SLOT], daramji: [FISHING_SLOT] },
    durationMs: { min: 20_000, max: 45_000 },
    manualDurationMs: { min: 30_000, max: 60_000 },
    preferredFacing: "right",
    preferredFacingByLayout: { mobile: "left" },
    animationByCharacter: { gorani: "carry", daramji: "idle" },
    animationSpeed: 0.16,
  },
  {
    id: "bench_slot",
    activity: "bench-sit",
    allowedCharacters: ["gorani", "daramji"],
    activation: { desktop: [], mobile: [] },
    walkableRegionIds: [],
    anchorWaypointIds: { gorani: [BENCH_EXIT_WAYPOINT], daramji: [BENCH_EXIT_WAYPOINT] },
    durationMs: { min: 20_000, max: 45_000 },
    manualDurationMs: { min: 30_000, max: 60_000 },
    preferredFacing: "right",
    animationByCharacter: { gorani: GORANI_BENCH_POSE.animation, daramji: "idle_front" },
  },
  {
    id: "pond_watch",
    activity: "pond-watch",
    allowedCharacters: ["gorani", "daramji"],
    activation: {
      desktop: [
        { x: 55, y: 77, radius: 7 },
        { x: 62, y: 86, radius: 6 },
      ],
      mobile: [
        { x: 59, y: 72, radius: 7 },
        { x: 73, y: 76, radius: 5.5 },
      ],
    },
    activationPolygons: dockActivityPolygons,
    walkableRegionIds: ["dock-connector", "wooden-dock"],
    anchorWaypointIds: { gorani: [POND_WATCH_ANCHOR, "dock_connector", "dock_mid"], daramji: [POND_WATCH_ANCHOR, "dock_connector", "dock_mid"] },
    durationMs: { min: 15_000, max: 35_000 },
    preferredFacing: "right",
  },
  ...(["left", "right"] as const).map((slot): SemanticActivityZone => ({
    id: slot === "left" ? "STATUE_VIEW_LEFT" : "STATUE_VIEW_RIGHT",
    statueSlot: slot,
    activity: "statue-appreciation",
    allowedCharacters: ["gorani", "daramji"],
    activation: { desktop: [], mobile: [] },
    walkableRegionIds: [],
    anchorWaypointIds: { gorani: [slot === "left" ? "path_front" : "daramji_home"], daramji: [slot === "left" ? "path_front" : "daramji_home"] },
    durationMs: { min: 30_000, max: 60_000 },
    preferredFacing: slot === "left" ? "right" : "left",
    animationByCharacter: { gorani: "ceremony_valentinesday", daramji: "ceremony_valentinesday" },
    animationSpeed: .5,
  })),
] as const;

export const isActivityAvailable = (zone: SemanticActivityZone, statues: StatueSelection) =>
  !zone.statueSlot || statues[zone.statueSlot] !== "none";

export function getActivityZone(id: SemanticActivityZone["id"]): SemanticActivityZone {
  const zone = ACTIVITY_ZONES.find((candidate) => candidate.id === id);
  if (!zone) throw new Error(`알 수 없는 activity zone: ${id}`);
  return zone;
}

export function resolveActivityDrop(
  point: ScenePoint,
  layout: SceneLayout,
  character: CharacterId,
  statues: StatueSelection = NO_STATUES,
): ResolvedActivityDrop | null {
  if (!isPointSafe(point, layout, character) && !matchesBench(point, layout)) return null;
  const zone = ACTIVITY_ZONES.find((candidate) => isActivityAvailable(candidate, statues) && candidate.allowedCharacters.includes(character) && matchesZone(point, candidate, layout));
  if (!zone) return null;
  return resolveZoneAnchor(zone, point, layout, character);
}

export function resolveManualActivityIntent(
  rawPoint: ScenePoint,
  resolvedDrop: ResolvedDrop,
  layout: SceneLayout,
  character: CharacterId,
  statues: StatueSelection = NO_STATUES,
): ResolvedActivityDrop | null {
  const zone = ACTIVITY_ZONES.find((candidate) => {
    if (!candidate.allowedCharacters.includes(character) || !isActivityAvailable(candidate, statues)) return false;
    const rawMatch = (isPointSafe(rawPoint, layout, character) || candidate.activity === "bench-sit" && matchesBench(rawPoint, layout)) && matchesZone(rawPoint, candidate, layout);
    const resolvedMatch = isPointSafe(resolvedDrop.point, layout, character) && matchesZone(resolvedDrop.point, candidate, layout);
    return candidate.activity === "fishing" ? rawMatch || (resolvedMatch && isPointSafe(rawPoint, layout, character)) : rawMatch;
  });
  return zone ? resolveZoneAnchor(zone, resolvedDrop.point, layout, character) : null;
}

export function resolveZoneAnchor(
  zone: SemanticActivityZone,
  point: ScenePoint,
  layout: SceneLayout,
  character: CharacterId,
): ResolvedActivityDrop | null {
  if (!zone.allowedCharacters.includes(character)) return null;
  const candidates = (zone.anchorWaypointIds[character] ?? [])
    .map(getWaypoint)
    .filter((waypoint) => isPointSafe(waypointPoint(waypoint, layout), layout, character))
    .sort((left, right) => distance(point, waypointPoint(left, layout)) - distance(point, waypointPoint(right, layout)));
  const waypoint = candidates[0];
  if (!waypoint) return null;
  const configuredPoint = zone.anchorPoints?.[waypoint.id]?.[layout];
  const anchorPoint = zone.statueSlot ? imagePointToScene(STATUE_VIEW_ANCHORS[zone.statueSlot], layout, { x: 0, y: STATUE_CEREMONY_OFFSET_Y_PX[zone.statueSlot] }) : zone.activity === "bench-sit" ? imagePointToScene(BENCH_SLOT, layout) : configuredPoint && isPointSafe(configuredPoint, layout, character)
    ? configuredPoint
    : waypointPoint(waypoint, layout);
  return { zone, waypoint, point: anchorPoint };
}

function distance(left: ScenePoint, right: ScenePoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function matchesZone(point: ScenePoint, zone: SemanticActivityZone, layout: SceneLayout): boolean {
  if (zone.statueSlot) {
    const anchor = imagePointToScene(STATUE_VIEW_ANCHORS[zone.statueSlot], layout);
    const edge = imagePointToScene({ x: STATUE_VIEW_ANCHORS[zone.statueSlot].x + STATUE_VIEW_RADIUS_MASTER, y: STATUE_VIEW_ANCHORS[zone.statueSlot].y + STATUE_VIEW_RADIUS_MASTER }, layout);
    return Math.hypot((point.x - anchor.x) / (edge.x - anchor.x), (point.y - anchor.y) / (edge.y - anchor.y)) <= 1;
  }
  if (zone.activity === "bench-sit") return matchesBench(point, layout);
  return zone.activation[layout].some((circle) => distance(point, circle) <= circle.radius)
    || Boolean(zone.activationPolygons?.[layout]?.some((polygon) => pointInPolygon(point, polygon)))
    || zone.walkableRegionIds.some((regionId) => isPointInWalkableRegion(point, layout, regionId));
}

function matchesBench(point: ScenePoint, layout: SceneLayout): boolean {
  const seat = imagePointToScene(BENCH_SLOT, layout);
  // The visual bench spans roughly 175 master-image pixels; keep the trigger local.
  return Math.abs(point.x - seat.x) <= 6.5 && Math.abs(point.y - seat.y) <= 6;
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
