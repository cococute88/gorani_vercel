import type { CharacterId } from "./character-types";
import {
  getWaypoint,
  isPointInWalkableRegion,
  isPointSafe,
  WALKABLE_REGIONS,
  waypointPoint,
  type ResolvedDrop,
  type SceneLayout,
  type ScenePoint,
} from "./navigation";
import type { Waypoint } from "./forest-character-config";

export type SemanticActivity = "fishing" | "pond-watch";

export interface ActivityActivationCircle extends ScenePoint {
  radius: number;
}

export interface SemanticActivityZone {
  id: "fishing_dock" | "pond_watch";
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
  animationSpeed?: number;
}

export const FISHING_VISUAL_CONFIG = {
  handBone: "arm_R2",
  handPoint: "end" as const,
  bobber: {
    desktop: { x: 80.8, y: 98.1 },
    mobile: { x: 82, y: 86 },
  },
  rodSizePx: { desktop: 50, mobile: 42 },
} as const;

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
    allowedCharacters: ["gorani"],
    activation: {
      desktop: [{ x: 72, y: 90, radius: 8 }],
      mobile: [{ x: 89, y: 86.5, radius: 8 }],
    },
    activationPolygons: dockActivityPolygons,
    walkableRegionIds: ["dock-connector", "wooden-dock"],
    anchorWaypointIds: { gorani: ["dock_end"] },
    anchorPoints: { dock_end: { desktop: { x: 74.7, y: 94.1 }, mobile: { x: 91.5, y: 82.7 } } },
    durationMs: { min: 20_000, max: 45_000 },
    manualDurationMs: { min: 30_000, max: 60_000 },
    preferredFacing: "right",
    preferredFacingByLayout: { mobile: "left" },
    animation: "carry",
    animationSpeed: 0.16,
  },
  {
    id: "pond_watch",
    activity: "pond-watch",
    allowedCharacters: ["daramji"],
    activation: {
      desktop: [
        { x: 55, y: 77, radius: 7 },
        { x: 62, y: 86, radius: 6 },
      ],
      mobile: [
        { x: 53, y: 78, radius: 7 },
        { x: 58, y: 84, radius: 5.5 },
      ],
    },
    activationPolygons: dockActivityPolygons,
    walkableRegionIds: ["dock-connector", "wooden-dock"],
    anchorWaypointIds: { daramji: ["pond_edge", "dock_connector", "dock_mid"] },
    anchorPoints: {
      pond_edge: { desktop: { x: 55, y: 77 }, mobile: { x: 53, y: 78 } },
      dock_connector: { desktop: { x: 61.5, y: 84.1 }, mobile: { x: 74, y: 81 } },
      dock_mid: { desktop: { x: 70.2, y: 90 }, mobile: { x: 84.5, y: 86 } },
    },
    durationMs: { min: 15_000, max: 35_000 },
    preferredFacing: "right",
  },
] as const;

export function getActivityZone(id: SemanticActivityZone["id"]): SemanticActivityZone {
  const zone = ACTIVITY_ZONES.find((candidate) => candidate.id === id);
  if (!zone) throw new Error(`알 수 없는 activity zone: ${id}`);
  return zone;
}

export function resolveActivityDrop(
  point: ScenePoint,
  layout: SceneLayout,
  character: CharacterId,
): ResolvedActivityDrop | null {
  if (!isPointSafe(point, layout, character)) return null;
  const zone = ACTIVITY_ZONES.find((candidate) => candidate.allowedCharacters.includes(character) && matchesZone(point, candidate, layout));
  if (!zone) return null;
  return resolveZoneAnchor(zone, point, layout, character);
}

export function resolveManualActivityIntent(
  rawPoint: ScenePoint,
  resolvedDrop: ResolvedDrop,
  layout: SceneLayout,
  character: CharacterId,
): ResolvedActivityDrop | null {
  const zone = ACTIVITY_ZONES.find((candidate) => {
    if (!candidate.allowedCharacters.includes(character)) return false;
    const rawMatch = isPointSafe(rawPoint, layout, character) && matchesZone(rawPoint, candidate, layout);
    const resolvedMatch = isPointSafe(resolvedDrop.point, layout, character) && matchesZone(resolvedDrop.point, candidate, layout);
    const waypointMatch = (candidate.anchorWaypointIds[character] ?? []).includes(resolvedDrop.waypoint.id);
    return candidate.activity === "fishing" ? rawMatch || resolvedMatch || waypointMatch : rawMatch;
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
  const anchorPoint = configuredPoint && isPointSafe(configuredPoint, layout, character)
    ? configuredPoint
    : waypointPoint(waypoint, layout);
  return { zone, waypoint, point: anchorPoint };
}

function distance(left: ScenePoint, right: ScenePoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function matchesZone(point: ScenePoint, zone: SemanticActivityZone, layout: SceneLayout): boolean {
  return zone.activation[layout].some((circle) => distance(point, circle) <= circle.radius)
    || Boolean(zone.activationPolygons?.[layout]?.some((polygon) => pointInPolygon(point, polygon)))
    || zone.walkableRegionIds.some((regionId) => isPointInWalkableRegion(point, layout, regionId));
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
