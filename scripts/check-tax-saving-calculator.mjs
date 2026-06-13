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
  DEFAULT_DIVIDEND_TAX_RATE,
  DEFAULT_TAX_RETENTION_RATE,
  DEFAULT_TAX_SAVING_INVESTMENT_USD,
  calculateExpectedDividendTaxSaving,
} = require("../lib/tax-saving-calculator.ts");

const {
  buildTaxSavingRows,
} = require("../lib/mock-calendar-data.ts");

const {
  calculateHistoricalTaxSavingMetric,
} = require("../lib/historical-tax-saving-calculator.ts");

function assertNear(actual, expected, message) {
  assert.equal(Math.abs(actual - expected) < 1e-10, true, message);
}

function calendarEvent({
  ticker,
  type,
  date,
  dividendAmount,
  sourceKind = "declared",
}) {
  return {
    id: `${ticker}-${type}-${date}`,
    canonicalEventId: `${ticker}-${type}-${date}`,
    legacyEventId: `${ticker}-${type}-${date}`,
    sourceKind,
    ticker,
    type,
    date,
    status: "confirmed",
    dividendAmount,
    buyDeadline: date,
    exDivDate: date,
    paymentDate: "",
    annualYield: 0,
    taxSavingUsd: 0,
  };
}

function assertValidCalculation() {
  const result = calculateExpectedDividendTaxSaving({
    investmentAmountUsd: 10000,
    currentPrice: 100,
    dividendAmountPerShare: 1,
    taxRetentionRate: 0.85,
    dividendTaxRate: 0.22,
  });

  assert.equal(result.canCalculate, true);
  assert.equal(result.expectedShares, 100);
  assert.equal(result.expectedDividendUsd, 100);
  assertNear(result.taxSavingUsd, 18.7, "case 1 taxSavingUsd");
  assert.deepEqual(result.warnings, []);

  return result;
}

function assertDefaultCalculation() {
  const result = calculateExpectedDividendTaxSaving({
    currentPrice: 33,
    dividendAmountPerShare: 0.5,
  });
  const expectedDividendUsd = Math.floor(DEFAULT_TAX_SAVING_INVESTMENT_USD / 33) * 0.5;
  const expectedTaxSavingUsd = expectedDividendUsd * DEFAULT_TAX_RETENTION_RATE * DEFAULT_DIVIDEND_TAX_RATE;

  assert.equal(result.canCalculate, true);
  assert.equal(result.expectedShares, 303);
  assert.equal(result.expectedDividendUsd, expectedDividendUsd);
  assertNear(result.taxSavingUsd, expectedTaxSavingUsd, "case 2 taxSavingUsd");
  assert.deepEqual(result.warnings, []);

  return result;
}

function assertMissingPrice() {
  const result = calculateExpectedDividendTaxSaving({
    currentPrice: null,
    dividendAmountPerShare: 1,
  });

  assert.equal(result.canCalculate, false);
  assert.equal(result.taxSavingUsd, 0);
  assert.equal(result.warnings.length > 0, true);
  assert.equal(result.warnings.some((warning) => warning.includes("currentPrice")), true);

  return result;
}

function assertMissingDividend() {
  const result = calculateExpectedDividendTaxSaving({
    currentPrice: 100,
    dividendAmountPerShare: null,
  });

  assert.equal(result.canCalculate, false);
  assert.equal(result.taxSavingUsd, 0);
  assert.equal(result.warnings.length > 0, true);
  assert.equal(result.warnings.some((warning) => warning.includes("dividendAmountPerShare")), true);

  return result;
}

function assertInvalidValues() {
  const cases = [
    ["zero price", { currentPrice: 0, dividendAmountPerShare: 1 }],
    ["negative price", { currentPrice: -10, dividendAmountPerShare: 1 }],
    ["zero dividend", { currentPrice: 100, dividendAmountPerShare: 0 }],
    ["negative dividend", { currentPrice: 100, dividendAmountPerShare: -1 }],
    ["zero investment", { investmentAmountUsd: 0, currentPrice: 100, dividendAmountPerShare: 1 }],
    ["negative investment", { investmentAmountUsd: -1000, currentPrice: 100, dividendAmountPerShare: 1 }],
    ["zero expected shares", { investmentAmountUsd: 50, currentPrice: 100, dividendAmountPerShare: 1 }],
  ];

  return cases.map(([name, input]) => {
    const result = calculateExpectedDividendTaxSaving(input);
    assert.equal(result.canCalculate, false, name);
    assert.equal(result.taxSavingUsd, 0, name);
    assert.equal(result.warnings.length > 0, true, name);
    return { name, warnings: result.warnings.join(" | ") };
  });
}

