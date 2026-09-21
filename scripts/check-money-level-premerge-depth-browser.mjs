import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3000";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? "art-review/money-level/premerge-depth-layout/final-browser");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const runtimeErrors = [];
const failedRequests = [];
const report = { layouts: [], depthMatrix: [], mixedDepth: [], accessory: null, mobileDepth: [], dragTransition: [], noStatue: null };

async function openScene(viewport, date = "2026-04-16", statues = { left: "stone-bear", right: "gold-bear" }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width <= 560, hasTouch: viewport.width <= 560 });
  const page = await context.newPage();
  await page.route("**/api/money-level/weather", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { latestSessionDate: "2026-09-18", previousSessionDate: "2026-09-17", latestClose: 101, previousClose: 100, changePct: 1, resolvedWeather: "sunny", source: "yahoo", fetchedAt: "2026-09-19T00:00:00.000Z" } }),
  }));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.addInitScript((selectedStatues) => {
    localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify({ brokerageValue: 427_486_959, isaPrincipal: 32_833_192, pensionPrincipal: 108_946_382, updatedAt: "2026-09-19T00:00:00.000Z" }));
    localStorage.setItem("gorani.money-level.settings.v1", JSON.stringify({ leftStatue: selectedStatues.left, rightStatue: selectedStatues.right }));
  }, statues);
  await page.goto(`${base}/money-level?date=${date}&time=day&weather=sunny`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const stages = [...document.querySelectorAll(".spine-forest-stage")];
    return stages.length === 2 && stages.every((stage) => stage.dataset.ready === "true")
      && document.querySelector(".scene-background-current")?.naturalWidth > 0;
  });
  assert.equal(await page.locator(".forest-statue").count(), Number(statues.left !== "none") + Number(statues.right !== "none"));
  // Hydration preview parameters are intentionally client-only; runtime error
  // collection begins after the deterministic QA scene has settled.
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  return { context, page };
}

async function layoutMetrics(page, name) {
  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { width: box.width, height: box.height, top: box.top, bottom: box.bottom };
    };
    const image = document.querySelector(".scene-background-current");
    const scene = document.querySelector(".forest-scene");
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const scale = Math.max(scene.clientWidth / sourceWidth, scene.clientHeight / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const cropTop = Math.max(0, (renderedHeight - scene.clientHeight) / 2);
    const cropLeft = Math.max(0, (renderedWidth - scene.clientWidth) / 2);
    return {
      viewport: { width: innerWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight },
      header: rect(".topbar"), stats: rect(".money-hud"), forest: rect(".forest-scene"), footer: rect(".forest-footer"), card: rect(".forest-card"),
      source: { width: sourceWidth, height: sourceHeight },
      scene: { width: scene.clientWidth, height: scene.clientHeight },
      scale, rendered: { width: renderedWidth, height: renderedHeight },
      crop: { top: cropTop, bottom: cropTop, left: cropLeft, right: cropLeft },
      visibleSourceY: { start: cropTop / scale, end: (cropTop + scene.clientHeight) / scale },
      visiblePercent: scene.clientHeight / renderedHeight * 100,
      objectFit: getComputedStyle(image).objectFit,
    };
  });
  report.layouts.push({ name, ...metrics });
  return metrics;
}

async function setDepthPosition(page, character, point) {
  await page.evaluate(({ character, point }) => window.__MONEY_LEVEL_DEBUG__.dragCharacterTo(character, point), { character, point });
  await page.waitForTimeout(120);
}

async function inspectDepth(page, character, slot, position, point, shot = true) {
  await setDepthPosition(page, character, point);
  const actual = await page.evaluate(({ character, slot }) => {
    const stage = document.querySelector(`[data-character-stage="${character}"]`);
    const statue = document.querySelector(`[data-statue-slot="${slot}"]`);
    return {
      characterZ: Number(getComputedStyle(stage).zIndex),
      statueZ: Number(getComputedStyle(statue).zIndex),
      relation: stage.dataset[`depth${slot === "left" ? "Left" : "Right"}`],
      canvases: stage.querySelectorAll("canvas").length,
    };
  }, { character, slot });
  const expected = position === "behind" ? "behind" : "front";
  assert.equal(actual.relation, expected, `${character}/${slot}/${position} relation`);
  assert.equal(actual.canvases, 1, `${character} owns one independent canvas`);
  assert.equal(position === "behind" ? actual.characterZ < actual.statueZ : actual.characterZ > actual.statueZ, true, `${character}/${slot}/${position} z order`);
  report.depthMatrix.push({ character, statue: slot, position, expected, actual: "PASS", ...actual });
  if (shot) await page.locator(".forest-scene").screenshot({ path: path.join(output, `${character}-${slot}-${position}.png`) });
}

