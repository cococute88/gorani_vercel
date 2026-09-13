import { FOREST_MASTER_SIZE } from "./landmarks";
import type { ScenePoint } from "./navigation";

export interface ForestCamera {
  width: number;
  height: number;
  scale: number;
  worldWidth: number;
  cropX: number;
  cropY: number;
  /** Camera origin in scaled master-image pixels. */
  x: number;
  maxX: number;
}

export const TOUCH_SLOP_PX = 12;
export const PAN_THRESHOLD_PX = 10;
export const EDGE_ZONE_PX = 52;
export const EDGE_MAX_SPEED_PX = 150;

export function createForestCamera(width: number, height: number, mobile: boolean): ForestCamera {
  const scale = Math.max(width / FOREST_MASTER_SIZE.width, height / FOREST_MASTER_SIZE.height);
  const worldWidth = FOREST_MASTER_SIZE.width * scale;
  const cropX = (worldWidth - width) * (mobile ? 0.51 : 0.5);
  return { width, height, scale, worldWidth, cropX,
    cropY: (FOREST_MASTER_SIZE.height * scale - height) / 2,
    x: cropX, maxX: Math.max(0, worldWidth - width) };
}

export function clampCameraX(camera: ForestCamera, x: number): number {
  return Math.max(0, Math.min(camera.maxX, x));
}

export function cameraTranslation(camera: ForestCamera): number { return camera.cropX - camera.x; }

/** Navigation retains its original crop-relative, normalized WORLD plane.
 * It can extend below 0 / above 100; panning never mutates activity geometry.
 * First undo camera, then scale/crop; normalize back to that stable plane. */
export function screenToWorld(point: ScenePoint, camera: ForestCamera): ScenePoint {
  const masterX = (point.x + camera.x) / camera.scale;
  const masterY = (point.y + camera.cropY) / camera.scale;
  return { x: (masterX * camera.scale - camera.cropX) / camera.width * 100,
    y: (masterY * camera.scale - camera.cropY) / camera.height * 100 };
}

export function worldToScreen(point: ScenePoint, camera: ForestCamera): ScenePoint {
  return { x: point.x / 100 * camera.width + cameraTranslation(camera), y: point.y / 100 * camera.height };
}

export type GestureIntent = "pending" | "horizontal" | "vertical";
export function resolveGestureIntent(dx: number, dy: number, previous: GestureIntent = "pending"): GestureIntent {
  if (previous !== "pending") return previous;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < PAN_THRESHOLD_PX) return "pending";
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return "horizontal";
  if (Math.abs(dy) > Math.abs(dx) * 1.2) return "vertical";
  return "pending";
}

export function edgePanSpeed(fingerX: number, width: number): number {
  const zone = Math.min(EDGE_ZONE_PX, width / 3);
  if (fingerX < zone) return -EDGE_MAX_SPEED_PX * Math.min(1, Math.max(0, (zone - fingerX) / zone));
  if (fingerX > width - zone) return EDGE_MAX_SPEED_PX * Math.min(1, Math.max(0, (fingerX - width + zone) / zone));
  return 0;
}
