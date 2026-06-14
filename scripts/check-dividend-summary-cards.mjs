#!/usr/bin/env node

// PORTFOLIO-DIVIDEND-UX-FIX-3 #4 회귀 테스트.
// 환산 예상 배당 카드 계산을 검증한다.
// - 환산 예상 배당 = 평가금액 × 0.035 (세전)
// - 세후 토글 시 × (1 - 0.154) = × 0.846
// - 위탁/절세 선택 범위에 따라 평가금액 source 가 바뀜 (= 입력 평가금액이 바뀜)
// - NaN/undefined/음수 방어

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
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  computeConvertedAnnualDividendKRW,
  DIVIDEND_WITHDRAWAL_RATE,
  DIVIDEND_AFTER_TAX_FACTOR,
} = require("../lib/dividend-estimates.ts");

function assertConstants() {
  assert.equal(DIVIDEND_WITHDRAWAL_RATE, 0.035);
  assert.equal(DIVIDEND_AFTER_TAX_FACTOR, 0.846);
  return { case: "상수 3.5% / 0.846" };
}

function assertPreTax() {
  const evaluationKRW = 100_000_000;
  const value = computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax: false });
  assert.equal(value, Math.round(evaluationKRW * 0.035));
  assert.equal(value, 3_500_000);
  return { case: "세전 = 평가금액 × 3.5%", value };
}

function assertAfterTax() {
  const evaluationKRW = 100_000_000;
  const value = computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax: true });
  assert.equal(value, Math.round(evaluationKRW * 0.035 * 0.846));
  assert.equal(value, 2_961_000);
  return { case: "세후 = 평가금액 × 3.5% × 0.846", value };
}

function assertScopeChangesWithEvaluation() {
  // 위탁만 vs 절세합산 → 평가금액 source 가 바뀌면 환산 예상 배당도 바뀐다.
  const taxableOnly = 80_000_000;
  const withTaxAdvantaged = 120_000_000;
  const a = computeConvertedAnnualDividendKRW(taxableOnly, { afterTax: false });
  const b = computeConvertedAnnualDividendKRW(withTaxAdvantaged, { afterTax: false });
  assert.equal(a, 2_800_000);
  assert.equal(b, 4_200_000);
  assert.ok(b > a, "절세합산 평가금액이 크면 환산 예상 배당도 커야 한다");
  return { case: "위탁/절세 범위 반영", taxableOnly: a, withTaxAdvantaged: b };
}

function assertDefense() {
  assert.equal(computeConvertedAnnualDividendKRW(0, { afterTax: false }), 0);
  assert.equal(computeConvertedAnnualDividendKRW(-100, { afterTax: false }), 0);
  assert.equal(computeConvertedAnnualDividendKRW(Number.NaN, { afterTax: true }), 0);
  assert.equal(computeConvertedAnnualDividendKRW(undefined, { afterTax: true }), 0);
  assert.equal(computeConvertedAnnualDividendKRW(null), 0);
  return { case: "NaN/undefined/음수 방어" };
}

function assertCardsShape() {
  // 5개 카드 데이터가 모두 정상 생성되는지(숫자/문자 방어).
  const evaluationKRW = 50_000_000;
  const annualDividendKRW = 1_800_000;
  const cards = {
    평가금액: evaluationKRW,
    연간예상배당: annualDividendKRW,
    월평균예상배당: annualDividendKRW / 12,
    환산예상배당: computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax: true }),
    목표달성률: 75.5,
  };
  const values = Object.values(cards);
  assert.equal(values.length, 5, "요약 카드는 5개여야 한다");
  for (const [name, v] of Object.entries(cards)) {
    assert.ok(typeof v === "number" && Number.isFinite(v), `${name} 값은 유한 숫자여야 한다`);
  }
  return { case: "5개 카드 데이터 생성", count: values.length };
}

function main() {
  const rows = [
    assertConstants(),
    assertPreTax(),
    assertAfterTax(),
    assertScopeChangesWithEvaluation(),
    assertDefense(),
    assertCardsShape(),
  ];
  console.log("Dividend summary cards regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("Dividend summary cards regression failed.");
  console.error(error);
  process.exit(1);
}