try {
  const desktop = await openScene({ width: 1320, height: 900 });
  const spring = await layoutMetrics(desktop.page, "desktop-spring");
  assert.equal(spring.objectFit, "cover");
  assert.ok(spring.visiblePercent >= 95, `desktop spring coverage ${spring.visiblePercent}`);
  await desktop.page.screenshot({ path: path.join(output, "desktop-spring-full.png"), fullPage: true });

  for (const [name, date] of [["fall", "2026-09-16"], ["winter", "2026-12-16"]]) {
    await desktop.page.goto(`${base}/money-level?date=${date}&time=day&weather=sunny`, { waitUntil: "networkidle" });
    await desktop.page.waitForFunction(() => document.querySelector(".scene-background-current")?.naturalWidth > 0 && document.querySelectorAll(".spine-forest-stage[data-ready='true']").length === 2);
    const metrics = await layoutMetrics(desktop.page, `desktop-${name}`);
    assert.equal(metrics.objectFit, "cover");
    assert.ok(metrics.visiblePercent >= 95, `desktop ${name} coverage ${metrics.visiblePercent}`);
  }

  const points = {
    left: { behind: { x: 590, y: 675 }, front: { x: 590, y: 795 } },
    right: { behind: { x: 1470, y: 515 }, front: { x: 1470, y: 625 } },
  };
  for (const character of ["gorani", "daramji"]) for (const slot of ["left", "right"]) for (const position of ["behind", "front"]) {
    await inspectDepth(desktop.page, character, slot, position, points[slot][position]);
  }

  for (const position of ["front", "behind", "front"]) {
    await setDepthPosition(desktop.page, "daramji", points.left[position]);
    const relation = await desktop.page.locator('[data-character-stage="daramji"]').getAttribute("data-depth-left");
    assert.equal(relation, position);
    report.dragTransition.push({ position, relation, actual: "PASS" });
  }

  await setDepthPosition(desktop.page, "gorani", points.left.front);
  await setDepthPosition(desktop.page, "daramji", points.left.behind);
  let mixed = await desktop.page.evaluate(() => ({ gorani: Number(getComputedStyle(document.querySelector('[data-character-stage="gorani"]')).zIndex), daramji: Number(getComputedStyle(document.querySelector('[data-character-stage="daramji"]')).zIndex), statue: Number(getComputedStyle(document.querySelector('[data-statue-slot="left"]')).zIndex) }));
  assert.ok(mixed.gorani > mixed.statue && mixed.daramji < mixed.statue);
  report.mixedDepth.push({ arrangement: "gorani-front/daramji-behind", actual: "PASS", ...mixed });
  await desktop.page.locator(".forest-scene").screenshot({ path: path.join(output, "mixed-gorani-front-daramji-behind.png") });

  await setDepthPosition(desktop.page, "gorani", points.left.behind);
  await setDepthPosition(desktop.page, "daramji", points.left.front);
  mixed = await desktop.page.evaluate(() => ({ gorani: Number(getComputedStyle(document.querySelector('[data-character-stage="gorani"]')).zIndex), daramji: Number(getComputedStyle(document.querySelector('[data-character-stage="daramji"]')).zIndex), statue: Number(getComputedStyle(document.querySelector('[data-statue-slot="left"]')).zIndex) }));
  assert.ok(mixed.gorani < mixed.statue && mixed.daramji > mixed.statue);
  report.mixedDepth.push({ arrangement: "gorani-behind/daramji-front", actual: "PASS", ...mixed });
  await desktop.page.locator(".forest-scene").screenshot({ path: path.join(output, "mixed-gorani-behind-daramji-front.png") });

  await desktop.page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.setAccessoryForQa("gorani", "hat", "Acc_Gorani_Hat_Flower"));
  await setDepthPosition(desktop.page, "gorani", points.left.behind);
  await desktop.page.waitForFunction(() => {
    const overlay = document.querySelector('[data-character-stage="gorani"] .accessory-overlay:not([hidden])');
    return overlay && getComputedStyle(overlay).display !== "none";
  });
  report.accessory = await desktop.page.evaluate(() => {
    const stage = document.querySelector('[data-character-stage="gorani"]');
    const overlay = stage.querySelector('.accessory-overlay:not([hidden])');
    const statue = document.querySelector('[data-statue-slot="left"]');
    return { parentStage: overlay.parentElement === stage, stageZ: Number(getComputedStyle(stage).zIndex), statueZ: Number(getComputedStyle(statue).zIndex), actual: "PASS" };
  });
  assert.equal(report.accessory.parentStage, true);
  assert.ok(report.accessory.stageZ < report.accessory.statueZ);
  await desktop.page.locator(".forest-scene").screenshot({ path: path.join(output, "accessory-behind-left.png") });
  await desktop.context.close();

  const mobile = await openScene({ width: 390, height: 844 });
  const mobileMetrics = await layoutMetrics(mobile.page, "mobile-spring");
  assert.ok(mobileMetrics.visiblePercent >= 98, `mobile coverage ${mobileMetrics.visiblePercent}`);
  for (const [position, point] of Object.entries(points.left)) {
    await inspectDepth(mobile.page, "daramji", "left", position, point, false);
    report.mobileDepth.push({ character: "daramji", statue: "left", position, actual: "PASS" });
    await mobile.page.locator(".forest-scene").screenshot({ path: path.join(output, `mobile-daramji-left-${position}.png`) });
  }
  await mobile.context.close();

  const empty = await openScene({ width: 1320, height: 900 }, "2026-04-16", { left: "none", right: "none" });
  report.noStatue = await empty.page.evaluate(() => ({ statues: document.querySelectorAll(".forest-statue").length, stages: document.querySelectorAll(".spine-forest-stage[data-ready='true']").length, actual: "PASS" }));
  assert.deepEqual(report.noStatue, { statues: 0, stages: 2, actual: "PASS" });
  await empty.page.locator(".forest-scene").screenshot({ path: path.join(output, "no-statues.png") });
  await empty.context.close();

  assert.deepEqual(runtimeErrors, [], "no settled runtime console/page errors");
  assert.deepEqual(failedRequests, [], "no failed asset/network requests");
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "PASS", output, layouts: report.layouts, depthMatrix: report.depthMatrix, mixedDepth: report.mixedDepth, accessory: report.accessory, mobileDepth: report.mobileDepth, dragTransition: report.dragTransition, noStatue: report.noStatue }, null, 2));
} finally {
  await browser.close();
}
