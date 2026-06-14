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
  buildPerformanceQldFromSnapshots,
} = require("../lib/performance-qld-from-snapshots.ts");

function holding(overrides = {}) {
  return {
    id: overrides.id ?? `h-${overrides.ticker ?? overrides.productName ?? "x"}`,
    broker: overrides.broker ?? "test",
    assetType: overrides.assetType ?? "주식",
    productName: overrides.productName ?? overrides.ticker ?? "Test Holding",
    cleanName: overrides.cleanName,
    ticker: overrides.ticker,
    principalKRW: overrides.principalKRW,
    valueKRW: overrides.valueKRW,
    returnPct: overrides.returnPct,
    quantity: overrides.quantity,
    currency: overrides.currency,
    currentPrice: overrides.currentPrice,
    valueOriginalCurrency: overrides.valueOriginalCurrency,
    needsReview: overrides.needsReview,
  };
}

function snapshot(overrides = {}) {
  const investmentValueKRW = overrides.investmentValueKRW;
  const investmentPrincipalKRW = overrides.investmentPrincipalKRW;
  return {
    id: overrides.id ?? `snap-${overrides.snapshotDate ?? "x"}`,
    snapshotDate: overrides.snapshotDate ?? "2026-06-12",
    sourceFileName: overrides.sourceFileName ?? "test.xlsx",
    totalAssetKRW: overrides.totalAssetKRW ?? investmentValueKRW ?? 0,
    totalDebtKRW: overrides.totalDebtKRW ?? 0,
    netAssetKRW: overrides.netAssetKRW ?? overrides.totalAssetKRW ?? investmentValueKRW ?? 0,
    investmentPrincipalKRW,
    investmentValueKRW,
    returnAmountKRW:
      overrides.returnAmountKRW ??
      ((investmentValueKRW ?? 0) - (investmentPrincipalKRW ?? 0)),
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
  const result = buildPerformanceQldFromSnapshots([]);

  assert.equal(result.summary.evaluationKRW, null);
  assert.equal(result.snapshotCount, 0);
  assert.equal(result.valueSeries.length, 0);
  assert.equal(result.rankings.length, 0);
  assert.equal(result.usesSampleData, false);
  assert.equal(result.sampleFallbackUsed, false);
  assert.ok(hasWarning(result, "no_snapshots"));
  assert.ok(hasWarning(result, "fx_unavailable"));

  return {
    case: "no snapshots",
    snapshotCount: result.snapshotCount,
    warnings: result.warnings.length,
  };
}

function assertOneSnapshot() {
  const result = buildPerformanceQldFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
      holdings: [
        holding({
          ticker: "QLD",
          productName: "ProShares Ultra QQQ",
          valueKRW: 60_000_000,
          principalKRW: 40_000_000,
        }),
      ],
    }),
  ]);

  assert.equal(result.summary.evaluationKRW, 100_000_000);
  assert.equal(result.summary.principalKRW, 80_000_000);
  assert.equal(result.summary.profitKRW, 20_000_000);
  assert.equal(result.summary.returnPct, 25);
  assert.equal(result.summary.previousChangeKRW, null);
  assert.equal(result.valueSeries.length, 1);
  assert.equal(result.rankings.length, 1);
  assert.equal(result.rankings[0].profitKRW, 20_000_000);

  return {
    case: "one snapshot",
    evaluationKRW: result.summary.evaluationKRW,
    rankings: result.rankings.length,
  };
}

function assertSortedSnapshots() {
  const result = buildPerformanceQldFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 130_000_000,
      investmentPrincipalKRW: 100_000_000,
      holdings: [
        holding({ ticker: "QLD", valueKRW: 90_000_000, principalKRW: 60_000_000 }),
      ],
    }),
    snapshot({
      snapshotDate: "2025-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
    }),
  ]);

  assert.deepEqual(result.valueSeries.map((row) => row.date), ["2025-06-12", "2026-06-12"]);
  assert.equal(result.summary.latestSnapshotDate, "2026-06-12");
  assert.equal(result.summary.previousSnapshotDate, "2025-06-12");
  assert.equal(result.summary.previousChangeKRW, 30_000_000);
  assert.equal(result.summary.previousChangePct, 30);

  return {
    case: "two snapshots sorted",
    previousChangeKRW: result.summary.previousChangeKRW,
    first: result.valueSeries[0].date,
    latest: result.summary.latestSnapshotDate,
  };
}

function assertNoHoldings() {
  const result = buildPerformanceQldFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
      holdings: [],
    }),
  ]);

  assert.equal(result.flags.hasHoldings, false);
  assert.equal(result.rankings.length, 0);
  assert.ok(hasWarning(result, "holdings_unavailable"));
  assert.ok(hasWarning(result, "ranking_value_unavailable"));

  return {
    case: "no holdings",
    rankings: result.rankings.length,
    warnings: result.warnings.length,
  };
}

