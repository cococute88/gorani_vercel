import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Optional browser QA dependency; use an installed Playwright via NODE_PATH.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "money-level-mobile-qa");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.MONEY_LEVEL_QA_CHANNEL ?? "chrome" });
const errors = [];
const results = [];
const near = (a, b, message, tolerance = 2) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);

async function setup(width, touch) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: touch, hasTouch: touch,
    reducedMotion: "reduce", ...(touch ? { userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36" } : {}) });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/money-level?time=day&weather=sunny`);
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await page.locator(".forest-scene").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.moneyLevelQAEvents = [];
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
      document.addEventListener(type, (event) => window.moneyLevelQAEvents.push({ type, trusted: event.isTrusted, pointerType: event.pointerType, target: event.target.id }), true);
    }
  });
  const cdp = await context.newCDPSession(page);
  const state = () => page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.state());
  const camera = () => page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.camera());
  const scene = async () => page.locator(".forest-scene").boundingBox();
  const send = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, radiusX: 2, radiusY: 2, force: 1 }] });
  const start = (x, y) => send("touchStart", x, y);
  const move = (x, y) => send("touchMove", x, y);
  const end = () => send("touchEnd");
  async function swipe(dx, dy) {
    const r = await scene();
    const x = r.x + (dx > 0 ? 65 : r.width - 65), y = r.y + 130;
    await start(x, y);
    for (let i = 1; i <= 10; i++) {
      await move(x + dx * i / 10, y + dy * i / 10);
      await page.waitForTimeout(18);
    }
    await end();
    await page.waitForTimeout(100);
  }
  const screen = async (master) => {
    const r = await scene(), c = await camera();
    return { x: r.x + master.x * c.scale - c.x, y: r.y + 2 + master.y * c.scale - c.cropY };
  };
  async function panToMaster(master) {
    for (let i = 0; i < 8; i++) {
      const r = await scene(), p = await screen(master);
      if (p.x >= r.x + 55 && p.x <= r.x + r.width - 55) return;
      await swipe(p.x < r.x + 55 ? 220 : -220, 1);
    }
    throw new Error(`Cannot reach master ${JSON.stringify(master)}`);
  }
  async function grab(id, jitter = false) {
    const r = await page.locator(`#${id}-drag-target`).boundingBox();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    assert.ok(x >= 0 && x <= width && y >= 0 && y <= 844, `${id} target is reachable`);
    await start(x, y);
    await page.waitForTimeout(120);
    if (jitter) await move(x + 6, y + 2);
    assert.notEqual((await state())[id].phase, "dragging", "no early drag at 100ms");
    await page.waitForTimeout(245);
    assert.equal((await state())[id].phase, "dragging", `${id} trusted touch long press`);
    const held = (await state())[id].position;
    const rScene = await scene(), c = await camera();
    // Pixel offset from finger to feet is preserved throughout camera motion.
    return { x: held.x / 100 * c.width + c.cropX - c.x + rScene.x - (x + (jitter ? 6 : 0)),
      y: held.y / 100 * c.height + rScene.y + 2 - (y + (jitter ? 2 : 0)) };
  }
  async function dropAt(id, master, offset) {
    const p = await screen(master);
    await move(p.x - offset.x, p.y - offset.y);
    await end();
  }
  async function edgeCarry(id, side, master, offset) {
    const r = await scene();
    const finger = { x: side === "right" ? r.x + r.width - 7 : r.x + 7, y: r.y + 220 };
    const before = (await camera()).x;
    await move(finger.x, finger.y);
    await page.waitForTimeout(150);
    assert.equal((await state())[id].phase, "dragging", "character drag takes priority over pan");
    for (let i = 0; i < 70; i++) {
      const c = await camera(), s = (await state())[id];
      near(r.x + s.position.x / 100 * c.width + c.cropX - c.x, finger.x + offset.x, `${id} stays attached during camera pan`, 3);
      const p = await screen(master);
      if (p.x > r.x + 65 && p.x < r.x + r.width - 65 && i >= 4) break;
      await page.waitForTimeout(80);
    }
    const after = (await camera()).x;
    assert.ok(side === "right" ? after > before + 25 : after < before - 25, `${id} ${side} edge auto-pan`);
    await dropAt(id, master, offset);
  }
  const waitPhase = (id, phase, timeout = 20000) => page.waitForFunction(({ id, phase }) => window.__MONEY_LEVEL_DEBUG__.state()[id].phase === phase, { id, phase }, { timeout });
  const waitRod = () => page.waitForFunction(() => document.querySelector(".fishing-activity")?.dataset.attached === "true");
  async function checkRod() {
    await waitRod();
    const values = await page.evaluate(() => {
      const c = window.__MONEY_LEVEL_DEBUG__.camera();
      const line = document.querySelector(".fishing-line"), bobber = document.querySelector(".fishing-bobber");
      const angle = parseFloat(line.style.transform.match(/rotate\(([-\d.]+)/)[1]) * Math.PI / 180;
      const length = parseFloat(line.style.height);
      return { x: parseFloat(line.style.left) - Math.sin(angle) * length, y: parseFloat(line.style.top) + Math.cos(angle) * length,
        bobberX: parseFloat(bobber.style.left), bobberY: parseFloat(bobber.style.top),
        screenBobberX: parseFloat(bobber.style.left) + c.cropX - c.x, c };
    });
    near(values.x, values.bobberX, "actual rod-tip line reaches bobber x", .02);
    near(values.y, values.bobberY, "actual rod-tip line reaches bobber y", .02);
    const master = width <= 560 ? { x: 1080, y: 804 } : { x: 1390, y: 788 };
    near(values.screenBobberX, master.x * values.c.scale - values.c.x, "bobber follows world during camera pan", .02);
  }
  return { context, page, state, camera, scene, screen, start, move, end, swipe, panToMaster, grab, dropAt, edgeCarry, waitPhase, waitRod, checkRod, cancel: () => send("touchCancel") };
}

