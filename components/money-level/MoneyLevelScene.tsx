"use client";
/* eslint-disable @next/next/no-img-element -- approved art renditions intentionally keep the existing scene loading path */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MoneyLevelHouseStage } from "@/lib/money-level/house-stages";
import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "@/lib/money-level/types";
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
import { FISHING_VISUAL_CONFIG, type SemanticActivityZone } from "@/lib/money-level/forest/activity-zones";
import { perspectiveScale, type ScenePoint } from "@/lib/money-level/forest/navigation";
import { FOREST_SCENE, HOUSE_ART_FAMILY, resolveForestBackground } from "@/lib/money-level/forest/scene-config";
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
      state: () => Record<CharacterId, DebugCharacterState>;
      startFishing: () => boolean;
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
  phrase: string;
}) {
  const sceneRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const [characterError, setCharacterError] = useState(false);

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
        }, 480);
      }, 18_000 + Math.random() * 20_000);
    };
    scheduleLightning();

    const worldPlacement = (id: CharacterId) => {
      const viewportHeight = 270;
      const viewportWidth = viewportHeight * (Math.max(scene.clientWidth, 1) / Math.max(scene.clientHeight, 1));
      const bottom = 103 - viewportHeight / 2;
      const position = positions[id];
      return {
        x: (position.x / 100 - 0.5) * viewportWidth,
        y: bottom + (1 - position.y / 100) * viewportHeight,
        scale: CHARACTER_CONFIG[id].scale * (mobile() ? 0.72 : 1) * perspectiveScale(position.y) * renderScaleMultiplier[id],
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
      if (id === "gorani") {
        const activity = scene.querySelector<HTMLElement>(".fishing-activity");
        if (activity) activity.hidden = phase !== "fishing";
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
        onChange: (position, phase) => {
          positions[id] = { ...position };
          updateCharacterDom(id, position, phase);
        },
      });
    }

    const updateFishingVisual = (hand: BoneScreenPoint) => {
      const activity = scene.querySelector<HTMLElement>(".fishing-activity");
      const rod = scene.querySelector<HTMLImageElement>(".fishing-rod");
      const line = scene.querySelector<HTMLElement>(".fishing-line");
      const bobber = scene.querySelector<HTMLElement>(".fishing-bobber");
      if (!activity || !rod || !line || !bobber || activity.hidden || controllers.gorani.getPhase() !== "fishing") return;
      const layout = mobile() ? "mobile" : "desktop";
      const size = FISHING_VISUAL_CONFIG.rodSizePx[layout];
      const direction = hand.flipped ? 1 : -1;
      const angle = direction * 2;
      const radians = angle * Math.PI / 180;
      const handle = { x: size * 0.16, y: size * 0.84 };
      const localTip = { x: direction * (size * 0.92 - handle.x), y: size * 0.11 - handle.y };
      const tip = {
        x: hand.x + localTip.x * Math.cos(radians) - localTip.y * Math.sin(radians),
        y: hand.y + localTip.x * Math.sin(radians) + localTip.y * Math.cos(radians),
      };
      const bobberPoint = FISHING_VISUAL_CONFIG.bobber[layout];
      const target = { x: scene.clientWidth * bobberPoint.x / 100, y: scene.clientHeight * bobberPoint.y / 100 };
      const lineDx = target.x - tip.x;
      const lineDy = target.y - tip.y;
      activity.dataset.handBone = FISHING_VISUAL_CONFIG.handBone;
      activity.dataset.attached = "true";
      rod.style.left = `${hand.x - handle.x}px`;
      rod.style.top = `${hand.y - handle.y}px`;
      rod.style.width = `${size}px`;
      rod.style.height = `${size}px`;
      rod.style.transformOrigin = `${handle.x}px ${handle.y}px`;
      rod.style.transform = `rotate(${angle}deg) scaleX(${direction})`;
      line.style.left = `${tip.x}px`;
      line.style.top = `${tip.y}px`;
      line.style.height = `${Math.hypot(lineDx, lineDy)}px`;
      line.style.transform = `rotate(${Math.atan2(lineDx, lineDy) * 180 / Math.PI}deg)`;
      bobber.style.left = `${target.x}px`;
      bobber.style.top = `${target.y}px`;
    };

    type DragSession = {
      id: CharacterId;
      pointerId: number;
      pointerType: string;
      startX: number;
      startY: number;
      active: boolean;
      timer: number;
      target: HTMLElement;
    };
    let dragSession: DragSession | null = null;
    const toScenePoint = (event: PointerEvent): ScenePoint => {
      const bounds = scene.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) / bounds.width) * 100,
        y: ((event.clientY - bounds.top) / bounds.height) * 100,
      };
    };
    const activateDrag = () => {
      if (!dragSession || dragSession.active) return;
      dragSession.active = true;
      try { dragSession.target.setPointerCapture(dragSession.pointerId); } catch { /* Synthetic QA pointers do not own capture. */ }
      dragSession.target.closest<HTMLElement>(".character-anchor")?.classList.add("is-grabbed");
      scene.classList.add("is-character-dragging");
      renderScaleMultiplier[dragSession.id] = 1.03;
      controllers[dragSession.id].beginDrag();
    };
    const finishDrag = (event: PointerEvent) => {
      if (!dragSession || event.pointerId !== dragSession.pointerId) return;
      window.clearTimeout(dragSession.timer);
      if (dragSession.active) {
        const result = controllers[dragSession.id].endDrag(toScenePoint(event));
        stageElement.dataset[`${dragSession.id}LastDrop`] = result.activity ? "activity" : result.snapped ? "snapped" : "valid";
        stageElement.dataset[`${dragSession.id}LastActivity`] = result.activityZoneId ?? "none";
        renderScaleMultiplier[dragSession.id] = 1;
        dragSession.target.closest<HTMLElement>(".character-anchor")?.classList.remove("is-grabbed");
        if (dragSession.target.hasPointerCapture(dragSession.pointerId)) dragSession.target.releasePointerCapture(dragSession.pointerId);
        scene.classList.remove("is-character-dragging");
      }
      dragSession = null;
    };

    for (const id of ["gorani", "daramji"] as const) {
      const target = scene.querySelector<HTMLElement>(`#${id}-drag-target`);
      if (!target) continue;
      const contextMenu = (event: Event) => event.preventDefault();
      const pointerDown = (event: PointerEvent) => {
        if (dragSession || (event.pointerType === "mouse" && event.button !== 0)) return;
        dragSession = { id, pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, active: false, timer: 0, target };
        if (event.pointerType === "touch") dragSession.timer = window.setTimeout(activateDrag, BEHAVIOR_CONFIG.longPressMs);
        else activateDrag();
      };
      const pointerMove = (event: PointerEvent) => {
        if (!dragSession || event.pointerId !== dragSession.pointerId) return;
        const distance = Math.hypot(event.clientX - dragSession.startX, event.clientY - dragSession.startY);
        if (!dragSession.active && dragSession.pointerType !== "touch" && distance >= BEHAVIOR_CONFIG.dragMoveThresholdPx) activateDrag();
        if (!dragSession.active && dragSession.pointerType === "touch" && distance >= BEHAVIOR_CONFIG.dragMoveThresholdPx) {
          window.clearTimeout(dragSession.timer);
          dragSession = null;
          return;
        }
        if (!dragSession?.active) return;
        event.preventDefault();
        controllers[dragSession.id].updateDrag(toScenePoint(event));
      };
      target.addEventListener("contextmenu", contextMenu);
      target.addEventListener("pointerdown", pointerDown);
      target.addEventListener("pointermove", pointerMove);
      target.addEventListener("pointerup", finishDrag);
      target.addEventListener("pointercancel", finishDrag);
      cleanupListeners.push(() => {
        target.removeEventListener("contextmenu", contextMenu);
        target.removeEventListener("pointerdown", pointerDown);
        target.removeEventListener("pointermove", pointerMove);
        target.removeEventListener("pointerup", finishDrag);
        target.removeEventListener("pointercancel", finishDrag);
      });
    }

    void SpineStage.create({
      container: stageElement,
      mode: "pair",
      actors: (["gorani", "daramji"] as const).map((id) => ({ id, state: states[id], placement: () => worldPlacement(id) })),
      boneObservers: [{ actorId: "gorani", boneName: FISHING_VISUAL_CONFIG.handBone, point: FISHING_VISUAL_CONFIG.handPoint, onUpdate: updateFishingVisual }],
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
        startFishing: () => controllers.gorani.startActivityAtZone("fishing_dock"),
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
      cleanupListeners.forEach((cleanup) => cleanup());
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

  return (
    <section ref={sceneRef} className="forest-scene" data-ambient={ambientEnabled ? "on" : "off"} aria-label="고라니와 다람쥐가 사는 숲">
      <div className="scene-world">
        <WeatherBackground timeOfDay={timeOfDay} weather={weather} />
        {ambientEnabled ? <div className="pond-shimmer-layer ambient-motion-layer" aria-hidden="true" /> : null}
        <div className="scene-prop-layer"><SceneProp /></div>
        <div className="house-place brokerage-house"><HouseVisual kind="brokerage" stage={brokerageStage} /></div>
        <div className="house-place tax-house"><HouseVisual kind="tax" stage={taxStage} /></div>
        <div className="character-ground-layer" aria-hidden="true">
          <CharacterAnchor id="gorani" layer="shadow" /><CharacterAnchor id="daramji" layer="shadow" />
        </div>
        <div ref={stageRef} className="spine-forest-stage" data-runtime-version={runtimeVersion} />
        <div className="scene-activity-layer" aria-hidden="true">
          <span className="pond-activity fishing-activity" hidden>
            <img className="fishing-rod" src="/money-level/art/props/fishing-rod.webp" alt="" draggable={false} />
            <i className="fishing-line" /><b className="fishing-bobber" />
          </span>
        </div>
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
        <div className="rain-layer ambient-motion-layer" aria-hidden="true">{Array.from({ length: 48 }, (_, index) => <i key={index} className={`rain-depth-${index % 3}`} style={rainDropStyle(index)} />)}</div>
        <div className="pond-ripple-layer ambient-motion-layer" aria-hidden="true">{POND_RIPPLES.map((ripple, index) => <i key={index} style={rippleStyle(ripple, index)} />)}</div>
        <div className="lightning-layer ambient-motion-layer" aria-hidden="true" />
      </> : null}
      <div className="scene-label-layer">
        <HouseLabel kind="brokerage" stage={brokerageStage} value={brokerageValue} displayLevel={brokerageLevel} />
        <HouseLabel kind="tax" stage={taxStage} value={taxValue} displayLevel={taxLevel} />
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

function SceneProp() {
  const { asset, placement } = FOREST_SCENE.props.dockConnector;
  const style = {
    "--prop-x": `${placement.x}%`, "--prop-y": `${placement.y}%`, "--prop-width": `${placement.width}%`,
    "--prop-mobile-x": `${placement.mobile.x}%`, "--prop-mobile-y": `${placement.mobile.y}%`, "--prop-mobile-width": `${placement.mobile.width}%`,
  } as CSSProperties;
  return <div className="scene-prop dock-connector-art" style={style} aria-hidden="true"><img src={asset.src} alt="" draggable={false} /></div>;
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

function HouseLabel({ kind, stage, value, displayLevel }: { kind: "brokerage" | "tax"; stage: MoneyLevelHouseStage; value: number; displayLevel: number }) {
  const placement = FOREST_SCENE.labelPlacements[kind];
  const title = kind === "brokerage" ? "위탁 집" : "절세 집";
  const style = { "--label-x": `${placement.x}%`, "--label-y": `${placement.y}%`, "--label-mobile-x": `${placement.mobile.x}%`, "--label-mobile-y": `${placement.mobile.y}%` } as CSSProperties;
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
