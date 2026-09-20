import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "gorani-camp-assets-qa"));
await mkdir(output, { recursive: true });

const dates = { spring: "2026-04-16", summer: "2026-06-16", fall: "2026-09-16", winter: "2026-12-16" };
const expected = {
  spring: "temporary-camp-spring-summer.webp",
  summer: "temporary-camp-spring-summer.webp",
  fall: "temporary-camp-fall.webp",
  winter: "temporary-camp-winter.webp",
};
const master = "/money-level/art/houses/tax-stage-10-15-camp-plus-alpha-v2.webp";
const errors = [], failedRequests = [], results = [];

const snapshot = { brokerageValue: 1.25e8, isaPrincipal: .5e8, pensionPrincipal: .75e8, updatedAt: "2026-09-20T00:00:00.000Z" };

async function ready(page) {
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await page.waitForFunction(() => {
    const root = document.querySelector(".moneyLevelRoot");
    const cards = [...document.querySelectorAll(".house-card")];
    return root?.dataset.taxStage === "camp-plus" && cards.length === 2
      && cards.every((card) => card.querySelector("img")?.complete && card.querySelector("img")?.naturalWidth > 0);
  });
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const layout of [
    { name: "desktop", viewport: { width: 1320, height: 900 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ]) {
    const context = await browser.newContext({ viewport: layout.viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${layout.name}: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${layout.name}: ${message.text()}`); });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/art/houses/")) failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
    });

    for (const [season, date] of Object.entries(dates)) {
      await page.goto(`${base}/money-level?date=${date}&time=day&weather=sunny`);
      await page.evaluate((value) => localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify(value)), snapshot);
      await page.reload();
      await ready(page);

      const runtime = await page.evaluate(async ({ expectedFile, masterSrc }) => {
        async function decode(src) {
          const image = new Image(); image.src = src; await image.decode();
          const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const bounds = (threshold) => {
            let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
            for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
              if (pixels[(y * canvas.width + x) * 4 + 3] < threshold) continue;
              x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            }
            return [x0, y0, x1 + 1, y1 + 1];
          };
          let darkPartial = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            if (alpha > 0 && alpha < 240 && Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) < 16) darkPartial++;
          }
          return { width: image.naturalWidth, height: image.naturalHeight, bounds8: bounds(8), coreBounds240: bounds(240), darkPartial };
        }
        const scene = document.querySelector(".forest-scene").getBoundingClientRect();
        const mobile = innerWidth <= 720;
        const scale = Math.max(scene.width / 1683, scene.height / 935);
        const cropX = (1683 * scale - scene.width) * (mobile ? .51 : .5);
        const cropY = (935 * scale - scene.height) * .5;
        const placements = {
          brokerage: { x: 599.805 * scale - cropX, y: 390.35 * scale - cropY, width: 622.71 * scale },
          tax: { x: 1246.884 * scale - cropX, y: 414.905 * scale - cropY, width: 495.6435 * scale },
        };
        const cards = [...document.querySelectorAll(".house-card")].map((card) => {
          const kind = card.classList.contains("house-tax") ? "tax" : "brokerage";
          const box = card.getBoundingClientRect();
          return { kind, src: card.querySelector("img").getAttribute("src"), width: box.width, expectedWidth: placements[kind].width };
        });
        const decoded = await decode(`/money-level/art/houses/${expectedFile}`);
        const masterDecoded = await decode(masterSrc);
        return { cards, decoded, masterDecoded, placements };
      }, { expectedFile: expected[season], masterSrc: master });
      assert.ok(runtime.cards.every((card) => card.src.endsWith(expected[season])));
      if (layout.name === "desktop") {
        assert.ok(runtime.cards.every((card) => Math.abs(card.width - card.expectedWidth) < .1), `${layout.name}/${season}: camp runtime frame must be identity`);
      }
      assert.deepEqual([runtime.decoded.width, runtime.decoded.height], [1536, 1024]);
      if (season === "winter") assert.equal(runtime.decoded.darkPartial, 0, `${layout.name}/${season}: dark alpha fringe`);
      await page.locator(".forest-scene").screenshot({ path: path.join(output, `${layout.name}-${season}-runtime.png`) });

      await page.evaluate(async ({ masterSrc, placements }) => {
        const cards = [...document.querySelectorAll(".house-card")];
        for (const card of cards) {
          const kind = card.classList.contains("house-tax") ? "tax" : "brokerage";
          const placement = placements[kind];
          card.style.setProperty("--house-x", `${placement.x}px`);
          card.style.setProperty("--house-y", `${placement.y}px`);
          card.style.setProperty("--house-width", `${placement.width}px`);
          const image = card.querySelector("img"); image.src = masterSrc; await image.decode();
        }
      }, { masterSrc: master, placements: runtime.placements });
      await page.locator(".forest-scene").screenshot({ path: path.join(output, `${layout.name}-${season}-master.png`) });
      results.push({ layout: layout.name, season, asset: expected[season], ...runtime });
    }
    await context.close();
  }
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: "PASS", scenarios: results.length, failedRequests: 0, errors: 0, output }));
} finally {
  await browser.close();
}
