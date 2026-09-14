import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "money-level-follow-up-qa");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36" });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  const send = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: /End|Cancel/.test(type) ? [] : [{ x, y, radiusX: 9, radiusY: 9, force: .6 }] });
  const state = () => page.evaluate(() => ({ owner: document.querySelector(".forest-scene").dataset.pointerOwner,
    grabbed: document.querySelectorAll(".is-grabbed").length, cameraX: Number(document.querySelector(".forest-scene").dataset.cameraX) }));
  async function load() {
    await page.goto(`${base}/money-level?time=day&weather=sunny&interactionDebug=1`);
    await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
    await page.locator(".forest-scene").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.qaTrace = [];
      for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "touchstart", "touchmove", "touchend"]) {
        document.addEventListener(type, e => window.qaTrace.push({ type, target: e.target.id, trusted: e.isTrusted, cancelable: e.cancelable }), true);
      }
    });
  }
  async function finger(id = "gorani") {
    const r = await page.locator(`#${id}-drag-target`).boundingBox();
    const p = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    assert.equal(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, p), `${id}-drag-target`);
    return p;
  }
  for (const id of ["gorani", "daramji"]) for (const jitter of [0, 5, 10, 15]) {
    await load();
    const p = await finger(id);
    await send("touchStart", p.x, p.y);
    await page.waitForTimeout(100);
    await send("touchMove", p.x + jitter, p.y + (jitter ? 2 : 0));
    await page.waitForTimeout(230);
    assert.equal((await state()).owner, "CHARACTER_DRAG", `${id} ${jitter}px jitter acquires drag`);
    const camera = (await state()).cameraX, scroll = await page.evaluate(() => scrollY);
    await send("touchMove", p.x + 35, p.y - 50);
    await page.waitForTimeout(120);
    assert.equal((await state()).owner, "CHARACTER_DRAG", "vertical move after grab stays owned");
    assert.equal(await page.evaluate(() => scrollY), scroll, "grab blocks native page scroll");
    assert.equal((await state()).cameraX, camera, "interior drag does not become pan");
    await send("touchEnd");
    assert.equal((await state()).grabbed, 0);
    assert.equal((await state()).owner, "NONE");
    const trace = await page.evaluate(() => window.qaTrace);
    assert.ok(trace.every(e => e.trusted));
    await writeFile(path.join(output, `${id}-${jitter}px-events.json`), JSON.stringify(trace, null, 2));
    results.push(`${id}: ${jitter}px jitter, delayed move, vertical drag, release`);
  }
  await load();
  let p = await finger();
  await send("touchStart", p.x, p.y);
  await page.waitForTimeout(70);
  const camera = (await state()).cameraX;
  await send("touchMove", p.x - 40, p.y + 1);
  await send("touchMove", p.x - 90, p.y + 1);
  assert.equal((await state()).owner, "FOREST_PAN", "early horizontal intent hands off to forest");
  assert.ok((await state()).cameraX > camera + 30);
  await send("touchEnd");
  results.push("early horizontal character swipe → Forest Pan, no orphaned session");
  await load();
  p = await finger();
  const beforeScroll = await page.evaluate(() => scrollY);
  await send("touchStart", p.x, p.y);
  for (let i = 1; i <= 6; i++) {
    await send("touchMove", p.x + 1, p.y - i * 20);
    await page.waitForTimeout(20);
  }
  await send("touchEnd");
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => scrollY) > beforeScroll + 20, "early vertical character swipe permits native page scroll");
  assert.ok((await page.evaluate(() => window.qaTrace)).some(e => e.type === "pointercancel"));
  results.push("early vertical character swipe → native page scroll + pointercancel");
  await load(); p = await finger();
  const jitterScroll = await page.evaluate(() => scrollY);
  await send("touchStart", p.x, p.y);
  await send("touchMove", p.x + 5, p.y - 2);
  await page.waitForTimeout(40);
  for (let i = 1; i <= 6; i++) {
    await send("touchMove", p.x + 5, p.y - i * 20);
    await page.waitForTimeout(20);
  }
  await send("touchEnd");
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => scrollY) > jitterScroll + 20, "jitter then vertical intent still permits native page scroll");
  results.push("5px jitter then early vertical intent → native page scroll");
  for (const active of [false, true]) {
    await load(); p = await finger();
    await send("touchStart", p.x, p.y);
    await page.waitForTimeout(active ? 330 : 70);
    await send("touchCancel");
    await page.waitForTimeout(330);
    assert.equal((await state()).owner, "NONE");
    assert.equal((await state()).grabbed, 0);
    results.push(`touch cancellation ${active ? "after" : "before"} acquisition cleans timer/capture/feedback`);
  }
  await context.close();
  const desktop = await browser.newPage({ viewport: { width: 1383, height: 900 }, reducedMotion: "reduce" });
  await desktop.addInitScript(() => localStorage.setItem("gorani.money-level.settings.v1", JSON.stringify({ leftStatue: "stone-bear", rightStatue: "gold-bear" })));
  for (const [time, weather] of [["morning", "sunny"], ["day", "sunny"], ["evening", "sunny"], ["evening", "cloudy"],
    ["evening", "rain"], ["night", "sunny"], ["night", "cloudy"], ["night", "thunderstorm"]]) {
    await desktop.goto(`${base}/money-level?time=${time}&weather=${weather}`);
    await desktop.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
    await desktop.waitForFunction(() => [...document.querySelectorAll(".house-art-image,.scene-background-current,.forest-statue")].every(i => i.complete && i.naturalWidth));
    assert.equal(await desktop.locator(".moneyLevelRoot").getAttribute("data-time-of-day"), time);
    assert.equal(await desktop.locator(".moneyLevelRoot").getAttribute("data-weather"), weather);
    const filters = await desktop.locator(".house-art-image,.forest-statue").evaluateAll(xs => xs.map(x => getComputedStyle(x).filter));
    assert.equal(filters.length, 4);
    assert.equal(filters[0], filters[1], "brokerage and tax camp share identical lighting");
    assert.equal(filters[2], filters[3], "both statues retain the approved category lighting");
    assert.notEqual(filters[0].match(/url\([^)]*\)/)[0], filters[2].match(/url\([^)]*\)/)[0], "house matrix cannot spill into statues");
    await desktop.waitForTimeout(550);
    await desktop.locator(".forest-scene").screenshot({ path: path.join(output, `${time}-${weather}.png`) });
    for (const kind of ["brokerage", "tax"]) await desktop.locator(`.house-${kind}`).screenshot({ path: path.join(output, `${time}-${weather}-${kind}.png`) });
    results.push(`visual captured: ${time}/${weather}, both houses at source scene size`);
  }
  await desktop.close();
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "results.json"), JSON.stringify({ results, realDevice: "NOT RUN" }, null, 2));
  console.log(JSON.stringify({ results, output, status: "SIMULATED TOUCH PASS; REAL DEVICE NOT RUN" }, null, 2));
} finally { await browser.close(); }
