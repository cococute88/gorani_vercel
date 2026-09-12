import type { CharacterId } from "./character-types";

export interface MoneyLevelAccessoryAsset {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface MoneyLevelCharacterCatalog {
  label: string;
  atlas: string;
  json: string;
  texture: string;
  bounds: { x: number; y: number; width: number; height: number };
  headBone: string;
  faceBone: string;
  slots: readonly { name: string; bone: string }[];
  accessories: readonly MoneyLevelAccessoryAsset[];
}

function accessories(character: "gorani" | "daramji", ids: readonly string[]): readonly MoneyLevelAccessoryAsset[] {
  return ids.map((id) => ({
    id,
    url: `/money-level/accessories/${character}/${id}.png`,
    width: 400,
    height: 400,
  }));
}

export const ASSET_CATALOG: Record<CharacterId, MoneyLevelCharacterCatalog> = {
  gorani: {
    label: "Gorani",
    atlas: "/money-level/spine/gorani/character_gorani.atlas",
    json: "/money-level/spine/gorani/character_gorani.json",
    texture: "/money-level/spine/gorani/character_gorani.png",
    bounds: { x: -53.7, y: -2.3, width: 107.98, height: 200.65 },
    headBone: "acc_head",
    faceBone: "acc_face",
    slots: [
      { name: "Acc_Gorani_Head", bone: "acc_head" },
      { name: "Acc_Gorani_Face", bone: "acc_face" },
    ],
    accessories: accessories("gorani", [
      "Acc_Gorani_Hat_Flower",
      "Acc_Gorani_Hat_Sprout",
      "Acc_Gorani_Hat_Strawhat",
      "Acc_Gorani_Hat_Partyhat",
      "Acc_Gorani_Hat_Ribbon",
      "Acc_Gorani_Face_blush",
      "Acc_Gorani_Face_Readingglasses",
      "Acc_Gorani_Face_Sleepingeyemask",
      "Acc_Gorani_Face_Hart",
    ]),
  },
  daramji: {
    label: "Daramji",
    atlas: "/money-level/spine/daramji/character_daramji.atlas",
    json: "/money-level/spine/daramji/character_daramji.json",
    texture: "/money-level/spine/daramji/character_daramji.png",
    bounds: { x: -49.64, y: -3.59, width: 102.94, height: 115.77 },
    headBone: "acc_head",
    faceBone: "acc_face",
    slots: [
      { name: "Acc_Daramji_Hat", bone: "acc_head" },
      { name: "Acc_Daramji_Face", bone: "acc_face" },
    ],
    accessories: accessories("daramji", [
      "Acc_Daramji_Hat_Flower",
      "Acc_Daramji_Hat_Sprout",
      "Acc_Daramji_Hat_Strawhat",
      "Acc_Daramji_Hat_Partyhat",
      "Acc_Daramji_Hat_Ribbon",
      "Acc_Daramji_Face_Blush",
      "Acc_Daramji_Face_Readingglasses",
      "Acc_Daramji_Face_Sleepingeyemask",
      "Acc_Daramji_Face_Hart",
    ]),
  },
};
