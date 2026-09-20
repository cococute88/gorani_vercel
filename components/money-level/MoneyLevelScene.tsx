"use client";
/* eslint-disable @next/next/no-img-element -- approved art renditions intentionally keep the existing scene loading path */

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { MoneyLevelHouseStage } from "@/lib/money-level/house-stages";
import type {
  MoneyLevelForestSpecialEvent,
  MoneyLevelSceneWeather,
  MoneyLevelSeason,
  MoneyLevelStatue,
  MoneyLevelTimeOfDay,
} from "@/lib/money-level/types";
import {
  BEHAVIOR_CONFIG,
  CHARACTER_CONFIG,
  initialCharacterState,
} from "@/lib/money-level/forest/forest-character-config";
import {
  ForestBehaviorController,
  type ActorPosition,
  type CharacterPhase,
} from "@/lib/money-level/forest/behavior";
import { CharacterActivityCoordinator } from "@/lib/money-level/forest/activity-coordinator";
import { GORANI_BENCH_POSE } from "@/lib/money-level/forest/character-pose";
import { cameraTranslation, clampCameraX, createForestCamera, edgePanSpeed, resolveGestureIntent, screenToWorld, TOUCH_SLOP_PX, type ForestCamera, type GestureIntent } from "@/lib/money-level/forest/camera";
import { FISHING_VISUAL_CONFIG, fishingRodGeometry, GORANI_BENCH_VISUAL_OFFSET_Y_PX, type SemanticActivityZone } from "@/lib/money-level/forest/activity-zones";
import { FISHING_BOBBER, fishingLineAngleDeg, projectForestPoint, statueSlotPlacement } from "@/lib/money-level/forest/landmarks";
import { perspectiveScale, setForestSceneViewport, imagePointToScene, type ScenePoint } from "@/lib/money-level/forest/navigation";
import { FOREST_SCENE, HOUSE_ART_FAMILY, resolveForestBackground, resolveForestHouseAsset } from "@/lib/money-level/forest/scene-config";
import { brokerageHouseLabelPoint, houseWorldToViewport, taxHouseLabelPoint, TAX_LABEL_WORLD } from "@/lib/money-level/forest/house-geometry";
import { resolveHouseVisualFrame, type HouseVisualFrame } from "@/lib/money-level/forest/tax-artwork";
import type { SceneAsset } from "@/lib/money-level/forest/scene-config";
import { getWorldObjectLighting, getHouseAmbientLighting } from "@/lib/money-level/forest/world-object-lighting";
import type { CharacterId, CharacterState } from "@/lib/money-level/forest/character-types";
import { resolveMoneyLevelWindIntensity } from "@/lib/money-level/weather";
import { SpineStage, type BoneScreenPoint } from "./runtime/spine-stage";

const MOBILE_BREAKPOINT = 560;
const BACKGROUND_CROSSFADE_MS = 800;
let activeRuntimeCount = 0;

const benchVisualOffsetYPx = (id: CharacterId, phase: CharacterPhase | undefined) =>
  id === "gorani" && phase === "bench-sit" ? GORANI_BENCH_VISUAL_OFFSET_Y_PX : 0;

type DebugCharacterState = {
  animation: string;
  accessory: string;
  position: ActorPosition;
  phase: CharacterPhase;
  waypoint: string;
  activityZone: SemanticActivityZone["id"] | null;
};

declare global {
  interface Window {
    __MONEY_LEVEL_DEBUG__?: {
      activeRuntimeCount: () => number;
      camera: () => ForestCamera;
      state: () => Record<CharacterId, DebugCharacterState>;
      startFishing: () => boolean;
      startFishingAs: (id: CharacterId) => boolean;
      startBenchSitting: (id: CharacterId) => boolean;
      dropCharacter: (id: CharacterId, source: ScenePoint) => void;
      startActivity: (id: CharacterId, zone: SemanticActivityZone["id"]) => boolean;
      ceremonyOwners: () => ReturnType<CharacterActivityCoordinator["getCeremonyOwners"]>;
      startPondWatch: () => boolean;
      triggerMove: () => void;
    };
  }
}

