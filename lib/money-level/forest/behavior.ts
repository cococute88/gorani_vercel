import type { CharacterId, CharacterState } from "./character-types";
import {
  BEHAVIOR_CONFIG,
  CHARACTER_CONFIG,
  WAYPOINTS,
  type ForestAction,
  type Waypoint,
} from "./forest-character-config";
import {
  resolveDrop,
  clampWorldPoint,
  getWaypoint,
  imagePointToScene,
  routeWaypoints,
  waypointPoint,
  isSegmentSafe,
  OPENED_WAYPOINTS,
  type SceneLayout,
  type ScenePoint,
} from "./navigation";
import type { MoneyLevelWeather as Weather } from "../types";
import { BENCH_EXIT_MASTER } from "./landmarks";
import type { ForestCamera } from "./camera";
import { normalGroundFacing } from "./character-pose";
import { NO_STATUES, CEREMONY_SLOTS, CEREMONY_SLOT_IDS, type StatueSelection } from "./statue-view";
import { CharacterActivityCoordinator, type CharacterActivity } from "./activity-coordinator";
import {
  getActivityZone,
  isActivityAvailable,
  resolveManualActivityIntent,
  resolveZoneAnchor,
  type ResolvedActivityDrop,
  type SemanticActivity,
  type SemanticActivityZone,
} from "./activity-zones";

export interface ActorPosition {
  x: number;
  y: number;
  facing: "left" | "right";
}

interface ControllerOptions {
  id: CharacterId;
  state: CharacterState;
  weather: () => Weather;
  mobile: () => boolean;
  onChange: (position: ActorPosition, phase: CharacterPhase) => void;
  activities: CharacterActivityCoordinator;
  statues?: () => StatueSelection;
}

export type CharacterPhase = "moving" | "daily" | "event" | "fishing" | "bench-sit" | "pond-watch" | "statue-appreciation" | "dragging" | "post-drag";

export interface DragDropResult {
  snapped: boolean;
  point: ScenePoint;
  activity: SemanticActivity | null;
  activityZoneId: SemanticActivityZone["id"] | null;
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const sample = <T>(values: readonly T[]): T => values[Math.floor(Math.random() * values.length)];

function accessoryCategory(id: string): "hat" | "face" {
  return id.includes("_Hat_") ? "hat" : "face";
}

export class ForestBehaviorController {
  readonly id: CharacterId;
  private readonly state: CharacterState;
  private readonly weather: () => Weather;
  private readonly mobile: () => boolean;
  private readonly onChange: ControllerOptions["onChange"];
  private readonly activities: CharacterActivityCoordinator;
  private readonly statues: () => StatueSelection;
  private dragDirection = 0;
  private waypoint: Waypoint;
  private timer = 0;
  private animationFrame = 0;
  private stopped = false;
  private phase: CharacterPhase = "daily";
  private route: Waypoint[] = [];
  private targetWaypointId: string | null = null;
  private pendingActivity: SemanticActivity | null = null;
  private activityZoneId: SemanticActivityZone["id"] | null = null;
  private reservedDrop: ResolvedActivityDrop | null = null;
  private snappingActivity: ResolvedActivityDrop | null = null;
  private activityRequest = 0;
  private exitResolve: (() => void) | null = null;
  position: ActorPosition;

  constructor(options: ControllerOptions) {
    this.id = options.id;
    this.state = options.state;
    this.weather = options.weather;
    this.mobile = options.mobile;
    this.onChange = options.onChange;
    this.activities = options.activities;
    this.statues = options.statues ?? (() => NO_STATUES);
    this.waypoint = WAYPOINTS.find(({ id }) => id === CHARACTER_CONFIG[this.id].homeWaypoint) ?? WAYPOINTS[0];
    this.position = { ...waypointPoint(this.waypoint, this.layout()), facing: this.waypoint.facing };
    this.onChange(this.position, this.phase);
  }