function assertRowBuildingCalculation() {
  const rows = buildTaxSavingRows(
    [
      calendarEvent({ ticker: "AAA", type: "buy_by", date: "2026-06-10", dividendAmount: 0.5 }),
      calendarEvent({ ticker: "AAA", type: "ex_div", date: "2026-06-11", dividendAmount: 1 }),
      calendarEvent({ ticker: "BBB", type: "earnings", date: "2026-06-12", dividendAmount: null }),
      calendarEvent({ ticker: "CCC", type: "ex_div", date: "2026-06-13", dividendAmount: 0.8 }),
      calendarEvent({ ticker: "DDD", type: "ex_div", date: "2026-06-01", dividendAmount: 0.2 }),
      calendarEvent({ ticker: "DDD", type: "ex_div", date: "2026-06-20", dividendAmount: 0.7 }),
      calendarEvent({ ticker: "CUSTOM", type: "custom", date: "2026-06-20", dividendAmount: 9, sourceKind: "custom" }),
    ],
    {
      todayIso: "2026-06-12",
      quoteByTicker: {
        AAA: { price: 100, source: "yahoo" },
        BBB: { price: 50, source: "yahoo" },
        DDD: { price: 50, source: "yahoo" },
      },
    },
  );

  const byTicker = Object.fromEntries(rows.map((row) => [row.ticker, row]));
  assert.equal(rows.some((row) => row.ticker === "CUSTOM"), false, "custom calendar events should be excluded");

  assert.equal(byTicker.AAA.canCalculate, true);
  assert.equal(byTicker.AAA.shouldBuyThisMonth, true);
  assert.equal(byTicker.AAA.dividendAmountPerShare, 1, "ex-dividend event should beat buy-by event when both exist");
  assert.equal(byTicker.AAA.expectedShares, 100);
  assertNear(byTicker.AAA.taxSavingUsd, 18.7, "AAA calculated tax saving");

  assert.equal(byTicker.BBB.canCalculate, false);
  assert.equal(byTicker.BBB.taxSavingUsd, 0);
  assert.equal(byTicker.BBB.warnings.some((warning) => warning.includes("No positive dividend")), true);

  assert.equal(byTicker.CCC.canCalculate, false);
  assert.equal(byTicker.CCC.taxSavingUsd, 0);
  assert.equal(byTicker.CCC.warnings.some((warning) => warning.includes("currentPrice")), true);

  assert.equal(byTicker.DDD.canCalculate, true);
  assert.equal(byTicker.DDD.dividendAmountPerShare, 0.7, "upcoming ex-dividend event should beat past ex-dividend event");

  return rows.map((row) => ({
    ticker: row.ticker,
    canCalculate: row.canCalculate,
    taxSavingUsd: row.taxSavingUsd,
    dividendAmountPerShare: row.dividendAmountPerShare,
  }));
}

function calculateOneHistoricalSample({ exDivHigh }) {
  return calculateHistoricalTaxSavingMetric({
    dividends: [{ date: "2026-06-10", amount: 1 }],
    prices: [
      { date: "2026-06-09", close: 100, high: 101 },
      { date: "2026-06-10", close: 99, high: exDivHigh },
    ],
  });
}

function assertHistoricalFullRecoverySuccess() {
  const result = calculateOneHistoricalSample({ exDivHigh: 100 });
  assert.equal(result.canCalculate, true);
  assert.equal(result.totalCount, 1);
  assert.equal(result.successCount, 1);
  assert.equal(result.failureCount, 0);
  assert.equal(result.samples[0].success, true);
  assertNear(result.samples[0].afterTaxDividend, 0.85, "historical full recovery afterTaxDividend");
  assertNear(result.samples[0].breakEvenPrice, 99.15, "historical full recovery breakEvenPrice");
  assertNear(result.samples[0].profitPct, 0.85, "historical full recovery profitPct");
  assertNear(result.taxSavingUsd, 18.7, "historical full recovery taxSavingUsd");
  return result;
}

function assertHistoricalPartialRecoverySuccess() {
  const result = calculateOneHistoricalSample({ exDivHigh: 99.5 });
  assert.equal(result.canCalculate, true);
  assert.equal(result.totalCount, 1);
  assert.equal(result.successCount, 1);
  assert.equal(result.failureCount, 0);
  assert.equal(result.samples[0].success, true);
  assertNear(result.samples[0].breakEvenPrice, 99.15, "historical partial recovery breakEvenPrice");
  assertNear(result.samples[0].profitPct, 0.85, "historical partial recovery original-compatible profitPct");
  assertNear(result.taxSavingUsd, 18.7, "historical partial recovery original-compatible taxSavingUsd");
  return result;
}

function assertHistoricalFailureExcluded() {
  const result = calculateOneHistoricalSample({ exDivHigh: 99 });
  assert.equal(result.canCalculate, true);
  assert.equal(result.totalCount, 1);
  assert.equal(result.successCount, 0);
  assert.equal(result.failureCount, 1);
  assert.equal(result.samples[0].success, false);
  assert.equal(result.samples[0].profitPct, 0);
  assert.equal(result.avgProfitPct, 0);
  assert.equal(result.taxSavingUsd, 0);
  return result;
}