export default function MoneyLevelScene({
  brokerageStage,
  taxStage,
  brokerageValue,
  taxValue,
  brokerageLevel,
  taxLevel,
  weather,
  season,
  specialEvent,
  timeOfDay,
  ambientEnabled,
  previewOverridesEnabled,
  leftStatue,
  rightStatue,
  brokerageText,
  taxText,
  phrase,
}: {
  brokerageStage: MoneyLevelHouseStage;
  taxStage: MoneyLevelHouseStage;
  brokerageValue: number;
  taxValue: number;
  brokerageLevel: number;
  taxLevel: number;
  weather: MoneyLevelSceneWeather;
  season: MoneyLevelSeason;
  specialEvent: MoneyLevelForestSpecialEvent;
  timeOfDay: MoneyLevelTimeOfDay;
  ambientEnabled: boolean;
  previewOverridesEnabled: boolean;
  leftStatue: MoneyLevelStatue;
  rightStatue: MoneyLevelStatue;
  brokerageText: string;
  taxText: string;
  phrase: string;
}) {
  const sceneRef = useRef<HTMLElement>(null);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const lightingFilterId = `world-object-lighting-${useId().replace(/:/g, "")}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(createForestCamera(1320, 520, false));
  const statuesRef = useRef({ left: leftStatue, right: rightStatue });
  statuesRef.current = { left: leftStatue, right: rightStatue };
  const refreshStatuesRef = useRef<(() => void) | null>(null);
  const reprojectCharactersRef = useRef<((previous: ForestCamera, next: ForestCamera) => void) | null>(null);
  useEffect(() => { refreshStatuesRef.current?.(); }, [leftStatue, rightStatue]);
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const [characterError, setCharacterError] = useState(false);
  const [sceneSize, setSceneSize] = useState({ width: 1320, height: 520, mobile: false });
  const [houseAmbientEnabled, setHouseAmbientEnabled] = useState(true);
  useEffect(() => {
    setHouseAmbientEnabled(!previewOverridesEnabled || new URLSearchParams(window.location.search).get("houseAmbient") !== "off");
  }, [previewOverridesEnabled]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      const size = { width: scene.clientWidth, height: scene.clientHeight, mobile: window.innerWidth <= MOBILE_BREAKPOINT };
      const previous = cameraRef.current;
      const camera = createForestCamera(size.width, size.height, size.mobile);
      camera.x = clampCameraX(camera, camera.cropX + (previous.x - previous.cropX) * camera.scale / previous.scale);
      cameraRef.current = camera;
      scene.style.setProperty("--forest-camera-translation", `${cameraTranslation(camera)}px`);
      scene.style.setProperty("--forest-world-width", `${camera.worldWidth}px`);
      scene.style.setProperty("--forest-world-left", `${-camera.cropX}px`);
      scene.dataset.cameraX = String(camera.x);
      scene.dataset.cameraMaxX = String(camera.maxX);
      setSceneSize(size);
      setForestSceneViewport(size);
      reprojectCharactersRef.current?.(previous, camera);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => { observer.disconnect(); setForestSceneViewport(null); };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const stageElement = stageRef.current;
    if (!scene || !stageElement) return;

    let cancelled = false;
    const initialization = new AbortController();
    let stage: SpineStage | null = null;
    let interactionTimer = 0;
    const cleanupListeners: Array<() => void> = [];
    const mobile = () => window.innerWidth <= MOBILE_BREAKPOINT;
    const states: Record<CharacterId, CharacterState> = {
      gorani: initialCharacterState("gorani"),
      daramji: initialCharacterState("daramji"),
    };
    const positions: Record<CharacterId, ActorPosition> = {
      gorani: { x: 24, y: 62, facing: "right" },
      daramji: { x: 76, y: 64, facing: "left" },
    };
    const renderScaleMultiplier: Record<CharacterId, number> = { gorani: 1, daramji: 1 };
    const controllers = {} as Record<CharacterId, ForestBehaviorController>;
    const activities = new CharacterActivityCoordinator((id, activity) => controllers[id].leaveOccupiedSlot(activity));
    activeRuntimeCount += 1;
    stageElement.dataset.activeRuntimeCount = String(activeRuntimeCount);
    setCharacterError(false);

    const worldPlacement = (id: CharacterId) => {
      const viewportHeight = 270;
      const viewportWidth = viewportHeight * (Math.max(scene.clientWidth, 1) / Math.max(scene.clientHeight, 1));
      const bottom = 103 - viewportHeight / 2;
      const position = positions[id];
      const goraniBench = id === "gorani" && controllers[id]?.getPhase() === "bench-sit";
      return {
        x: (position.x / 100 - 0.5 + (cameraTranslation(cameraRef.current) + (goraniBench ? GORANI_BENCH_POSE.offsetXPx : 0)) / Math.max(scene.clientWidth, 1)) * viewportWidth,
        y: bottom + (1 - position.y / 100) * viewportHeight
          - benchVisualOffsetYPx(id, controllers[id]?.getPhase()) / Math.max(scene.clientHeight, 1) * viewportHeight,
        scale: CHARACTER_CONFIG[id].scale * (mobile() ? 0.72 : 1) * perspectiveScale(position.y) * renderScaleMultiplier[id],
        scaleY: id === "daramji" && controllers[id]?.getPhase() === "bench-sit" ? 0.84 : 1,
        visualRotationDeg: goraniBench ? GORANI_BENCH_POSE.rotationDeg : 0,
        rotationPivotBone: goraniBench ? GORANI_BENCH_POSE.pivotBone : undefined,
        flipX: position.facing === "right",
      };
    };

    const updateCharacterDom = (id: CharacterId, position: ActorPosition, phase: CharacterPhase) => {
      for (const anchor of Array.from(scene.querySelectorAll<HTMLElement>(`[data-character-anchor="${id}"]`))) {
        anchor.style.left = `${position.x + (id === "gorani" && phase === "bench-sit" ? GORANI_BENCH_POSE.offsetXPx / Math.max(scene.clientWidth, 1) * 100 : 0)}%`;
        anchor.style.top = `${position.y + benchVisualOffsetYPx(id, phase) / Math.max(scene.clientHeight, 1) * 100}%`;
        anchor.style.setProperty("--perspective-scale", String(perspectiveScale(position.y)));
        anchor.dataset.phase = phase;
      }
      const activity = scene.querySelector<HTMLElement>(".fishing-activity");
      if (activity && (phase === "fishing" || activity.dataset.character === id)) {
        activity.hidden = phase !== "fishing";
        if (phase === "fishing") activity.dataset.character = id;
        else delete activity.dataset.attached;
      }
      stageElement.dataset[`${id}Phase`] = phase;
      stageElement.dataset[`${id}Animation`] = states[id].animation;
      stageElement.dataset[`${id}Accessory`] = states[id].hat || states[id].face || "none";
      stageElement.dataset[`${id}Facing`] = position.facing;
    };

    for (const id of ["gorani", "daramji"] as const) {
      controllers[id] = new ForestBehaviorController({
        id,
        state: states[id],
        weather: () => weatherRef.current === "snow" ? "cloudy" : weatherRef.current,
        mobile,
        activities,
        statues: () => statuesRef.current,
        onChange: (position, phase) => {
          positions[id] = { ...position };
          updateCharacterDom(id, position, phase);
        },
      });
    }

    refreshStatuesRef.current = () => { controllers.gorani.refreshStatueAvailability(); controllers.daramji.refreshStatueAvailability(); };
    reprojectCharactersRef.current = (previous, next) => { controllers.gorani.reproject(previous, next); controllers.daramji.reproject(previous, next); };

    const updateFishingVisual = (id: CharacterId, hand: BoneScreenPoint) => {
      const activity = scene.querySelector<HTMLElement>(".fishing-activity");
      const rod = scene.querySelector<HTMLImageElement>(".fishing-rod");
      const line = scene.querySelector<HTMLElement>(".fishing-line");
      const bobber = scene.querySelector<HTMLElement>(".fishing-bobber");
      if (!activity || !rod || !line || !bobber || activity.hidden || activity.dataset.character !== id || controllers[id].getPhase() !== "fishing") return;
      const layout = mobile() ? "mobile" : "desktop";
      const worldHand = { ...hand, x: hand.x - cameraTranslation(cameraRef.current) };
      const { size, direction, angle, handle, left, top, tip } = fishingRodGeometry(id, worldHand, layout);
      const target = projectForestPoint(FISHING_BOBBER[layout], { width: scene.clientWidth, height: scene.clientHeight }, layout === "mobile");
      const lineDx = target.x - tip.x;
      const lineDy = target.y - tip.y;
      activity.dataset.handBone = FISHING_VISUAL_CONFIG[id].handBone;
      activity.dataset.attached = "true";
      rod.style.left = `${left}px`;
      rod.style.top = `${top}px`;
      rod.style.width = `${size}px`;
      rod.style.height = `${size}px`;
      rod.style.transformOrigin = `${handle.x}px ${handle.y}px`;
      rod.style.transform = `rotate(${angle}deg) scaleX(${direction})`;
      line.style.left = `${tip.x}px`;
      line.style.top = `${tip.y}px`;
      line.style.height = `${Math.hypot(lineDx, lineDy)}px`;
      line.style.transform = `rotate(${fishingLineAngleDeg(tip, target)}deg)`;
      bobber.style.left = `${target.x}px`;
      bobber.style.top = `${target.y}px`;
    };

    type DragSession = {
      id: CharacterId;
      pointerId: number;
      pointerType: string;
      startX: number;
      startY: number;
      clientX: number;
      clientY: number;
      grabOffset: ScenePoint;
      active: boolean;
      timer: number;
      startedAt: number;
      target: HTMLElement;
    };
    let dragSession: DragSession | null = null;
    let panSession: { pointerId: number; startX: number; startY: number; cameraX: number; intent: GestureIntent } | null = null;
    let edgeFrame = 0;
    let edgeLastTime = 0;
    const debugEnabled = previewOverridesEnabled && new URLSearchParams(window.location.search).get("interactionDebug") === "1";
    const debugPanel = debugEnabled ? document.createElement("output") : null;
    if (debugPanel) debugPanel.className = "interaction-debug";
    let pointerCancelCount = 0;
    let lastPointerType = "none";
    let movementDistance = 0;
    let pagePointerId: number | null = null;
    const eventLog: string[] = [];
    const renderInteractionDebug = () => {
      const owner = dragSession?.active ? "CHARACTER_DRAG" : panSession?.intent === "horizontal" ? "FOREST_PAN" : pagePointerId !== null || panSession?.intent === "vertical" ? "PAGE" : "NONE";
      scene.dataset.pointerOwner = owner;
      scene.dataset.longPressTimer = dragSession && !dragSession.active ? "pending" : "off";
      if (!debugPanel) return;
      const elapsed = dragSession ? Math.round(performance.now() - dragSession.startedAt) : 0;
      const captured = dragSession?.target.hasPointerCapture(dragSession.pointerId) ?? false;
      debugPanel.textContent = `owner: ${owner}\nlongPressTimer: ${scene.dataset.longPressTimer} (${elapsed}ms / ${BEHAVIOR_CONFIG.longPressMs}ms)\npointerType: ${lastPointerType}\nmovement: ${movementDistance.toFixed(1)}px / ${TOUCH_SLOP_PX}px\npointercancel: ${pointerCancelCount}\ncapture: ${captured}\ncameraX: ${cameraRef.current.x.toFixed(1)}\ngrabbed: ${dragSession?.active ? dragSession.id : "none"}\n${eventLog.join("\n")}`;
    };
    if (debugPanel) {
      scene.append(debugPanel);
      const trace = (event: Event) => {
        if (event instanceof PointerEvent) {
          lastPointerType = event.pointerType;
          if (event.type === "pointercancel") pointerCancelCount += 1;
        }
        const target = event.target instanceof HTMLElement ? event.target.id || event.target.className : "unknown";
        eventLog.push(`${Math.round(performance.now())} ${event.type} ${target} cancelable=${event.cancelable}`);
        if (eventLog.length > 6) eventLog.shift();
        queueMicrotask(renderInteractionDebug);
      };
      for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture", "touchstart", "touchmove", "touchend", "touchcancel"]) {
        scene.addEventListener(type, trace, { capture: true, passive: true });
        cleanupListeners.push(() => scene.removeEventListener(type, trace, true));
      }
      cleanupListeners.push(() => debugPanel.remove());
    }
    const toScenePoint = (event: { clientX: number; clientY: number }): ScenePoint => {
      const bounds = scene.getBoundingClientRect();
      return screenToWorld({ x: event.clientX - bounds.left - scene.clientLeft, y: event.clientY - bounds.top - scene.clientTop }, cameraRef.current);
    };
    const dragPoint = (event: { clientX: number; clientY: number }): ScenePoint => {
      const point = toScenePoint(event);
      return { x: point.x + (dragSession?.grabOffset.x ?? 0), y: point.y + (dragSession?.grabOffset.y ?? 0) };
    };
    const setCameraX = (x: number) => {
      const camera = cameraRef.current;
      camera.x = clampCameraX(camera, x);
      scene.style.setProperty("--forest-camera-translation", `${cameraTranslation(camera)}px`);
      scene.dataset.cameraX = String(camera.x);
      renderInteractionDebug();
    };
    const autoPan = (now: number) => {
      if (!dragSession?.active) return;
      const bounds = scene.getBoundingClientRect();
      const seconds = Math.min(0.032, (now - edgeLastTime) / 1000);
      edgeLastTime = now;
      if (!document.hidden) {
        const fingerX = dragSession.clientX - bounds.left;
        const fingerY = dragSession.clientY - bounds.top;
        if (fingerY >= 0 && fingerY <= bounds.height) setCameraX(cameraRef.current.x + edgePanSpeed(fingerX, scene.clientWidth) * seconds);
        controllers[dragSession.id].updateDrag(dragPoint(dragSession));
      }
      edgeFrame = window.requestAnimationFrame(autoPan);
    };
    const activateDrag = () => {
      if (!dragSession || dragSession.active) return;
      dragSession.active = true;
      window.clearTimeout(dragSession.timer);
      pagePointerId = null;
      panSession = null;
      const point = toScenePoint(dragSession);
      dragSession.grabOffset = { x: positions[dragSession.id].x - point.x, y: positions[dragSession.id].y - point.y };
      try { dragSession.target.setPointerCapture(dragSession.pointerId); } catch { /* Synthetic QA pointers do not own capture. */ }
      dragSession.target.closest<HTMLElement>(".character-anchor")?.classList.add("is-grabbed");
      scene.classList.add("is-character-dragging");
      renderScaleMultiplier[dragSession.id] = 1.03;
      controllers[dragSession.id].beginDrag();
      edgeLastTime = performance.now();
      edgeFrame = window.requestAnimationFrame(autoPan);
      renderInteractionDebug();
    };
    const finishDrag = (event: PointerEvent) => {
      if (!dragSession || event.pointerId !== dragSession.pointerId) return;
      window.clearTimeout(dragSession.timer);
      if (dragSession.active) {
        window.cancelAnimationFrame(edgeFrame);
        // Cancellation/lost capture is not a drop at an arbitrary browser coordinate.
        const result = controllers[dragSession.id].endDrag(event.type === "pointercancel" || event.type === "lostpointercapture" ? positions[dragSession.id] : dragPoint(event));
        stageElement.dataset[`${dragSession.id}LastDrop`] = result.activity ? "activity" : result.snapped ? "snapped" : "valid";
        stageElement.dataset[`${dragSession.id}LastActivity`] = result.activityZoneId ?? "none";
        renderScaleMultiplier[dragSession.id] = 1;
        dragSession.target.closest<HTMLElement>(".character-anchor")?.classList.remove("is-grabbed");
        scene.classList.remove("is-character-dragging");
      }
      const finished = dragSession;
      dragSession = null;
      if (finished.target.hasPointerCapture(finished.pointerId)) finished.target.releasePointerCapture(finished.pointerId);
      renderInteractionDebug();
    };

    for (const id of ["gorani", "daramji"] as const) {
      const target = scene.querySelector<HTMLElement>(`#${id}-drag-target`);
      if (!target) continue;
      const contextMenu = (event: Event) => event.preventDefault();
      const pointerDown = (event: PointerEvent) => {
        if (!event.isPrimary || dragSession || panSession || (event.pointerType === "mouse" && event.button !== 0)) return;
        event.stopPropagation();
        pagePointerId = null;
        lastPointerType = event.pointerType;
        movementDistance = 0;
        dragSession = { id, pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, clientX: event.clientX, clientY: event.clientY, grabOffset: { x: 0, y: 0 }, active: false, timer: 0, startedAt: performance.now(), target };
        // Capture the press, not just the eventual drag. Moving sprites and
        // finger jitter must not change the target while the timer is pending.
        try { target.setPointerCapture(event.pointerId); } catch { /* Untrusted QA pointer. */ }
        if (event.pointerType === "touch") dragSession.timer = window.setTimeout(activateDrag, BEHAVIOR_CONFIG.longPressMs);
        else activateDrag();
        renderInteractionDebug();
      };
      const pointerMove = (event: PointerEvent) => {
        if (!dragSession || event.pointerId !== dragSession.pointerId) return;
        dragSession.clientX = event.clientX;
        dragSession.clientY = event.clientY;
        const distance = Math.hypot(event.clientX - dragSession.startX, event.clientY - dragSession.startY);
        movementDistance = distance;
        if (!dragSession.active && dragSession.pointerType !== "touch" && distance >= BEHAVIOR_CONFIG.dragMoveThresholdPx) activateDrag();
        if (!dragSession.active && dragSession.pointerType === "touch" && distance > TOUCH_SLOP_PX) {
          const pending = dragSession;
          window.clearTimeout(pending.timer);
          const intent = resolveGestureIntent(event.clientX - pending.startX, event.clientY - pending.startY);
          dragSession = null;
          if (intent === "horizontal") panSession = { pointerId: event.pointerId, startX: pending.startX, startY: pending.startY, cameraX: cameraRef.current.x, intent };
          else pagePointerId = event.pointerId;
          if (pending.target.hasPointerCapture(event.pointerId)) pending.target.releasePointerCapture(event.pointerId);
          renderInteractionDebug();
          return;
        }
        if (!dragSession?.active) return;
        event.preventDefault();
        controllers[dragSession.id].updateDrag(dragPoint(event));
        renderInteractionDebug();
      };
      // Pointer capture cannot veto browser scrolling. Use a target-scoped,
      // explicitly non-passive touch listener while the press/drag owns input.
      // Early intentional movement is released by pointerMove before touchMove.
      const touchMove = (event: TouchEvent) => {
        if (dragSession?.target === target && event.touches.length === 1 && event.cancelable) event.preventDefault();
      };
      const suppressClick = (event: MouseEvent) => { if (event.detail !== 0) event.preventDefault(); };
      target.addEventListener("contextmenu", contextMenu);
      target.addEventListener("click", suppressClick);
      target.addEventListener("touchmove", touchMove, { passive: false });
      target.addEventListener("pointerdown", pointerDown);
      window.addEventListener("pointermove", pointerMove, { passive: false });
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
      target.addEventListener("lostpointercapture", finishDrag);
      cleanupListeners.push(() => {
        target.removeEventListener("contextmenu", contextMenu);
        target.removeEventListener("click", suppressClick);
        target.removeEventListener("touchmove", touchMove);
        target.removeEventListener("pointerdown", pointerDown);
        window.removeEventListener("pointermove", pointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
        target.removeEventListener("lostpointercapture", finishDrag);
      });
    }

    const panDown = (event: PointerEvent) => {
      if (!event.isPrimary || dragSession || panSession || (event.pointerType === "mouse" && event.button !== 0)) return;
      pagePointerId = null;
      lastPointerType = event.pointerType;
      panSession = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX: cameraRef.current.x, intent: "pending" };
    };
    const panMove = (event: PointerEvent) => {
      if (!panSession || panSession.pointerId !== event.pointerId || dragSession?.active) return;
      const dx = event.clientX - panSession.startX, dy = event.clientY - panSession.startY;
      movementDistance = Math.hypot(dx, dy);
      panSession.intent = resolveGestureIntent(dx, dy, panSession.intent);
      scene.dataset.gestureIntent = panSession.intent;
      renderInteractionDebug();
      if (panSession.intent !== "horizontal") return;
      event.preventDefault();
      try { scene.setPointerCapture(event.pointerId); } catch { /* Untrusted QA pointer. */ }
      setCameraX(panSession.cameraX - dx);
    };
    const panEnd = (event: PointerEvent) => {
      if (pagePointerId === event.pointerId) pagePointerId = null;
      renderInteractionDebug();
      if (panSession?.pointerId !== event.pointerId) return;
      panSession = null;
      if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
      renderInteractionDebug();
    };
    scene.addEventListener("pointerdown", panDown);
    window.addEventListener("pointermove", panMove, { passive: false });
    window.addEventListener("pointerup", panEnd);
    window.addEventListener("pointercancel", panEnd);
    scene.addEventListener("lostpointercapture", panEnd);
    cleanupListeners.push(() => {
      scene.removeEventListener("pointerdown", panDown);
      window.removeEventListener("pointermove", panMove);
      window.removeEventListener("pointerup", panEnd);
      window.removeEventListener("pointercancel", panEnd);
      scene.removeEventListener("lostpointercapture", panEnd);
    });
    renderInteractionDebug();

    void SpineStage.create({
      container: stageElement,
      mode: "pair",
      actors: (["gorani", "daramji"] as const).map((id) => ({ id, state: states[id], placement: () => worldPlacement(id) })),
      boneObservers: (["gorani", "daramji"] as const).map((id) => ({ actorId: id, boneName: FISHING_VISUAL_CONFIG[id].handBone, point: FISHING_VISUAL_CONFIG[id].handPoint, onUpdate: (hand: BoneScreenPoint) => updateFishingVisual(id, hand) })),
      onError: () => setCharacterError(true),
      onContextRestored: () => setRuntimeVersion((version) => version + 1),
      signal: initialization.signal,
    }).then((createdStage) => {
      if (cancelled) {
        createdStage.dispose();
        return;
      }
      stage = createdStage;
      stageElement.dataset.ready = "true";
      controllers.gorani.start();
      controllers.daramji.start();
    }).catch((error: unknown) => {
      if (cancelled) return;
      stageElement.dataset.ready = "false";
      setCharacterError(true);
      if (process.env.NODE_ENV !== "production") console.warn("[Money Level] Spine initialization failed", error);
    });

    interactionTimer = window.setInterval(() => {
      if (document.hidden) return;
      const distance = Math.hypot(positions.gorani.x - positions.daramji.x, positions.gorani.y - positions.daramji.y);
      if (distance < 18 && Math.random() < BEHAVIOR_CONFIG.interactionChance) {
        controllers.gorani.triggerInteraction();
        controllers.daramji.triggerInteraction();
      }
    }, 18_000);

    if (process.env.NODE_ENV !== "production") {
      window.__MONEY_LEVEL_DEBUG__ = {
        activeRuntimeCount: () => activeRuntimeCount,
        camera: () => ({ ...cameraRef.current }),
        startFishing: () => controllers.gorani.startActivityAtZone("fishing_dock"),
        startFishingAs: (id) => controllers[id].startActivityAtZone("fishing_dock"),
        startBenchSitting: (id) => controllers[id].startActivityAtZone("bench_slot"),
        dropCharacter: (id, source) => { controllers[id].beginDrag(); controllers[id].endDrag(imagePointToScene(source, mobile() ? "mobile" : "desktop")); },
        startActivity: (id, zone) => controllers[id].startActivityAtZone(zone),
        ceremonyOwners: () => activities.getCeremonyOwners(),
        startPondWatch: () => controllers.daramji.startActivityAtZone("pond_watch"),
        triggerMove: () => { controllers.gorani.triggerMove(); controllers.daramji.triggerMove(); },
        state: () => ({
          gorani: { animation: states.gorani.animation, accessory: states.gorani.hat || states.gorani.face || "none", position: { ...positions.gorani }, phase: controllers.gorani.getPhase(), waypoint: controllers.gorani.getWaypointId(), activityZone: controllers.gorani.getActivityZoneId() },
          daramji: { animation: states.daramji.animation, accessory: states.daramji.hat || states.daramji.face || "none", position: { ...positions.daramji }, phase: controllers.daramji.getPhase(), waypoint: controllers.daramji.getWaypointId(), activityZone: controllers.daramji.getActivityZoneId() },
        }),
      };
    }

    return () => {
      cancelled = true;
      refreshStatuesRef.current = null;
      reprojectCharactersRef.current = null;
      initialization.abort();
      window.clearInterval(interactionTimer);
      if (dragSession) window.clearTimeout(dragSession.timer);
      window.cancelAnimationFrame(edgeFrame);
      scene.classList.remove("is-character-dragging");
      cleanupListeners.forEach((cleanup) => cleanup());
      if (dragSession) {
        dragSession.target.closest<HTMLElement>(".character-anchor")?.classList.remove("is-grabbed");
        if (dragSession.target.hasPointerCapture(dragSession.pointerId)) dragSession.target.releasePointerCapture(dragSession.pointerId);
      }
      if (panSession && scene.hasPointerCapture(panSession.pointerId)) scene.releasePointerCapture(panSession.pointerId);
      controllers.gorani.stop();
      controllers.daramji.stop();
      stage?.dispose();
      activeRuntimeCount = Math.max(0, activeRuntimeCount - 1);
      if (activeRuntimeCount > 0) stageElement.dataset.activeRuntimeCount = String(activeRuntimeCount);
      else delete stageElement.dataset.activeRuntimeCount;
      if (process.env.NODE_ENV !== "production" && window.__MONEY_LEVEL_DEBUG__?.activeRuntimeCount() === 0) {
        delete window.__MONEY_LEVEL_DEBUG__;
      }
    };
  }, [previewOverridesEnabled, runtimeVersion]);

  useEffect(() => {
    const lightning = sceneRef.current?.querySelector<HTMLElement>(".lightning-layer");
    if (weather !== "thunderstorm" || !ambientEnabled || !lightning || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let flashTimer = 0;
    let resetTimer = 0;
    let cancelled = false;
    const schedule = () => {
      flashTimer = window.setTimeout(() => {
        if (cancelled) return;
        lightning.dataset.flashCount = String(Number(lightning.dataset.flashCount ?? "0") + 1);
        lightning.classList.add("is-flashing");
        resetTimer = window.setTimeout(() => {
          lightning.classList.remove("is-flashing");
          schedule();
        }, 1_050);
      }, 18_000 + Math.random() * 20_000);
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(flashTimer);
      window.clearTimeout(resetTimer);
      lightning.classList.remove("is-flashing");
    };
  }, [ambientEnabled, weather]);

  const statuePlacements = {
    left: statueSlotPlacement("left", sceneSize, sceneSize.mobile),
    right: statueSlotPlacement("right", sceneSize, sceneSize.mobile),
  };
  const objectLighting = getWorldObjectLighting(timeOfDay, weather);
  const houseAmbient = getHouseAmbientLighting(timeOfDay, weather);
  const ambientOpacity = houseAmbientEnabled ? houseAmbient.opacity : 0;
  const nightAmbient = houseAmbientEnabled ? houseAmbient.night : null;
  const brokerageHouseAsset = resolveForestHouseAsset(season, brokerageStage.art);
  const taxHouseAsset = resolveForestHouseAsset(season, taxStage.art);
  const worldObjectStyle = {
    "--money-level-house-lighting": `${objectLighting.house.filter} url(#${lightingFilterId})`,
    "--money-level-statue-lighting": `${objectLighting.statue.filter} url(#${lightingFilterId}-statue)`,
  } as CSSProperties;

  return (
    <section ref={sceneRef} className="forest-scene" data-ambient={ambientEnabled ? "on" : "off"} data-special-event={specialEvent} aria-label="고라니와 다람쥐가 사는 숲">
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <filter id={lightingFilterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feColorMatrix type="matrix" values={objectLighting.house.colorMatrix} result="houseBase" />
            {nightAmbient ? <>
              {/* Blend opaque working colors, then restore SourceAlpha ONCE.
                  Native source-over blends of two translucent copies expand
                  alpha (2A-A²); this keeps every original edge pixel intact. */}
              <feComponentTransfer in="houseBase" result="opaqueBase"><feFuncA type="table" tableValues="1 1" /></feComponentTransfer>
              <feFlood floodColor={houseAmbient.color} result="shadowColor" />
              <feComposite in="opaqueBase" in2="shadowColor" operator="arithmetic" k1="1" result="shadowSurface" />
              <feComposite in="opaqueBase" in2="shadowSurface" operator="arithmetic" k2={1 - ambientOpacity} k3={ambientOpacity} result="nightShadow" />
              <feFlood floodColor={nightAmbient.color} result="moonlightColor" />
              <feBlend in="moonlightColor" in2="nightShadow" mode={nightAmbient.blendMode} result="moonlitSurface" />
              <feComposite in="nightShadow" in2="moonlitSurface" operator="arithmetic" k2={1 - nightAmbient.opacity} k3={nightAmbient.opacity} result="nightColor" />
              <feComponentTransfer in="nightColor" result="crispNight">
                <feFuncR type="linear" slope={nightAmbient.contrast} intercept={(1 - nightAmbient.contrast) / 2} />
                <feFuncG type="linear" slope={nightAmbient.contrast} intercept={(1 - nightAmbient.contrast) / 2} />
                <feFuncB type="linear" slope={nightAmbient.contrast} intercept={(1 - nightAmbient.contrast) / 2} />
              </feComponentTransfer>
              {/* Generic warm/highlight mask protects existing practical lights;
                  no per-asset window coordinates or painted masks. */}
              <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 -1 -1 0 -0.12" result="warmPixels" />
              <feComponentTransfer in="warmPixels" result="practicalMask"><feFuncA type="linear" slope={nightAmbient.practicalLightProtection} /></feComponentTransfer>
              <feComponentTransfer in="SourceGraphic" result="opaquePractical"><feFuncA type="table" tableValues="1 1" /></feComponentTransfer>
              <feComposite in="opaquePractical" in2="practicalMask" operator="in" result="practicalLight" />
              <feComposite in="practicalLight" in2="crispNight" operator="over" result="litNight" />
              <feComposite in="litNight" in2="SourceAlpha" operator="in" />
            </> : <>
            <feFlood floodColor={houseAmbient.color} result="ambientColor" />
            {/* Multiply premultiplied source by opaque illumination: alpha A×1
                stays A, transparent RGB stays zero, and black ink cannot lift.
                Interpolate two equal-alpha surfaces, avoiding source-over halos. */}
            <feComposite in="houseBase" in2="ambientColor" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="ambientSurface" />
            <feComposite in="houseBase" in2="ambientSurface" operator="arithmetic" k1="0" k2={1 - ambientOpacity} k3={ambientOpacity} k4="0" />
            </>}
          </filter>
          <filter id={`${lightingFilterId}-statue`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values={objectLighting.statue.colorMatrix} /></filter>
        </defs>
      </svg>
      <div className="scene-world" style={worldObjectStyle}>
        <WeatherBackground season={season} timeOfDay={timeOfDay} weather={weather} />
        {ambientEnabled ? <div className="pond-shimmer-layer ambient-motion-layer" aria-hidden="true" /> : null}
        <div className="house-place brokerage-house"><HouseVisual kind="brokerage" stage={brokerageStage} sceneSize={sceneSize} asset={brokerageHouseAsset} /></div>
        <div className="house-place tax-house"><HouseVisual kind="tax" stage={taxStage} sceneSize={sceneSize} asset={taxHouseAsset} /></div>
        {(["left", "right"] as const).map((slot) => {
          const statue = slot === "left" ? leftStatue : rightStatue;
          if (statue === "none") return null;
          const placement = statuePlacements[slot];
          return <img key={slot} className="forest-statue" data-statue-slot={slot} src={`/money-level/art/statues/${statue}.png`} alt={`${slot === "left" ? "왼쪽" : "오른쪽"} 받침대의 곰 조각상`} style={{ left: placement.x, top: placement.y, "--statue-width": `${placement.width}px` } as CSSProperties} draggable={false} />;
        })}
        <div className="character-ground-layer" aria-hidden="true">
          <CharacterAnchor id="gorani" layer="shadow" /><CharacterAnchor id="daramji" layer="shadow" />
        </div>
      </div>
      {ambientEnabled && specialEvent === "payday-leaf-shower" ? <PaydayLeafShower layer="far" count={48} /> : null}
      {/* Render only the camera viewport, not a translated/clipped full-world canvas. */}
      <div ref={stageRef} className="spine-forest-stage" data-runtime-version={runtimeVersion} />
      <div className="scene-activity-layer" aria-hidden="true">
        <span className="pond-activity fishing-activity" hidden>
          <img className="fishing-rod" src="/money-level/art/props/fishing-rod.webp" alt="" draggable={false} />
          <i className="fishing-line" /><b className="fishing-bobber" />
        </span>
      </div>
      <div className="practical-lighting-layer" aria-hidden="true" />
      {ambientEnabled ? <div className="sky-drift-layer ambient-motion-layer" aria-hidden="true" /> : null}
      {characterError ? <p className="character-fallback" role="status">캐릭터 표시를 불러오지 못했어요.</p> : null}
      <div className="character-interaction-layer">
        <CharacterAnchor id="gorani" layer="hit" /><CharacterAnchor id="daramji" layer="hit" />
      </div>
      {ambientEnabled ? <>
        <div className={`wind-layer wind-${specialEvent === "normal-windy" ? "breeze" : resolveMoneyLevelWindIntensity(weather)} ambient-motion-layer`} aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}
        </div>
        {specialEvent === "payday-leaf-shower" ? <PaydayLeafShower layer="front" count={72} /> : null}
        <div className="rain-layer ambient-motion-layer" aria-hidden="true">{Array.from({ length: 72 }, (_, index) => <i key={index} className={`rain-depth-${index % 3}`} style={rainDropStyle(index)} />)}</div>
        <div className="pond-ripple-layer ambient-motion-layer" aria-hidden="true">{POND_RIPPLES.map((ripple, index) => <i key={index} style={rippleStyle(ripple, index)} />)}</div>
        <div className="lightning-layer ambient-motion-layer" aria-hidden="true" />
      </> : null}
      <div className="scene-label-layer">
        <HouseLabel kind="brokerage" text={brokerageText} value={brokerageValue} displayLevel={brokerageLevel} sceneSize={sceneSize} visualFrame={brokerageHouseAsset?.visualFrame} />
        <HouseLabel kind="tax" text={taxText} value={taxValue} displayLevel={taxLevel} sceneSize={sceneSize} visualFrame={taxHouseAsset?.visualFrame} />
      </div>
      <div className="scene-weather"><span>{weatherIcon(weather)}</span><b>{weatherLabel(weather)}</b><small>{timeLabel(timeOfDay)}</small></div>
      <p className="forest-phrase">{phrase}</p>
    </section>
  );
}

function WeatherBackground({ season, timeOfDay, weather }: { season: MoneyLevelSeason; timeOfDay: MoneyLevelTimeOfDay; weather: MoneyLevelSceneWeather }) {
  const requestedSrc = resolveForestBackground(season, timeOfDay, weather);
  const activeSrcRef = useRef(requestedSrc);
  const transitionTimerRef = useRef(0);
  const frameRef = useRef(0);
  const [activeSrc, setActiveSrc] = useState(requestedSrc);
  const [previousSrc, setPreviousSrc] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    if (requestedSrc === activeSrcRef.current) return;
    let cancelled = false;
    const preload = new Image();
    preload.decoding = "async";
    preload.onload = () => {
      if (cancelled) return;
      window.clearTimeout(transitionTimerRef.current);
      window.cancelAnimationFrame(frameRef.current);
      setPreviousSrc(activeSrcRef.current);
      activeSrcRef.current = requestedSrc;
      setActiveSrc(requestedSrc);
      setRevealed(false);
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = window.requestAnimationFrame(() => setRevealed(true));
      });
      transitionTimerRef.current = window.setTimeout(() => setPreviousSrc(null), BACKGROUND_CROSSFADE_MS);
    };
    preload.src = requestedSrc;
    return () => {
      cancelled = true;
      preload.onload = null;
    };
  }, [requestedSrc]);

  useEffect(() => () => {
    window.clearTimeout(transitionTimerRef.current);
    window.cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className="scene-illustration" aria-hidden="true" data-background-src={activeSrc}>
      {previousSrc ? <img className={`scene-background scene-background-previous${revealed ? " is-hidden" : ""}`} src={previousSrc} alt="" draggable={false} /> : null}
      <img className={`scene-background scene-background-current${previousSrc && !revealed ? " is-entering" : ""}`} src={activeSrc} alt={FOREST_SCENE.background.alt} draggable={false} />
    </div>
  );
}

