import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "gorani-house-stages-qa"));
await mkdir(output, { recursive: true });

const dates = { spring: "2026-04-16", summer: "2026-06-16", fall: "2026-09-16", winter: "2026-12-16" };
const arts = [
  "clearing", "camp", "camp-plus", "tent-small", "tent-large", "tent-color", "micro-house", "cabin",
  "cabin-expanded", "house", "workshop-house", "two-story", "two-story-garden", "two-story-veranda",
  "two-story-large", "two-story-annex", "mansion", "mansion-garden", "grand-mansion", "grand-mansion-annex",
];
const values = arts.map((_, level) => level * 50_000_000 + 25_000_000);
const errors = [];
const failures = [];
const results = [];

function snapshot(brokerageValue, taxValue = brokerageValue) {
  return {
    brokerageValue,
    isaPrincipal: taxValue * .4,
    pensionPrincipal: taxValue * .6,
    updatedAt: "2026-09-26T00:00:00.000Z",
  };
}

async function setSnapshot(page, brokerageValue, taxValue = brokerageValue) {
  await page.evaluate((value) => localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify(value)), snapshot(brokerageValue, taxValue));
}

async function ready(page, art, cardCount = art === "clearing" ? 0 : 2) {
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  let diagnostic;
  for (let attempt = 0; attempt < 100; attempt++) {
    diagnostic = await page.evaluate(() => ({
      stored: localStorage.getItem("gorani.money-level.snapshot.v1"),
      brokerage: document.querySelector(".moneyLevelRoot")?.dataset.brokerageStage,
      tax: document.querySelector(".moneyLevelRoot")?.dataset.taxStage,
      cards: [...document.querySelectorAll(".house-card")].map((card) => ({
        art: card.dataset.art,
        ready: Boolean(card.querySelector("img")?.complete && card.querySelector("img")?.naturalWidth),
      })),
    }));
    if (diagnostic.brokerage === art && diagnostic.tax === art
      && diagnostic.cards.length === cardCount && diagnostic.cards.every((card) => card.ready)) break;
    await page.waitForTimeout(100);
  }
  assert.equal(diagnostic.brokerage, art, `brokerage stage readiness: ${JSON.stringify(diagnostic)}`);
  assert.equal(diagnostic.tax, art, `tax stage readiness: ${JSON.stringify(diagnostic)}`);
  assert.equal(diagnostic.cards.length, cardCount, `card readiness: ${JSON.stringify(diagnostic)}`);
  assert.ok(diagnostic.cards.every((card) => card.ready), `image readiness: ${JSON.stringify(diagnostic)}`);
  await page.waitForTimeout(120);
}

function attachDiagnostics(page, label) {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText;
    if (reason === "net::ERR_ABORTED" && request.url().includes("/api/money-level/weather")) return;
    failures.push(`${label}: ${request.url()}: ${reason}`);
  });
}

