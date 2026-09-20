import assert from "node:assert/strict";
import { access, readdir, readFile, stat } from "node:fs/promises";
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
const timeBackgrounds = ["morning", "day", "evening", "night"]
  .flatMap((time) => ["sunny", "cloudy", "rain", "storm"]
    .map((weather) => `art/background/forest-${time}-${weather}.webp`));
const dockedBackgrounds = timeBackgrounds.map((file) => file.replace(/\.webp$/, "-docked.webp"));
const seasonalBackgrounds = ["spring", "summer", "fall", "winter"].flatMap((season) =>
  ["morning", "day", "evening", "night"].flatMap((time) =>
    ["sunny", "cloudy", "rain", "storm", "snow"]
      .filter((weather) => !(season === "summer" && weather === "snow"))
      .map((weather) => `art/background/seasonal/forest-${season}-${time}-${weather}.webp`),
  ),
);
const retainedSourceArtifacts = ["art/background/background.zip"];
const statueMaterials = ["stone", "marble", "wood", "gold", "whitegold", "crystal"];
const statueAssets = statueMaterials.map((material) => `art/statues/${material}-bear.png`);
assert.equal(timeBackgrounds.length, 16, "Production must contain the complete 4x4 illustrated background matrix");
assert.equal(dockedBackgrounds.length, 16, "Each illustrated scene needs its baked connector rendition");
assert.equal(seasonalBackgrounds.length, 76, "Seasonal Production must contain exactly 76 backgrounds");
const taxAlphaRenditions = pngMasters.filter(file => file.startsWith("art/houses/tax-stage-"))
  .map(file => file.replace(/\.png$/, "-alpha-v2.webp"));
assert.equal(taxAlphaRenditions.length, 4, "Each opaque Tax master needs its audited safe-frame alpha rendition");
const temporaryHouseAssets = [
  "art/houses/temporary-camp-spring-summer.webp",
  "art/houses/temporary-camp-fall.webp",
  "art/houses/temporary-camp-winter.webp",
  "art/houses/temporary-tent-neutral.webp",
  "art/houses/temporary-tent-yellow.webp",
  "art/houses/temporary-house-fall.webp",
  "art/houses/temporary-house-winter.webp",
];
assert.equal(temporaryHouseAssets.length, 7, "Temporary house hotfix must reuse exactly seven approved illustrations");
const required = [...pngMasters, ...webpRenditions, ...taxAlphaRenditions, ...temporaryHouseAssets, ...timeBackgrounds, ...dockedBackgrounds, ...seasonalBackgrounds, ...statueAssets, ...retainedSourceArtifacts];

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
for (const file of dockedBackgrounds) {
  const info = await stat(path.join(assetRoot, file));
  assert(info.size > 100_000, `Illustrated background rendition is unexpectedly small: ${file}`);
  const name = path.basename(file).replace(/-docked\.webp$/, "");
  const reviewPng = path.join(root, "art-review", "money-level", "weather-time", "docked", `${name}-docked.png`);
  const patchPng = path.join(root, "art-review", "money-level", "weather-time", "connector-patches", `${name}.png`);
  for (const [pngPath, width, height] of [[reviewPng, 1672, 941], [patchPng, 280, 170]]) {
    const header = (await readFile(pngPath)).subarray(0, 24);
    assert.equal(header.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `Expected PNG: ${pngPath}`);
    assert.equal(header.readUInt32BE(16), width, `Wrong width: ${pngPath}`);
    assert.equal(header.readUInt32BE(20), height, `Wrong height: ${pngPath}`);
  }
}
for (const file of seasonalBackgrounds) {
  const absolute = path.join(assetRoot, file);
  const info = await stat(absolute);
  assert(info.size > 100_000, `Seasonal background rendition is unexpectedly small: ${file}`);
  const header = (await readFile(absolute)).subarray(0, 32);
  assert.equal(header.toString("ascii", 0, 4), "RIFF", `Expected WebP RIFF header: ${file}`);
  assert.equal(header.toString("ascii", 8, 12), "WEBP", `Expected WebP payload: ${file}`);
}
for (const file of temporaryHouseAssets) {
  const header = (await readFile(path.join(assetRoot, file))).subarray(0, 32);
  assert.equal(header.toString("ascii", 0, 4), "RIFF", `Expected WebP RIFF header: ${file}`);
  assert.equal(header.toString("ascii", 8, 12), "WEBP", `Expected WebP payload: ${file}`);
}
const sceneComponent = await readFile(path.join(root, "components", "money-level", "MoneyLevelScene.tsx"), "utf8");
const settingsComponent = await readFile(path.join(root, "lib", "money-level", "settings.ts"), "utf8");
assert(sceneComponent.includes('/money-level/art/statues/${statue}.png'), "Statue object URL must resolve the selected material");
for (const file of statueAssets) {
  assert(settingsComponent.includes(`"${path.basename(file, ".png")}"`), `Statue option is not selectable: ${file}`);
  const header = (await readFile(path.join(assetRoot, file))).subarray(0, 26);
  assert.equal(header.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `Expected transparent PNG: ${file}`);
  assert.equal(header[25], 6, `Statue must remain RGBA: ${file}`);
}

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? listFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]));
  return nested.flat();
}

// `art/baseidea/` is a local, untracked user staging area. It is deliberately
// outside the Production manifest and must neither fail this check nor enter a PR.
const actual = (await listFiles(assetRoot)).filter((file) => !file.startsWith("art/baseidea/")).sort();
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
  // The former connector rendition is retained as a source artifact, never as a visual layer.
  if (file.endsWith("dock-connector.webp")) continue;
  // Legacy house renditions remain rollback-safe repository assets, but the
  // temporary seasonal resolver must never select them at runtime.
  if (file.startsWith("art/houses/")) continue;
  const fishingRodUsed = file.endsWith("fishing-rod.webp")
    && (await readFile(path.join(root, "components", "money-level", "MoneyLevelScene.tsx"), "utf8")).includes(publicUrl);
  assert(scene.includes(publicUrl) || fishingRodUsed, `WebP rendition is not used at runtime: ${publicUrl}`);
}
// Legacy docked backgrounds remain as a rollback-safe source set while the
// centralized seasonal manifest is verified in Production.
assert(scene.includes("FOREST_SEASONAL_BACKGROUND_MANIFEST") && scene.includes("/seasonal/forest-${season}-${time}-${WEATHER_FILE_SUFFIX[weather]}.webp"), "Seasonal backgrounds must resolve through the centralized manifest");
assert(scene.includes("resolveForestHouseAsset") && scene.includes("/money-level/art/houses/temporary-${source}.webp"), "Temporary house art must resolve through one centralized manifest");
assert(!`${catalog}\n${scene}`.match(/\/money-level\/art\/[^"']+\.png/), "Runtime scene config must not load environmental PNG masters");
assert(!`${catalog}\n${scene}`.includes("curation"), "Production config must not import curation assets");
console.log(`Money Level assets OK: ${actual.length} exact-case files`);
