"use client";
/* eslint-disable @next/next/no-img-element -- approved art renditions intentionally keep the existing scene loading path */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MoneyLevelHouseStage } from "@/lib/money-level/house-stages";
import type { MoneyLevelStatue, MoneyLevelTimeOfDay, MoneyLevelWeather } from "@/lib/money-level/types";
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
import { cameraTranslation, clampCameraX, createForestCamera, edgePanSpeed, resolveGestureIntent, screenToWorld, TOUCH_SLOP_PX, type ForestCamera, type GestureIntent } from "@/lib/money-level/forest/camera";
import { FISHING_VISUAL_CONFIG, fishingRodGeometry, type SemanticActivityZone } from "@/lib/money-level/forest/activity-zones";
import { brokerageLabelPoint, FISHING_BOBBER, fishingLineAngleDeg, projectForestPoint, statueSlotPlacement } from "@/lib/money-level/forest/landmarks";
import { perspectiveScale, setForestSceneViewport, type ScenePoint } from "@/lib/money-level/forest/navigation";
import { FOREST_SCENE, HOUSE_ART_FAMILY, resolveForestBackground } from "@/lib/money-level/forest/scene-config";
import { getWorldObjectLighting } from "@/lib/money-level/forest/world-object-lighting";
import type { CharacterId, CharacterState } from "@/lib/money-level/forest/character-types";
import { resolveMoneyLevelWindIntensity } from "@/lib/money-level/weather";
import { SpineStage, type BoneScreenPoint } from "./runtime/spine-stage";

