import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "gorani-seasonal-background-qa"));
await mkdir(output, { recursive: true });

const changeByWeather = { sunny: 1, cloudy: -.5, rain: -1.5, thunderstorm: -2.5 };
const errors = [];
const failedSeasonalRequests = [];
const results = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

function marketPayload(weather) {
  const changePct = changeByWeather[weather];
  return {
    data: {
      latestSessionDate: "2026-09-18",
      previousSessionDate: "2026-09-17",
      latestClose: 100 + changePct,
      previousClose: 100,
      changePct,
      resolvedWeather: weather,
      source: "yahoo",
      fetchedAt: "2026-09-19T00:00:00.000Z",
    },
  };
}

async function configurePage(context, initialWeather = "sunny") {
  let marketWeather = initialWeather;
  const page = await context.newPage();
  await page.route("**/api/money-level/weather", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(marketPayload(marketWeather)) });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/art/background/seasonal/")) failedSeasonalRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await page.addInitScript(() => {
    localStorage.removeItem("gorani.money-level.weather.v1");
    localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify({
      brokerageValue: 427_486_959,
      isaPrincipal: 32_833_192,
      pensionPrincipal: 108_946_382,
      updatedAt: "2026-09-19T00:00:00.000Z",
    }));
  });
  return { page, setMarketWeather: (weather) => { marketWeather = weather; } };
}

async function waitForScene(page, expected) {
  await page.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await page.waitForFunction(({ season, weather, event }) => {
    const root = document.querySelector(".moneyLevelRoot");
    const image = document.querySelector(".scene-background-current");
    return root?.dataset.season === season
      && root?.dataset.weather === weather
      && root?.dataset.specialEvent === event
      && image?.complete
      && image.naturalWidth > 0;
  }, expected);
  await page.waitForTimeout(180);
}

async function inspectScenario(page, scenario, layout) {
  await page.goto(`${base}/money-level?date=${scenario.date}&time=${scenario.time ?? "day"}&weatherdebug=1`);
  await waitForScene(page, scenario.expected);
  const actual = await page.evaluate(() => {
    const root = document.querySelector(".moneyLevelRoot");
    const image = document.querySelector(".scene-background-current");
    const scene = document.querySelector(".forest-scene");
    return {
      season: root.dataset.season,
      weather: root.dataset.weather,
      event: root.dataset.specialEvent,
      src: image.getAttribute("src"),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit,
      objectPosition: getComputedStyle(image).objectPosition,
      activeRuntimeCount: Number(document.querySelector(".spine-forest-stage").dataset.activeRuntimeCount),
      sceneWidth: scene.clientWidth,
      sceneHeight: scene.clientHeight,
    };
  });
  assert.equal(actual.src, scenario.src);
  assert.equal(actual.objectFit, "cover");
  assert.equal(actual.activeRuntimeCount, 1);
  results.push({ layout, name: scenario.name, ...actual });
  await page.locator(".forest-scene").screenshot({ path: path.join(output, `${layout}-${scenario.name}.png`) });
}