function PaydayLeafShower({ layer, count }: { layer: "far" | "front"; count: number }) {
  return (
    <div
      className={`payday-leaf-shower payday-leaf-shower-${layer} ambient-motion-layer`}
      data-leaf-count={count}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => <i key={index} style={paydayLeafStyle(index, layer)} />)}
    </div>
  );
}

function paydayLeafStyle(index: number, layer: "far" | "front"): CSSProperties {
  const front = layer === "front";
  const seed = index + (front ? 47 : 3);
  const size = (front ? 19 : 12) + (seed * 7 % (front ? 13 : 9));
  const speed = (front ? 9.2 : 14.5) + (seed * 13 % 55) / 10;
  const turn = 520 + (seed * 47 % 620);
  const sway = -34 + (seed * 19 % 69);
  const palette = front
    ? ["#6bbd3f", "#a7da4f", "#43a946", "#c6e95c", "#55c05d"]
    : ["#86c94f", "#b9e269", "#61b64f", "#9fd45a"];
  return {
    "--payday-leaf-x": `${-4 + (seed * 37 + index * 11) % 109}%`,
    "--payday-leaf-size": `${size}px`,
    "--payday-leaf-speed": `${speed.toFixed(1)}s`,
    "--payday-leaf-delay": `${-((seed * 2.73) % speed).toFixed(2)}s`,
    "--payday-leaf-color": palette[seed % palette.length],
    "--payday-leaf-sway-a": `${Math.round(sway * -.7)}px`,
    "--payday-leaf-sway-b": `${sway}px`,
    "--payday-leaf-sway-c": `${Math.round(sway * -.45)}px`,
    "--payday-leaf-sway-end": `${Math.round(sway * .65)}px`,
    "--payday-leaf-turn-a": `${Math.round(turn * .28)}deg`,
    "--payday-leaf-turn-b": `${Math.round(turn * .55)}deg`,
    "--payday-leaf-turn-c": `${Math.round(turn * .82)}deg`,
    "--payday-leaf-turn": `${turn}deg`,
    "--payday-leaf-opacity": front ? (.82 + (seed % 4) * .05).toFixed(2) : (.6 + (seed % 4) * .06).toFixed(2),
  } as CSSProperties;
}