const MOBILE_BREAKPOINT = 560;
const BACKGROUND_CROSSFADE_MS = 800;
let activeRuntimeCount = 0;

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
  timeOfDay,
  ambientEnabled,
  leftStatue,
  rightStatue,
  phrase,
}: {
  brokerageStage: MoneyLevelHouseStage;
  taxStage: MoneyLevelHouseStage;
  brokerageValue: number;
  taxValue: number;
  brokerageLevel: number;
  taxLevel: number;
  weather: MoneyLevelWeather;
  timeOfDay: MoneyLevelTimeOfDay;
  ambientEnabled: boolean;
  leftStatue: MoneyLevelStatue;
  rightStatue: MoneyLevelStatue;
  phrase: string;
}) {
  const sceneRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(createForestCamera(1320, 520, false));
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const [characterError, setCharacterError] = useState(false);
  const [sceneSize, setSceneSize] = useState({ width: 1320, height: 520, mobile: false });

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
    let lightningTimer = 0;
    let lightningResetTimer = 0;
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

    const lightning = scene.querySelector<HTMLElement>(".lightning-layer");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scheduleLightning = () => {
      if (weather !== "thunderstorm" || !ambientEnabled || reducedMotion || !lightning) return;
      lightningTimer = window.setTimeout(() => {
        lightning.dataset.flashCount = String(Number(lightning.dataset.flashCount ?? "0") + 1);
        lightning.classList.add("is-flashing");
        lightningResetTimer = window.setTimeout(() => {
          lightning.classList.remove("is-flashing");
          scheduleLightning();
        }, 1_050);
      }, 18_000 + Math.random() * 20_000);
    };
    scheduleLightning();

    const worldPlacement = (id: CharacterId) => {
      const viewportHeight = 270;
      const viewportWidth = viewportHeight * (Math.max(scene.clientWidth, 1) / Math.max(scene.clientHeight, 1));
      const bottom = 103 - viewportHeight / 2;
      const position = positions[id];
      return {
        x: (position.x / 100 - 0.5 + cameraTranslation(cameraRef.current) / Math.max(scene.clientWidth, 1)) * viewportWidth,
        y: bottom + (1 - position.y / 100) * viewportHeight,
        scale: CHARACTER_CONFIG[id].scale * (mobile() ? 0.72 : 1) * perspectiveScale(position.y) * renderScaleMultiplier[id],
        scaleY: controllers[id]?.getPhase() === "bench-sit" ? 0.84 : 1,
        flipX: position.facing === "right",
      };
    };

    const updateCharacterDom = (id: CharacterId, position: ActorPosition, phase: CharacterPhase) => {
      for (const anchor of Array.from(scene.querySelectorAll<HTMLElement>(`[data-character-anchor="${id}"]`))) {
        anchor.style.left = `${position.x}%`;
        anchor.style.top = `${position.y}%`;
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
        weather: () => weather,
        mobile,
        activities,
        onChange: (position, phase) => {
          positions[id] = { ...position };
          updateCharacterDom(id, position, phase);
        },
      });
    }

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
      target: HTMLElement;
    };
    let dragSession: DragSession | null = null;
    let panSession: { pointerId: number; startX: number; startY: number; cameraX: number; intent: GestureIntent } | null = null;
    let edgeFrame = 0;
    let edgeLastTime = 0;
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
    };

    for (const id of ["gorani", "daramji"] as const) {
      const target = scene.querySelector<HTMLElement>(`#${id}-drag-target`);
      if (!target) continue;
      const contextMenu = (event: Event) => event.preventDefault();
      const pointerDown = (event: PointerEvent) => {
        if (dragSession || (event.pointerType === "mouse" && event.button !== 0)) return;
        dragSession = { id, pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, clientX: event.clientX, clientY: event.clientY, grabOffset: { x: 0, y: 0 }, active: false, timer: 0, target };
        if (event.pointerType === "touch") dragSession.timer = window.setTimeout(activateDrag, BEHAVIOR_CONFIG.longPressMs);
        else activateDrag();
      };
      const pointerMove = (event: PointerEvent) => {
        if (!dragSession || event.pointerId !== dragSession.pointerId) return;
        dragSession.clientX = event.clientX;
        dragSession.clientY = event.clientY;
        const distance = Math.hypot(event.clientX - dragSession.startX, event.clientY - dragSession.startY);
        if (!dragSession.active && dragSession.pointerType !== "touch" && distance >= BEHAVIOR_CONFIG.dragMoveThresholdPx) activateDrag();
        if (!dragSession.active && dragSession.pointerType === "touch" && distance >= TOUCH_SLOP_PX) {
          window.clearTimeout(dragSession.timer);
          dragSession = null;
          return;
        }
        if (!dragSession?.active) return;
        event.preventDefault();
        controllers[dragSession.id].updateDrag(dragPoint(event));
      };
      target.addEventListener("contextmenu", contextMenu);
      target.addEventListener("pointerdown", pointerDown);
      window.addEventListener("pointermove", pointerMove, { passive: false });
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
      target.addEventListener("lostpointercapture", finishDrag);
      cleanupListeners.push(() => {
        target.removeEventListener("contextmenu", contextMenu);
        target.removeEventListener("pointerdown", pointerDown);
        window.removeEventListener("pointermove", pointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
        target.removeEventListener("lostpointercapture", finishDrag);
      });
    }

    const panDown = (event: PointerEvent) => {
      if (dragSession || panSession || (event.pointerType === "mouse" && event.button !== 0)) return;
      panSession = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX: cameraRef.current.x, intent: "pending" };
    };
    const panMove = (event: PointerEvent) => {
      if (!panSession || panSession.pointerId !== event.pointerId || dragSession?.active) return;
      const dx = event.clientX - panSession.startX, dy = event.clientY - panSession.startY;
      panSession.intent = resolveGestureIntent(dx, dy, panSession.intent);
      scene.dataset.gestureIntent = panSession.intent;
      if (panSession.intent !== "horizontal") return;
      event.preventDefault();
      try { scene.setPointerCapture(event.pointerId); } catch { /* Untrusted QA pointer. */ }
      setCameraX(panSession.cameraX - dx);
    };
    const panEnd = (event: PointerEvent) => {
      if (panSession?.pointerId !== event.pointerId) return;
      panSession = null;
      if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
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
      initialization.abort();
      window.clearInterval(interactionTimer);
      window.clearTimeout(lightningTimer);
      window.clearTimeout(lightningResetTimer);
      lightning?.classList.remove("is-flashing");
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
  }, [ambientEnabled, runtimeVersion, weather]);

  const statuePlacements = {
    left: statueSlotPlacement("left", sceneSize, sceneSize.mobile),
    right: statueSlotPlacement("right", sceneSize, sceneSize.mobile),
  };
  const objectLighting = getWorldObjectLighting(timeOfDay, weather);
  const worldObjectStyle = {
    "--money-level-house-lighting": objectLighting.house.filter,
    "--money-level-statue-lighting": objectLighting.statue.filter,
  } as CSSProperties;

  return (
    <section ref={sceneRef} className="forest-scene" data-ambient={ambientEnabled ? "on" : "off"} aria-label="고라니와 다람쥐가 사는 숲">
      <div className="scene-world" style={worldObjectStyle}>
        <WeatherBackground timeOfDay={timeOfDay} weather={weather} />
        {ambientEnabled ? <div className="pond-shimmer-layer ambient-motion-layer" aria-hidden="true" /> : null}
        <div className="house-place brokerage-house"><HouseVisual kind="brokerage" stage={brokerageStage} /></div>
        <div className="house-place tax-house"><HouseVisual kind="tax" stage={taxStage} /></div>
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
        <div className={`wind-layer wind-${resolveMoneyLevelWindIntensity(weather)} ambient-motion-layer`} aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}
        </div>
        <div className="rain-layer ambient-motion-layer" aria-hidden="true">{Array.from({ length: 72 }, (_, index) => <i key={index} className={`rain-depth-${index % 3}`} style={rainDropStyle(index)} />)}</div>
        <div className="pond-ripple-layer ambient-motion-layer" aria-hidden="true">{POND_RIPPLES.map((ripple, index) => <i key={index} style={rippleStyle(ripple, index)} />)}</div>
        <div className="lightning-layer ambient-motion-layer" aria-hidden="true" />
      </> : null}
      <div className="scene-label-layer">
        <HouseLabel kind="brokerage" stage={brokerageStage} value={brokerageValue} displayLevel={brokerageLevel} sceneSize={sceneSize} />
        <HouseLabel kind="tax" stage={taxStage} value={taxValue} displayLevel={taxLevel} sceneSize={sceneSize} />
      </div>
      <div className="scene-weather"><span>{weatherIcon(weather)}</span><b>{weatherLabel(weather)}</b><small>{timeLabel(timeOfDay)}</small></div>
      <p className="forest-phrase">{phrase}</p>
    </section>
  );
}