const browser = await chromium.launch({ channel: process.env.MONEY_LEVEL_QA_CHANNEL ?? "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  attachDiagnostics(page, "desktop");
  await page.goto(`${base}/money-level?date=${dates.spring}&time=day&weather=sunny`);

  for (let level = 0; level < arts.length; level++) {
    await setSnapshot(page, values[level]);
    await page.reload();
    await ready(page, arts[level]);
    const cards = await page.locator(".house-card").evaluateAll((nodes) => nodes.map((node) => ({
      kind: node.classList.contains("house-brokerage") ? "brokerage" : "tax",
      level: node.dataset.level,
      art: node.dataset.art,
      src: node.dataset.assetSrc,
      composite: node.dataset.composite,
      imageCount: node.querySelectorAll("img").length,
    })));
    assert.equal(cards.length, level === 0 ? 0 : 2, `Lv.${level} card count`);
    for (const card of cards) {
      assert.equal(card.level, String(level));
      assert.equal(card.art, arts[level]);
      assert.equal(card.imageCount, 1);
      if (level <= 5) assert.ok(card.src.includes("/temporary-"), `Lv.${level} approved early art`);
      else assert.ok(card.src.includes(`/${card.kind}-stage-`), `Lv.${level} ${card.kind} dedicated art`);
    }
    if (level >= 6) assert.notEqual(cards[0].src, cards[1].src, `Lv.${level} account identity`);
    const loadedHouseAssets = await page.evaluate(() => [...new Set(performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/money-level/art/houses/"))
      .map((name) => new URL(name).pathname))]);
    assert.ok(loadedHouseAssets.length <= 2, `Lv.${level} does not preload future stage art: ${loadedHouseAssets.join(", ")}`);
    await page.locator(".forest-scene").screenshot({ path: path.join(output, `progression-lv-${String(level).padStart(2, "0")}.png`) });
    results.push({ level, art: arts[level], cards, loadedHouseAssets });
  }

  await setSnapshot(page, values[18]);
  for (const [season, date] of Object.entries(dates)) {
    await page.goto(`${base}/money-level?date=${date}&time=day&weather=sunny`);
    await ready(page, arts[18]);
    assert.equal(await page.locator(".moneyLevelRoot").getAttribute("data-season"), season);
    await page.locator(".forest-scene").screenshot({ path: path.join(output, `season-${season}-lv-18.png`) });
  }

  for (const viewport of [
    { width: 1920, height: 1080, sceneHeight: 725 },
    { width: 1440, height: 900, sceneHeight: 690 },
    { width: 1366, height: 768, sceneHeight: 610 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/money-level?date=${dates.summer}&time=day&weather=sunny`);
    await ready(page, arts[18]);
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyHeight: document.body.scrollHeight,
      sceneHeight: document.querySelector(".forest-scene")?.getBoundingClientRect().height,
      houseCount: document.querySelectorAll(".house-card").length,
      labelCount: document.querySelectorAll(".house-label").length,
    }));
    assert.equal(layout.scrollWidth, layout.innerWidth, `${viewport.width} no horizontal overflow`);
    assert.equal(layout.sceneHeight, viewport.sceneHeight, `${viewport.width} existing responsive forest height unchanged`);
    assert.equal(layout.houseCount, 2);
    assert.equal(layout.labelCount, 2);
    await page.screenshot({ path: path.join(output, `desktop-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await setSnapshot(page, 423_000_000, 612_000_000);
  await page.goto(`${base}/money-level?date=${dates.spring}&time=day&weather=sunny`);
  await page.waitForFunction(() => document.querySelector(".moneyLevelRoot")?.dataset.brokerageStage === "cabin-expanded"
    && document.querySelector(".moneyLevelRoot")?.dataset.taxStage === "two-story-garden");
  const scrollHeightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
  const imageCountBefore = await page.locator(".forest-scene img").count();
  const brokerageTrigger = page.locator(".house-brokerage .house-interaction");
  await brokerageTrigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await assert.doesNotReject(dialog.waitFor({ state: "visible" }));
  assert.equal(await dialog.locator(".house-stage-row").count(), 20);
  assert.equal(await dialog.locator(".house-stage-row.is-current").count(), 1);
  assert.equal(await dialog.locator(".house-stage-row.is-done").count(), 8);
  assert.ok((await dialog.textContent()).includes("위탁 집"));
  assert.ok((await dialog.textContent()).includes("Lv.8 · 확장 오두막"));
  assert.ok((await dialog.textContent()).includes("4.23억"));
  assert.ok((await dialog.textContent()).includes("Lv.9 · 정식 주택"));
  assert.equal(await dialog.getByRole("progressbar").getAttribute("aria-valuenow"), "46");
  assert.equal(await page.locator(".forest-scene img").count(), imageCountBefore, "dialog remains text-only");
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), scrollHeightBefore, "dialog opening does not change page height");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.waitForTimeout(50);
  assert.equal(await brokerageTrigger.evaluate((node) => node === document.activeElement), true, "Escape restores trigger focus");

  const taxTrigger = page.locator(".house-tax .house-interaction");
  await taxTrigger.focus();
  await page.keyboard.press("Space");
  assert.ok((await dialog.textContent()).includes("절세 집"));
  assert.ok((await dialog.textContent()).includes("Lv.12 · 2층집과 작은 정원"));
  assert.ok((await dialog.textContent()).includes("6.12억"));
  await page.locator(".house-stage-close").click();
  await dialog.waitFor({ state: "detached" });
  await brokerageTrigger.click();
  await dialog.waitFor({ state: "visible" });
  await page.locator(".house-stage-overlay").click({ position: { x: 3, y: 3 } });
  await dialog.waitFor({ state: "detached" });
  results.push({ dialog: "keyboard, close button, outside click, values, progress, 20-row text list, no preload/reflow" });
  await context.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await mobileContext.addInitScript((initial) => localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify(initial)), snapshot(values[18]));
  const mobile = await mobileContext.newPage();
  attachDiagnostics(mobile, "mobile");
  await mobile.goto(`${base}/money-level?date=${dates.winter}&time=day&weather=sunny`);
  await ready(mobile, arts[18]);
  await mobile.locator(".forest-scene").scrollIntoViewIfNeeded();
  const mobileTrigger = mobile.locator(".house-brokerage .house-interaction");
  const mobileTriggerBox = await mobileTrigger.boundingBox();
  await mobile.touchscreen.tap(mobileTriggerBox.x + mobileTriggerBox.width / 2, mobileTriggerBox.y + mobileTriggerBox.height / 2);
  await mobile.getByRole("dialog").waitFor({ state: "visible" });
  const mobileLayout = await mobile.evaluate(() => {
    const dialog = document.querySelector(".house-stage-dialog").getBoundingClientRect();
    return {
      dialog: { left: dialog.left, top: dialog.top, right: dialog.right, bottom: dialog.bottom },
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      rows: document.querySelectorAll(".house-stage-row").length,
    };
  });
  assert.ok(mobileLayout.dialog.left >= 0 && mobileLayout.dialog.right <= mobileLayout.width);
  assert.ok(mobileLayout.dialog.top >= 0 && mobileLayout.dialog.bottom <= mobileLayout.height);
  assert.equal(mobileLayout.scrollWidth, mobileLayout.width);
  assert.equal(mobileLayout.rows, 20);
  await mobile.screenshot({ path: path.join(output, "mobile-390x844-dialog.png"), fullPage: true });
  await mobile.locator(".house-stage-close").tap();
  await mobile.getByRole("dialog").waitFor({ state: "detached" });
  const cdp = await mobileContext.newCDPSession(mobile);
  const sceneBox = await mobile.locator(".forest-scene").boundingBox();
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 2, radiusY: 2, force: 1 }],
  });
  for (let sweep = 0; sweep < 14; sweep++) {
    const x = sceneBox.x + sceneBox.width - 65;
    const y = sceneBox.y + 130;
    await touch("touchStart", x, y);
    for (let step = 1; step <= 10; step++) {
      await touch("touchMove", x - 220 * step / 10, y + step / 10);
    }
    await touch("touchEnd", 0, 0);
  }
  const camera = await mobile.evaluate(() => window.__MONEY_LEVEL_DEBUG__.camera());
  assert.ok(Math.abs(camera.x - camera.maxX) < 2, `house hit areas cannot block right camera pan: ${camera.x} vs ${camera.maxX}`);
  assert.equal(await mobile.getByRole("dialog").count(), 0, "horizontal house swipe cannot open the stage dialog");
  results.push({ mobile: "390x844 touch dialog plus trusted left/right camera pan without horizontal overflow" });
  await mobileContext.close();

  assert.deepEqual(failures, [], "no failed browser requests");
  assert.deepEqual(errors, [], "no browser console/page errors");
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: "PASS", progressionStages: arts.length, seasons: Object.keys(dates), desktopViewports: 3, mobileViewport: "390x844", output }));
} finally {
  await browser.close();
}
