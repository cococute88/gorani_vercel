import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = path.join(tmpdir(), "money-level-night-dock-browser");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const p = await browser.newPage({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
  const errors = [], results = [];p.on("pageerror", e => errors.push(e.message));
  for (const weather of ["sunny", "cloudy", "rain", "thunderstorm"]) {
    await p.goto(`${base}/money-level?time=night&weather=${weather}`);
    await p.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
    await p.waitForFunction(() => [...document.querySelectorAll(".scene-background-current,.house-art-image")].every(i => i.complete && i.naturalWidth));
    const image = await p.locator(".scene-background-current").evaluate(i => ({ src: i.getAttribute("src"), width: i.naturalWidth, height: i.naturalHeight }));
    assert.equal(image.src, `/money-level/art/background/forest-night-${weather === "thunderstorm" ? "storm" : weather}-docked.webp`);
    assert.equal(image.width, 1683);assert.equal(image.height, 935);
    await p.locator(".forest-scene").screenshot({ path: path.join(output, `night-${weather}.png`) });
    results.push(image);
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: "PASS", decodedRuntimeNightAssets: 4, output }));
} finally { await browser.close(); }
