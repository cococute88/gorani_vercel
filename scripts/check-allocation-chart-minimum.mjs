import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
Module._extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  module._compile(output, filename);
};

const require = Module.createRequire(import.meta.url);
const { isAllocationChartAmountVisible, MIN_ALLOCATION_CHART_AMOUNT_KRW } = require(path.join(root, "lib/allocation-chart-filter.ts"));
const { buildAssetAllocationDonut } = require(path.join(root, "lib/asset-allocation-donut.ts"));
const { buildAssetClassAllocation } = require(path.join(root, "lib/asset-class-allocation.ts"));
const { buildPortfolioPageFromSnapshot } = require(path.join(root, "lib/portfolio-from-snapshots.ts"));

assert.equal(MIN_ALLOCATION_CHART_AMOUNT_KRW, 1_000_000);
assert.equal(isAllocationChartAmountVisible(999_999), false);
assert.equal(isAllocationChartAmountVisible(1_000_000), true);

const donut = buildAssetAllocationDonut([
  { ticker: "TQQQ", valueKRW: 3_000_000 },
  { ticker: "SCHD", valueKRW: 1_500_000 },
  { productName: "기타", valueKRW: 999_999 },
]);
assert.deepEqual(donut.slices.map((slice) => slice.amountKRW).sort((a, b) => a - b), [1_500_000, 3_000_000]);
assert.equal(donut.totalKRW, 4_500_000);
assert.equal(donut.slices.some((slice) => slice.amountKRW === 999_999), false);

const classSlices = buildAssetClassAllocation(
  [
    { ticker: "TQQQ", valueKRW: 3_000_000, principalKRW: 2_500_000 },
    { ticker: "SCHD", valueKRW: 1_500_000, principalKRW: 1_400_000 },
    { ticker: "MISC", productName: "기타", valueKRW: 999_999, principalKRW: 900_000 },
  ],
  [{ productName: "현금", amountKRW: 1_000_000, isDebt: false, category: "현금" }],
);
assert.equal(classSlices.some((slice) => slice.name === "기타"), false);
assert.equal(classSlices.reduce((sum, slice) => sum + slice.valueKRW, 0), 5_500_000);

const model = buildPortfolioPageFromSnapshot({
  id: "boundary",
  snapshotDate: "2026-06-17",
  createdAt: "2026-06-17T00:00:00.000Z",
  sourceFileName: "boundary.xlsx",
  holdings: [
    { ticker: "TQQQ", productName: "TQQQ", valueKRW: 3_000_000, principalKRW: 2_500_000, tag: "성장" },
    { ticker: "SCHD", productName: "SCHD", valueKRW: 1_500_000, principalKRW: 1_400_000, tag: "배당" },
    { ticker: "CASH", productName: "현금", valueKRW: 1_000_000, principalKRW: 1_000_000, tag: "현금" },
    { ticker: "MISC", productName: "기타", valueKRW: 999_999, principalKRW: 900_000, tag: "기타" },
  ],
  financeAssets: [],
});
assert.equal(model.stockAllocation.some((slice) => slice.name.includes("MISC") || slice.name.includes("기타")), false);
assert.equal(model.stockAllocation.reduce((sum, slice) => sum + (slice.amountKRW ?? 0), 0), 5_500_000);
assert.equal(model.stockAllocation.some((slice) => slice.amountKRW === 1_000_000), true);

console.log("allocation minimum boundary checks passed");
