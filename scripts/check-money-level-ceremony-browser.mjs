import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "money-level-ceremony-qa");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem("gorani.money-level.settings.v1", JSON.stringify({ leftStatue: "stone-bear", rightStatue: "gold-bear" })));
  const page = await context.newPage();
  await page.goto(`${base}/money-level?time=day&weather=sunny&interactionDebug=1`);
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await page.locator(".forest-scene").scrollIntoViewIfNeeded();
  const cdp = await context.newCDPSession(page);
  const send = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: /End|Cancel/.test(type) ? [] : [{ x, y, radiusX: 9, radiusY: 9, force: .6 }] });
  const geometry = () => page.evaluate(() => {
    const s = document.querySelector(".forest-scene"), b = s.getBoundingClientRect();
    const width = s.clientWidth, height = s.clientHeight, scale = Math.max(width / 1683, height / 935), worldWidth = scale * 1683;
    return { left: b.left + s.clientLeft, top: b.top + s.clientTop, width, height, scale, cropX: (worldWidth - width) * .51,
      cropY: (935 * scale - height) / 2, cameraX: Number(s.dataset.cameraX), maxX: Number(s.dataset.cameraMaxX) };
  });
  const states = () => page.evaluate(() => {
    const stage = document.querySelector(".spine-forest-stage");
    return Object.fromEntries(["gorani", "daramji"].map(id => {
      const a = document.querySelector(`.character-hit-anchor[data-character-anchor="${id}"]`);
      return [id, { x: parseFloat(a.style.left), y: parseFloat(a.style.top), phase: stage.dataset[`${id}Phase`], animation: stage.dataset[`${id}Animation`] }];
    }));
  });
  const screen = async master => { const g = await geometry(); return { x: g.left + master.x * g.scale - g.cameraX, y: g.top + master.y * g.scale - g.cropY }; };
  async function panTo(master) {
    for (let i = 0; i < 8; i++) {
      const g = await geometry(), p = await screen(master);
      if (p.x >= g.left + 55 && p.x <= g.left + g.width - 55) return;
      const dx = p.x < g.left + 55 ? 180 : -180, x = g.left + (dx > 0 ? 70 : g.width - 70), y = g.top + 100;
      await send("touchStart", x, y);
      for (let j = 1; j <= 6; j++) await send("touchMove", x + dx * j / 6, y + 1);
      await send("touchEnd");
    }
    throw new Error("target not reachable by forest pan");
  }
  async function grab(id) {
    let g = await geometry(), s = (await states())[id];
    await panTo({ x: (s.x / 100 * g.width + g.cropX) / g.scale, y: (s.y / 100 * g.height + g.cropY) / g.scale });
    const box = await page.locator(`#${id}-drag-target`).boundingBox();
    const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await send("touchStart", p.x, p.y); await page.waitForTimeout(330);
    assert.equal(await page.locator(".forest-scene").getAttribute("data-pointer-owner"), "CHARACTER_DRAG");
    g = await geometry(); s = (await states())[id];
    return { x: g.left + s.x / 100 * g.width + g.cropX - g.cameraX - p.x, y: g.top + s.y / 100 * g.height - p.y };
  }
  async function drop(id, slot, point) {
    const offset = await grab(id);
    let p = await screen(point), g = await geometry();
    if (p.x < g.left + 55 || p.x > g.left + g.width - 55) {
      const right = p.x > g.left + g.width - 55;
      await send("touchMove", g.left + (right ? g.width - 7 : 7), g.top + 230);
      for (let i = 0; i < 90; i++) {
        p = await screen(point); g = await geometry();
        if (p.x >= g.left + 55 && p.x <= g.left + g.width - 55) break;
        await page.waitForTimeout(60);
      }
    }
    p = await screen(point);
    await send("touchMove", p.x - offset.x, p.y - offset.y); await send("touchEnd");
    await page.waitForFunction(id => document.querySelector(".spine-forest-stage").dataset[`${id}Phase`] === "statue-appreciation", id, { timeout: 30000 });
    const all = await states(), s = all[id]; g = await geometry();
    const owners = await page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.ceremonyOwners());
    const assigned = Object.keys(owners).find(slot => owners[slot] === id);
    const anchor = { CEREMONY_LEFT_A: { x: 470, y: 751.6, offset: 0 }, CEREMONY_LEFT_B: { x: 694, y: 736, offset: 0 }, CEREMONY_RIGHT: { x: 1370, y: 593, offset: 0 } }[assigned];
    assert.ok(Math.abs(s.x / 100 * g.width - (anchor.x * g.scale - g.cropX)) < .1);
    assert.ok(Math.abs(s.y / 100 * g.height - (anchor.y * g.scale - g.cropY + anchor.offset)) < .1);
    assert.equal(s.animation, "ceremony_valentinesday");
    assert.ok(Object.values(all).filter(s => s.phase === "statue-appreciation").length <= 2);
    assert.ok(Math.hypot(all.gorani.x-all.daramji.x,all.gorani.y-all.daramji.y)>.1);
    const name = `390-${slot}-${id}-${point.y}.png`;
    await page.locator(".forest-scene").screenshot({ path: path.join(output, name) });
    results.push({ id, slot, drop: point, anchor, state: s });
  }
  await drop("gorani", "left", { x: 475, y: 684 });
  await drop("daramji", "left", { x: 470, y: 794 });
  await drop("gorani", "right", { x: 1360, y: 562 });
  await drop("daramji", "right", { x: 1365, y: 602 });
  await writeFile(path.join(output, "results.json"), JSON.stringify({ results, status: "SIMULATED TOUCH PASS; REAL DEVICE REGRESSION NOT RUN" }, null, 2));
  console.log(JSON.stringify({ results, output, status: "SIMULATED TOUCH PASS; REAL DEVICE REGRESSION NOT RUN" }));
  await context.close();
} finally { await browser.close(); }
