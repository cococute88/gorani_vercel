import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const assetRoot = path.join(root, "public", "money-level");
const required = [
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

assert.equal(required.length, 34, "Production manifest must contain exactly 34 MVP assets");

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
assert.deepEqual(actual, [...required].sort(), "No curation/lab asset may enter the Production namespace");

for (const character of ["gorani", "daramji"]) {
  const atlas = await readFile(path.join(assetRoot, "spine", character, `character_${character}.atlas`), "utf8");
  assert(atlas.includes(`character_${character}.png`), `${character} atlas must reference its exact texture filename`);
}

const catalog = await readFile(path.join(root, "lib", "money-level", "forest", "asset-catalog.ts"), "utf8");
const scene = await readFile(path.join(root, "lib", "money-level", "forest", "scene-config.ts"), "utf8");
for (const file of required) {
  const publicUrl = `/money-level/${file}`;
  const accessoryMatch = file.match(/^accessories\/(gorani|daramji)\/(.+)\.png$/);
  const accessoryReachable = accessoryMatch
    ? catalog.includes("/money-level/accessories/${character}/${id}.png") && catalog.includes(`"${accessoryMatch[2]}"`)
    : false;
  assert(catalog.includes(publicUrl) || scene.includes(publicUrl) || accessoryReachable || publicUrl.endsWith("/fishing-rod.png"), `Asset is not reachable from catalog/scene config: ${publicUrl}`);
}
assert(!`${catalog}\n${scene}`.includes("curation"), "Production config must not import curation assets");
console.log(`Money Level assets OK: ${actual.length} exact-case files`);
