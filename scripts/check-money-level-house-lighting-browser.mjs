import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "gorani-house-lighting-qa"));
await mkdir(output, { recursive: true });

const layouts = [
  { name: "desktop", viewport: { width: 1320, height: 900 }, mobile: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, mobile: true },
];
const dates = { spring: "2026-04-16", fall: "2026-09-16", winter: "2026-12-16" };
const times = ["morning", "day", "evening", "night"];
const stageValues = { camp: 1.25e8, "tent-neutral": 1.75e8, "tent-yellow": 2.75e8, house: 3.25e8 };
const errors = [], failedRequests = [], results = [], projections = [];

function snapshot(value) {
  return { brokerageValue: value, isaPrincipal: value * .4, pensionPrincipal: value * .6, updatedAt: "2026-09-20T00:00:00.000Z" };
}

async function ready(page) {
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await page.waitForFunction(() => {
    const bg = document.querySelector(".scene-background-current");
    const houses = [...document.querySelectorAll(".house-art-image")];
    return bg?.complete && bg.naturalWidth > 0 && houses.length === 2 && houses.every((image) => image.complete && image.naturalWidth > 0);
  });
  await page.waitForTimeout(250);
}

async function openScenario(page, { season, time, weather, value }) {
  await page.evaluate((payload) => localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify(payload)), snapshot(value));
  await page.goto(`${base}/money-level?date=${dates[season]}&time=${time}&weather=${weather}`);
  await ready(page);
}

async function inspect(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".moneyLevelRoot");
    const scene = document.querySelector(".forest-scene").getBoundingClientRect();
    const container = document.querySelector(".scene-illustration").getBoundingClientRect();
    const image = document.querySelector(".scene-background-current");
    const imageStyle = getComputedStyle(image);
    const scale = Math.max(container.width / image.naturalWidth, container.height / image.naturalHeight);
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    const cropX = Math.max(0, renderedWidth - container.width);
    const cropY = Math.max(0, renderedHeight - container.height);
    const filter = document.querySelector('filter:not([id$="-statue"])');
    const matrix = filter?.querySelector("feColorMatrix")?.getAttribute("values");
    const transfers = [...(filter?.querySelectorAll("feComponentTransfer") ?? [])].map((node) => node.outerHTML);
    return {
      season: root.dataset.season,
      time: root.dataset.timeOfDay,
      weather: root.dataset.weather,
      assets: [...document.querySelectorAll(".house-card")].map((card) => card.querySelector("img").getAttribute("src")),
      houseFilter: getComputedStyle(document.querySelector(".house-art-image")).filter,
      matrix,
      transfers,
      background: {
        src: image.getAttribute("src"), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        sourceAspect: image.naturalWidth / image.naturalHeight,
        objectFit: imageStyle.objectFit, objectPosition: imageStyle.objectPosition,
        sceneWidth: scene.width, sceneHeight: scene.height,
        containerWidth: container.width, containerHeight: container.height,
        coverScale: scale, renderedWidth, renderedHeight,
        cropLeft: cropX / 2, cropRight: cropX / 2, cropTop: cropY / 2, cropBottom: cropY / 2,
        visibleSourceY: [cropY / 2 / scale, (cropY / 2 + container.height) / scale],
        scaleX: renderedWidth / image.naturalWidth, scaleY: renderedHeight / image.naturalHeight,
      },
    };
  });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const layout of layouts) {
    const context = await browser.newContext({ viewport: layout.viewport, isMobile: layout.mobile, hasTouch: layout.mobile, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${layout.name}: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${layout.name}: ${message.text()}`); });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/money-level/art/")) failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
    });
    await page.goto(`${base}/money-level?date=${dates.fall}&time=day&weather=sunny`);

    for (const season of Object.keys(dates)) for (const time of times) {
      await openScenario(page, { season, time, weather: "sunny", value: stageValues.house });
      const actual = await inspect(page);
      assert.equal(actual.season, season);
      assert.equal(actual.time, time);
      results.push({ layout: layout.name, group: "time-house", season, time, weather: "sunny", ...actual });
      await page.locator(".forest-scene").screenshot({ path: path.join(output, `${layout.name}-${season}-house-${time}-sunny.png`) });
      if (time === "day") {
        const projection = { layout: layout.name, season, ...actual.background };
        assert.equal(projection.objectFit, "cover");
        assert.equal(projection.objectPosition, layout.mobile ? "51% 50%" : "50% 50%");
        assert.ok(Math.abs(projection.scaleX - projection.scaleY) < 1e-10, `${layout.name}/${season}: aspect ratio must remain uniform`);
        assert.ok(Math.abs(projection.cropTop - projection.cropBottom) < .01, `${layout.name}/${season}: vertical crop must be symmetric`);
        projections.push(projection);
      }
    }

    for (const season of Object.keys(dates)) for (const stage of ["camp", "tent-neutral", "tent-yellow"]) for (const time of ["day", "evening", "night"]) {
      await openScenario(page, { season, time, weather: "sunny", value: stageValues[stage] });
      const actual = await inspect(page);
      results.push({ layout: layout.name, group: "asset-material", season, stage, time, weather: "sunny", ...actual });
      await page.locator(".house-tax").screenshot({ path: path.join(output, `${layout.name}-${season}-${stage}-${time}-sunny-tax.png`) });
    }

    for (const scenario of [
      ["fall", "evening", "sunny"], ["fall", "evening", "rain"], ["fall", "evening", "thunderstorm"],
      ["fall", "night", "sunny"], ["fall", "night", "rain"], ["fall", "night", "thunderstorm"],
      ["winter", "night", "snow"],
    ]) {
      const [season, time, weather] = scenario;
      await openScenario(page, { season, time, weather, value: stageValues.house });
      const actual = await inspect(page);
      results.push({ layout: layout.name, group: "weather-stress", season, time, weather, ...actual });
      await page.locator(".forest-scene").screenshot({ path: path.join(output, `${layout.name}-${season}-house-${time}-${weather}.png`) });
    }
    await context.close();
  }
  assert.deepEqual(failedRequests, [], "house/background assets must not fail");
  assert.deepEqual(errors, [], "browser console/page errors");
  await writeFile(path.join(output, "results.json"), JSON.stringify({ results, projections, failedRequests, errors }, null, 2));
  console.log(JSON.stringify({ status: "PASS", scenarios: results.length, projections: projections.length, failedRequests: 0, errors: 0, output }));
} finally {
  await browser.close();
}