const POND_RIPPLES = [
  { x: 62, y: 77, mobileX: 67, mobileY: 77, size: 16 },
  { x: 74, y: 70, mobileX: 82, mobileY: 70, size: 21 },
  { x: 86, y: 79, mobileX: 91, mobileY: 80, size: 14 },
  { x: 93, y: 72, mobileX: 96, mobileY: 72, size: 19 },
  { x: 79, y: 91, mobileX: 85, mobileY: 91, size: 17 },
  { x: 95, y: 89, mobileX: 97, mobileY: 90, size: 13 },
  { x: 68, y: 88, mobileX: 74, mobileY: 87, size: 12 },
  { x: 88, y: 94, mobileX: 92, mobileY: 94, size: 18 },
] as const;

function rainDropStyle(index: number): CSSProperties {
  const speed = 1.55 + (index % 7) * 0.14;
  return {
    "--rain-x": `${(index * 37 + 11) % 101}%`,
    "--rain-delay": `${-((index * 0.317) % 4.1).toFixed(3)}s`,
    "--rain-speed": `${speed.toFixed(2)}s`,
    "--storm-rain-speed": `${(speed * 0.76).toFixed(2)}s`,
    "--rain-angle": `${8 + (index % 5) * 1.2}deg`,
  } as CSSProperties;
}

