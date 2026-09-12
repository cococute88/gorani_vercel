import {
  AnimationState,
  AnimationStateData,
  AssetManager,
  AtlasAttachmentLoader,
  Physics,
  SceneRenderer,
  Skeleton,
  SkeletonJson,
  Vector3,
} from "@esotericsoftware/spine-webgl";
import { ASSET_CATALOG, type MoneyLevelCharacterCatalog } from "@/lib/money-level/forest/asset-catalog";
import type {
  ActorPlacement,
  BoneScreenPoint as BaseBoneScreenPoint,
  CharacterId,
  CharacterState,
} from "@/lib/money-level/forest/character-types";

export type { ActorPlacement, CharacterId, CharacterState } from "@/lib/money-level/forest/character-types";

interface ActorOverlay {
  hat: HTMLImageElement;
  face: HTMLImageElement;
}

interface Actor {
  id: CharacterId;
  catalog: MoneyLevelCharacterCatalog;
  skeleton: Skeleton;
  animationState: AnimationState;
  overlay: ActorOverlay;
  appliedSkin: string;
  appliedAnimation: string;
  appliedLoop: boolean;
  setupHeadAngle: number;
  setupFaceAngle: number;
}

export interface StageActorDefinition {
  id: CharacterId;
  state: CharacterState;
  placement: () => ActorPlacement;
}

export interface BoneScreenPoint extends BaseBoneScreenPoint {
  flipped: boolean;
}

export interface StageBoneObserver {
  actorId: CharacterId;
  boneName: string;
  point?: "origin" | "end";
  onUpdate: (point: BoneScreenPoint) => void;
}

export interface StageOptions {
  container: HTMLElement;
  actors: StageActorDefinition[];
  mode: "single" | "pair";
  zoom?: () => number;
  boneObservers?: readonly StageBoneObserver[];
  onError?: (message: string) => void;
  onContextRestored?: () => void;
  signal?: AbortSignal;
}

export class SpineStage {
  private readonly canvas: HTMLCanvasElement;
  private readonly status: HTMLElement;
  private readonly renderer: SceneRenderer;
  private readonly gl: WebGLRenderingContext;
  private readonly actorDefinitions: StageActorDefinition[];
  private readonly mode: "single" | "pair";
  private readonly zoom: () => number;
  private readonly boneObservers: readonly StageBoneObserver[];
  private readonly onError?: (message: string) => void;
  private readonly onContextRestored?: () => void;
  private readonly resizeObserver: ResizeObserver;
  private assetManager: AssetManager | null = null;
  private actors: Actor[] = [];
  private disposed = false;
  private contextLost = false;
  private rafId: number | null = null;
  private lastFrame = performance.now();

  private constructor(options: StageOptions) {
    this.actorDefinitions = options.actors;
    this.mode = options.mode;
    this.zoom = options.zoom ?? (() => 1);
    this.boneObservers = options.boneObservers ?? [];
    this.onError = options.onError;
    this.onContextRestored = options.onContextRestored;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "spine-canvas";
    this.canvas.setAttribute("aria-label", `${options.mode} Spine preview`);
    this.status = document.createElement("div");
    this.status.className = "stage-status";
    this.status.textContent = "자산 로딩 중…";
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL을 사용할 수 없습니다.");
    this.gl = gl;
    this.renderer = new SceneRenderer(this.canvas, gl, true);
    options.container.append(this.canvas, this.status);
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.resizeObserver = new ResizeObserver(() => this.resizeAndConfigureCamera());
    this.resizeObserver.observe(options.container);
  }

  static async create(options: StageOptions): Promise<SpineStage> {
    const stage = new SpineStage(options);
    const abort = () => stage.dispose();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    try {
      await stage.load();
      if (stage.disposed) throw new Error("SpineStage creation aborted");
      stage.lastFrame = performance.now();
      stage.scheduleFrame();
      return stage;
    } catch (error) {
      stage.dispose();
      throw error;
    } finally {
      options.signal?.removeEventListener("abort", abort);
    }
  }

