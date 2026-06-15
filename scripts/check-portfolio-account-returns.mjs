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
  if (request.startsWith("@/")) return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename });
  module._compile(output.outputText, filename);
};

const { buildPortfolioAccountReturnRows, MIN_VISIBLE_ACCOUNT_AMOUNT_KRW } = require("../lib/portfolio-account-returns.ts");
const { buildPortfolioPageFromSnapshot } = require("../lib/portfolio-from-snapshots.ts");

function holding(overrides = {}) { return { id: overrides.id ?? Math.random().toString(36), broker: "미래증권", assetType: "ETF", productName: "ETF", principalKRW: 800_000, valueKRW: 1_000_000, ...overrides }; }
function financeAsset(overrides = {}) { return { id: overrides.id ?? Math.random().toString(36), groupName: "자유입출금 자산", productName: "계좌", amountKRW: 1_000_000, category: "투자성", ...overrides }; }
function snapshot(overrides = {}) { return { id: "s", snapshotDate: "2026-06-15", sourceFileName: "x.xlsx", totalAssetKRW: 0, totalDebtKRW: 0, netAssetKRW: 0, investmentPrincipalKRW: 0, investmentValueKRW: 0, returnAmountKRW: 0, returnPct: 0, holdings: [], financeAssets: [], createdAt: "2026-06-15T00:00:00.000Z", ...overrides }; }

{
  const result = buildPortfolioAccountReturnRows(snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: 1_500_000, principalKRW: 1_000_000 })] }));
  assert.equal(result.rows[0].principalKRW, 1_000_000);
  assert.equal(result.rows[0].returnAmountKRW, 500_000);
  assert.equal(Number(result.rows[0].returnPct.toFixed(1)), 50.0);
}
{
  const result = buildPortfolioAccountReturnRows(snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: 1_000_000, principalKRW: null })] }));
  assert.equal(result.rows[0].principalKRW, null);
  assert.equal(result.rows[0].returnAmountKRW, null);
  assert.equal(result.rows[0].returnPct, null);
}
{
  const result = buildPortfolioAccountReturnRows(snapshot({ financeAssets: [financeAsset({ accountGroup: "위탁", amountKRW: 1_000_000 })] }));
  assert.equal(result.rows[0].valueKRW, 1_000_000);
  assert.equal(result.rows[0].principalKRW, null);
  assert.equal(result.rows[0].returnPct, null);
}
{
  const result = buildPortfolioAccountReturnRows(snapshot({ holdings: [holding({ accountGroup: "위탁" }), holding({ accountGroup: "연금" }), holding({ accountGroup: "투자성 자산" })] }));
  assert.deepEqual(new Set(result.rows.map((row) => row.statusGroup)), new Set(["위탁", "절세", "미확인"]));
}
{
  const result = buildPortfolioAccountReturnRows(snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: 1_000_000, principalKRW: 0 })] }));
  assert.equal(result.rows[0].returnPct, null);
}
{
  const result = buildPortfolioAccountReturnRows(snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: 700_000, principalKRW: 1_000_000 })] }));
  assert.equal(result.rows[0].returnAmountKRW, -300_000);
  assert.equal(Number(result.rows[0].returnPct.toFixed(1)), -30.0);
}
{
  const result = buildPortfolioAccountReturnRows(snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: Number.NaN, principalKRW: Number.NaN }), holding({ accountGroup: "위탁", valueKRW: 300_000, principalKRW: null })] }));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].returnPct, null);
}
{
  const result = buildPortfolioAccountReturnRows(snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: MIN_VISIBLE_ACCOUNT_AMOUNT_KRW - 1, principalKRW: 10_000 })] }));
  assert.equal(result.rows.length, 0);
}
{
  const input = snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: 1_000_000, principalKRW: 800_000 })] });
  const before = JSON.stringify(input);
  buildPortfolioAccountReturnRows(input);
  assert.equal(JSON.stringify(input), before);
}
{
  const page = buildPortfolioPageFromSnapshot(snapshot({ holdings: [holding({ accountGroup: "위탁", valueKRW: 1_000_000, principalKRW: 800_000 })] }));
  assert.equal(page.accountCards[0].principal, 800_000);
  assert.equal(page.accountCards[0].profit, 200_000);
}

const ui = fs.readFileSync(path.join(rootDir, "components/AssetAccountCards.tsx"), "utf8");
assert.ok(ui.includes("원금"));
assert.ok(ui.includes("수익"));
assert.ok(ui.includes("수익률"));
assert.ok(ui.includes("일부 계좌는 원금 정보가 없어 수익률을 계산하지 않습니다."));
console.log("portfolio account returns checks passed");