function rippleStyle(ripple: (typeof POND_RIPPLES)[number], index: number): CSSProperties {
  const speed = 7.2 + (index % 4) * 1.05;
  return {
    "--ripple-x": `${ripple.x}%`, "--ripple-y": `${ripple.y}%`,
    "--ripple-mobile-x": `${ripple.mobileX}%`, "--ripple-mobile-y": `${ripple.mobileY}%`,
    "--ripple-size": `${ripple.size}px`,
    "--ripple-delay": `${-(index * 2.13).toFixed(2)}s`,
    "--ripple-speed": `${speed.toFixed(1)}s`,
    "--storm-ripple-speed": `${(speed * 0.7).toFixed(1)}s`,
  } as CSSProperties;
}

function HouseVisual({ kind, stage, sceneSize, asset }: { kind: "brokerage" | "tax"; stage: MoneyLevelHouseStage; sceneSize: { width: number; height: number; mobile: boolean }; asset: SceneAsset | null }) {
  const family = HOUSE_ART_FAMILY[stage.art];
  if (!asset) return null;
  const placement = resolveHouseVisualFrame(houseWorldToViewport(kind, sceneSize, sceneSize.mobile), asset.visualFrame);
  const composite = asset.composite ?? "masked";
  const style = {
    "--house-x": `${placement.x}px`, "--house-y": `${placement.y}px`, "--house-width": `${placement.width}px`,
  } as CSSProperties;
  return (
    <article className={`house-card house-${kind} house-family-${family} house-composite-${composite}`} style={style} data-level={stage.level} data-art={stage.art} data-asset-src={asset.src} data-composite={composite} aria-label={`${kind === "brokerage" ? "위탁" : "절세"} 집, ${stage.label}`}>
      <img className="house-art-image" src={asset.src} alt={asset.alt} draggable={false} />
    </article>
  );
}

