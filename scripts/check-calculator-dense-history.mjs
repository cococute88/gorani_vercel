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
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { defaultConversionInput, calculateConversionFromPrices } = require("../lib/conversion-calculator.ts");
const { defaultMddInput, calculateMddFromPrices, resolvePeriodWindow, slicePrices } = require("../lib/mdd-calculator.ts");
const { getTickerHistory } = require("../lib/calculator-data-provider.ts");

function makeTradingDays(start, end, base = 100) {
  const out = [];
  const d = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  let i = 0;
  while (d <= last) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push({
        date: d.toISOString().slice(0, 10),
        close: Number((base + i * 0.03 + Math.sin(i / 7) * 2).toFixed(4)),
      });
      i += 1;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const start = "2015-06-17";
const end = "2026-06-17";
const sellPrices = makeTradingDays(start, end, 110);
const buyPrices = makeTradingDays(start, end, 75);

const conversion = calculateConversionFromPrices(
  { ...defaultConversionInput, startDate: start, endDate: end, averageMonths: 36 },
  { sellPrices, buyPrices },
  { source: "yahoo", updatedAt: "fixture" },
);
assert.equal(conversion.rows.length, sellPrices.length, "conversion rows must keep every common daily trading date");

const mddPrices = makeTradingDays(start, end, 300);
const mddResults = {};
for (const period of ["3m", "1y", "5y", "10y", "max"]) {
  const window = resolvePeriodWindow(mddPrices, period);
  const windowPrices = slicePrices(mddPrices, window.start, window.end);
  const result = calculateMddFromPrices({ ...defaultMddInput, ticker: "QQQ", startDate: window.start, endDate: window.end }, windowPrices, { source: "yahoo" });
  mddResults[period] = result.series.length;
}

assert.ok(mddResults["3m"] >= 60, `3m should contain >=60 points, got ${mddResults["3m"]}`);
assert.ok(mddResults["1y"] >= 250, `1y should contain >=250 points, got ${mddResults["1y"]}`);
assert.ok(mddResults["5y"] >= 1200, `5y should contain >=1200 points, got ${mddResults["5y"]}`);
assert.ok(mddResults["10y"] >= 2500, `10y should contain >=2500 points, got ${mddResults["10y"]}`);
assert.ok(mddResults.max >= mddResults["10y"], "max range should not be smaller than 10y fixture");

const fallback = getTickerHistory("QQQ", "2021-06-17", "2026-06-17", 100);
assert.ok(fallback.length >= 1800, `client fallback should be daily calendar history, got ${fallback.length}`);

const conversionSource = fs.readFileSync(path.join(rootDir, "lib/conversion-calculator.ts"), "utf8");
assert.doesNotMatch(conversionSource, /sampleRows|slice\(-18\)|sampleEvery/, "conversion must not downsample chart/table rows to ~18 points");

console.log(JSON.stringify({
  conversion: {
    "3m": calculateConversionFromPrices({ ...defaultConversionInput, startDate: "2026-03-17", endDate: end }, { sellPrices: makeTradingDays("2026-03-17", end, 110), buyPrices: makeTradingDays("2026-03-17", end, 75) }, { source: "yahoo" }).rows.length,
    "1y": calculateConversionFromPrices({ ...defaultConversionInput, startDate: "2025-06-17", endDate: end }, { sellPrices: makeTradingDays("2025-06-17", end, 110), buyPrices: makeTradingDays("2025-06-17", end, 75) }, { source: "yahoo" }).rows.length,
    "5y": calculateConversionFromPrices({ ...defaultConversionInput, startDate: "2021-06-17", endDate: end }, { sellPrices: makeTradingDays("2021-06-17", end, 110), buyPrices: makeTradingDays("2021-06-17", end, 75) }, { source: "yahoo" }).rows.length,
    "10y": calculateConversionFromPrices({ ...defaultConversionInput, startDate: "2016-06-17", endDate: end }, { sellPrices: makeTradingDays("2016-06-17", end, 110), buyPrices: makeTradingDays("2016-06-17", end, 75) }, { source: "yahoo" }).rows.length,
    max: conversion.rows.length,
  },
  mdd: mddResults,
  fallbackDailyPoints5y: fallback.length,
}, null, 2));
