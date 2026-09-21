import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "gorani-house-hotfix-qa"));
await mkdir(output, { recursive: true });

const dates = { spring: "2026-04-16", summer: "2026-06-16", fall: "2026-09-16", winter: "2026-12-16" };
const stageCases = [
  { name: "camp", value: .75e8, art: "camp" },
  { name: "camp-plus", value: 1.25e8, art: "camp-plus" },
  { name: "tent-small", value: 1.75e8, art: "tent-small" },
  { name: "tent-large", value: 2.25e8, art: "tent-large" },
  { name: "tent-color", value: 2.75e8, art: "tent-color" },
  { name: "house", value: 3.25e8, art: "micro-house" },
];
const expected = {
  spring: { camp: "temporary-camp-spring-summer.webp", "camp-plus": "temporary-camp-spring-summer.webp", "tent-small": "temporary-tent-neutral.webp", "tent-large": "temporary-tent-neutral.webp", "tent-color": "temporary-tent-yellow.webp", house: "temporary-house-fall.webp" },
  summer: { camp: "temporary-camp-spring-summer.webp", "camp-plus": "temporary-camp-spring-summer.webp", "tent-small": "temporary-tent-neutral.webp", "tent-large": "temporary-tent-neutral.webp", "tent-color": "temporary-tent-yellow.webp", house: "temporary-house-fall.webp" },
  fall: { camp: "temporary-camp-fall.webp", "camp-plus": "temporary-camp-fall.webp", "tent-small": "temporary-tent-neutral.webp", "tent-large": "temporary-tent-neutral.webp", "tent-color": "temporary-tent-yellow.webp", house: "temporary-house-fall.webp" },
  winter: { camp: "temporary-camp-winter.webp", "camp-plus": "temporary-camp-winter.webp", "tent-small": "temporary-tent-neutral.webp", "tent-large": "temporary-tent-neutral.webp", "tent-color": "temporary-tent-yellow.webp", house: "temporary-house-winter.webp" },
};
const assetPaths = [...new Set(Object.values(expected).flatMap((mapping) => Object.values(mapping)))].map((name) => `/money-level/art/houses/${name}`);
const errors = [], failedRequests = [], results = [];

function snapshot(value) {
  return { brokerageValue: value, isaPrincipal: value * .4, pensionPrincipal: value * .6, updatedAt: "2026-09-20T00:00:00.000Z" };
}

async function setValue(page, value) {
  await page.evaluate((payload) => localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify(payload)), snapshot(value));
}

