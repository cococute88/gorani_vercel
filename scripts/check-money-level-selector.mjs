#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");
process.env.NODE_ENV = "production";
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

const { buildPortfolioPageFromSnapshot } = require("../lib/portfolio-from-snapshots.ts");
const {
  diagnoseMoneyLevelPortfolioSelection,
  isSuspiciousMoneyLevelUpdatedAt,
  selectMoneyLevelPortfolioSnapshot,
} = require("../lib/money-level/portfolio-selector.ts");

function holding(overrides = {}) {
  return {
    id: overrides.id ?? Math.random().toString(36),
    broker: "미래증권",
    assetType: "ETF",
    productName: "ETF",
    principalKRW: 800_000,
    valueKRW: 1_000_000,
    ...overrides,
  };
}

function financeAsset(overrides = {}) {
  return {
    id: overrides.id ?? Math.random().toString(36),
    groupName: "투자성 자산",
    productName: "계좌",
    amountKRW: 1_000_000,
    category: "투자성",
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    id: "money-level-fixture",
    snapshotDate: "2026-09-12",
    sourceFileName: "money-level-fixture.xlsx",
    totalAssetKRW: 0,
    totalDebtKRW: 0,
    netAssetKRW: 0,
    investmentPrincipalKRW: 0,
    investmentValueKRW: 0,
    returnAmountKRW: 0,
    returnPct: 0,
    holdings: [],
    financeAssets: [],
    createdAt: "2026-09-12T01:02:03.000Z",
    ...overrides,
  };
}

const normalizedPage = buildPortfolioPageFromSnapshot(snapshot({
  financeAssets: [
    financeAsset({ id: "brokerage", accountGroup: "위탁", amountKRW: 400_000_000 }),
    financeAsset({ id: "usd", accountGroup: "달러", amountKRW: 20_000_000 }),
    financeAsset({ id: "krw", accountGroup: "원", amountKRW: 5_000_000 }),
    financeAsset({ id: "unknown", groupName: "", productName: "", amountKRW: 1_986_959 }),
    financeAsset({ id: "hidden-card", accountGroup: "소액계좌", amountKRW: 500_000 }),
    financeAsset({ id: "below-row-threshold", accountGroup: "제외계좌", amountKRW: 199_999 }),
    financeAsset({ id: "isa", accountGroup: "ISA", amountKRW: 55_000_000 }),
    financeAsset({ id: "pension", accountGroup: "연금", amountKRW: 155_000_000 }),
  ],
  holdings: [
    holding({ id: "isa-holding", accountGroup: "ISA", valueKRW: 50_000_000, principalKRW: 32_833_192 }),
    holding({ id: "pension-holding", accountGroup: "연금", valueKRW: 150_000_000, principalKRW: 108_946_382 }),
  ],
}));

const selected = selectMoneyLevelPortfolioSnapshot(normalizedPage);
assert.ok(selected);

// 위탁·달러·원·미분류와 20~100만원 hidden card row를 accountCards에서 한 번만 더한다.
assert.equal(selected.brokerageValue, 427_486_959);
assert.equal(normalizedPage.accountCards.some((row) => row.name === "제외계좌"), false);
assert.equal(normalizedPage.accountCards.some((row) => row.name === "소액계좌"), true);

// 평가금액이 아니라 normalized principal을 선택한다.
assert.equal(selected.isaPrincipal, 32_833_192);
assert.notEqual(selected.isaPrincipal, 55_000_000);
assert.equal(selected.pensionPrincipal, 108_946_382);
assert.notEqual(selected.pensionPrincipal, 155_000_000);
assert.equal(selected.updatedAt, "2026-09-12T01:02:03.000Z");
assert.deepEqual(diagnoseMoneyLevelPortfolioSelection(normalizedPage), []);

const epochPage = {
  ...normalizedPage,
  snapshot: { ...normalizedPage.snapshot, createdAt: new Date(0).toISOString() },
};
assert.equal(isSuspiciousMoneyLevelUpdatedAt(epochPage.snapshot.createdAt), true);
assert.equal(
  diagnoseMoneyLevelPortfolioSelection(epochPage).some((item) => item.code === "updated_at_epoch_fallback"),
  true,
);
assert.equal(isSuspiciousMoneyLevelUpdatedAt("2026-09-12T01:02:03.000Z"), false);
assert.equal(isSuspiciousMoneyLevelUpdatedAt("not-a-date"), true);
assert.equal(isSuspiciousMoneyLevelUpdatedAt("2026"), true);

const unavailablePage = {
  ...normalizedPage,
  accountCards: normalizedPage.accountCards.map((row) => (
    row.name === "ISA" ? { ...row, principal: null } : row
  )),
};
assert.equal(selectMoneyLevelPortfolioSnapshot(unavailablePage).isaPrincipal, 0);
assert.equal(
  diagnoseMoneyLevelPortfolioSelection(unavailablePage).some((item) => item.code === "isa_principal_unavailable"),
  true,
);

assert.equal(selectMoneyLevelPortfolioSnapshot({ snapshot: null, accountCards: [] }), null);

const selectorSource = fs.readFileSync(path.join(rootDir, "lib/money-level/portfolio-selector.ts"), "utf8");
assert.equal(selectorSource.includes(".holdings"), false);
assert.equal(selectorSource.includes(".financeAssets"), false);
assert.equal(selectorSource.includes("principal_krw"), false);

const hookSource = fs.readFileSync(
  path.join(rootDir, "lib/money-level/use-money-level-portfolio-snapshot.ts"),
  "utf8",
);
assert.equal(hookSource.includes("usePortfolioFirestoreSnapshot()"), true);
assert.equal(hookSource.includes("usePortfolioView()"), true);
assert.equal(hookSource.includes("/api/portfolio/latest-snapshot"), false);
assert.equal(hookSource.includes("fetch("), false);

console.log("money level selector checks passed");
