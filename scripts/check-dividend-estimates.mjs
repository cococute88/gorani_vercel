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
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  buildDividendEstimateForHolding,
  estimateAverageCostFromPrincipal,
  estimateQuantityFromValue,
  getTtmDividendPerShare,
  getUniqueDividendEstimateTickers,
} = require("../lib/dividend-estimates.ts");

const asOf = new Date("2026-06-14T00:00:00.000Z");
const usdFx = {
  pair: "USDKRW",
  source: "yahoo",
  updatedAt: "2026-06-14T00:00:00.000Z",
  warnings: [],
  rate: 1375,
  date: "2026-06-13",
};
const usdQuote = {
  ticker: "SCHD",
  normalizedTicker: "SCHD",
  source: "yahoo",
  updatedAt: "2026-06-14T00:00:00.000Z",
  warnings: [],
  price: 100,
  date: "2026-06-13",
};
const krwQuote = {
  ticker: "360200.KS",
  normalizedTicker: "360200.KS",
  source: "yahoo",
  updatedAt: "2026-06-14T00:00:00.000Z",
  warnings: [],
  price: 10_000,
  date: "2026-06-13",
};
const dividends = {
  ticker: "SCHD",
  normalizedTicker: "SCHD",
  source: "yahoo",
  updatedAt: "2026-06-14T00:00:00.000Z",
  warnings: [],
  dividends: [
    { date: "2025-05-01", amount: 9 },
    { date: "2025-07-01", amount: 2 },
    { date: "2026-03-01", amount: 1 },
  ],
};

function assertUsdQuantity() {
  const estimate = buildDividendEstimateForHolding(
    { ticker: "SCHD", valueKRW: 1_375_000, principalKRW: 1_100_000 },
    { quote: usdQuote, fx: usdFx, dividends },
    { asOf },
  );

  assert.equal(estimate.currentPriceKRW, 137_500);
  assert.equal(estimate.estimatedQuantity, 10);
  assert.equal(estimate.estimatedAverageCost, 80);
  assert.equal(estimate.ttmDividendPerShare, 3);
  assert.equal(estimate.annualDividendKRW, 41_250);
  assert.equal(Math.round(estimate.personalYieldPct * 100) / 100, 3.75);
  assert.deepEqual(estimate.dividendMonths.map((month) => month.month), [7, 3]);

  return {
    case: "USD quote + FX estimates quantity/dividend",
    quantity: estimate.estimatedQuantity,
    averageCostUSD: estimate.estimatedAverageCost,
    annualDividendKRW: estimate.annualDividendKRW,
  };
}

function assertKrwQuantity() {
  const estimate = buildDividendEstimateForHolding(
    { ticker: "360200.KS", valueKRW: 100_000, principalKRW: 80_000 },
    { quote: krwQuote, dividends: { ...dividends, ticker: "360200.KS", normalizedTicker: "360200.KS" } },
    { asOf },
  );

  assert.equal(estimate.currentPriceKRW, 10_000);
  assert.equal(estimate.estimatedQuantity, 10);
  assert.equal(estimate.estimatedAverageCost, 8_000);
  assert.equal(estimate.annualDividendKRW, 30);

  return {
    case: "KRW quote estimates quantity/dividend",
    quantity: estimate.estimatedQuantity,
    averageCostKRW: estimate.estimatedAverageCost,
  };
}

function assertPureCalculators() {
  assert.equal(estimateQuantityFromValue(1_000_000, 50_000), 20);
  assert.equal(estimateQuantityFromValue(0, 50_000), undefined);
  assert.equal(estimateAverageCostFromPrincipal(1_000_000, 20, "KRW"), 50_000);
  assert.equal(estimateAverageCostFromPrincipal(1_375_000, 10, "USD", 1375), 100);
  return { case: "pure calculator helpers" };
}

function assertTtmDividends() {
  const ttm = getTtmDividendPerShare(dividends.dividends, asOf);
  assert.equal(ttm.amount, 3);
  assert.deepEqual(ttm.rows.map((row) => row.date), ["2025-07-01", "2026-03-01"]);
  return { case: "TTM dividend sum", ttmDividendPerShare: ttm.amount };
}

function assertMissingDividendHistory() {
  const estimate = buildDividendEstimateForHolding(
    { ticker: "SCHD", valueKRW: 1_375_000, principalKRW: 1_100_000 },
    { quote: usdQuote, fx: usdFx, dividends: { ...dividends, dividends: [] } },
    { asOf },
  );

  assert.equal(estimate.annualDividendKRW, undefined);
  assert.equal(estimate.warnings.some((warning) => warning.code === "dividend_missing"), true);
  return { case: "missing dividend history stays unavailable" };
}

function assertQuoteFailure() {
  const estimate = buildDividendEstimateForHolding(
    { ticker: "SCHD", valueKRW: 1_375_000, principalKRW: 1_100_000 },
    { fx: usdFx, dividends },
    { asOf },
  );

  assert.equal(estimate.currentPrice, undefined);
  assert.equal(estimate.estimatedQuantity, undefined);
  assert.equal(estimate.warnings.some((warning) => warning.code === "quote_missing"), true);
  return { case: "quote failure blocks current price/quantity" };
}

function assertFxFailure() {
  const estimate = buildDividendEstimateForHolding(
    { ticker: "SCHD", valueKRW: 1_375_000, principalKRW: 1_100_000 },
    { quote: usdQuote, fx: { ...usdFx, source: "sample" }, dividends },
    { asOf },
  );

  assert.equal(estimate.estimatedQuantity, undefined);
  assert.equal(estimate.annualDividendKRW, undefined);
  assert.equal(estimate.warnings.some((warning) => warning.code === "fx_sample"), true);
  return { case: "FX sample/failure blocks USD estimates" };
}

function assertTickerDedupe() {
  const tickers = getUniqueDividendEstimateTickers([
    { ticker: "schd" },
    { ticker: "SCHD" },
    { ticker: "SPY" },
    { ticker: "" },
  ]);
  assert.deepEqual(tickers, ["SCHD", "SPY"]);
  return { case: "same ticker dedupe", tickers: tickers.join(", ") };
}

function assertNoSourceMutation() {
  const source = { ticker: "SCHD", valueKRW: 1_375_000, principalKRW: 1_100_000 };
  const before = JSON.stringify(source);
  buildDividendEstimateForHolding(source, { quote: usdQuote, fx: usdFx, dividends }, { asOf });
  assert.equal(JSON.stringify(source), before);
  return { case: "source holding input is not mutated" };
}

function assertNoMockYieldDependency() {
  const helperSource = fs.readFileSync(path.join(rootDir, "lib", "dividend-estimates.ts"), "utf8");
  assert.equal(helperSource.includes("DIVIDEND_YIELDS"), false);
  assert.equal(helperSource.includes("annualYieldPct"), false);
  return { case: "mock DIVIDEND_YIELDS not used" };
}

const rows = [
  assertUsdQuantity(),
  assertKrwQuantity(),
  assertPureCalculators(),
  assertTtmDividends(),
  assertMissingDividendHistory(),
  assertQuoteFailure(),
  assertFxFailure(),
  assertTickerDedupe(),
  assertNoSourceMutation(),
  assertNoMockYieldDependency(),
];

console.log("Dividend estimate regression passed.");
console.table(rows);