  start(): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.enterDaily(this.waypoint, "idle");
      return;
    }
    this.timer = window.setTimeout(
      () => this.chooseNext(),
      randomBetween(BEHAVIOR_CONFIG.initialStayMinMs, BEHAVIOR_CONFIG.initialStayMaxMs),
    );
  }

  stop(): void {
    this.stopped = true;
    this.activityRequest += 1;
    this.finishExit();
    void this.activities.setCharacterActivity(this.id, "roaming");
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
  }

  triggerEvent(): void {
    if (this.isBusyWithUserActivity()) return;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.enterEvent(this.waypoint);
  }

  triggerMove(): void {
    if (this.isBusyWithUserActivity()) return;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.chooseNext();
  }

  moveToWaypoint(id: string): void {
    if (this.isBusyWithUserActivity()) return;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.pendingActivity = null;
    this.chooseNext(true, getWaypoint(id));
  }

  triggerPondActivity(): void {
    if (this.isBusyWithUserActivity()) return;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.pendingActivity = this.id === "gorani" ? "fishing" : "pond-watch";
    this.chooseNext(true, getWaypoint(this.id === "gorani" ? "dock_end" : "pond_edge"));
  }

  triggerInteraction(): void {
    if (this.isBusyWithUserActivity() || this.phase === "post-drag") return;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.phase = "event";
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.activityZoneId = null;
    this.state.animation = "respect";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.event;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.position.facing = this.id === "gorani" ? "right" : "left";
    this.onChange(this.position, this.phase);
    this.timer = window.setTimeout(() => this.enterDaily(this.waypoint), 5_000);
  }

  beginDrag(): void {
    this.dragDirection = 0;
    this.activityRequest += 1;
    this.finishExit();
    void this.activities.setCharacterActivity(this.id, "roaming");
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.route = [];
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.activityZoneId = null;
    this.phase = "dragging";
    this.snappingActivity = null;
    this.state.animation = "idle_front";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.idle_front;
    this.state.loop = true;
    this.onChange(this.position, this.phase);
  }

  updateDrag(point: ScenePoint): void {
    if (this.phase !== "dragging") return;
    const bounded = clampWorldPoint(point, this.layout());
    const dx = bounded.x - this.position.x;
    if (Math.abs(dx) >= .1) this.dragDirection = dx;
    this.position.x = bounded.x;
    this.position.y = bounded.y;
    this.onChange(this.position, this.phase);
  }

  endDrag(point: ScenePoint): DragDropResult {
    let resolved = resolveDrop(point, this.layout(), this.id);
    const activityDrop = resolveManualActivityIntent(point, resolved, this.layout(), this.id, this.statues());
    if (activityDrop) {
      if (activityDrop.zone.ceremonySlot) {
        // Broad drop intent can include blocked ground. Lift the character
        // onto the resolved safe grass before walking to the assigned slot.
        this.position.x = resolved.point.x;
        this.position.y = resolved.point.y;
        this.waypoint = resolved.waypoint;
      }
      const assigned = this.enterActivityFromManualDrop(activityDrop);
      if (assigned) return {
        snapped: false,
        point: assigned.point,
        activity: activityDrop.zone.activity,
        activityZoneId: assigned.zone.id,
      };
      // If only one visible statue slot exists and it is occupied, remain on
      // its safe exit grass rather than dancing at the other owner's anchor.
      if (activityDrop.zone.ceremonySlot) resolved = resolveDrop(imagePointToScene(
        CEREMONY_SLOTS[activityDrop.zone.ceremonySlot].exit, this.layout()), this.layout(), this.id);
    }
    void this.activities.setCharacterActivity(this.id, "roaming");
    this.waypoint = resolved.waypoint;
    this.state.animation = "idle";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.idle;
    this.state.loop = true;
    this.phase = "post-drag";
    this.position.facing = normalGroundFacing(this.position.facing, this.dragDirection === 0 ? 0 : Math.sign(this.dragDirection));
    this.activityZoneId = null;
    if (resolved.snapped) this.snapTo(resolved.point);
    else {
      this.position.x = resolved.point.x;
      this.position.y = resolved.point.y;
      this.onChange(this.position, this.phase);
      this.schedulePostDragStay();
    }
    return { snapped: resolved.snapped, point: resolved.point, activity: null, activityZoneId: null };
  }

  resumeWander(): void {
    if (this.isBusyWithUserActivity()) return;
    window.clearTimeout(this.timer);
    this.chooseNext(true);
  }

  getPhase(): CharacterPhase {
    return this.phase;
  }

  /** Preserve the source ground point when cover/crop changes during a resize. */
  reproject(previous: ForestCamera, next: ForestCamera): void {
    const source = { x: (this.position.x * previous.width / 100 + previous.cropX) / previous.scale,
      y: (this.position.y * previous.height / 100 + previous.cropY) / previous.scale };
    this.position.x = (source.x * next.scale - next.cropX) / next.width * 100;
    this.position.y = (source.y * next.scale - next.cropY) / next.height * 100;
    cancelAnimationFrame(this.animationFrame);
    if (this.reservedDrop) this.reservedDrop = resolveZoneAnchor(this.reservedDrop.zone, this.position, this.layout(), this.id);
    if (this.phase === "moving" && this.targetWaypointId) this.moveTo(getWaypoint(this.targetWaypointId));
    else if (this.phase === "post-drag" && this.snappingActivity) {
      const drop = resolveZoneAnchor(this.snappingActivity.zone, this.position, this.layout(), this.id);
      const token = this.activityRequest;
      if (drop) this.snapTo(drop.point, () => {
        if (token !== this.activityRequest) return;
        this.snappingActivity = null;
        this.enterSemanticActivity(drop.zone, drop.waypoint);
      }, BEHAVIOR_CONFIG.manualActivitySnapMs);
    } else if (this.activityZoneId && this.phase !== "dragging" && this.phase !== "post-drag") {
      const zone = getActivityZone(this.activityZoneId), drop = resolveZoneAnchor(zone, this.position, this.layout(), this.id);
      if (drop) { this.position.x = drop.point.x; this.position.y = drop.point.y; }
    } else if (this.phase === "post-drag" && !this.activityZoneId) this.schedulePostDragStay();
    this.onChange(this.position, this.phase);
  }

  getTargetWaypointId(): string | null { return this.targetWaypointId; }

  getActivityZoneId(): SemanticActivityZone["id"] | null { return this.activityZoneId; }

  getWaypointId(): string { return this.waypoint.id; }

  startActivityAtZone(id: SemanticActivityZone["id"]): boolean {
    if (this.stopped) return false;
    const zone = getActivityZone(id);
    if (!isActivityAvailable(zone, this.statues())) return false;
    const resolved = resolveZoneAnchor(zone, this.position, this.layout(), this.id);
    if (!resolved) return false;
    return Boolean(this.requestActivity(resolved, false));
  }

  refreshStatueAvailability(): void {
    if (this.activityZoneId && !isActivityAvailable(getActivityZone(this.activityZoneId), this.statues())) {
      this.activityRequest += 1;
      window.clearTimeout(this.timer);
      cancelAnimationFrame(this.animationFrame);
      this.enterPostActivityIdle(this.waypoint);
    }
  }

  /** Called by the shared coordinator before a replacement can use the slot. */
  leaveOccupiedSlot(activity: "fishing" | "bench-sit" | "statue-ceremony"): Promise<void> {
    const ceremonySlot = this.activityZoneId ? getActivityZone(this.activityZoneId).ceremonySlot : undefined;
    this.activityRequest += 1;
    this.finishExit();
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.route = [];
    this.pendingActivity = null;
    this.activityZoneId = null;
    this.reservedDrop = null;
    const exit = getWaypoint(activity === "fishing" ? "pond_edge" : activity === "bench-sit" ? "bench_exit" : ceremonySlot ? CEREMONY_SLOTS[ceremonySlot].exitWaypoint : "path_front");
    if (activity === "fishing") void this.activities.setCharacterActivity(this.id, "pond-watch");
    const promise = new Promise<void>((resolve) => { this.exitResolve = resolve; });
    this.state.animation = "run";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.run;
    this.state.loop = true;
    this.phase = "moving";
    this.onChange(this.position, this.phase);
    if (activity === "fishing") {
      this.pendingActivity = "pond-watch";
      this.chooseNext(true, exit);
    } else {
      this.waypoint = exit;
      const source = activity === "statue-ceremony" && ceremonySlot ? CEREMONY_SLOTS[ceremonySlot].exit : BENCH_EXIT_MASTER;
      this.snapTo(imagePointToScene(source, this.layout()), () => {
        this.finishExit();
        this.enterPostActivityIdle(exit);
      }, 900);
    }
    return promise;
  }

  private finishExit(): void {
    this.exitResolve?.();
    this.exitResolve = null;
  }

  private requestActivity(drop: ResolvedActivityDrop, manual: boolean): ResolvedActivityDrop | null {
    if (drop.zone.ceremonySlot) {
      const available = CEREMONY_SLOT_IDS.filter(slot => isActivityAvailable(getActivityZone(slot), this.statues()));
      const assigned = this.activities.claimCeremony(this.id, drop.zone.ceremonySlot, available);
      if (!assigned) return null;
      drop = resolveZoneAnchor(getActivityZone(assigned), drop.point, this.layout(), this.id) ?? drop;
    }
    const token = ++this.activityRequest;
    this.finishExit();
    this.reservedDrop = null;
    this.snappingActivity = null;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.route = [];
    this.pendingActivity = null;
    this.targetWaypointId = null;
    this.activityZoneId = drop.zone.id;
    const activity: CharacterActivity = drop.zone.statueSlot ? "statue-ceremony" : drop.zone.activity as CharacterActivity;
    const departure = this.activities.setCharacterActivity(this.id, activity);
    this.phase = manual ? "post-drag" : "moving";
    this.state.animation = drop.zone.ceremonySlot ? "run" : "idle";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds[drop.zone.ceremonySlot ? "run" : "idle"];
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.onChange(this.position, this.phase);
    void departure.then(() => {
      if (this.stopped || token !== this.activityRequest || this.activities.getActivity(this.id) !== activity) return;
      drop = resolveZoneAnchor(drop.zone, this.position, this.layout(), this.id) ?? drop;
      if (!manual) {
        if (this.waypoint.id === drop.waypoint.id && Math.hypot(this.position.x - drop.point.x, this.position.y - drop.point.y) < 0.1) {
          this.enterSemanticActivity(drop.zone, drop.waypoint);
          return;
        }
        this.reservedDrop = drop;
        this.chooseNext(true, drop.waypoint);
        return;
      }
      if (drop.zone.ceremonySlot && !isSegmentSafe(this.position, drop.point, this.layout(), this.id)) {
        // Occupied-slot redirects can cross the pond in a straight line.
        // Keep the reservation while following the same safe roaming graph.
        this.reservedDrop = drop;
        this.chooseNext(true, drop.waypoint);
        return;
      }
      this.waypoint = drop.waypoint;
      this.snappingActivity = drop;
      this.snapTo(drop.point, () => {
        if (token !== this.activityRequest || this.activities.getActivity(this.id) !== activity) return;
        this.snappingActivity = null;
        this.enterSemanticActivity(drop.zone, drop.waypoint, drop.zone.manualDurationMs ?? drop.zone.durationMs);
      }, drop.zone.ceremonySlot ? 800 : BEHAVIOR_CONFIG.manualActivitySnapMs);
    });
    return drop;
  }

  private chooseNext(forceDifferent = false, forcedWaypoint?: Waypoint): void {
    if (this.stopped) return;
    let next = forcedWaypoint;
    if (!next) {
      const activityChance = this.id === "gorani" ? BEHAVIOR_CONFIG.fishingChance : BEHAVIOR_CONFIG.pondWatchChance;
      if (Math.random() < activityChance) {
        this.pendingActivity = this.id === "gorani" ? "fishing" : "pond-watch";
        next = getWaypoint(this.id === "gorani" ? "dock_end" : "pond_edge");
      } else next = this.weightedWaypoint(forceDifferent);
    }
    const layout = this.layout();
    const route = routeWaypoints(this.waypoint.id, next.id, layout, this.id);
    if (next.id !== this.waypoint.id && route.length === 0) {
      this.enterDaily(this.waypoint, "idle");
      return;
    }
    const anchor = waypointPoint(this.waypoint, layout);
    const offAnchor = Math.hypot(this.position.x - anchor.x, this.position.y - anchor.y) > 0.05;
    this.route = offAnchor ? [this.waypoint, ...route] : route;
    const first = this.route.shift();
    if (first) this.moveTo(first);
    else this.enterDaily(this.waypoint);
  }

  private weightedWaypoint(forceDifferent: boolean): Waypoint {
    const config = CHARACTER_CONFIG[this.id];
    const weighted = [...WAYPOINTS, ...Object.values(OPENED_WAYPOINTS)].map((waypoint) => {
      let weight = waypoint.weight;
      if (waypoint.id === config.homeWaypoint) weight *= BEHAVIOR_CONFIG.homeWeightMultiplier;
      if (["rain", "thunderstorm"].includes(this.weather()) && [config.homeWaypoint, "large_tree"].includes(waypoint.id)) {
        weight *= BEHAVIOR_CONFIG.rainShelterMultiplier;
      }
      if (waypoint.id === this.waypoint.id) weight *= forceDifferent ? 0 : 0.18;
      return { waypoint, weight };
    });
    let roll = Math.random() * weighted.reduce((sum, item) => sum + item.weight, 0);
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) return item.waypoint;
    }
    return weighted[weighted.length - 1].waypoint;
  }

  private moveTo(next: Waypoint): void {
    const start = { x: this.position.x, y: this.position.y };
    const target = waypointPoint(next, this.layout());
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const minDuration = this.route.length > 0 ? BEHAVIOR_CONFIG.minRouteSegmentMs : BEHAVIOR_CONFIG.minMoveMs;
    const duration = Math.max(
      minDuration,
      Math.min(BEHAVIOR_CONFIG.maxMoveMs, distance * BEHAVIOR_CONFIG.moveMsPerSceneUnit),
    );
    const started = performance.now();
    this.phase = "moving";
    this.state.animation = "run";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.run;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.targetWaypointId = next.id;
    const dx = target.x - start.x;
    if (Math.abs(dx) >= BEHAVIOR_CONFIG.facingThreshold) this.position.facing = dx < 0 ? "left" : "right";
    this.onChange(this.position, this.phase);

    const frame = (now: number) => {
      if (this.stopped) return;
      if (document.hidden) {
        this.animationFrame = requestAnimationFrame(frame);
        return;
      }
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 2);
      this.position.x = start.x + (target.x - start.x) * eased;
      this.position.y = start.y + (target.y - start.y) * eased;
      this.onChange(this.position, this.phase);
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(frame);
        return;
      }
      this.waypoint = next;
      const following = this.route.shift();
      if (following) {
        this.moveTo(following);
      } else if (this.reservedDrop) {
        const drop = this.reservedDrop;
        this.reservedDrop = null;
        this.snapTo(drop.point, () => this.enterSemanticActivity(drop.zone, drop.waypoint), drop.zone.activity === "bench-sit" ? 1_300 : 320);
      } else if (this.pendingActivity === "fishing" && next.id === "dock_end") {
        this.enterFishing(next);
      } else if (this.pendingActivity === "pond-watch" && ["pond_edge", "dock_start"].includes(next.id)) {
        this.finishExit();
        this.enterPondWatch(next);
      } else if (Math.random() < BEHAVIOR_CONFIG.eventChance) this.enterEvent(next);
      else this.enterDaily(next);
    };
    this.animationFrame = requestAnimationFrame(frame);
  }

  private enterDaily(waypoint: Waypoint, forcedAction?: ForestAction, suppressAccessory = false): void {
    this.finishExit();
    this.reservedDrop = null;
    void this.activities.setCharacterActivity(this.id, "roaming");
    const config = CHARACTER_CONFIG[this.id];
    const action = forcedAction ?? sample(waypoint.supportedActions);
    this.phase = "daily";
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.activityZoneId = null;
    this.state.animation = sample(config.dailyAnimations);
    this.state.speed = config.animationSpeeds[this.state.animation === "idle_front" ? "idle_front" : "idle"];
    this.state.loop = true;
    this.state.skin = config.defaultSkin;
    this.state.hat = "";
    this.state.face = "";
    const preset = config.actionAccessoryMap[action];
    const accessory = !suppressAccessory && preset && Math.random() < BEHAVIOR_CONFIG.actionAccessoryChance
      ? preset
      : !suppressAccessory && Math.random() < BEHAVIOR_CONFIG.accessoryChance
        ? sample(config.everydayAccessories)
        : "";
    if (accessory) this.state[accessoryCategory(accessory)] = accessory;
    this.position.facing = normalGroundFacing(this.position.facing);
    this.onChange(this.position, this.phase);
    this.timer = window.setTimeout(() => this.chooseNext(), randomBetween(BEHAVIOR_CONFIG.minStayMs, BEHAVIOR_CONFIG.maxStayMs));
  }

  private enterEvent(waypoint: Waypoint): void {
    void this.activities.setCharacterActivity(this.id, "roaming");
    const config = CHARACTER_CONFIG[this.id];
    this.phase = "event";
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.activityZoneId = null;
    this.state.animation = sample(config.eventAnimations);
    this.state.speed = config.animationSpeeds.event;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    const accessory = sample(config.eventAccessories);
    this.state[accessoryCategory(accessory)] = accessory;
    this.onChange(this.position, this.phase);
    this.timer = window.setTimeout(() => this.enterDaily(waypoint, "idle", true), randomBetween(4_000, 7_000));
  }

  private enterFishing(waypoint: Waypoint): void {
    const zone = getActivityZone("fishing_dock");
    const resolved = resolveZoneAnchor(zone, this.position, this.layout(), this.id);
    if (resolved) this.requestActivity(resolved, false);
    else this.enterDaily(waypoint, "idle");
  }

  private enterActivityFromManualDrop(activityDrop: ResolvedActivityDrop): ResolvedActivityDrop | null {
    return this.requestActivity(activityDrop, true);
  }

  private enterSemanticActivity(
    zone: SemanticActivityZone,
    waypoint: Waypoint,
    durationMs = zone.durationMs,
  ): void {
    if (zone.activity === "pond-watch") {
      this.enterPondWatch(waypoint, zone);
      return;
    }
    this.phase = zone.activity;
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.state.animation = zone.animationByCharacter?.[this.id] ?? zone.animation ?? "idle";
    this.state.speed = zone.animationSpeed ?? CHARACTER_CONFIG[this.id].animationSpeeds.idle;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.activityZoneId = zone.id;
    this.position.facing = zone.preferredFacingByLayout?.[this.layout()] ?? zone.preferredFacing;
    this.onChange(this.position, this.phase);
    if (zone.activity === "statue-appreciation") return;
    this.timer = window.setTimeout(() => {
      if (zone.activity === "bench-sit") {
        void this.activities.setCharacterActivity(this.id, "roaming");
        void this.leaveOccupiedSlot("bench-sit");
      } else this.enterPostActivityIdle(waypoint);
    }, randomBetween(durationMs.min, durationMs.max));
  }

  private enterPondWatch(waypoint: Waypoint, zone = getActivityZone("pond_watch")): void {
    void this.activities.setCharacterActivity(this.id, "pond-watch");
    this.phase = "pond-watch";
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.state.animation = "idle_front";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.idle_front;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.activityZoneId = zone.id;
    this.position.facing = zone.preferredFacingByLayout?.[this.layout()] ?? zone.preferredFacing;
    this.onChange(this.position, this.phase);
    this.timer = window.setTimeout(() => this.enterPostActivityIdle(waypoint), randomBetween(zone.durationMs.min, zone.durationMs.max));
  }

  private enterPostActivityIdle(waypoint: Waypoint): void {
    void this.activities.setCharacterActivity(this.id, "roaming");
    this.phase = "daily";
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.activityZoneId = null;
    this.state.animation = "idle";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.idle;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.position.facing = waypoint.facing;
    this.onChange(this.position, this.phase);
    this.timer = window.setTimeout(
      () => this.chooseNext(true),
      randomBetween(BEHAVIOR_CONFIG.postActivityStayMinMs, BEHAVIOR_CONFIG.postActivityStayMaxMs),
    );
  }

  private snapTo(target: ScenePoint, onComplete?: () => void, durationMs: number = BEHAVIOR_CONFIG.invalidDropSnapMs): void {
    const start = { x: this.position.x, y: this.position.y };
    const started = performance.now();
    const frame = (now: number) => {
      if (this.stopped) return;
      const progress = Math.min(1, (now - started) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.position.x = start.x + (target.x - start.x) * eased;
      this.position.y = start.y + (target.y - start.y) * eased;
      this.onChange(this.position, this.phase);
      if (progress < 1) this.animationFrame = requestAnimationFrame(frame);
      else if (onComplete) onComplete();
      else this.schedulePostDragStay();
    };
    this.animationFrame = requestAnimationFrame(frame);
  }

  private schedulePostDragStay(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(
      () => this.chooseNext(true),
      randomBetween(BEHAVIOR_CONFIG.postDragStayMinMs, BEHAVIOR_CONFIG.postDragStayMaxMs),
    );
  }

  private layout(): SceneLayout {
    return this.mobile() ? "mobile" : "desktop";
  }

  private isBusyWithUserActivity(): boolean {
    return this.phase === "dragging" || this.exitResolve !== null || this.activities.getActivity(this.id) !== "roaming";
  }
}
