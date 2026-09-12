import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const assetRoot = path.join(root, "public", "money-level");
const pngMasters = [
  "art/background/cozy-forest-base.png",
  "art/houses/brokerage-stage-35-40-small-cabin.png",
  "art/houses/brokerage-stage-40-45-expanded-cabin-alpha.png",
  "art/houses/brokerage-stage-45-50-proper-house.png",
  "art/houses/tax-stage-10-15-camp-plus.png",
  "art/houses/tax-stage-15-20-small-white-tent.png",
  "art/houses/tax-stage-20-25-large-white-tent.png",
  "art/houses/tax-stage-25-30-colored-tent.png",
  "art/props/dock-connector.png",
  "art/props/fishing-rod.png",
  "spine/gorani/character_gorani.json",
  "spine/gorani/character_gorani.atlas",
  "spine/gorani/character_gorani.png",
  "spine/daramji/character_daramji.json",
  "spine/daramji/character_daramji.atlas",
  "spine/daramji/character_daramji.png",
  ...["Flower", "Sprout", "Strawhat", "Partyhat", "Ribbon"].map((name) => `accessories/gorani/Acc_Gorani_Hat_${name}.png`),
  ...["blush", "Readingglasses", "Sleepingeyemask", "Hart"].map((name) => `accessories/gorani/Acc_Gorani_Face_${name}.png`),
  ...["Flower", "Sprout", "Strawhat", "Partyhat", "Ribbon"].map((name) => `accessories/daramji/Acc_Daramji_Hat_${name}.png`),
  ...["Blush", "Readingglasses", "Sleepingeyemask", "Hart"].map((name) => `accessories/daramji/Acc_Daramji_Face_${name}.png`),
];

assert.equal(pngMasters.length, 34, "Production manifest must contain exactly 34 MVP master assets");
const webpRenditions = pngMasters
  .filter((file) => file.startsWith("art/"))
  .map((file) => file.replace(/\.png$/, ".webp"));
assert.equal(webpRenditions.length, 10, "Every environmental art PNG must have a WebP rendition");
const timeBackgrounds = ["morning", "am", "pm", "evening", "night"]
  .map((time) => `art/background/forest-${time}.webp`);
const required = [...pngMasters, ...webpRenditions, ...timeBackgrounds];

async function assertExactCase(relativePath) {
  let current = assetRoot;
  for (const segment of relativePath.split("/")) {
    const names = await readdir(current);
    assert(names.includes(segment), `Missing or case-mismatched asset path: ${relativePath}`);
    current = path.join(current, segment);
  }
  await access(current);
}

for (const file of required) await assertExactCase(file);

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? listFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]));
  return nested.flat();
}

const actual = (await listFiles(assetRoot)).sort();
assert.deepEqual(actual, [...required].sort(), "Only approved masters and WebP renditions may enter the Production namespace");

for (const character of ["gorani", "daramji"]) {
  const atlas = await readFile(path.join(assetRoot, "spine", character, `character_${character}.atlas`), "utf8");
  assert(atlas.includes(`character_${character}.png`), `${character} atlas must reference its exact texture filename`);
}

const catalog = await readFile(path.join(root, "lib", "money-level", "forest", "asset-catalog.ts"), "utf8");
const scene = await readFile(path.join(root, "lib", "money-level", "forest", "scene-config.ts"), "utf8");
for (const file of pngMasters) {
  if (file.startsWith("art/")) continue;
  const publicUrl = `/money-level/${file}`;
  const accessoryMatch = file.match(/^accessories\/(gorani|daramji)\/(.+)\.png$/);
  const accessoryReachable = accessoryMatch
    ? catalog.includes("/money-level/accessories/${character}/${id}.png") && catalog.includes(`"${accessoryMatch[2]}"`)
    : false;
  assert(catalog.includes(publicUrl) || scene.includes(publicUrl) || accessoryReachable || publicUrl.endsWith("/fishing-rod.png"), `Asset is not reachable from catalog/scene config: ${publicUrl}`);
}
for (const file of webpRenditions) {
  const publicUrl = `/money-level/${file}`;
  assert(scene.includes(publicUrl) || (file.endsWith("fishing-rod.webp") && (await readFile(path.join(root, "components", "money-level", "MoneyLevelScene.tsx"), "utf8")).includes(publicUrl)), `WebP rendition is not used at runtime: ${publicUrl}`);
}
for (const file of timeBackgrounds) {
  const publicUrl = `/money-level/${file}`;
  assert(scene.includes(publicUrl), `Time background is not mapped at runtime: ${publicUrl}`);
}
assert(!`${catalog}\n${scene}`.match(/\/money-level\/art\/[^"']+\.png/), "Runtime scene config must not load environmental PNG masters");
assert(!`${catalog}\n${scene}`.includes("curation"), "Production config must not import curation assets");
console.log(`Money Level assets OK: ${actual.length} exact-case files`);