function assertHistoricalMixedAverage() {
  const result = calculateHistoricalTaxSavingMetric({
    dividends: [
      { date: "2026-06-10", amount: 1 },
      { date: "2026-09-10", amount: 1 },
    ],
    prices: [
      { date: "2026-06-09", close: 100, high: 101 },
      { date: "2026-06-10", close: 99, high: 100 },
      { date: "2026-09-09", close: 100, high: 101 },
      { date: "2026-09-10", close: 99, high: 99 },
    ],
  });

  assert.equal(result.canCalculate, true);
  assert.equal(result.totalCount, 2);
  assert.equal(result.successCount, 1);
  assert.equal(result.failureCount, 1);
  assertNear(result.avgProfitPct, 0.85, "historical mixed success-only average");
  assertNear(result.taxSavingUsd, 18.7, "historical mixed success-only taxSavingUsd");
  return result;
}

function assertHistoricalMissingData() {
  const missingPriceBars = calculateHistoricalTaxSavingMetric({
    dividends: [{ date: "2026-06-10", amount: 1 }],
    prices: [],
  });

  assert.equal(missingPriceBars.canCalculate, false);
  assert.equal(missingPriceBars.taxSavingUsd, 0);
  assert.equal(missingPriceBars.warnings.length > 0, true);

  const missingPreviousTradingDay = calculateHistoricalTaxSavingMetric({
    dividends: [{ date: "2026-06-10", amount: 1 }],
    prices: [{ date: "2026-06-10", close: 99, high: 100 }],
  });

  assert.equal(missingPreviousTradingDay.canCalculate, false);
  assert.equal(missingPreviousTradingDay.taxSavingUsd, 0);
  assert.equal(missingPreviousTradingDay.warnings.length > 0, true);

  return [
    { case: "missing price bars", warnings: missingPriceBars.warnings.join(" | ") },
    { case: "missing previous trading day", warnings: missingPreviousTradingDay.warnings.join(" | ") },
  ];
}

function main() {
  const validCalculation = assertValidCalculation();
  const defaultCalculation = assertDefaultCalculation();
  const missingPrice = assertMissingPrice();
  const missingDividend = assertMissingDividend();
  const invalidValues = assertInvalidValues();
  const rowBuilding = assertRowBuildingCalculation();
  const historicalFullRecovery = assertHistoricalFullRecoverySuccess();
  const historicalPartialRecovery = assertHistoricalPartialRecoverySuccess();
  const historicalFailure = assertHistoricalFailureExcluded();
  const historicalMixedAverage = assertHistoricalMixedAverage();
  const historicalMissingData = assertHistoricalMissingData();

  console.log("Tax saving calculator regression passed.");
  console.table([
    {
      case: "explicit constants",
      canCalculate: validCalculation.canCalculate,
      expectedShares: validCalculation.expectedShares,
      expectedDividendUsd: validCalculation.expectedDividendUsd,
      taxSavingUsd: validCalculation.taxSavingUsd,
    },
    {
      case: "defaults",
      canCalculate: defaultCalculation.canCalculate,
      expectedShares: defaultCalculation.expectedShares,
      expectedDividendUsd: defaultCalculation.expectedDividendUsd,
      taxSavingUsd: defaultCalculation.taxSavingUsd,
    },
    {
      case: "missing price",
      canCalculate: missingPrice.canCalculate,
      expectedShares: missingPrice.expectedShares,
      expectedDividendUsd: missingPrice.expectedDividendUsd,
      taxSavingUsd: missingPrice.taxSavingUsd,
    },
    {
      case: "missing dividend",
      canCalculate: missingDividend.canCalculate,
      expectedShares: missingDividend.expectedShares,
      expectedDividendUsd: missingDividend.expectedDividendUsd,
      taxSavingUsd: missingDividend.taxSavingUsd,
    },
  ]);
  console.table(invalidValues);
  console.table(rowBuilding);
  console.table([
    {
      case: "historical full recovery success",
      canCalculate: historicalFullRecovery.canCalculate,
      avgProfitPct: historicalFullRecovery.avgProfitPct,
      successCount: historicalFullRecovery.successCount,
      failureCount: historicalFullRecovery.failureCount,
      taxSavingUsd: historicalFullRecovery.taxSavingUsd,
    },
    {
      case: "historical partial recovery success",
      canCalculate: historicalPartialRecovery.canCalculate,
      avgProfitPct: historicalPartialRecovery.avgProfitPct,
      successCount: historicalPartialRecovery.successCount,
      failureCount: historicalPartialRecovery.failureCount,
      taxSavingUsd: historicalPartialRecovery.taxSavingUsd,
    },
    {
      case: "historical failure excluded",
      canCalculate: historicalFailure.canCalculate,
      avgProfitPct: historicalFailure.avgProfitPct,
      successCount: historicalFailure.successCount,
      failureCount: historicalFailure.failureCount,
      taxSavingUsd: historicalFailure.taxSavingUsd,
    },
    {
      case: "historical mixed success/failure average",
      canCalculate: historicalMixedAverage.canCalculate,
      avgProfitPct: historicalMixedAverage.avgProfitPct,
      successCount: historicalMixedAverage.successCount,
      failureCount: historicalMixedAverage.failureCount,
      taxSavingUsd: historicalMixedAverage.taxSavingUsd,
    },
  ]);
  console.table(historicalMissingData);
}

main();
