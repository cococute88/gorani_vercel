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
  buildPortfolioPageFromSnapshot,
  buildPortfolioPageFromSnapshots,
} = require("../lib/portfolio-from-snapshots.ts");

function holding(overrides = {}) {
  return {
    id: overrides.id ?? `h-${overrides.productName ?? "x"}`,
    broker: overrides.broker ?? "테스트증권",
    accountName: overrides.accountName,
    assetType: overrides.assetType ?? "ETF",
    productName: overrides.productName ?? "테스트 ETF",
    cleanName: overrides.cleanName,
    ticker: overrides.ticker,
    tag: overrides.tag,
    principalKRW: overrides.principalKRW ?? 1_000_000,
    valueKRW: overrides.valueKRW ?? 1_100_000,
    returnPct: overrides.returnPct,
    currency: overrides.currency,
    accountGroup: overrides.accountGroup,
    purposeGroup: overrides.purposeGroup,
    statusGroup: overrides.statusGroup,
    tickerConfidence: overrides.tickerConfidence,
    needsReview: overrides.needsReview,
    ...overrides,
  };
}

function financeAsset(overrides = {}) {
  return {
    id: overrides.id ?? `fa-${overrides.productName ?? "x"}`,
    groupName: overrides.groupName ?? "자유입출금 자산",
    productName: overrides.productName ?? "테스트 통장",
    amountKRW: overrides.amountKRW ?? 500_000,
    category: overrides.category ?? "현금",
    isDebt: overrides.isDebt,
    accountGroup: overrides.accountGroup,
    statusGroup: overrides.statusGroup,
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  const holdings = overrides.holdings ?? [];
  const financeAssets = overrides.financeAssets ?? [];
  const investmentValueKRW =
    overrides.investmentValueKRW ??
    holdings.reduce((sum, item) => sum + (Number.isFinite(item.valueKRW) ? item.valueKRW : 0), 0);
  const investmentPrincipalKRW =
    overrides.investmentPrincipalKRW ??
    holdings.reduce((sum, item) => sum + (Number.isFinite(item.principalKRW) ? item.principalKRW : 0), 0);
  return {
    id: overrides.id ?? `snap-${overrides.snapshotDate ?? "x"}`,
    snapshotDate: overrides.snapshotDate ?? "2026-06-12",
    sourceFileName: overrides.sourceFileName ?? "test.xlsx",
    totalAssetKRW:
      overrides.totalAssetKRW ??
      investmentValueKRW +
        financeAssets.reduce((sum, item) => sum + (Number.isFinite(item.amountKRW) ? item.amountKRW : 0), 0),
    totalDebtKRW: overrides.totalDebtKRW ?? 0,
    netAssetKRW: overrides.netAssetKRW ?? overrides.totalAssetKRW ?? investmentValueKRW,
    investmentPrincipalKRW,
    investmentValueKRW,
    returnAmountKRW: overrides.returnAmountKRW ?? investmentValueKRW - investmentPrincipalKRW,
    returnPct:
      overrides.returnPct ??
      (investmentPrincipalKRW > 0
        ? ((investmentValueKRW - investmentPrincipalKRW) / investmentPrincipalKRW) * 100
        : 0),
    holdings,
    financeAssets,
    createdAt: overrides.createdAt ?? "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

function hasWarning(result, code) {
  return result.warnings.some((warning) => warning.code === code || warning.message.includes(code));
}

function assertNoSnapshot() {
  const result = buildPortfolioPageFromSnapshot(null);
  assert.equal(result.flags.hasSnapshot, false);
  assert.equal(result.flags.usesSampleData, false);
  assert.equal(result.flags.sampleFallbackUsed, false);
  assert.equal(result.accountAllocation.length, 0);
  assert.equal(result.treemapItems.length, 0);
  assert.ok(hasWarning(result, "no_snapshot"));
  return { case: "snapshot 없음", warnings: result.warnings.length };
}

function assertHoldingsEmpty() {
  const result = buildPortfolioPageFromSnapshot(snapshot({ holdings: [] }));
  assert.equal(result.flags.hasHoldings, false);
  assert.equal(result.stockAllocation.length, 0);
  assert.equal(result.treemapItems.length, 0);
  assert.ok(hasWarning(result, "holdings_empty"));
  return { case: "holdings 없음", treemap: result.treemapItems.length };
}

function assertFinanceAssetsEmptyAndHoldingsFallback() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      holdings: [
        holding({ broker: "미래증권", accountGroup: "위탁", valueKRW: 2_000_000 }),
        holding({ broker: "미래증권", accountGroup: "위탁", valueKRW: 3_000_000 }),
      ],
      financeAssets: [],
    }),
  );
  assert.equal(result.flags.hasFinanceAssets, false);
  assert.equal(result.accountAllocationSource, "holdings");
  assert.equal(result.accountAllocation[0].amountKRW, 5_000_000);
  assert.ok(hasWarning(result, "finance_assets_empty"));
  assert.ok(hasWarning(result, "account_allocation_holdings_fallback"));
  return { case: "financeAssets 없음 holdings fallback", source: result.accountAllocationSource };
}