try {
  const bench = { x: 302, y: 616 }, dock = { x: 1150, y: 781 };
  const m = await setup(390, true);
  let c = await m.camera();
  assert.ok(c.worldWidth > c.width * 2, "world retains original mobile cover scale");
  const initial = c.x;
  await m.swipe(-220, 2);
  assert.ok((await m.camera()).x > initial + 100, "A swipe left moves camera right");
  await m.swipe(220, 2);
  near((await m.camera()).x, initial, "A swipe right moves camera left", 3);
  results.push("A: trusted touch horizontal pan both directions");

  await m.page.evaluate(() => window.scrollTo(0, 0));
  const r = await m.scene();
  const beforeScroll = await m.page.evaluate(() => window.scrollY), beforeCamera = (await m.camera()).x;
  await m.start(280, r.y + 150);
  for (let i = 1; i <= 8; i++) { await m.move(282, r.y + 150 - i * 15); await m.page.waitForTimeout(20); }
  await m.end();
  await m.page.waitForTimeout(200);
  assert.ok(await m.page.evaluate(() => window.scrollY) > beforeScroll + 20, "B native vertical page scroll");
  near((await m.camera()).x, beforeCamera, "B vertical scroll leaves camera unchanged");
  await m.page.locator(".forest-scene").scrollIntoViewIfNeeded();
  results.push("B: native vertical scroll, camera unchanged");

  let offset = await m.grab("gorani", true);
  await m.edgeCarry("gorani", "right", dock, offset);
  await m.waitPhase("gorani", "fishing");
  await m.waitRod();
  await m.checkRod();
  await m.page.screenshot({ path: path.join(output, "390-gorani-fishing.png") });
  results.push("C/E: Gorani long press with 6px tremor, right edge carry, Dock drop → fishing");
  console.log("390px A/B/C/E passed");

  // Return camera with a blank swipe; the fishing actor's world position is invariant.
  const fishingPosition = (await m.state()).gorani.position;
  await m.panToMaster({ x: 842, y: 700 });
  await m.checkRod();
  assert.deepEqual((await m.state()).gorani.position, fishingPosition);
  offset = await m.grab("daramji", true);
  await m.edgeCarry("daramji", "left", bench, offset);
  await m.waitPhase("daramji", "bench-sit");
  await m.page.screenshot({ path: path.join(output, "390-daramji-bench.png") });
  results.push("D/F: Daramji long press, left edge carry, reachable Bench drop → sitting");

  offset = await m.grab("daramji");
  await m.edgeCarry("daramji", "right", dock, offset);
  await m.waitPhase("daramji", "fishing");
  await m.waitRod();
  await m.checkRod();
  assert.notEqual((await m.state()).gorani.phase, "fishing", "G exclusive fishing ownership");
  assert.equal((await m.state()).gorani.phase, "pond-watch", "G displaced fisher watches pond");
  results.push("G: Daramji replaces Gorani fishing; Gorani → Pond Watch");

  // Daramji goes back to bench; Gorani can then replace the bench occupant.
  offset = await m.grab("daramji");
  await m.edgeCarry("daramji", "left", bench, offset);
  await m.waitPhase("daramji", "bench-sit");
  await m.panToMaster({ x: 916, y: 674 });
  offset = await m.grab("gorani");
  await m.edgeCarry("gorani", "left", bench, offset);
  await m.waitPhase("gorani", "bench-sit");
  assert.equal((await m.state()).daramji.phase, "daily", "H previous bench sitter exits");
  c = await m.camera();
  const exit = (await m.state()).daramji.position;
  near(exit.x / 100 * c.width + c.cropX, 355 * c.scale, "H nearby grass exit x");
  near(exit.y / 100 * c.height + c.cropY, 662 * c.scale, "H nearby grass exit y");
  await m.page.screenshot({ path: path.join(output, "390-bench-replacement.png") });
  results.push("H: Gorani replaces Daramji bench; Daramji → nearby safe grass");
  console.log("390px D/F/G/H passed");

  await m.panToMaster({ x: 355, y: 662 });
  await m.grab("daramji");
  await m.cancel();
  assert.notEqual((await m.state()).daramji.phase, "dragging", "touch cancellation clears drag");
  assert.equal(await m.page.locator(".is-character-dragging").count(), 0);
  assert.equal(await m.page.locator(".is-grabbed").count(), 0);
  results.push("touchCancel: no stuck character, capture or grabbed CSS state; fishing line follows camera");

  // Sweep both bounds and verify the background never reveals empty space.
  for (const side of ["left", "right"]) {
    for (let i = 0; i < 6; i++) await m.swipe(side === "left" ? 220 : -220, 1);
    c = await m.camera();
    near(c.x, side === "left" ? 0 : c.maxX, `${side} camera clamp`, .1);
    const boxes = await m.page.evaluate(() => ({ scene: document.querySelector(".forest-scene").getBoundingClientRect().toJSON(), background: document.querySelector(".scene-background-current").getBoundingClientRect().toJSON(), bodyWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
    assert.ok(boxes.background.left <= boxes.scene.left + .1 && boxes.background.right >= boxes.scene.right - .1, "background covers camera viewport");
    assert.equal(boxes.bodyWidth, boxes.width, "no body horizontal scrolling");
  }
  const events = await m.page.evaluate(() => window.moneyLevelQAEvents);
  assert.ok(events.some((e) => e.type === "pointercancel" && e.pointerType === "touch"), "native scroll cancels pointer sequence");
  assert.ok(events.filter((e) => e.pointerType === "touch").every((e) => e.trusted), "QA uses trusted browser touch, not synthetic PointerEvent");
  results.push("390px: camera clamp/background coverage/body overflow/trusted touch verified");
  await m.context.close();

  const tablet = await setup(768, true);
  const tabletBefore = (await tablet.camera()).x;
  await tablet.swipe(-100, 1);
  assert.ok((await tablet.camera()).x >= tabletBefore, "tablet touch camera pan");
  for (const id of ["gorani", "daramji"]) {
    await tablet.grab(id, true);
    await tablet.cancel();
    assert.notEqual((await tablet.state())[id].phase, "dragging");
  }
  results.push("768px tablet: trusted touch pan, both character long-press and cancellation");
  await tablet.context.close();

  for (const width of [768, 1320]) {
    const desktop = await setup(width, false);
    const targetMaster = { x: 302, y: 616 };
    // Mouse pan also makes tablet cover-cropped Bench reachable.
    for (let i = 0; i < 4; i++) {
      const p = await desktop.screen(targetMaster), r = await desktop.scene();
      if (p.x >= r.x + 45) break;
      await desktop.page.mouse.move(r.x + 60, r.y + 120);
      await desktop.page.mouse.down();
      await desktop.page.mouse.move(r.x + 280, r.y + 120, { steps: 12 });
      await desktop.page.mouse.up();
    }
    for (const id of ["daramji", "gorani"]) {
      const r = await desktop.page.locator(`#${id}-drag-target`).boundingBox();
      await desktop.page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await desktop.page.mouse.down();
      const c = await desktop.camera(), sr = await desktop.scene(), held = (await desktop.state())[id].position;
      const offset = { x: held.x / 100 * c.width + c.cropX - c.x + sr.x - r.x - r.width / 2,
        y: held.y / 100 * c.height + sr.y + 2 - r.y - r.height / 2 };
      const p = await desktop.screen(targetMaster);
      await desktop.page.mouse.move(p.x - offset.x, p.y - offset.y, { steps: 12 });
      await desktop.page.mouse.up();
      await desktop.waitPhase(id, "bench-sit");
    }
    assert.equal((await desktop.state()).daramji.phase, "daily");
    await desktop.page.screenshot({ path: path.join(output, `${width}-desktop-bench.png`) });
    results.push(`${width}px: desktop mouse drag, bench ownership replacement regression`);
    for (const id of ["gorani", "daramji"]) {
      const r = await desktop.page.locator(`#${id}-drag-target`).boundingBox();
      await desktop.page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await desktop.page.mouse.down();
      const c = await desktop.camera(), sr = await desktop.scene(), held = (await desktop.state())[id].position;
      const offset = { x: held.x / 100 * c.width + c.cropX - c.x + sr.x - r.x - r.width / 2,
        y: held.y / 100 * c.height + sr.y + 2 - r.y - r.height / 2 };
      const dockMaster = { x: 1258, y: 777 };
      let p = await desktop.screen(dockMaster);
      if (p.x > sr.x + sr.width - 45) {
        await desktop.page.mouse.move(sr.x + sr.width - 7, sr.y + 220, { steps: 12 });
        for (let i = 0; i < 40; i++) {
          p = await desktop.screen(dockMaster);
          if (p.x < sr.x + sr.width - 45) break;
          await desktop.page.waitForTimeout(50);
        }
      }
      p = await desktop.screen(dockMaster);
      await desktop.page.mouse.move(p.x - offset.x, p.y - offset.y, { steps: 12 });
      await desktop.page.mouse.up();
      await desktop.waitPhase(id, "fishing");
      await desktop.checkRod();
    }
    assert.equal((await desktop.state()).gorani.phase, "pond-watch");
    await desktop.page.screenshot({ path: path.join(output, `${width}-desktop-fishing.png`) });
    results.push(`${width}px: mouse Dock drops, both fishing rigs, fishing replacement → Pond Watch`);
    await desktop.context.close();
  }
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(JSON.stringify({ results, screenshots: output, input: "Chrome CDP Input.dispatchTouchEvent: isTrusted=true, pointerType=touch; Android UA; 390px; held 345ms (280ms threshold); REAL DEVICE NOT RUN" }, null, 2));
} finally {
  await browser.close();
}
