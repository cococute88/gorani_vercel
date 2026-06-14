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
    return originalResolveFilename.call(
      this,
      path.join(rootDir, request.slice(2)),
      parent,
      isMain,
      options,
    );
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

const { formatChartMonthTick } = require("../lib/chart-style.ts");
const {
  VIX_THRESHOLDS,
  buildRsiSeries,
  buildDrawdownSeries,
  buildVixSeries,
} = require("../lib/mock-market-data.ts");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertMonthTickFormatter() {
  // YYYY-MM / YYYY-MM-DD → YY/MM
  assert.equal(formatChartMonthTick("2026-03"), "26/03");
  assert.equal(formatChartMonthTick("2026-01"), "26/01");
  assert.equal(formatChartMonthTick("2026-06-14"), "26/06");
  assert.equal(formatChartMonthTick("2025-12-31"), "25/12");
  // Date 객체 / timestamp 도 안전 처리
  assert.equal(formatChartMonthTick(new Date(2026, 2, 9)), "26/03");
  assert.equal(formatChartMonthTick(new Date(2026, 2, 9).getTime()), "26/03");
  // invalid date 방어: 원본 문자열 유지, 비문자열은 빈 문자열
  assert.equal(formatChartMonthTick("T-52"), "T-52");
  assert.equal(formatChartMonthTick(""), "");
  assert.equal(formatChartMonthTick(null), "");
  assert.equal(formatChartMonthTick(undefined), "");
  assert.equal(formatChartMonthTick(Number.NaN), "");

  return { case: "month tick formatter", sample: formatChartMonthTick("2026-03") };
}

function assertSeriesDates() {
  for (const range of ["6개월", "1년", "3년", "5년", "전체"]) {
    for (const point of buildRsiSeries(range)) {
      assert.ok(ISO_DATE.test(point.date), `RSI date should be ISO: ${point.date}`);
      assert.ok(formatChartMonthTick(point.date) !== point.date, "RSI date must format to YY/MM");
    }
    for (const point of buildVixSeries(range)) {
      assert.ok(ISO_DATE.test(point.date), `VIX date should be ISO: ${point.date}`);
    }
  }
  return { case: "series dates are ISO + formattable" };
}

function assertDrawdownIsNegativeFromZero() {
  let min = 0;
  let max = 0;
  for (const point of buildDrawdownSeries("1년")) {
    assert.ok(ISO_DATE.test(point.date), `drawdown date should be ISO: ${point.date}`);
    for (const ticker of ["QQQ", "SCHD", "SPY"]) {
      const v = Number(point[ticker]);
      assert.ok(Number.isFinite(v), "drawdown value must be numeric");
      assert.ok(v <= 0, `drawdown must be 0-baseline negative, got ${v}`);
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  assert.ok(min < 0, "drawdown should reach below zero");
  assert.ok(max <= 0, "drawdown should never exceed zero");
  return { case: "drawdown 0-baseline negative", min, max };
}

function assertVixThresholds() {
  assert.deepEqual(VIX_THRESHOLDS, { high: 30, watch: 20 });
  return { case: "vix thresholds", high: VIX_THRESHOLDS.high, watch: VIX_THRESHOLDS.watch };
}

function main() {
  const rows = [
    assertMonthTickFormatter(),
    assertSeriesDates(),
    assertDrawdownIsNegativeFromZero(),
    assertVixThresholds(),
  ];

  console.log("Market chart formatters regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("Market chart formatters regression failed.");
  console.error(error);
  process.exit(1);
}
