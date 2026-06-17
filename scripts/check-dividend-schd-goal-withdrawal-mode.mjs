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
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  DIVIDEND_AFTER_TAX_FACTOR,
  computeConvertedAnnualDividendKRW,
  computeSchdEquivalentGoalProgress,
} = require("../lib/dividend-estimates.ts");

function round1(value) {
  return Math.round(value * 10) / 10;
}

function assertEquivalentGoalProgress() {
  const actualShares = 325;
  const equivalentShares = 663.7;
  const targetQty = 3300;
  const targetPriceKRW = 49_390;
  const evaluationKRW = equivalentShares * targetPriceKRW;
  const progress = computeSchdEquivalentGoalProgress({
    targetTicker: "SCHD",
    targetQty,
    evaluationKRW,
    targetPriceKRW,
    actualShares,
  });

  assert.equal(progress.calculable, true);
  assert.equal(round1(progress.equivalentShares), 663.7);
  assert.equal(progress.actualShares, 325);
  assert.equal(round1(progress.achievementPct), 20.1);
  assert.ok(progress.equivalentShares >= progress.actualShares, "환산주수는 실제 SCHD 주수보다 작으면 안 된다");
  return { case: "SCHD 환산주수 기준 목표 달성률", label: "663.7주(실보유 325주) / 3,300주" };
}

function assertActualSharesOnlyWouldBeWrong() {
  const actualOnlyPct = (325 / 3300) * 100;
  const equivalentPct = (663.7 / 3300) * 100;
  assert.equal(round1(actualOnlyPct), 9.8);
  assert.equal(round1(equivalentPct), 20.1);
  assert.notEqual(round1(actualOnlyPct), round1(equivalentPct));
  return { case: "실보유 주수 단독 계산 방지", actualOnlyPct: round1(actualOnlyPct), equivalentPct: round1(equivalentPct) };
}

function assertMissingTargetPriceIsUnavailable() {
  const progress = computeSchdEquivalentGoalProgress({
    targetTicker: "SCHD",
    targetQty: 3300,
    evaluationKRW: 32_780_000,
    actualShares: 325,
  });
  assert.equal(progress.calculable, false);
  assert.equal(progress.error, "목표 종목 현재가 조회 불가");
  return { case: "SCHD 가격 없음 → 계산 불가" };
}

function assertWithdrawalModeMath() {
  const evaluationKRW = 40_340_000;
  const preTaxAnnual = computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax: false });
  const afterTaxAnnual = computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax: true });
  assert.equal(preTaxAnnual, Math.round(evaluationKRW * 0.035));
  assert.equal(afterTaxAnnual, Math.round(evaluationKRW * 0.035 * DIVIDEND_AFTER_TAX_FACTOR));
  assert.equal(preTaxAnnual / 12, Math.round(evaluationKRW * 0.035) / 12);
  return { case: "3.5% 인출률 ON 계산", preTaxAnnual, preTaxMonthly: preTaxAnnual / 12, afterTaxAnnual };
}

function assertUiContracts() {
  const page = fs.readFileSync(path.join(rootDir, "components", "dividend", "DividendPage.tsx"), "utf8");
  const cards = fs.readFileSync(path.join(rootDir, "components", "dividend", "DividendSummaryCards.tsx"), "utf8");
  assert.ok(cards.includes("일괄3.5%인출률"));
  assert.ok(cards.includes("실제 배당 이력은 반영하지 않습니다"));
  assert.ok(page.includes("withdrawalMode ? convertedAnnualDividendKRW : ttmAnnualDividendKRW"));
  assert.ok(page.includes("quantity: estimate.estimatedQuantity ?? row.quantity"));
  assert.ok(page.includes("quantityEstimated: estimate.estimatedQuantity !== undefined"));
  assert.ok(page.includes("SCHD 환산"));
  assert.ok(page.includes("실보유"));
  return { case: "UI/모드 분리 계약" };
}

const rows = [
  assertEquivalentGoalProgress(),
  assertActualSharesOnlyWouldBeWrong(),
  assertMissingTargetPriceIsUnavailable(),
  assertWithdrawalModeMath(),
  assertUiContracts(),
];
console.log("Dividend SCHD goal + withdrawal mode checks passed.");
console.table(rows);
