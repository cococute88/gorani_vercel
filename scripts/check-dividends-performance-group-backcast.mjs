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
assert.ok(account.includes("performanceDomain(performanceChartData)"), "account cumulative chart domain derives from its rendered (period-clamped) data");
assert.ok(account.includes("monthHistoryStart(latestSnapshot.snapshotDate, 25)"), "account quote history must start before latest snapshot");
assert.ok(account.includes('yAxisId="profit"') && account.includes('yAxisId="asset"'), "monthly account chart must split profit and asset axes");
assert.ok(perf.includes("performanceDomain(performancePoints)"), "total cumulative chart domain derives from its rendered (period-clamped) data");
assert.ok(perf.includes('yAxisId="profit"') && perf.includes('yAxisId="asset"'), "monthly total chart must split profit and asset axes");
assert.ok(perf.includes("deposit: null") && account.includes("totalAssets: null"), "missing months must stay null, not zero-filled");
assert.ok(perf.includes("monthlyProfit: null"));
assert.ok(account.includes("monthlyProfit: null"));
assert.ok(perf.includes('name="총자산"'));
assert.ok(account.includes('name="총자산"'));
assert.ok(!perf.includes("샘플 데이터"));

const priceHistories = {
  MSFT: [{ date: "2024-06-28", close: 400 }, { date: "2025-06-30", close: 450 }, { date: "2026-06-15", close: 500 }],
  SCHD: [{ date: "2024-06-28", close: 70 }, { date: "2025-06-30", close: 75 }, { date: "2026-06-15", close: 80 }],
  SPY: [{ date: "2024-06-28", close: 500 }, { date: "2025-06-30", close: 550 }, { date: "2026-06-15", close: 600 }],
  QQQ: [{ date: "2024-06-28", close: 420 }, { date: "2025-06-30", close: 480 }, { date: "2026-06-15", close: 530 }],
};
const fxHistory = [{ date: "2024-06-28", close: 1300 }, { date: "2025-06-30", close: 1350 }, { date: "2026-06-15", close: 1400 }];
const taxableHoldings = [
  { ticker: "MSFT", valueKRW: 7_000_000, currentPrice: 500, valueOriginalCurrency: 5000, currency: "USD", estimatedQuantity: 10 },
  { ticker: "SPY", valueKRW: 8_400_000, currentPrice: 600, valueOriginalCurrency: 6000, currency: "USD", quantityEstimated: true },
  { ticker: "SCHD", valueKRW: 1_120_000, currentPriceKRW: 112_000, quantityEstimated: true },
];
const taxHoldings = [
  { ticker: "SPY", valueKRW: 8_400_000, currentPrice: 600, valueOriginalCurrency: 6000, currency: "USD", quantityEstimated: true },
  { ticker: "QQQ", valueKRW: 7_420_000, currentPrice: 530, valueOriginalCurrency: 5300, currency: "USD" },
];
const taxable = buildDividendPerformanceBackcast({ holdings: taxableHoldings, priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
const taxAdv = buildDividendPerformanceBackcast({ holdings: taxHoldings, priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
assert.equal(taxable.available, true);
assert.equal(taxAdv.available, true);
assert.ok(taxable.warnings.some((w) => w.includes("추정 수량")));
const partial = buildDividendPerformanceBackcast({ holdings: [...taxableHoldings, { ticker: "NOPE", quantity: 1, valueKRW: 1 }], priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
assert.equal(partial.available, true);
assert.ok(partial.warnings.some((w) => w.includes("제외")));
const allFailed = buildDividendPerformanceBackcast({ holdings: [{ ticker: "NOPE", quantity: 1, valueKRW: 1 }], priceHistories: {}, latestDate: "2026-06-15" });
assert.equal(allFailed.available, false);
assert.ok(allFailed.unavailableReason.includes("과거 가격을 확인할 수 있는 보유종목이 없습니다"));
assert.equal(buildDividendPerformanceBackcast({ holdings: taxableHoldings, priceHistories, benchmarkHistories: { kospi: null, sp500: null }, fxHistory, latestDate: "2026-06-15" }).available, true);

const snapshots = [{ id: "s1", snapshotDate: "2026-06-15", sourceFileName: "x", totalAssetKRW: 0, totalDebtKRW: 0, netAssetKRW: 0, investmentPrincipalKRW: 0, investmentValueKRW: 0, returnAmountKRW: 0, returnPct: 0, holdings: [], financeAssets: [], createdAt: "" }];
const group = buildAccountGroupPerformance(snapshots, "위탁", { holdings: taxableHoldings, priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
assert.equal(group.available, true);
assert.equal(group.dataSource, "latest-holdings-backcast");
console.log("dividends performance group backcast checks passed");
