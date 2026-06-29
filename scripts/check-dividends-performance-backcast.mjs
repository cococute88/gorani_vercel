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
if (old) require.extensions[".ts"] = old;

const component = readFileSync("components/dividend/DividendPerformanceSection.tsx", "utf8");
const page = readFileSync("components/dividend/DividendPage.tsx", "utf8");
const helper = readFileSync("lib/dividend-performance-from-snapshots.ts", "utf8");
assert.ok(!component.includes("최소 2개 이상의 스냅샷"));
assert.ok(!helper.includes("최소 2개 이상의 스냅샷"));
assert.ok(page.includes("buildDividendPerformanceBackcast"));
assert.ok(component.includes("최신 보유 기준 역산"));
assert.ok(!page.includes("DIVIDEND_PERFORMANCE_SERIES"));

const holdings = [
  { ticker: "QQQ", quantity: 10, valueKRW: 7_000_000 },
  { ticker: "SPY", quantity: 5, valueKRW: 4_000_000 },
];
const priceHistories = {
  QQQ: [{ date: "2024-06-28", close: 400 }, { date: "2025-06-30", close: 450 }, { date: "2026-06-15", close: 500 }],
  SPY: [{ date: "2024-06-28", close: 500 }, { date: "2025-06-30", close: 550 }, { date: "2026-06-15", close: 600 }],
};
const fxHistory = [{ date: "2024-06-28", close: 1300 }, { date: "2025-06-30", close: 1350 }, { date: "2026-06-15", close: 1400 }];
const result = buildDividendPerformanceBackcast({ holdings, priceHistories, fxHistory, latestDate: "2026-06-15", months: 24 });
assert.equal(result.available, true);
assert.equal(result.dataSource, "latest-holdings-backcast");
assert.ok(result.points.length >= 2);
assert.equal(result.kpis.sp500ValueKRW, null);
assert.ok(result.warnings.some((warning) => warning.includes("최신 보유종목")));

const withBenchmark = buildDividendPerformanceBackcast({
  holdings,
  priceHistories,
  fxHistory,
  benchmarkHistories: { schd: [{ date: "2024-06-28", close: 2500 }, { date: "2026-06-15", close: 3000 }] },
  latestDate: "2026-06-15",
  months: 24,
});
assert.equal(withBenchmark.available, true);
assert.ok(withBenchmark.kpis.schdValueKRW > 0);
assert.equal(withBenchmark.kpis.sp500ValueKRW, null);
assert.equal(buildDividendPerformanceBackcast({ holdings, priceHistories: {}, latestDate: "2026-06-15" }).available, false);
console.log("dividends performance backcast checks passed");