try {
  const scenarios = [
    { name: "spring-sunny", date: "2026-04-16", baseWeather: "sunny", expected: { season: "spring", weather: "sunny", event: "none" }, src: "/money-level/art/background/seasonal/forest-spring-day-sunny.webp" },
    { name: "spring-payday-snow", date: "2026-04-17", baseWeather: "thunderstorm", expected: { season: "spring", weather: "snow", event: "none" }, src: "/money-level/art/background/seasonal/forest-spring-day-snow.webp" },
    { name: "summer-sunny", date: "2026-06-16", baseWeather: "sunny", expected: { season: "summer", weather: "sunny", event: "none" }, src: "/money-level/art/background/seasonal/forest-summer-day-sunny.webp" },
    { name: "summer-storm", date: "2026-06-16", baseWeather: "thunderstorm", expected: { season: "summer", weather: "thunderstorm", event: "none" }, src: "/money-level/art/background/seasonal/forest-summer-day-storm.webp" },
    { name: "summer-payday-leaf-shower", date: "2026-06-17", baseWeather: "thunderstorm", expected: { season: "summer", weather: "sunny", event: "payday-leaf-shower" }, src: "/money-level/art/background/seasonal/forest-summer-day-sunny.webp" },
    { name: "fall-sunny", date: "2026-09-16", baseWeather: "sunny", expected: { season: "fall", weather: "sunny", event: "none" }, src: "/money-level/art/background/seasonal/forest-fall-day-sunny.webp" },
    { name: "fall-payday-snow", date: "2026-09-17", baseWeather: "rain", expected: { season: "fall", weather: "snow", event: "none" }, src: "/money-level/art/background/seasonal/forest-fall-day-snow.webp" },
    { name: "winter-sunny", date: "2026-12-16", baseWeather: "sunny", expected: { season: "winter", weather: "sunny", event: "none" }, src: "/money-level/art/background/seasonal/forest-winter-day-sunny.webp" },
    { name: "winter-snow", date: "2026-12-16", baseWeather: "rain", expected: { season: "winter", weather: "snow", event: "none" }, src: "/money-level/art/background/seasonal/forest-winter-day-snow.webp" },
  ];

  for (const layout of [
    { name: "desktop", viewport: { width: 1320, height: 900 }, isMobile: false },
    { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true },
  ]) {
    const context = await browser.newContext({ viewport: layout.viewport, isMobile: layout.isMobile, hasTouch: layout.isMobile, reducedMotion: "no-preference" });
    const { page, setMarketWeather } = await configurePage(context);
    for (const scenario of scenarios) {
      setMarketWeather(scenario.baseWeather);
      await inspectScenario(page, scenario, layout.name);
    }

    setMarketWeather("thunderstorm");
    await page.goto(`${base}/money-level?date=2026-06-17&time=day`);
    await waitForScene(page, { season: "summer", weather: "sunny", event: "payday-leaf-shower" });
    const leafQa = await page.evaluate(async () => {
      const leaves = [...document.querySelectorAll(".payday-leaf-shower i")];
      const visible = leaves.filter((leaf) => getComputedStyle(leaf).display !== "none");
      const animated = visible.filter((leaf) => Number(getComputedStyle(leaf).opacity) > .1);
      const colors = new Set(visible.map((leaf) => getComputedStyle(leaf).backgroundColor));
      const layers = [...document.querySelectorAll(".payday-leaf-shower")].map((layer) => ({
        className: layer.className,
        pointerEvents: getComputedStyle(layer).pointerEvents,
      }));
      const before = visible.slice(0, 8).map((leaf) => getComputedStyle(leaf).transform);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const after = visible.slice(0, 8).map((leaf) => getComputedStyle(leaf).transform);
      return { total: leaves.length, visible: visible.length, animated: animated.length, colors: colors.size, layers, moved: before.some((value, index) => value !== after[index]) };
    });
    assert.equal(leafQa.total, 120);
    assert.ok(leafQa.visible >= (layout.isMobile ? 72 : 120));
    assert.ok(leafQa.animated >= (layout.isMobile ? 50 : 88), "Leaf rain must be immediately dense");
    assert.ok(leafQa.colors >= 4);
    assert.equal(leafQa.layers.length, 2);
    assert.ok(leafQa.layers.every((layer) => layer.pointerEvents === "none"));
    assert.equal(leafQa.moved, true);

    await page.goto(`${base}/money-level?date=2026-06-16&time=day&weather=cloudy&leafEffect=normal-windy`);
    await waitForScene(page, { season: "summer", weather: "cloudy", event: "normal-windy" });
    const normalWind = await page.evaluate(() => ({
      total: document.querySelectorAll(".wind-layer i").length,
      visible: [...document.querySelectorAll(".wind-layer i")].filter((leaf) => getComputedStyle(leaf).display !== "none").length,
      paydayLayers: document.querySelectorAll(".payday-leaf-shower").length,
    }));
    assert.equal(normalWind.total, 8);
    assert.equal(normalWind.visible, 3);
    assert.equal(normalWind.paydayLayers, 0);
    assert.ok(leafQa.visible >= normalWind.visible * 15, "Payday shower density must be unmistakably higher than normal windy");
    results.push({ layout: layout.name, normalWind, paydayLeafShower: leafQa });
    await context.close();
  }

  const interactionContext = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "no-preference" });
  const { page, setMarketWeather } = await configurePage(interactionContext, "sunny");
  setMarketWeather("sunny");
  await page.goto(`${base}/money-level?date=2026-04-16&time=day`);
  await waitForScene(page, { season: "spring", weather: "sunny", event: "none" });
  assert.equal(await page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.startBenchSitting("gorani")), true);
  await page.waitForFunction(() => window.__MONEY_LEVEL_DEBUG__.state().gorani.phase === "bench-sit", null, { timeout: 30_000 });
  const benchBefore = await page.evaluate(() => ({ state: window.__MONEY_LEVEL_DEBUG__.state().gorani, camera: window.__MONEY_LEVEL_DEBUG__.camera(), runtimes: window.__MONEY_LEVEL_DEBUG__.activeRuntimeCount() }));
  await page.evaluate(() => { history.pushState(null, "", "?date=2026-04-17&time=night"); dispatchEvent(new PopStateEvent("popstate")); });
  await waitForScene(page, { season: "spring", weather: "snow", event: "none" });
  const benchAfter = await page.evaluate(() => ({ state: window.__MONEY_LEVEL_DEBUG__.state().gorani, camera: window.__MONEY_LEVEL_DEBUG__.camera(), runtimes: window.__MONEY_LEVEL_DEBUG__.activeRuntimeCount() }));
  assert.equal(benchAfter.state.phase, "bench-sit");
  assert.deepEqual(benchAfter.state.position, benchBefore.state.position);
  assert.deepEqual(benchAfter.camera, benchBefore.camera);
  assert.equal(benchAfter.runtimes, 1);

  assert.equal(await page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.startFishing()), true);
  await page.waitForFunction(() => window.__MONEY_LEVEL_DEBUG__.state().gorani.phase === "fishing", null, { timeout: 30_000 });
  const fishingBefore = await page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.state().gorani);
  setMarketWeather("thunderstorm");
  await page.evaluate(() => { history.pushState(null, "", "?date=2026-06-17&time=evening"); dispatchEvent(new PopStateEvent("popstate")); });
  await waitForScene(page, { season: "summer", weather: "sunny", event: "payday-leaf-shower" });
  const fishingAfter = await page.evaluate(() => window.__MONEY_LEVEL_DEBUG__.state().gorani);
  assert.equal(fishingAfter.phase, "fishing");
  assert.deepEqual(fishingAfter.position, fishingBefore.position);
  assert.equal(await page.locator(".fishing-activity").isVisible(), true);
  await page.locator(".forest-scene").screenshot({ path: path.join(output, "desktop-state-preserved-fishing-leaf-shower.png") });

  const decoded = await page.evaluate(async () => {
    const seasons = ["spring", "summer", "fall", "winter"];
    const times = ["morning", "day", "evening", "night"];
    const weather = ["sunny", "cloudy", "rain", "storm", "snow"];
    const paths = seasons.flatMap((season) => times.flatMap((time) => weather
      .filter((value) => !(season === "summer" && value === "snow"))
      .map((value) => `/money-level/art/background/seasonal/forest-${season}-${time}-${value}.webp`)));
    const failures = [];
    await Promise.all(paths.map(async (src) => {
      const image = new Image();
      image.src = src;
      try { await image.decode(); } catch { failures.push(src); }
    }));
    return { count: paths.length, failures };
  });
  assert.equal(decoded.count, 76);
  assert.deepEqual(decoded.failures, []);
  await interactionContext.close();

  assert.deepEqual(failedSeasonalRequests, [], "Seasonal assets must not 404 or fail to load");
  assert.deepEqual(errors, [], "Forest UI must not emit console/page errors");
  console.log(JSON.stringify({ status: "PASS", scenarios: results.length, decodedAssets: 76, output, results }, null, 2));
} finally {
  await browser.close();
}
