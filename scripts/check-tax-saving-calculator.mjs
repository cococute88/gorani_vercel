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

function assertNear(actual, expected, message) {
  assert.equal(Math.abs(actual - expected) < 1e-10, true, message);
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

function main() {
  const validCalculation = assertValidCalculation();
  const defaultCalculation = assertDefaultCalculation();
  const missingPrice = assertMissingPrice();
  const missingDividend = assertMissingDividend();
  const invalidValues = assertInvalidValues();

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
}

main();
