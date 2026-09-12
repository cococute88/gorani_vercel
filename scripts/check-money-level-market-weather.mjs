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

const source = fs.readFileSync(path.join(rootDir, "lib/server/money-level-weather-source.ts"), "utf8");
const hook = fs.readFileSync(path.join(rootDir, "lib/money-level/use-money-level-market-weather.ts"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "components/money-level/money-level.css"), "utf8");
assert.ok(source.includes("fetchYahooChart"), "Money Level weather must reuse the existing Yahoo chart helper");
assert.ok(source.includes("range: \"1m\"") && source.includes("events: \"history\""), "Money Level weather must use daily history");
assert.ok(!source.includes("regularMarketPrice") && !source.includes("adjclose"), "weather must use regular daily close, not intraday or adjusted close");
assert.ok(hook.includes("lastKnown.resolvedWeather") && hook.includes("resolveMoneyLevelSeededWeather"), "fallback order must retain last-known then seeded weather");
assert.ok(css.includes("prefers-reduced-motion") && css.includes("pointer-events: none"), "weather overlays must be accessible and non-interactive");

console.log("Money Level SPY market weather checks passed");