function assertHoldingsWithoutValue() {
  const result = buildPerformanceQldFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 80_000_000,
      holdings: [
        holding({ ticker: "QLD", valueKRW: 0, principalKRW: 40_000_000 }),
        holding({ ticker: "TQQQ", valueKRW: Number.NaN, principalKRW: 10_000_000 }),
      ],
    }),
  ]);

  assert.equal(result.flags.hasHoldings, true);
  assert.equal(result.flags.hasValueRanking, false);
  assert.equal(result.rankings.length, 0);
  assert.ok(hasWarning(result, "ranking_value_unavailable"));

  return {
    case: "holdings without calculable value",
    rankings: result.rankings.length,
  };
}

function assertValueRankingPossible() {
  const result = buildPerformanceQldFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 150_000_000,
      investmentPrincipalKRW: 100_000_000,
      holdings: [
        holding({ ticker: "QLD", productName: "QLD row 1", valueKRW: 60_000_000, principalKRW: 30_000_000 }),
        holding({ ticker: "QLD", productName: "QLD row 2", valueKRW: 40_000_000, principalKRW: 30_000_000 }),
        holding({ ticker: "SCHD", productName: "SCHD", valueKRW: 20_000_000, principalKRW: 25_000_000 }),
      ],
    }),
  ]);

  assert.equal(result.rankings.length, 2);
  assert.equal(result.rankings[0].ticker, "QLD");
  assert.equal(result.rankings[0].valueKRW, 100_000_000);
  assert.equal(result.rankings[0].principalKRW, 60_000_000);
  assert.equal(result.rankings[0].profitKRW, 40_000_000);
  assert.equal(Math.round(result.rankings[0].weightPct), 83);
  assert.equal(result.flags.hasProfitRanking, true);
  assert.equal(result.flags.hasReturnRanking, true);

  return {
    case: "value ranking possible",
    top: result.rankings[0].ticker,
    topValue: result.rankings[0].valueKRW,
  };
}

function assertProfitRankingUnavailable() {
  const result = buildPerformanceQldFromSnapshots([
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: 100_000_000,
      investmentPrincipalKRW: 0,
      holdings: [
        holding({ ticker: "QLD", valueKRW: 60_000_000, principalKRW: 0 }),
        holding({ ticker: "TQQQ", valueKRW: 20_000_000, principalKRW: Number.NaN }),
      ],
    }),
  ]);

  assert.equal(result.rankings.length, 2);
  assert.equal(result.flags.hasValueRanking, true);
  assert.equal(result.flags.hasProfitRanking, false);
  assert.equal(result.flags.hasReturnRanking, false);
  assert.ok(hasWarning(result, "ranking_profit_unavailable"));

  return {
    case: "profit return ranking unavailable",
    valueRankings: result.rankings.length,
    hasProfitRanking: result.flags.hasProfitRanking,
  };
}

function assertInvalidNumbersAndFallbackBoundary() {
  const result = buildPerformanceQldFromSnapshots([
    snapshot({
      snapshotDate: "bad-date",
      investmentValueKRW: 999_000_000,
      investmentPrincipalKRW: 1,
    }),
    snapshot({
      snapshotDate: "2026-06-12",
      investmentValueKRW: Number.NaN,
      totalAssetKRW: 110_000_000,
      investmentPrincipalKRW: null,
      holdings: [
        holding({ ticker: "QLD", valueKRW: null, principalKRW: null }),
      ],
    }),
  ]);

  assert.equal(result.summary.evaluationKRW, 110_000_000);
  assert.equal(result.summary.evaluationSource, "totalAssetKRW");
  assert.equal(result.summary.principalKRW, null);
  assert.equal(result.summary.profitKRW, null);
  assert.equal(result.rankings.length, 0);
  assert.equal(result.usesSampleData, false);
  assert.equal(result.sampleFallbackUsed, false);
  assert.ok(hasWarning(result, "invalid_snapshot_date"));
  assert.ok(hasWarning(result, "ranking_value_unavailable"));

  return {
    case: "invalid number fallback boundary",
    evaluationSource: result.summary.evaluationSource,
    sampleFallbackUsed: result.sampleFallbackUsed,
  };
}

function main() {
  const rows = [
    assertNoSnapshots(),
    assertOneSnapshot(),
    assertSortedSnapshots(),
    assertNoHoldings(),
    assertHoldingsWithoutValue(),
    assertValueRankingPossible(),
    assertProfitRankingUnavailable(),
    assertInvalidNumbersAndFallbackBoundary(),
  ];

  console.log("Performance QLD snapshot regression passed.");
  console.table(rows);
}

main();