function HouseLabel({ kind, text, value, displayLevel, sceneSize, visualFrame }: { kind: "brokerage" | "tax"; text: string; value: number; displayLevel: number; sceneSize: { width: number; height: number; mobile: boolean }; visualFrame?: HouseVisualFrame }) {
  const title = kind === "brokerage" ? "위탁 집" : "절세 집";
  const point = kind === "brokerage" ? brokerageHouseLabelPoint(sceneSize, sceneSize.mobile, visualFrame) : taxHouseLabelPoint(sceneSize, sceneSize.mobile, 0, visualFrame);
  const half = 96;
  const rawX = projectForestPoint(TAX_LABEL_WORLD, sceneSize, sceneSize.mobile).x;
  // Clamp AFTER camera translation, then compensate the parent's transform.
  const style = { left: kind === "tax" ? `calc(clamp(${half}px, calc(${rawX}px + var(--forest-camera-translation, 0px)), calc(100% - ${half}px)) - var(--forest-camera-translation, 0px))` : point.x, top: point.y };
  return <div className={`house-label house-label-${kind}`} style={style} data-house-label={kind} aria-label={`${title} 정보`}><div className="house-label-content"><p><span className="house-leaf" aria-hidden="true">♧</span><span>{title}</span><small title="월 현금흐름 하트 기준 레벨">Lv.{displayLevel}</small><b>{(value / 100_000_000).toFixed(1)}억원</b></p><strong>{text}</strong></div></div>;
}