  private async load(): Promise<void> {
    const manager = new AssetManager(this.gl);
    this.assetManager = manager;
    const uniqueIds = Array.from(new Set(this.actorDefinitions.map(({ id }) => id)));
    for (const id of uniqueIds) {
      const catalog = ASSET_CATALOG[id];
      manager.loadTextureAtlas(catalog.atlas);
      manager.loadJson(catalog.json);
    }
    await manager.loadAll();
    if (this.disposed) return;
    if (manager.hasErrors()) {
      throw new Error(`Spine 자산 로드 실패: ${JSON.stringify(manager.getErrors())}`);
    }

    this.actors = this.actorDefinitions.map((definition) => {
      const catalog = ASSET_CATALOG[definition.id];
      const atlasLoader = new AtlasAttachmentLoader(manager.require(catalog.atlas));
      const skeletonJson = new SkeletonJson(atlasLoader);
      const data = skeletonJson.readSkeletonData(manager.require(catalog.json));
      const skeleton = new Skeleton(data);
      const animationState = new AnimationState(new AnimationStateData(data));
      const overlay = this.createOverlay(definition.id);
      skeleton.setSkinByName(definition.state.skin);
      skeleton.setSlotsToSetupPose();
      animationState.setAnimation(0, definition.state.animation, definition.state.loop);
      skeleton.updateWorldTransform(Physics.update);
      const head = skeleton.findBone(catalog.headBone);
      const face = skeleton.findBone(catalog.faceBone);
      if (!head || !face) throw new Error(`${catalog.label} accessory bone을 찾을 수 없습니다.`);
      return {
        id: definition.id,
        catalog,
        skeleton,
        animationState,
        overlay,
        appliedSkin: definition.state.skin,
        appliedAnimation: definition.state.animation,
        appliedLoop: definition.state.loop,
        setupHeadAngle: head.getWorldRotationX(),
        setupFaceAngle: face.getWorldRotationX(),
      };
    });

    this.status.hidden = true;
  }

  private createOverlay(id: CharacterId): ActorOverlay {
    const make = (category: "hat" | "face") => {
      const image = document.createElement("img");
      image.className = `accessory-overlay accessory-${category}`;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.dataset.debugLabel = `${ASSET_CATALOG[id].label} ${category} accessory`;
      image.draggable = false;
      image.hidden = true;
      image.style.display = "none";
      image.onload = () => {
        const requestedId = image.dataset.requestedAccessoryId;
        const requestedUrl = image.dataset.requestedAccessoryUrl;
        if (!requestedId || !requestedUrl || image.naturalWidth <= 0 || image.currentSrc !== requestedUrl) {
          this.clearAccessoryState(id, category);
          this.clearOverlay(image);
          return;
        }
        image.dataset.loadedAccessoryId = requestedId;
      };
      image.onerror = () => {
        this.clearAccessoryState(id, category);
        this.clearOverlay(image);
      };
      this.canvas.parentElement?.append(image);
      return image;
    };
    return { hat: make("hat"), face: make("face") };
  }

  private clearOverlay(image: HTMLImageElement): void {
    image.hidden = true;
    image.style.display = "none";
    image.removeAttribute("src");
    delete image.dataset.requestedAccessoryId;
    delete image.dataset.requestedAccessoryUrl;
    delete image.dataset.loadedAccessoryId;
  }

  private clearAccessoryState(id: CharacterId, category: "hat" | "face"): void {
    const definition = this.actorDefinitions.find((actor) => actor.id === id);
    if (definition) definition.state[category] = "";
  }

