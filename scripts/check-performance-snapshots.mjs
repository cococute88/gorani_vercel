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
  buildPerformanceFromSnapshots,
} = require("../lib/performance-from-snapshots.ts");

function snapshot(overrides) {
  return {
    id: overrides.id ?? `snap-${overrides.snapshotDate ?? "x"}`,
    snapshotDate: overrides.snapshotDate ?? "2026-06-12",
    sourceFileName: overrides.sourceFileName ?? "test.xlsx",
    totalAssetKRW: overrides.totalAssetKRW ?? overrides.investmentValueKRW ?? 0,
    totalDebtKRW: overrides.totalDebtKRW ?? 0,
    netAssetKRW: overrides.netAssetKRW ?? overrides.totalAssetKRW ?? overrides.investmentValueKRW ?? 0,
    investmentPrincipalKRW: overrides.investmentPrincipalKRW,
    investmentValueKRW: overrides.investmentValueKRW,
    returnAmountKRW:
      overrides.returnAmountKRW ??
      ((overrides.investmentValueKRW ?? 0) - (overrides.investmentPrincipalKRW ?? 0)),
    returnPct: overrides.returnPct ?? 0,
    holdings: overrides.holdings ?? [],
    financeAssets: overrides.financeAssets ?? [],
    createdAt: overrides.createdAt ?? "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

function hasWarning(result, token) {
  return result.warnings.some((warning) => warning.includes(token));
}

function assertNoSnapshots() {
  const result = buildPerformanceFromSnapshots([]);

  assert.equal(result.metrics.currentValueKRW, null);
  assert.equal(result.metrics.snapshotCount, 0);
  assert.equal(result.canCalculateTrend, false);
  assert.ok(hasWarning(result, "no_snapshots"));

  return {
    case: "no snapshots",
    snapshotCount: result.metrics.snapshotCount,
    warnings: result.warnings.length,
  };
}

function assertOneSnapshot() {
  const result = buildPerformanceFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
    }),
  ]);

  assert.equal(result.metrics.currentValueKRW, 100_000_000);
  assert.equal(result.metrics.investedPrincipalKRW, 80_000_000);
  assert.equal(result.metrics.cumulativeGainKRW, 20_000_000);
  assert.equal(result.metrics.cumulativeReturnPct, 25);
  assert.equal(result.metrics.moneyWeightedCagrPct, null);
  assert.equal(result.metrics.timeWeightedCagrPct, null);
  assert.equal(result.series.length, 1);

  return {
    case: "one snapshot",
    currentValueKRW: result.metrics.currentValueKRW,
    returnPct: result.metrics.cumulativeReturnPct,
    series: result.series.length,
  };
}

function assertTwoSnapshotsSorted() {
  const result = buildPerformanceFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 130_000_000,
      investmentPrincipalKRW: 100_000_000,
    }),
    snapshot({
      snapshotDate: "2025-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
    }),
  ]);

  assert.equal(result.metrics.currentValueKRW, 130_000_000);
  assert.equal(result.metrics.investedPrincipalKRW, 100_000_000);
  assert.equal(result.metrics.cumulativeGainKRW, 30_000_000);
  assert.equal(result.metrics.cumulativeReturnPct, 30);
  assert.deepEqual(result.series.map((row) => row.date), ["2025-06-12", "2026-06-12"]);
  assert.equal(result.canCalculateTrend, true);

  return {
    case: "two snapshots sorted",
    currentValueKRW: result.metrics.currentValueKRW,
    returnPct: result.metrics.cumulativeReturnPct,
    first: result.series[0].date,
    latest: result.series[1].date,
  };
}

function assertInvalidValues() {
  const result = buildPerformanceFromSnapshots([
    snapshot({
      snapshotDate: "bad-date",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
    }),
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: Number.NaN,
      investmentPrincipalKRW: -1,
    }),
    snapshot({
      snapshotDate: "2026-06-13",
      investmentValueKRW: 50_000_000,
      investmentPrincipalKRW: undefined,
    }),
  ]);

  assert.equal(result.series.length, 2);
  assert.equal(result.series[0].evaluationKRW, null);
  assert.equal(result.series[0].principalKRW, null);
  assert.equal(result.metrics.currentValueKRW, 50_000_000);
  assert.equal(result.metrics.investedPrincipalKRW, null);
  assert.ok(hasWarning(result, "invalid_snapshot_date"));
  assert.ok(hasWarning(result, "invalid_evaluation"));
  assert.ok(hasWarning(result, "invalid_principal"));

  return {
    case: "invalid values",
    series: result.series.length,
    warnings: result.warnings.length,
  };
}

function assertDividendUnavailable() {
  const result = buildPerformanceFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
    }),
  ]);

  assert.equal(result.series[0].dividendKRW, null);
  assert.ok(hasWarning(result, "dividend_unavailable"));

  return {
    case: "dividend unavailable",
    dividendKRW: result.series[0].dividendKRW,
    warning: hasWarning(result, "dividend_unavailable"),
  };
}

function main() {
  const rows = [
    assertNoSnapshots(),
    assertOneSnapshot(),
    assertTwoSnapshotsSorted(),
    assertInvalidValues(),
    assertDividendUnavailable(),
  ];

  console.log("Performance snapshot regression passed.");
  console.table(rows);
}

main();