function assertTreemapFromHoldingValues() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      holdings: [
        holding({ productName: "Alpha", ticker: "AAA", valueKRW: 10_000_000, principalKRW: 8_000_000, purposeGroup: "성장" }),
        holding({ productName: "Beta", ticker: "BBB", valueKRW: 5_000_000, principalKRW: 6_000_000, purposeGroup: "배당" }),
      ],
    }),
  );
  assert.equal(result.flags.hasTreemap, true);
  assert.equal(result.treemapItems.length, 2);
  assert.equal(result.treemapItems[0].ticker, "AAA");
  assert.equal(result.treemapItems[0].valueKRW, 10_000_000);
  assert.equal(result.holdingsRankingRows[0].rank, 1);
  assert.equal(result.stockAllocation[0].amountKRW, 10_000_000);
  return { case: "holdings valueKRW 트리맵", items: result.treemapItems.length };
}

function assertInvalidHoldingValuesExcluded() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      holdings: [
        holding({ productName: "No value", valueKRW: null }),
        holding({ productName: "NaN value", valueKRW: Number.NaN }),
        holding({ productName: "Good", ticker: "GOOD", valueKRW: 4_000_000 }),
      ],
    }),
  );
  assert.equal(result.treemapItems.length, 1);
  assert.equal(result.treemapItems[0].ticker, "GOOD");
  assert.ok(hasWarning(result, "treemap_excluded_invalid_value"));
  return { case: "invalid value 제외", warnings: result.warnings.length };
}

function assertFinanceAssetsAccountGraph() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      holdings: [holding({ valueKRW: 1_000_000 })],
      financeAssets: [
        financeAsset({ groupName: "KB ISA", amountKRW: 7_000_000, category: "투자성" }),
        financeAsset({ groupName: "KB ISA", amountKRW: 3_000_000, category: "투자성" }),
      ],
    }),
  );
  assert.equal(result.accountAllocationSource, "financeAssets");
  assert.equal(result.accountAllocation.length, 1);
  assert.equal(result.accountAllocation[0].amountKRW, 10_000_000);
  assert.equal(result.accountCards[0].profit, null);
  return { case: "financeAssets 계좌 그래프", source: result.accountAllocationSource };
}

function assertInvalidNumbersDefense() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      investmentValueKRW: Number.NaN,
      investmentPrincipalKRW: 0,
      totalAssetKRW: 9_000_000,
      holdings: [holding({ valueKRW: Number.NaN, principalKRW: null })],
      financeAssets: [financeAsset({ amountKRW: null })],
    }),
  );
  assert.equal(result.summary.totalAssetKRW, 9_000_000);
  assert.equal(result.summary.investmentValueKRW, null);
  assert.equal(result.summary.investmentPrincipalKRW, null);
  assert.equal(result.summary.returnAmountKRW, null);
  assert.equal(result.summary.returnPct, null);
  assert.equal(result.accountAllocation.length, 0);
  assert.ok(hasWarning(result, "account_allocation_unavailable"));
  return { case: "invalid number 방어", value: result.summary.totalAssetKRW };
}

function assertTicker4MappingAndNoOverwrite() {
  const tickerNameMap = {
    KODEX200: {
      ticker: "069500",
      displayTicker: "069500.KS",
      rawProductName: "KODEX 200",
      updatedAt: "2026-06-14T00:00:00.000Z",
    },
  };
  const source = snapshot({
    holdings: [
      holding({ id: "empty", productName: "KODEX 200 ETF", cleanName: "KODEX 200", ticker: "" }),
      holding({ id: "existing", productName: "KODEX 200 ETF", cleanName: "KODEX 200", ticker: "111111.KS" }),
    ],
  });
  const before = JSON.stringify(source);
  const result = buildPortfolioPageFromSnapshot(source, { tickerNameMap });
  assert.equal(result.flags.hasTickerMapApplied, true);
  assert.equal(result.mappedHoldings[0].ticker, "069500.KS");
  assert.equal(result.mappedHoldings[1].ticker, "111111.KS");
  assert.equal(JSON.stringify(source), before, "source snapshot should not be mutated");
  assert.ok(hasWarning(result, "ticker_name_map_applied"));
  return { case: "TICKER-4 mapping", mapped: result.mappedHoldings[0].ticker };
}

function assertLatestSnapshotAndNoSampleFallback() {
  const result = buildPortfolioPageFromSnapshots([
    snapshot({ snapshotDate: "2025-01-01", holdings: [holding({ ticker: "OLD", valueKRW: 1_000_000 })] }),
    snapshot({ snapshotDate: "2026-01-01", holdings: [holding({ ticker: "NEW", valueKRW: 2_000_000 })] }),
  ]);
  assert.equal(result.snapshot.snapshotDate, "2026-01-01");
  assert.equal(result.treemapItems[0].ticker, "NEW");
  assert.equal(result.flags.usesSampleData, false);
  assert.equal(result.flags.sampleFallbackUsed, false);
  return { case: "latest snapshot + no sample", snapshot: result.snapshot.snapshotDate };
}

function main() {
  const rows = [
    assertNoSnapshot(),
    assertHoldingsEmpty(),
    assertFinanceAssetsEmptyAndHoldingsFallback(),
    assertTreemapFromHoldingValues(),
    assertInvalidHoldingValuesExcluded(),
    assertFinanceAssetsAccountGraph(),
    assertInvalidNumbersDefense(),
    assertTicker4MappingAndNoOverwrite(),
    assertLatestSnapshotAndNoSampleFallback(),
  ];

  console.log("Portfolio real-data regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("Portfolio real-data regression failed.");
  console.error(error);
  process.exit(1);
}