  private readonly frame = (now: number): void => {
    this.rafId = null;
    if (this.disposed || this.contextLost) return;
    if (document.hidden) {
      this.lastFrame = now;
      return;
    }
    try {
      const delta = Math.min((now - this.lastFrame) / 1000, 0.1);
      this.lastFrame = now;
      this.resizeAndConfigureCamera();
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      for (let index = 0; index < this.actors.length; index += 1) {
        this.updateActor(this.actors[index], this.actorDefinitions[index], delta);
      }

      this.renderer.begin();
      for (const actor of this.actors) {
        this.renderer.drawSkeleton(actor.skeleton, true);
      }
      this.renderer.end();

      for (const actor of this.actors) {
        this.updateOverlays(actor);
        this.updateBoneObservers(actor);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.status.hidden = false;
      this.status.textContent = "캐릭터 표시를 불러오지 못했어요.";
      this.onError?.(message);
      return;
    }
    this.scheduleFrame();
  };

  private scheduleFrame(): void {
    if (!this.disposed && !this.contextLost && this.rafId === null) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  private readonly handleVisibilityChange = (): void => {
    this.lastFrame = performance.now();
    if (!document.hidden) this.scheduleFrame();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.status.hidden = false;
    this.status.textContent = "캐릭터 표시를 불러오지 못했어요.";
    this.onError?.("WebGL context lost");
  };

  private readonly handleContextRestored = (): void => {
    if (this.disposed) return;
    this.onContextRestored?.();
  };

  private resizeAndConfigureCamera(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(this.canvas.clientWidth, 1);
    const cssHeight = Math.max(this.canvas.clientHeight, 1);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.mode === "pair") {
      const viewportHeight = 270 / this.zoom();
      this.renderer.camera.setViewport(viewportHeight * (cssWidth / cssHeight), viewportHeight);
      this.renderer.camera.position.x = 0;
      this.renderer.camera.position.y = 103;
      this.renderer.camera.zoom = 1;
    } else {
      const catalog = this.actors[0]?.catalog ?? ASSET_CATALOG[this.actorDefinitions[0].id];
      const viewportHeight = Math.max(catalog.bounds.height + 40, 160);
      this.renderer.camera.setViewport(viewportHeight * (cssWidth / cssHeight), viewportHeight);
      this.renderer.camera.position.x = catalog.bounds.x + catalog.bounds.width / 2;
      this.renderer.camera.position.y = catalog.bounds.y + catalog.bounds.height / 2;
      this.renderer.camera.zoom = 1;
    }
  }

  private updateActor(actor: Actor, definition: StageActorDefinition, delta: number): void {
    const { state } = definition;
    if (state.skin !== actor.appliedSkin) {
      actor.skeleton.setSkinByName(state.skin);
      actor.skeleton.setSlotsToSetupPose();
      actor.appliedSkin = state.skin;
    }
    if (state.animation !== actor.appliedAnimation || state.loop !== actor.appliedLoop) {
      actor.animationState.setAnimation(0, state.animation, state.loop);
      actor.appliedAnimation = state.animation;
      actor.appliedLoop = state.loop;
    }
    if (state.playing) {
      actor.animationState.update(delta * state.speed);
      actor.skeleton.update(delta * state.speed);
    }
    actor.animationState.apply(actor.skeleton);

    const placement = definition.placement();
    actor.skeleton.x = placement.x;
    actor.skeleton.y = placement.y;
    actor.skeleton.scaleX = placement.scale * (placement.flipX ? -1 : 1);
    actor.skeleton.scaleY = placement.scale;
    actor.skeleton.updateWorldTransform(Physics.update);

    const headSlot = actor.catalog.slots.find((slot) => slot.bone === actor.catalog.headBone);
    const faceSlot = actor.catalog.slots.find((slot) => slot.bone === actor.catalog.faceBone);
    if (headSlot) actor.skeleton.findSlot(headSlot.name)?.setAttachment(null);
    if (faceSlot) actor.skeleton.findSlot(faceSlot.name)?.setAttachment(null);
  }

  private updateOverlays(actor: Actor): void {
    const definition = this.actorDefinitions.find(({ id }) => id === actor.id);
    if (!definition) return;
    this.placeOverlay(actor, "hat", definition.state.hat, actor.catalog.headBone, actor.setupHeadAngle);
    this.placeOverlay(actor, "face", definition.state.face, actor.catalog.faceBone, actor.setupFaceAngle);
  }

  private updateBoneObservers(actor: Actor): void {
    const observers = this.boneObservers.filter(({ actorId }) => actorId === actor.id);
    if (observers.length === 0) return;
    const cssWidth = this.canvas.clientWidth;
    const cssHeight = this.canvas.clientHeight;
    for (const observer of observers) {
      const bone = actor.skeleton.findBone(observer.boneName);
      if (!bone) continue;
      const atEnd = observer.point === "end";
      const worldX = bone.worldX + (atEnd ? bone.a * bone.data.length : 0);
      const worldY = bone.worldY + (atEnd ? bone.c * bone.data.length : 0);
      const screen = this.renderer.camera.worldToScreen(new Vector3(worldX, worldY, 0), cssWidth, cssHeight);
      observer.onUpdate({
        x: screen.x,
        y: cssHeight - screen.y,
        rotation: -bone.getWorldRotationX(),
        flipped: actor.skeleton.scaleX < 0,
      });
    }
  }

  private placeOverlay(
    actor: Actor,
    category: "hat" | "face",
    accessoryId: string,
    boneName: string,
    setupAngle: number,
  ): void {
    const image = actor.overlay[category];
    const accessory = actor.catalog.accessories.find((item) => item.id === accessoryId);
    if (!accessory?.url) {
      this.clearAccessoryState(actor.id, category);
      this.clearOverlay(image);
      return;
    }
    const accessoryUrl = new URL(accessory.url, document.baseURI).href;
    if (
      image.dataset.requestedAccessoryId !== accessory.id
      || image.dataset.requestedAccessoryUrl !== accessoryUrl
    ) {
      this.clearOverlay(image);
      image.dataset.requestedAccessoryId = accessory.id;
      image.dataset.requestedAccessoryUrl = accessoryUrl;
      image.src = accessory.url;
      return;
    }
    if (
      image.dataset.loadedAccessoryId !== accessory.id
      || !image.complete
      || image.naturalWidth <= 0
    ) {
      image.hidden = true;
      image.style.display = "none";
      return;
    }
    const bone = actor.skeleton.findBone(boneName);
    if (!bone) {
      this.clearOverlay(image);
      return;
    }
    const cssWidth = this.canvas.clientWidth;
    const cssHeight = this.canvas.clientHeight;
    const screen = this.renderer.camera.worldToScreen(
      new Vector3(bone.worldX, bone.worldY, 0),
      cssWidth,
      cssHeight,
    );
    const worldScaleX = bone.getWorldScaleX();
    const worldScaleY = bone.getWorldScaleY();
    const renderedWidth = accessory.width * Math.abs(worldScaleX) * cssWidth
      / this.renderer.camera.viewportWidth;
    const renderedHeight = accessory.height * Math.abs(worldScaleY) * cssHeight
      / this.renderer.camera.viewportHeight;
    image.hidden = false;
    image.style.display = "block";
    image.style.left = `${screen.x - renderedWidth / 2}px`;
    image.style.top = `${cssHeight - screen.y - renderedHeight / 2}px`;
    image.style.width = `${renderedWidth}px`;
    image.style.height = `${renderedHeight}px`;
    const overlayFlip = actor.skeleton.scaleX < 0 ? -1 : 1;
    image.style.transform = `rotate(${-1 * (bone.getWorldRotationX() - setupAngle)}deg) scaleX(${overlayFlip})`;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    for (const actor of this.actors) {
      actor.overlay.hat.onload = null;
      actor.overlay.hat.onerror = null;
      actor.overlay.face.onload = null;
      actor.overlay.face.onerror = null;
      this.clearOverlay(actor.overlay.hat);
      this.clearOverlay(actor.overlay.face);
      actor.overlay.hat.remove();
      actor.overlay.face.remove();
    }
    this.actors = [];
    try {
      this.assetManager?.dispose();
    } catch {
      // A lost context may already have disposed its textures.
    }
    this.assetManager = null;
    try {
      this.renderer.dispose();
    } catch {
      // A lost context may already have disposed its renderer resources.
    }
    this.canvas.remove();
    this.status.remove();
  }
}
