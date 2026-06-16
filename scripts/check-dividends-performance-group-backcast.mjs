#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const old = require.extensions[".ts"];
require.extensions[".ts"] = (mod, filename) => {
  const source = readFileSync(filename, "utf8");
  const out = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  mod._compile(out.outputText, filename);
};
const { buildDividendPerformanceBackcast } = require("../lib/dividend-performance-from-snapshots.ts");
const { buildAccountGroupPerformance } = require("../lib/dividend-ledger-performance.ts");
if (old) require.extensions[".ts"] = old;

const perf = readFileSync("components/dividend/DividendPerformanceSection.tsx", "utf8");
const account = readFileSync("components/dividend/DividendAccountPerformanceSection.tsx", "utf8");
const page = readFileSync("components/dividend/DividendPage.tsx", "utf8");
const helper = readFileSync("lib/dividend-performance-from-snapshots.ts", "utf8");
assert.ok(!`${perf}${account}${helper}`.includes("최소 2개 이상의 스냅샷"));
assert.ok(page.includes("latestBackcastHoldings={accountBackcastHoldings}"));
assert.ok(account.includes("latestBackcastHoldings"));
assert.ok(account.includes("performanceDomain(chartData)"));
assert.ok(perf.includes("performanceDomain(result.points)"));
assert.ok(perf.includes("monthlyProfit: null"));
assert.ok(account.includes("monthlyProfit: null"));
assert.ok(perf.includes('name="총자산"'));
assert.ok(account.includes('name="총자산"'));
assert.ok(!perf.includes("샘플 데이터"));

const priceHistories = {
  SCHD: [{ date: "2024-06-28", close: 70 }, { date: "2025-06-30", close: 75 }, { date: "2026-06-15", close: 80 }],
  SPY: [{ date: "2024-06-28", close: 500 }, { date: "2025-06-30", close: 550 }, { date: "2026-06-15", close: 600 }],
};
const fxHistory = [{ date: "2024-06-28", close: 1300 }, { date: "2025-06-30", close: 1350 }, { date: "2026-06-15", close: 1400 }];
const taxableHoldings = [{ ticker: "SCHD", valueKRW: 1_120_000, currentPriceKRW: 112_000, quantityEstimated: true }];
const taxHoldings = [{ ticker: "SPY", valueKRW: 8_400_000, currentPrice: 600, valueOriginalCurrency: 6000, currency: "USD", quantityEstimated: true }];
const taxable = buildDividendPerformanceBackcast({ holdings: taxableHoldings, priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
const taxAdv = buildDividendPerformanceBackcast({ holdings: taxHoldings, priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
assert.equal(taxable.available, true);
assert.equal(taxAdv.available, true);
assert.ok(taxable.warnings.some((w) => w.includes("추정 수량")));
const partial = buildDividendPerformanceBackcast({ holdings: [...taxableHoldings, { ticker: "NOPE", quantity: 1, valueKRW: 1 }], priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
assert.equal(partial.available, true);
assert.ok(partial.warnings.some((w) => w.includes("제외")));
assert.equal(buildDividendPerformanceBackcast({ holdings: [{ ticker: "NOPE", quantity: 1, valueKRW: 1 }], priceHistories: {}, latestDate: "2026-06-15" }).available, false);
assert.equal(buildDividendPerformanceBackcast({ holdings: taxableHoldings, priceHistories, benchmarkHistories: { kospi: null, sp500: null }, fxHistory, latestDate: "2026-06-15" }).available, true);

const snapshots = [{ id: "s1", snapshotDate: "2026-06-15", sourceFileName: "x", totalAssetKRW: 0, totalDebtKRW: 0, netAssetKRW: 0, investmentPrincipalKRW: 0, investmentValueKRW: 0, returnAmountKRW: 0, returnPct: 0, holdings: [], financeAssets: [], createdAt: "" }];
const group = buildAccountGroupPerformance(snapshots, "위탁", { holdings: taxableHoldings, priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
assert.equal(group.available, true);
assert.equal(group.dataSource, "latest-holdings-backcast");
console.log("dividends performance group backcast checks passed");