async function ready(page, art, cardCount = 2) {
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await page.waitForFunction(({ art, cardCount }) => {
    const root = document.querySelector(".moneyLevelRoot");
    const cards = [...document.querySelectorAll(".house-card")];
    return root?.dataset.brokerageStage === art && root?.dataset.taxStage === art
      && cards.length === cardCount
      && cards.every((card) => card.querySelector("img")?.complete && card.querySelector("img")?.naturalWidth > 0);
  }, { art, cardCount });
  await page.waitForTimeout(300);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const layout of [
    { name: "desktop", viewport: { width: 1320, height: 900 }, mobile: false },
    { name: "mobile", viewport: { width: 390, height: 844 }, mobile: true },
  ]) {
    const context = await browser.newContext({ viewport: layout.viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${layout.name}: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${layout.name}: ${message.text()}`); });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/art/houses/temporary-")) failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
    });

    await page.goto(`${base}/money-level?date=${dates.spring}&time=day&weather=sunny`);
    const decoded = await page.evaluate(async (paths) => Promise.all(paths.map(async (src) => {
      const image = new Image(); image.src = src; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0, partial = 0, darkPartial = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha === 0) transparent++;
        else if (alpha < 240) {
          partial++;
          if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) < 16) darkPartial++;
        }
      }
      return { src, width: image.naturalWidth, height: image.naturalHeight, transparent, partial, darkPartial,
        corners: [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]].map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]) };
    })), assetPaths);
    for (const asset of decoded) {
      assert.ok(asset.transparent > 100_000 && asset.partial > 100, `${asset.src} must decode with alpha`);
      assert.deepEqual(asset.corners, [0, 0, 0, 0], `${asset.src} cannot retain an opaque matte`);
      if (asset.src.includes("winter")) assert.equal(asset.darkPartial, 0, `${asset.src} cannot retain a black fringe`);
    }

    for (const [season, date] of Object.entries(dates)) for (const stage of stageCases) {
      await setValue(page, stage.value);
      await page.goto(`${base}/money-level?date=${date}&time=day&weather=sunny`);
      await ready(page, stage.art);
      const qa = await page.evaluate(() => ({
        season: document.querySelector(".moneyLevelRoot")?.dataset.season,
        runtimeCount: window.__MONEY_LEVEL_DEBUG__.activeRuntimeCount(),
        cards: [...document.querySelectorAll(".house-card")].map((card) => {
          const image = card.querySelector("img");
          const box = card.getBoundingClientRect();
          const label = document.querySelector(`.house-label-${card.classList.contains("house-tax") ? "tax" : "brokerage"}`)?.getBoundingClientRect();
          return { src: image.getAttribute("src"), complete: image.complete, naturalWidth: image.naturalWidth,
            composite: card.dataset.composite, box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height },
            label: label ? { left: label.left, top: label.top, right: label.right, bottom: label.bottom } : null };
        }),
        labels: document.querySelectorAll(".house-label").length,
      }));
      assert.equal(qa.season, season);
      assert.equal(qa.runtimeCount, 1);
      assert.equal(qa.labels, 2);
      assert.equal(qa.cards.length, 2);
      assert.ok(qa.cards.every((card) => card.src.endsWith(expected[season][stage.name])));
      assert.ok(qa.cards.every((card) => card.complete && card.naturalWidth > 0 && card.composite === "alpha"));
      results.push({ layout: layout.name, season, stage: stage.name, ...qa });
      await page.locator(".forest-scene").screenshot({ path: path.join(output, `${layout.name}-${season}-${stage.name}.png`) });
    }

    await setValue(page, .25e8);
    await page.goto(`${base}/money-level?date=${dates.spring}&time=day&weather=sunny`);
    await ready(page, "clearing", 0);
    assert.equal(await page.locator(".house-card").count(), 0, "clearing cannot show a fallback camp");
    assert.equal(await page.locator(".house-label").count(), 2, "clearing labels and levels remain available");

    await setValue(page, 8.25e8);
    await page.goto(`${base}/money-level?date=${dates.winter}&time=day&weather=sunny`);
    await ready(page, "mansion");
    assert.ok((await page.locator(".house-card").evaluateAll((cards) => cards.every((card) => card.dataset.assetSrc.endsWith("temporary-house-winter.webp")))));

    if (layout.mobile) {
      const phaseBefore = await page.evaluate(() => ({ state: window.__MONEY_LEVEL_DEBUG__.state(), runtimes: window.__MONEY_LEVEL_DEBUG__.activeRuntimeCount() }));
      const sceneBox = await page.locator(".forest-scene").boundingBox();
      const panTo = async (target) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const current = await page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.camera().x);
          const delta = current - target;
          if (Math.abs(delta) < 2) break;
          const startX = delta > 0 ? 20 : sceneBox.width - 20;
          const endX = Math.max(5, Math.min(sceneBox.width - 5, startX + delta));
          await page.mouse.move(sceneBox.x + startX, sceneBox.y + 30);
          await page.mouse.down();
          await page.mouse.move(sceneBox.x + endX, sceneBox.y + 30, { steps: 8 });
          await page.mouse.up();
        }
      };
      await panTo(110);
      const left = await page.locator(".house-brokerage").boundingBox();
      assert.ok(left.x >= -1 && left.x + left.width <= layout.viewport.width + 1, "mobile camera can reveal the complete Brokerage illustration");
      await panTo(485);
      const right = await page.locator(".house-tax").boundingBox();
      assert.ok(right.x >= -1 && right.x + right.width <= layout.viewport.width + 1, "mobile camera can reveal the complete Tax illustration");
      const phaseAfter = await page.evaluate(() => ({ state: window.__MONEY_LEVEL_DEBUG__.state(), runtimes: window.__MONEY_LEVEL_DEBUG__.activeRuntimeCount() }));
      assert.deepEqual(phaseAfter.state, phaseBefore.state, "camera pan cannot reset character phase or world position");
      assert.equal(phaseAfter.runtimes, phaseBefore.runtimes, "camera pan cannot recreate the Spine runtime");
      await page.locator(".forest-scene").screenshot({ path: path.join(output, "mobile-winter-house-right-pan.png") });
    }

    if (!layout.mobile) {
      assert.equal(await page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.startBenchSitting("gorani")), true);
      await page.waitForFunction(() => window.__MONEY_LEVEL_DEBUG__.state().gorani.phase === "bench-sit");
      const before = await page.evaluate(() => ({ state: window.__MONEY_LEVEL_DEBUG__.state().gorani, camera: window.__MONEY_LEVEL_DEBUG__.camera(), runtimes: window.__MONEY_LEVEL_DEBUG__.activeRuntimeCount() }));
      await page.evaluate(() => { history.pushState(null, "", "?date=2026-09-16&time=day&weather=sunny"); dispatchEvent(new PopStateEvent("popstate")); });
      await page.waitForFunction(() => document.querySelector(".moneyLevelRoot")?.dataset.season === "fall");
      const after = await page.evaluate(() => ({ state: window.__MONEY_LEVEL_DEBUG__.state().gorani, camera: window.__MONEY_LEVEL_DEBUG__.camera(), runtimes: window.__MONEY_LEVEL_DEBUG__.activeRuntimeCount() }));
      assert.equal(after.state.phase, "bench-sit");
      assert.deepEqual(after.state.position, before.state.position);
      assert.deepEqual(after.camera, before.camera);
      assert.equal(after.runtimes, before.runtimes);
    }
    await context.close();
  }
  assert.deepEqual(failedRequests, [], "temporary production house requests must not fail");
  assert.deepEqual(errors, [], "browser console/page errors");
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: "PASS", scenarios: results.length, decodedAssets: assetPaths.length, failedRequests: failedRequests.length, errors: errors.length, output }));
} finally {
  await browser.close();
}