function WeatherBackground({ timeOfDay, weather }: { timeOfDay: MoneyLevelTimeOfDay; weather: MoneyLevelWeather }) {
  const requestedSrc = resolveForestBackground(timeOfDay, weather);
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

function HouseVisual({ kind, stage }: { kind: "brokerage" | "tax"; stage: MoneyLevelHouseStage }) {
  const placement = FOREST_SCENE.housePlacements[kind];
  const family = HOUSE_ART_FAMILY[stage.art];
  const accountAssets = FOREST_SCENE.stageAssets[kind] as Partial<Record<MoneyLevelHouseStage["art"], { src: string; alt: string; composite?: "masked" | "alpha" }>>;
  const asset = accountAssets[stage.art] ?? FOREST_SCENE.familyFallbackAssets[kind][family];
  const composite = asset.composite ?? "masked";
  const style = {
    "--house-x": `${placement.x}%`, "--house-y": `${placement.y}%`, "--house-width": `${placement.width}%`,
    "--house-mobile-x": `${placement.mobile.x}%`, "--house-mobile-y": `${placement.mobile.y}%`, "--house-mobile-width": `${placement.mobile.width}%`,
  } as CSSProperties;
  return (
    <article className={`house-card house-${kind} house-family-${family} house-composite-${composite}`} style={style} data-level={stage.level} data-art={stage.art} data-composite={composite} aria-label={`${kind === "brokerage" ? "위탁" : "절세"} 집, ${stage.label}`}>
      <img className="house-art-image" src={asset.src} alt={asset.alt} draggable={false} />
    </article>
  );
}

function HouseLabel({ kind, stage, value, displayLevel, sceneSize }: { kind: "brokerage" | "tax"; stage: MoneyLevelHouseStage; value: number; displayLevel: number; sceneSize: { width: number; height: number; mobile: boolean } }) {
  const title = kind === "brokerage" ? "위탁 집" : "절세 집";
  const placement = FOREST_SCENE.labelPlacements.tax;
  const point = kind === "brokerage" ? brokerageLabelPoint(sceneSize, sceneSize.mobile) : null;
  const style = point
    ? { left: point.x, top: point.y }
    : { "--label-x": `${placement.x}%`, "--label-y": `${placement.y}%`, "--label-mobile-x": `${placement.mobile.x}%`, "--label-mobile-y": `${placement.mobile.y}%` } as CSSProperties;
  return <div className={`house-label house-label-${kind}`} style={style} data-house-label={kind} aria-label={`${title} 정보`}><span className="house-leaf" aria-hidden="true">♧</span><div><p>{title} <small title="월 현금흐름 하트 기준 레벨">Lv.{displayLevel}</small></p><strong>{stage.label}</strong><b>{(value / 100_000_000).toFixed(1)}억원</b></div></div>;
}

function CharacterAnchor({ id, layer }: { id: CharacterId; layer: "shadow" | "hit" }) {
  const bounds = CHARACTER_CONFIG[id].interactionBounds;
  if (layer === "shadow") return <span className="character-anchor character-shadow-anchor" data-character-anchor={id}><i className="character-contact-shadow" /></span>;
  const style = { "--hit-width": `${bounds.widthPx}px`, "--hit-height": `${bounds.heightPx}px`, "--hit-mobile-width": `${bounds.mobileWidthPx}px`, "--hit-mobile-height": `${bounds.mobileHeightPx}px` } as CSSProperties;
  return <span className="character-anchor character-hit-anchor" data-character-anchor={id}><span className="character-hit-target" id={`${id}-drag-target`} role="button" aria-label={`${id === "gorani" ? "고라니" : "다람쥐"} 옮기기`} tabIndex={0} style={style} /></span>;
}

function weatherLabel(value: MoneyLevelWeather): string { return ({ sunny: "맑음", cloudy: "흐림", rain: "비", thunderstorm: "천둥번개" } as const)[value]; }
function weatherIcon(value: MoneyLevelWeather): string { return ({ sunny: "☀", cloudy: "☁", rain: "☂", thunderstorm: "ϟ" } as const)[value]; }
function timeLabel(value: MoneyLevelTimeOfDay): string { return ({ morning: "아침", day: "낮", evening: "저녁", night: "밤" } as const)[value]; }
