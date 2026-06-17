#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summaryPath = path.join(rootDir, "components", "dividend", "DividendSummaryCards.tsx");
const pagePath = path.join(rootDir, "components", "dividend", "DividendPage.tsx");
const summary = fs.readFileSync(summaryPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const appSources = [summary, page].join("\n");

assert.ok(!appSources.includes("일괄 3.5% 인출률 적용"), "legacy withdrawal-mode label must not remain in dividend UI sources");
assert.ok(summary.includes("일괄3.5%인출률"), "short withdrawal-mode label must exist in DividendSummaryCards");
assert.ok(!appSources.includes("절세합산"), "legacy tax-advantaged group label must not remain in dividend UI sources");
assert.ok(summary.includes("절세합"), "short tax-advantaged group label must exist in DividendSummaryCards");

for (const contract of [
  "withdrawalMode",
  "afterTax",
  "includeTaxAdvantaged",
  "onToggleTax(false)",
  "onToggleTax(true)",
  "onToggleWithdrawalMode(!withdrawalMode)",
  "onToggleGroup(false)",
  "onToggleGroup(true)",
  "computeConvertedAnnualDividendKRW",
  "withdrawalMode ? convertedAnnualDividendKRW : ttmAnnualDividendKRW",
]) {
  const source = contract.startsWith("compute") || contract.includes("convertedAnnualDividend") ? page : summary;
  assert.ok(source.includes(contract), `calculation/state/handler contract changed or missing: ${contract}`);
}

console.log("Dividend summary mobile label checks passed.");
console.table([
  { case: "legacy labels removed", labels: "일괄 3.5% 인출률 적용, 절세합산" },
  { case: "short labels present", labels: "일괄3.5%인출률, 절세합" },
  { case: "state/handler/calculation contracts retained", contracts: "withdrawalMode, afterTax, includeTaxAdvantaged" },
]);
