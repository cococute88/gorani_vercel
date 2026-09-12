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
  getWaypoint,
  routeWaypoints,
  waypointPoint,
  type SceneLayout,
  type ScenePoint,
} from "./navigation";
import type { MoneyLevelWeather as Weather } from "../types";
import {
  getActivityZone,
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
}

export type CharacterPhase = "moving" | "daily" | "event" | "fishing" | "pond-watch" | "dragging" | "post-drag";

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
  private waypoint: Waypoint;
  private timer = 0;
  private animationFrame = 0;
  private stopped = false;
  private phase: CharacterPhase = "daily";
  private route: Waypoint[] = [];
  private targetWaypointId: string | null = null;
  private pendingActivity: "fishing" | "pond-watch" | null = null;
  private activityZoneId: SemanticActivityZone["id"] | null = null;
  position: ActorPosition;

  constructor(options: ControllerOptions) {
    this.id = options.id;
    this.state = options.state;
    this.weather = options.weather;
    this.mobile = options.mobile;
    this.onChange = options.onChange;
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
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.route = [];
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.activityZoneId = null;
    this.phase = "dragging";
    this.state.animation = "idle_front";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.idle_front;
    this.state.loop = true;
    this.onChange(this.position, this.phase);
  }

  updateDrag(point: ScenePoint): void {
    if (this.phase !== "dragging") return;
    this.position.x = Math.max(0, Math.min(100, point.x));
    this.position.y = Math.max(0, Math.min(100, point.y));
    this.onChange(this.position, this.phase);
  }

  endDrag(point: ScenePoint): DragDropResult {
    const resolved = resolveDrop(point, this.layout(), this.id);
    const activityDrop = resolveManualActivityIntent(point, resolved, this.layout(), this.id);
    if (activityDrop) {
      this.enterActivityFromManualDrop(activityDrop);
      return {
        snapped: false,
        point: activityDrop.point,
        activity: activityDrop.zone.activity,
        activityZoneId: activityDrop.zone.id,
      };
    }
    this.waypoint = resolved.waypoint;
    this.state.animation = "idle";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.idle;
    this.state.loop = true;
    this.phase = "post-drag";
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

  getTargetWaypointId(): string | null { return this.targetWaypointId; }

  getActivityZoneId(): SemanticActivityZone["id"] | null { return this.activityZoneId; }

  getWaypointId(): string { return this.waypoint.id; }

  startActivityAtZone(id: SemanticActivityZone["id"]): boolean {
    if (this.stopped) return false;
    const zone = getActivityZone(id);
    const resolved = resolveZoneAnchor(zone, this.position, this.layout(), this.id);
    if (!resolved) return false;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.route = [];
    this.pendingActivity = null;
    this.waypoint = resolved.waypoint;
    this.position.x = resolved.point.x;
    this.position.y = resolved.point.y;
    this.enterSemanticActivity(zone, resolved.waypoint, zone.manualDurationMs ?? zone.durationMs);
    return true;
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
    const weighted = WAYPOINTS.map((waypoint) => {
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
      } else if (this.pendingActivity === "fishing" && this.id === "gorani" && next.id === "dock_end") {
        this.enterFishing(next);
      } else if (this.pendingActivity === "pond-watch" && this.id === "daramji" && ["pond_edge", "dock_start"].includes(next.id)) {
        this.enterPondWatch(next);
      } else if (Math.random() < BEHAVIOR_CONFIG.eventChance) this.enterEvent(next);
      else this.enterDaily(next);
    };
    this.animationFrame = requestAnimationFrame(frame);
  }

  private enterDaily(waypoint: Waypoint, forcedAction?: ForestAction, suppressAccessory = false): void {
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
    this.position.facing = waypoint.facing;
    this.onChange(this.position, this.phase);
    this.timer = window.setTimeout(() => this.chooseNext(), randomBetween(BEHAVIOR_CONFIG.minStayMs, BEHAVIOR_CONFIG.maxStayMs));
  }

  private enterEvent(waypoint: Waypoint): void {
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
    this.enterSemanticActivity(getActivityZone("fishing_dock"), waypoint);
  }

  private enterActivityFromManualDrop(activityDrop: ResolvedActivityDrop): void {
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.animationFrame);
    this.route = [];
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.waypoint = activityDrop.waypoint;
    this.state.animation = "idle";
    this.state.speed = CHARACTER_CONFIG[this.id].animationSpeeds.idle;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.phase = "post-drag";
    this.activityZoneId = activityDrop.zone.id;
    this.snapTo(
      activityDrop.point,
      () => this.enterSemanticActivity(
        activityDrop.zone,
        activityDrop.waypoint,
        activityDrop.zone.manualDurationMs ?? activityDrop.zone.durationMs,
      ),
      BEHAVIOR_CONFIG.manualActivitySnapMs,
    );
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
    this.phase = "fishing";
    this.targetWaypointId = null;
    this.pendingActivity = null;
    this.state.animation = zone.animation ?? "idle";
    this.state.speed = zone.animationSpeed ?? CHARACTER_CONFIG[this.id].animationSpeeds.idle;
    this.state.loop = true;
    this.state.hat = "";
    this.state.face = "";
    this.activityZoneId = zone.id;
    this.position.facing = zone.preferredFacingByLayout?.[this.layout()] ?? zone.preferredFacing;
    this.onChange(this.position, this.phase);
    this.timer = window.setTimeout(() => this.enterPostActivityIdle(waypoint), randomBetween(durationMs.min, durationMs.max));
  }

  private enterPondWatch(waypoint: Waypoint, zone = getActivityZone("pond_watch")): void {
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
    return this.phase === "dragging" || this.phase === "fishing" || this.phase === "pond-watch";
  }
}
