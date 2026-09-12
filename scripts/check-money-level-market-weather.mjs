#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  buildMoneyLevelMarketWeatherData,
  resolveMoneyLevelMarketWeather,
  selectLatestCompletedSessionCloses,
} = require("../lib/money-level/market-weather.ts");
const {
  moneyLevelPreviewOverridesEnabled,
  parseMoneyLevelPreviewOverrides,
} = require("../lib/money-level/preview.ts");
const {
  resolveMoneyLevelTimeOfDay,
  resolveMoneyLevelWindIntensity,
} = require("../lib/money-level/weather.ts");
const {
  FOREST_WEATHER_BACKGROUNDS,
  resolveForestBackground,
} = require("../lib/money-level/forest/scene-config.ts");

for (const [changePct, expected] of [
  [2, "sunny"],
  [0, "sunny"],
  [-0.01, "cloudy"],
  [-0.99, "cloudy"],
  [-1, "rain"],
  [-1.99, "rain"],
  [-2, "thunderstorm"],
  [-5, "thunderstorm"],
]) {
  assert.equal(resolveMoneyLevelMarketWeather(changePct), expected, `${changePct}% must resolve to ${expected}`);
}

const fridaySession = {
  date: "2026-09-11",
  startEpochSeconds: 1_789_133_400,
  endEpochSeconds: 1_789_156_800,
};
const weekendRows = [
  { date: "2026-09-09", close: 101 },
  { date: "2026-09-10", close: 102 },
  { date: "2026-09-11", close: 103 },
];
assert.deepEqual(
  selectLatestCompletedSessionCloses(weekendRows, fridaySession.endEpochSeconds + 86_400, fridaySession),
  [weekendRows[2], weekendRows[1]],
  "weekend must retain Friday and Thursday as the latest two sessions",
);

const holidayRows = [
  { date: "2026-09-03", close: 100 },
  { date: "2026-09-04", close: 101 },
  { date: "2026-09-08", close: 99 },
];
const tuesdaySession = {
  date: "2026-09-08",
  startEpochSeconds: 1_788_874_200,
  endEpochSeconds: 1_788_897_600,
};
assert.deepEqual(
  selectLatestCompletedSessionCloses(holidayRows, tuesdaySession.endEpochSeconds + 1, tuesdaySession),
  [holidayRows[2], holidayRows[1]],
  "Labor Day gap must not create a synthetic Monday session",
);

assert.deepEqual(
  selectLatestCompletedSessionCloses(weekendRows, fridaySession.startEpochSeconds + 3_600, fridaySession),
  [weekendRows[1], weekendRows[0]],
  "an in-progress regular-session bar must be excluded",
);

assert.equal(selectLatestCompletedSessionCloses([], fridaySession.endEpochSeconds, fridaySession), null, "missing latest data must fail closed");
assert.equal(selectLatestCompletedSessionCloses([weekendRows[0]], fridaySession.endEpochSeconds, fridaySession), null, "missing previous data must fail closed");
assert.equal(selectLatestCompletedSessionCloses(weekendRows, fridaySession.endEpochSeconds, null), null, "missing session metadata must not admit a possibly intraday bar");
assert.equal(buildMoneyLevelMarketWeatherData(null, new Date().toISOString()), null, "missing sessions must not fabricate weather");
assert.throws(() => resolveMoneyLevelMarketWeather(Number.NaN), RangeError, "malformed change must be rejected");

