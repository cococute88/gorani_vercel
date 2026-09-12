export type CharacterId = "gorani" | "daramji";

export interface CharacterState {
  skin: string;
  animation: string;
  hat: string;
  face: string;
  playing: boolean;
  speed: number;
  loop: boolean;
}

export interface ActorPlacement {
  x: number;
  y: number;
  scale: number;
  flipX?: boolean;
}

export interface BoneScreenPoint {
  x: number;
  y: number;
  rotation: number;
}
