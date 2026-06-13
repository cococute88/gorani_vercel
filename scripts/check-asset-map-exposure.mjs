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

const {
  buildAssetMapExposureFromHoldings,
  normalizeAssetMapTicker,
} = require("../lib/asset-map-exposure.ts");

function assertNear(actual, expected, tolerance, message) {
  assert.equal(Math.abs(actual - expected) <= tolerance, true, message);
}

function assertSectorSum(result, message) {
  const sum = result.sectorAllocation.reduce((acc, row) => acc + row.weightPct, 0);
  assertNear(sum, 100, 0.05, message);
}

function findHolding(result, ticker) {
  return result.effectiveHoldingsTop.find((row) => row.ticker === ticker);
}

function assertDirectStockOnly() {
  const result = buildAssetMapExposureFromHoldings([
    { ticker: "MSFT", name: "Microsoft", valueKRW: 1_000_000, assetType: "해외주식" },
    { ticker: "AAPL", name: "Apple", valueKRW: 2_000_000, assetType: "해외주식" },
  ]);

  assert.equal(result.source, "portfolio");
  assert.equal(result.totalValueKRW, 3_000_000);
  assert.equal(result.directValueKRW, 3_000_000);
  assert.ok(findHolding(result, "MSFT"));
  assert.ok(findHolding(result, "AAPL"));
  assertSectorSum(result, "direct-stock sector allocation should sum to 100%");
  assert.equal(result.coveragePct, 0, "no ETF holdings use documented 0% ETF coverage");

  return {
    case: "direct stock only",
    totalValueKRW: result.totalValueKRW,
    coveragePct: result.coveragePct,
    sectors: result.sectorAllocation.length,
  };
}

function assertCoveredEtf() {
  const result = buildAssetMapExposureFromHoldings([
    { ticker: "QQQ", name: "Invesco QQQ Trust", valueKRW: 10_000_000, assetType: "ETF" },
  ]);

  assert.equal(result.source, "portfolio");
  assert.equal(result.etfValueKRW, 10_000_000);
  assert.equal(result.coveredEtfValueKRW, 10_000_000);
  assert.equal(result.uncoveredEtfValueKRW, 0);
  assert.ok(findHolding(result, "MSFT"));
  assert.ok(result.coveragePct > 0 && result.coveragePct < 100);
  assert.ok(
    result.warnings.some((warning) => warning.includes("QQQ ETF fixture")),
    "partial QQQ fixture should be documented as partial",
  );

  return {
    case: "covered ETF",
    coveredEtfValueKRW: result.coveredEtfValueKRW,
    coveragePct: result.coveragePct,
    effectiveRows: result.effectiveHoldingsTop.length,
  };
}

function assertDirectAndEtfOverlap() {
  const result = buildAssetMapExposureFromHoldings([
    { ticker: "MSFT", name: "Microsoft", valueKRW: 1_000_000, assetType: "해외주식" },
    { ticker: "QQQ", name: "Invesco QQQ Trust", valueKRW: 10_000_000, assetType: "ETF" },
  ]);
  const msft = findHolding(result, "MSFT");

  assert.ok(msft, "MSFT should be present");
  assert.equal(msft.amountKRW, 1_870_000);
  assert.deepEqual(msft.sources, ["direct", "QQQ"]);

  return {
    case: "direct + ETF overlap",
    msftAmountKRW: msft.amountKRW,
    sources: msft.sources.join(", "),
  };
}

function assertUncoveredEtf() {
  const result = buildAssetMapExposureFromHoldings([
    { ticker: "UNKNOWNETF", name: "UNKNOWNETF", valueKRW: 5_000_000, assetType: "ETF" },
  ]);

  assert.equal(result.source, "mock");
  assert.equal(result.etfValueKRW, 5_000_000);
  assert.equal(result.uncoveredEtfValueKRW, 5_000_000);
  assert.equal(result.effectiveHoldingsTop.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("UNKNOWNETF")));

  return {
    case: "uncovered ETF",
    uncoveredEtfValueKRW: result.uncoveredEtfValueKRW,
    warnings: result.warnings.length,
  };
}

function assertTickerExtraction() {
  const cases = [
    [{ name: "①QQQ", valueKRW: 1_000_000 }, "QQQ"],
    [{ name: "①SPY", valueKRW: 1_000_000 }, "SPY"],
    [{ name: "①TQQQ", valueKRW: 1_000_000 }, "TQQQ"],
    [{ name: "삼성전자", valueKRW: 1_000_000 }, "005930.KS"],
    [{ name: "SK하이닉스", valueKRW: 1_000_000 }, "000660.KS"],
    [{ ticker: "①QLD", name: "tagged qld", valueKRW: 1_000_000 }, "QLD"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(normalizeAssetMapTicker(input), expected);
  }

  return {
    case: "ticker extraction",
    normalized: cases.map(([, expected]) => expected).join(", "),
  };
}

function main() {
  const rows = [
    assertDirectStockOnly(),
    assertCoveredEtf(),
    assertDirectAndEtfOverlap(),
    assertUncoveredEtf(),
    assertTickerExtraction(),
  ];

  console.log("Asset map exposure regression passed.");
  console.table(rows);
}

main();
