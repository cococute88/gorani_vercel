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
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { buildAssetMapExposureFromHoldings, normalizeAssetMapTicker } = require("../lib/asset-map-exposure.ts");

function row(result, ticker) {
  return result.effectiveHoldingsTop.find((item) => item.ticker === ticker);
}
function assertNoWrapperRows(result) {
  const forbidden = ["토스SPYM", "키움QQQ", "삼성위탁SCHD", "미래연금ACE미국S&P500", "UNKNOWNETF", "미래연금국채혼합MMF"];
  for (const item of result.effectiveHoldingsTop) {
    for (const value of forbidden) {
      assert.equal(item.name.includes(value) || item.ticker.includes(value), false, `${value} leaked into TOP 100`);
    }
  }
}

const aliasCases = [
  [{ name: "토스SPYM", valueKRW: 1_000_000, assetType: "ETF" }, "SPYM"],
  [{ name: "키움QQQ", valueKRW: 1_000_000, assetType: "ETF" }, "QQQ"],
  [{ name: "키움TQQQ", valueKRW: 1_000_000, assetType: "ETF" }, "TQQQ"],
  [{ name: "키움QLD", valueKRW: 1_000_000, assetType: "ETF" }, "QLD"],
  [{ name: "삼성위탁SCHD", valueKRW: 1_000_000, assetType: "ETF" }, "SCHD"],
  [{ name: "미래연금ACE미국S&P500", valueKRW: 1_000_000, assetType: "ETF" }, "SPY"],
  [{ name: "미래연금ACE미국나스닥100", valueKRW: 1_000_000, assetType: "ETF" }, "QQQ"],
  [{ ticker: "360200.KS", name: "ACE미국S&P500", valueKRW: 1_000_000, assetType: "ETF" }, "SPY"],
  [{ ticker: "379780.KS", name: "RISE미국S&P500", valueKRW: 1_000_000, assetType: "ETF" }, "SPY"],
  [{ ticker: "367380.KS", name: "ACE미국나스닥100", valueKRW: 1_000_000, assetType: "ETF" }, "QQQ"],
  [{ ticker: "368590.KS", name: "RISE미국나스닥100", valueKRW: 1_000_000, assetType: "ETF" }, "QQQ"],
  [{ ticker: "360750.KS", name: "TIGER미국S&P500", valueKRW: 1_000_000, assetType: "ETF" }, "SPY"],
];
for (const [input, expected] of aliasCases) assert.equal(normalizeAssetMapTicker(input), expected);

const result = buildAssetMapExposureFromHoldings([
  { name: "토스SPYM", valueKRW: 10_000_000, assetType: "ETF" },
  { ticker: "QQQ", name: "Invesco QQQ", valueKRW: 20_000_000, assetType: "ETF" },
  { ticker: "GOOGL", name: "Alphabet direct", valueKRW: 1_000_000, assetType: "해외주식" },
  { ticker: "UNKNOWNETF", name: "UNKNOWNETF", valueKRW: 3_000_000, assetType: "ETF" },
  { name: "알수없는상품", valueKRW: 2_000_000, assetType: "ETF" },
  { ticker: "MSFT", name: "invalid", valueKRW: Number.NaN, assetType: "해외주식" },
  { ticker: "AAPL", name: "zero", valueKRW: 0, assetType: "해외주식" },
  { name: "미래연금국채혼합MMF", valueKRW: 4_000_000, assetType: "MMF" },
  { ticker: "360200.KS", name: "ACE미국S&P500", valueKRW: 5_000_000, assetType: "ETF" },
]);

assert.equal(result.source, "portfolio");
assert.equal(result.etfValueKRW, 38_000_000);
assert.equal(result.coveredEtfValueKRW, 35_000_000);
assert.equal(result.uncoveredEtfValueKRW, 3_000_000);
assert.ok(result.analyzedValueKRW > 1_000_000);
assert.ok(result.excludedHoldings.some((item) => item.ticker === "UNKNOWNETF" && item.reason === "constituents_unavailable"));
assert.ok(result.excludedHoldings.some((item) => item.name === "알수없는상품"));
assert.ok(result.excludedHoldings.some((item) => item.name === "미래연금국채혼합MMF" && item.reason === "not_look_through_target"));
assert.ok(row(result, "MSFT"));
assert.ok(row(result, "COST"));
assert.ok(row(result, "TSLA"));
const googl = row(result, "GOOGL");
assert.ok(googl);
assert.ok(googl.amountKRW > 1_000_000, "direct GOOGL and ETF GOOGL should be summed");
assert.ok(googl.sources.includes("direct") && googl.sources.includes("QQQ") && googl.sources.includes("SPYM"));
assertNoWrapperRows(result);
assert.equal(result.totalValueKRW, 45_000_000, "invalid/zero values excluded from total");

console.log("Asset-map ETF decomposition regression passed.");
console.table({
  aliases: aliasCases.length,
  topRows: result.effectiveHoldingsTop.length,
  analyzedValueKRW: result.analyzedValueKRW,
  uncoveredEtfValueKRW: result.uncoveredEtfValueKRW,
  excludedRows: result.excludedHoldings.length,
});
