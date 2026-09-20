import assert from "node:assert/strict";
import { chromium } from "playwright";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "money-level-house-world-qa");
const washed = path.join(process.cwd(), "art-review/money-level/house-crisp-review");
const temporaryFrames = {
  "temporary-camp-spring-summer.webp": { canvas: [1536, 1024], ground: [768, 900] },
  "temporary-camp-fall.webp": { canvas: [1536, 1024], ground: [768, 900] },
  "temporary-camp-winter.webp": { canvas: [1536, 1024], ground: [768, 900] },
  "temporary-tent-neutral.webp": { canvas: [1448, 1086], ground: [748, 1016] },
  "temporary-tent-yellow.webp": { canvas: [1536, 1024], ground: [764, 976] },
  "temporary-house-fall.webp": { canvas: [1448, 1086], ground: [723, 1048] },
  "temporary-house-winter.webp": { canvas: [1536, 1024], ground: [768, 970] },
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [], review = [], errors = [];
async function ready(page) {
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await page.waitForFunction(() => [...document.querySelectorAll(".house-art-image,.scene-background-current,.forest-statue")].every(i => i.complete && i.naturalWidth));
  await page.waitForTimeout(550);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("gorani.money-level.settings.v1", JSON.stringify({ leftStatue: "stone-bear", rightStatue: "gold-bear" })));
  for (const width of [1440, 1320, 1100, 980, 768]) for (const height of [760, 1100]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/money-level?time=day&weather=sunny`);
    await ready(page);
    const geometry = await page.evaluate((frames) => {
      const scene = document.querySelector(".forest-scene"), bg = document.querySelector(".scene-background-current");
      const b = bg.getBoundingClientRect(), s = scene.getBoundingClientRect();
      const scale = Math.max(b.width / 1683, b.height / 935), cropY = (935 * scale - b.height) / 2;
      return [...document.querySelectorAll(".house-card")].map(h => {
        const box = h.getBoundingClientRect(), image = h.querySelector("img"), name = image.getAttribute("src").split("/").pop(), frame = frames[name];
        const groundScreenX = box.x + frame.ground[0] / frame.canvas[0] * box.width;
        const groundScreenY = box.y + frame.ground[1] / frame.canvas[1] * box.height;
        return { kind: h.classList.contains("house-brokerage") ? "brokerage" : "tax",
          src: image.getAttribute("src"),
          groundX: (groundScreenX - b.x) / scale,
          groundY: (groundScreenY - b.y + cropY) / scale,
          sceneWidth: s.width, sceneHeight: scene.clientHeight };
      });
    }, temporaryFrames);
    for (const h of geometry) {
      const world = h.kind === "brokerage" ? [599.805, 390.35, 622.71] : [1246.884, 414.905, 495.6435];
      const expectedGround = [world[0], world[1] + world[2] * 388 / 1536];
      assert.ok(h.src.includes("/money-level/art/houses/temporary-"), `${h.kind} cannot resolve legacy art`);
      assert.ok(Math.abs(h.groundX - expectedGround[0]) < .1, `rendered ${h.kind} ground x stable: ${h.groundX} vs ${expectedGround[0]}`);
      assert.ok(Math.abs(h.groundY - expectedGround[1]) < .1, `rendered ${h.kind} ground y stable: ${h.groundY} vs ${expectedGround[1]}`);
    }
    const name = `geometry-${width}-${height}.png`;
    await page.locator(".forest-scene").screenshot({ path: path.join(output, name) });
    review.push(`<figure><img src="${name}"><figcaption>${width}×${height}</figcaption></figure>`);
    results.push({ viewport: `${width}×${height}`, geometry });
  }
  await page.setViewportSize({ width: 1320, height: 900 });
  for (const stages of ["current", "max"]) {
    const context = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(stages => {
      localStorage.setItem("gorani.money-level.settings.v1", JSON.stringify({ leftStatue: "stone-bear", rightStatue: "gold-bear" }));
      if (stages === "max") localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify({ brokerageValue: 950000000, isaPrincipal: 500000000, pensionPrincipal: 450000000, updatedAt: "2026-09-13T09:00:00.000Z" }));
    }, stages);
    const p = await context.newPage(); p.on("pageerror", e => errors.push(e.message));
    for (const [time, weather] of [["day", "sunny"], ["morning", "sunny"], ["evening", "sunny"], ["evening", "cloudy"], ["evening", "rain"], ["night", "sunny"], ["night", "cloudy"], ["night", "thunderstorm"]]) {
      const images = [];
      for (const mode of ["off", "on"]) {
        await p.goto(`${base}/money-level?time=${time}&weather=${weather}&houseAmbient=${mode}`);
        await ready(p);
        const assets = await p.locator(".house-card").evaluateAll(xs => xs.map(x => ({ level: x.dataset.level, art: x.dataset.art, src: x.querySelector("img").getAttribute("src") })));
        if (stages === "max") assert.ok(assets.every(a => a.level === "19"));
        assert.equal(await p.locator(".moneyLevelRoot").getAttribute("data-time-of-day"), time);
        const name = `${stages}-${time}-${weather}-${mode}.png`;
        await p.locator(".forest-scene").screenshot({ path: path.join(output, name) });
        for (const kind of ["brokerage", "tax"]) await p.locator(`.house-${kind}`).screenshot({ path: path.join(output, `${stages}-${time}-${weather}-${mode}-${kind}.png`) });
        images.push(name);
        results.push({ stages, time, weather, mode, assets });
      }
      for (const kind of ["brokerage", "tax"]) review.push(`<section><h2>${stages} ${kind}: ${time}/${weather}</h2><div class="pair"><figure><img src="${images[0].replace(".png", `-${kind}.png`)}"><figcaption>A: existing filter-only / C: ambient OFF (identical base)</figcaption></figure><figure><img src="${images[1].replace(".png", `-${kind}.png`)}"><figcaption>B: filter + alpha-clipped ambient</figcaption></figure></div></section>`);
    }
    for (const [time, weather] of [["evening", "sunny"], ["night", "sunny"], ["night", "thunderstorm"]]) {
      for (const mode of ["source", "ambient-only"]) {
        await p.goto(`${base}/money-level?time=${time}&weather=${weather}`); await ready(p);
        await p.evaluate(mode => {
          const filter = document.querySelector('filter:not([id$="-statue"])');
          if (mode === "source") for (const image of document.querySelectorAll(".house-art-image")) image.style.filter = "none";
          else {
            filter.querySelector("feColorMatrix").setAttribute("values", "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0");
            for (const image of document.querySelectorAll(".house-art-image")) image.style.filter = `url(#${filter.id})`;
          }
        }, mode);
        await p.waitForTimeout(600);
        for (const kind of ["brokerage", "tax"]) await p.locator(`.house-${kind}`).screenshot({ path: path.join(output, `${stages}-${time}-${weather}-${mode}-${kind}.png`) });
      }
      for (const kind of ["brokerage", "tax"]) {
        const stem = `${stages}-${time}-${weather}`;
        await copyFile(path.join(washed, `${stem}-washed-${kind}.png`), path.join(output, `${stem}-washed-${kind}.png`));
        await copyFile(path.join(washed, `${stem}-old-filter-${kind}.png`), path.join(output, `${stem}-old-filter-${kind}.png`));
        review.push(`<section><h2>Pipeline: ${stages} ${kind} ${time}/${weather}</h2><div class="pipeline">${[["source", "1. Source (existing radial mask retained)"], ["old-filter", "2. Previous filter only"], ["ambient-only", "3. Ambient only"], ["washed", "4. Old filter + washed ambient"], ["on", "5. Final crisp composite"], ["off", "New ambient OFF"]].map(([mode, label]) => `<figure><img src="${stem}-${mode}-${kind}.png"><figcaption>${label}</figcaption></figure>`).join("")}</div></section>`);
      }
    }
    // Use the ACTUAL runtime SVG filter with a translucent test sprite. Rasterize
    // both modes in-browser and verify every pixel's alpha is unchanged, including
    // anti-aliased edges, while interior RGB changes under Night ambient.
    await p.goto(`${base}/money-level?time=night&weather=sunny`); await ready(p);
    const alpha = await p.evaluate(async () => {
      const actual = document.querySelector('filter:not([id$="-statue"])').cloneNode(true);
      actual.id = "alpha-qa";
      const rasterize = async off => {
        const filter = actual.cloneNode(true);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><defs>${filter.outerHTML}</defs><g ${off ? "" : 'filter="url(#alpha-qa)"'}>${[.25, .5, .75, 1].map((a, i) => `<rect x="${10.4 + i * 20}" y="10.4" width="14.4" height="40.4" fill="#a58c46" opacity="${a}"/>`).join("")}<rect x="10" y="54" width="70" height="6" fill="#000"/></g></svg>`;
        const image = new Image(); image.src = "data:image/svg+xml;base64," + btoa(svg); await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 64;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, 96, 64).data;
      };
      const a = await rasterize(true), b = await rasterize(false);
      let alphaDelta = 0, transparentTint = 0, rgbDelta = 0, blackLift = 0;
      for (let i = 0; i < a.length; i += 4) {
        alphaDelta = Math.max(alphaDelta, Math.abs(a[i + 3] - b[i + 3]));
        if (!a[i + 3] && (b[i] || b[i + 1] || b[i + 2] || b[i + 3])) transparentTint++;
        if (a[i + 3] === 255 && a[i] + a[i + 1] + a[i + 2] === 0) blackLift = Math.max(blackLift, b[i], b[i + 1], b[i + 2]);
        if (a[i + 3] === 255) rgbDelta = Math.max(rgbDelta, Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]));
      }
      return { alphaDelta, transparentTint, rgbDelta, blackLift };
    });
    assert.ok(alpha.alphaDelta <= 1, "fractional alpha stays unchanged, no halo/duplicate edges");
    assert.equal(alpha.transparentTint, 0, "transparent pixels receive zero ambient color");
    assert.equal(alpha.blackLift, 0, "ambient never washes black illustration outlines");
    assert.ok(alpha.rgbDelta > 0, "ambient changes opaque surface color");
    results.push({ stages, alpha });
    await context.close();
  }
  await page.close();
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "review.html"), `<!doctype html><meta charset="utf-8"><title>House world geometry and ambient comparison</title><style>body{background:#e9eddf;color:#273629;margin:20px;font-family:system-ui}img{width:100%}figure{margin:0 0 24px}figcaption{padding:8px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pipeline{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}h2{font-size:18px}</style><h1>House world geometry / ambient review</h1><p>Current/max runtime stages. Existing max fallback artwork retained. Pipeline separates source, previous filter, ambient only, interrupted washed WIP, and final. Physical Android regression not run.</p>${review.join("\n")}`);
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: "PASS", ratios: 10, lightingPairs: 16, houseComparisons: 32, output }));
} finally { await browser.close(); }