for (const [hour, minute, expected] of [
  [4, 59, "night"],
  [5, 0, "morning"],
  [8, 59, "morning"],
  [9, 0, "day"],
  [11, 59, "day"],
  [12, 0, "day"],
  [15, 59, "day"],
  [16, 0, "evening"],
  [18, 59, "evening"],
  [19, 0, "night"],
]) {
  assert.equal(
    resolveMoneyLevelTimeOfDay(new Date(2026, 8, 12, hour, minute)),
    expected,
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} must resolve to ${expected}`,
  );
}

assert.equal(resolveMoneyLevelWindIntensity("sunny"), "none");
assert.equal(resolveMoneyLevelWindIntensity("cloudy"), "breeze");
assert.equal(resolveMoneyLevelWindIntensity("rain"), "breeze");
assert.equal(resolveMoneyLevelWindIntensity("thunderstorm"), "strong");

assert.equal(moneyLevelPreviewOverridesEnabled({ nodeEnv: "development" }), true, "local development must allow QA overrides");
assert.equal(moneyLevelPreviewOverridesEnabled({ nodeEnv: "production", vercelEnv: "preview" }), true, "Vercel Preview must allow QA overrides");
assert.equal(moneyLevelPreviewOverridesEnabled({ nodeEnv: "production", vercelEnv: "production" }), false, "Production must reject QA overrides");
assert.deepEqual(
  parseMoneyLevelPreviewOverrides("?weather=rain&time=evening&weatherdebug=1", true),
  { weather: "rain", time: "evening", debug: true, ambientEnabled: true },
  "weather and time overrides must compose",
);
assert.equal(parseMoneyLevelPreviewOverrides("?time=am", true).time, "day", "AM preview alias must resolve to day");
assert.equal(parseMoneyLevelPreviewOverrides("?time=pm", true).time, "day", "PM preview alias must resolve to day");
assert.equal(parseMoneyLevelPreviewOverrides("?ambient=off", true).ambientEnabled, false, "Preview ambient toggle must disable motion");
assert.deepEqual(
  parseMoneyLevelPreviewOverrides("?weather=thunderstorm&time=evening&weatherdebug=1", false),
  { weather: null, time: null, debug: false, ambientEnabled: true },
  "disabled Production gate must ignore every override",
);
assert.deepEqual(
  parseMoneyLevelPreviewOverrides("?weather=snow&time=midnight", true),
  { weather: null, time: null, debug: false, ambientEnabled: true },
  "unknown preview values must be rejected",
);

for (const time of ["morning", "day", "evening", "night"]) {
  for (const weather of ["sunny", "cloudy", "rain", "thunderstorm"]) {
    const suffix = weather === "thunderstorm" ? "storm" : weather;
    const expected = `/money-level/art/background/forest-${time}-${suffix}.webp`;
    assert.equal(FOREST_WEATHER_BACKGROUNDS[time][weather], expected, `${time}/${weather} must map explicitly`);
    assert.equal(resolveForestBackground(time, weather), expected, `${time}/${weather} resolver mismatch`);
  }
}

const source = fs.readFileSync(path.join(rootDir, "lib/server/money-level-weather-source.ts"), "utf8");
const hook = fs.readFileSync(path.join(rootDir, "lib/money-level/use-money-level-market-weather.ts"), "utf8");
const page = fs.readFileSync(path.join(rootDir, "app/money-level/page.tsx"), "utf8");
const scene = fs.readFileSync(path.join(rootDir, "components/money-level/MoneyLevelScene.tsx"), "utf8");
const sceneConfig = fs.readFileSync(path.join(rootDir, "lib/money-level/forest/scene-config.ts"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "components/money-level/money-level.css"), "utf8");
assert.ok(source.includes("fetchYahooChart"), "Money Level weather must reuse the existing Yahoo chart helper");
assert.ok(source.includes("range: \"1m\"") && source.includes("events: \"history\""), "Money Level weather must use daily history");
assert.ok(!source.includes("regularMarketPrice") && !source.includes("adjclose"), "weather must use regular daily close, not intraday or adjusted close");
assert.ok(hook.includes("lastKnown.resolvedWeather") && hook.includes("resolveMoneyLevelSeededWeather"), "fallback order must retain last-known then seeded weather");
assert.ok(page.includes("process.env.VERCEL_ENV") && page.includes("previewOverridesEnabled"), "server page must gate Vercel Preview overrides from deployment metadata");
assert.ok(hook.includes("parseMoneyLevelPreviewOverrides(window.location.search, previewOverridesEnabled)"), "client overrides must use the server-provided gate");
assert.ok(!hook.includes("hostname"), "client must not guess Preview from its hostname");
for (const time of ["morning", "day", "evening", "night"]) {
  for (const weather of ["sunny", "cloudy", "rain", "storm"]) {
    assert.ok(sceneConfig.includes(`forest-${time}-${weather}.webp`), `${time}/${weather} must have a pre-rendered background`);
  }
}
assert.ok(!css.includes("--money-level-time-filter") && !css.includes("--money-level-weather-filter") && !css.includes("weather-atmosphere"), "runtime must not double-grade completed backgrounds");
assert.ok(scene.includes("BACKGROUND_CROSSFADE_MS = 800") && scene.includes("new Image()"), "backgrounds must crossfade after loading only the requested asset");
assert.ok(css.includes("--money-level-time-ambient") && css.includes("--money-level-character-time-ambient"), "foreground objects and characters must share restrained scene lighting");
assert.ok(css.includes(".wind-breeze") && css.includes(".wind-strong"), "weather visuals must share one intensity-based wind system");
assert.ok(css.includes("money-level-leaf-breeze") && css.includes("translate3d(28vw,-14px") && css.includes("translate3d(56vw,22px"), "breeze leaves must follow a curved fluttering trajectory");
assert.ok(scene.includes("rain-depth-") && scene.includes("Array.from({ length: 48 }") && css.includes("nth-child(n+31)") && css.includes("--rain-angle"), "rain must use subtle multi-depth drops with denser storm reuse");
assert.ok(scene.includes("pond-shimmer-layer") && scene.includes("pond-ripple-layer") && css.includes("@keyframes money-level-pond-shimmer") && css.includes("money-level-pond-ripple"), "pond motion must include subtle shimmer and weather ripples");
assert.ok(scene.includes("sky-drift-layer") && css.includes("@keyframes money-level-sky-drift"), "cloudy weather must include a slow sky-only atmosphere drift");
assert.ok(scene.includes("18_000 + Math.random() * 20_000") && !css.includes("money-level-lightning-bolt"), "lightning must be an irregular diffuse sky illumination without a bolt sprite");
assert.ok(css.includes("prefers-reduced-motion") && css.includes(".wind-layer, .moneyLevelRoot .pond-ripple-layer, .moneyLevelRoot .lightning-layer{ display: none !important; }"), "reduced motion must disable leaves, ripples, and lightning");
assert.ok(scene.includes("ambientEnabled") && css.includes(".ambient-off .ambient-motion-layer"), "Preview ambient-off comparison must disable every ambient layer");
assert.ok(css.includes("pointer-events: none"), "weather overlays must be non-interactive");
assert.ok(![page, hook, scene, css].some((value) => value.includes("reference/")), "local visual references must never enter the runtime bundle");

console.log("Money Level SPY market weather checks passed");