function CharacterAnchor({ id, layer }: { id: CharacterId; layer: "shadow" | "hit" }) {
  const bounds = CHARACTER_CONFIG[id].interactionBounds;
  if (layer === "shadow") return <span className="character-anchor character-shadow-anchor" data-character-anchor={id}><i className="character-contact-shadow" /></span>;
  const style = { "--hit-width": `${bounds.widthPx}px`, "--hit-height": `${bounds.heightPx}px`, "--hit-mobile-width": `${bounds.mobileWidthPx}px`, "--hit-mobile-height": `${bounds.mobileHeightPx}px` } as CSSProperties;
  return <span className="character-anchor character-hit-anchor" data-character-anchor={id}><span className="character-hit-target" id={`${id}-drag-target`} role="button" aria-label={`${id === "gorani" ? "고라니" : "다람쥐"} 옮기기`} tabIndex={0} style={style} /></span>;
}

function weatherLabel(value: MoneyLevelSceneWeather): string { return ({ sunny: "맑음", cloudy: "흐림", rain: "비", thunderstorm: "천둥번개", snow: "눈" } as const)[value]; }
function weatherIcon(value: MoneyLevelSceneWeather): string { return ({ sunny: "☀", cloudy: "☁", rain: "☂", thunderstorm: "ϟ", snow: "❄" } as const)[value]; }
function timeLabel(value: MoneyLevelTimeOfDay): string { return ({ morning: "아침", day: "낮", evening: "저녁", night: "밤" } as const)[value]; }
