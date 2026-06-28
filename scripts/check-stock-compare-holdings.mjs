#!/usr/bin/env node

// =============================================================
// 종목 성과 비교 — 구성종목(Holdings) 조회/중복 분석 회귀 검증.
//
// 검증 포인트
//   1) 직접 fixture 보유 ETF(SPY/QQQ/SCHD/SPMO)는 status="ok" 로 조회된다.
//   2) 동일 지수 별칭(IVV/VTI→SPY, QQQM→QQQ)은 status="proxy" 로 fallback 되고
//      proxyOf 가 원본 fixture 티커를 가리킨다.
//   3) 대표 ETF 페어(SPY vs SPMO, SPY vs VOO, SPY vs IVV, SPY vs QQQ,
//      SCHD vs SPY, VTI vs SPY, SPMO vs QQQ)는 hasHoldings=true 이고
//      공통 종목이 1개 이상 존재한다(실제 비중 중복도 > 0).
//   4) 티커 대소문자/$/공백은 정규화되어 동일하게 조회된다.
//   5) 개별 종목(AAPL)은 status="stock", 지원 예정 ETF(VYM)는 status="unsupported"
//      로 원인이 구분되며 hasHoldings=false 가 된다.
//   6) supportedHoldingsTickers() 는 SPMO 를 포함한다.
// =============================================================

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
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { analyzeOverlap, resolveHoldings, getHoldings, supportedHoldingsTickers } = require(
  "../lib/stock-compare/holdings.ts",
);

function assertDirectFixtures() {
  for (const t of ["SPY", "QQQ", "SCHD", "SPMO"]) {
    const res = resolveHoldings(t);
    assert.equal(res.status, "ok", `${t}: 직접 fixture status=ok`);
    assert.ok(res.holdings.length > 0, `${t}: holdings 존재`);
    assert.equal(res.proxyOf, null, `${t}: proxyOf=null`);
  }
  return { case: "direct fixtures (SPY/QQQ/SCHD/SPMO) → ok" };
}

function assertProxyFallback() {
  const cases = [
    ["IVV", "SPY"],
    ["VTI", "SPY"],
    ["SPLG", "SPY"],
    ["QQQM", "QQQ"],
  ];
  for (const [alias, origin] of cases) {
    const res = resolveHoldings(alias);
    assert.equal(res.status, "proxy", `${alias}: status=proxy`);
    assert.equal(res.proxyOf, origin, `${alias}: proxyOf=${origin}`);
    assert.ok(res.holdings.length > 0, `${alias}: proxy holdings 존재`);
  }
  return { case: "alias fallback (IVV/VTI/SPLG→SPY, QQQM→QQQ) → proxy" };
}

function assertRepresentativePairs() {
  const pairs = [
    ["SPY", "SPMO"],
    ["SPY", "VOO"],
    ["SPY", "IVV"],
    ["SPY", "QQQ"],
    ["SCHD", "SPY"],
    ["VTI", "SPY"],
    ["SPMO", "QQQ"],
  ];
  const rows = [];
  for (const [a, b] of pairs) {
    const ov = analyzeOverlap(a, b);
    assert.equal(ov.hasHoldings, true, `${a} vs ${b}: hasHoldings=true`);
    assert.ok(ov.commonCount >= 1, `${a} vs ${b}: 공통 종목 1개 이상 (got ${ov.commonCount})`);
    assert.ok(ov.mutualWeightPct > 0, `${a} vs ${b}: 실제 비중 중복도 > 0`);
    rows.push({
      pair: `${a} vs ${b}`,
      common: ov.commonCount,
      mutualWeightPct: ov.mutualWeightPct,
      weightOverlapA: ov.weightOverlapPctA,
      weightOverlapB: ov.weightOverlapPctB,
      topA: ov.holdingsA[0]?.ticker ?? "-",
      topB: ov.holdingsB[0]?.ticker ?? "-",
    });
  }
  return { case: "representative pairs all resolve", rows };
}

function assertCaseInsensitiveNormalization() {
  const base = getHoldings("SPY");
  for (const variant of ["spy", " SPY ", "$SPY", "Spy"]) {
    const got = getHoldings(variant);
    assert.equal(got.length, base.length, `${JSON.stringify(variant)} → SPY 와 동일 조회`);
  }
  return { case: "ticker normalization (case/$/whitespace)" };
}

function assertCauseDistinction() {
  const stock = resolveHoldings("AAPL");
  assert.equal(stock.status, "stock", "AAPL: 개별 종목 status=stock");
  assert.equal(getHoldings("AAPL").length, 0, "AAPL: holdings 없음");

  const unsupported = resolveHoldings("VYM");
  assert.equal(unsupported.status, "unsupported", "VYM: 미지원 ETF status=unsupported");
  assert.equal(getHoldings("VYM").length, 0, "VYM: holdings 없음");

  const ov = analyzeOverlap("SPY", "AAPL");
  assert.equal(ov.hasHoldings, false, "SPY vs AAPL: hasHoldings=false");
  assert.equal(ov.statusA, "ok", "SPY 측 status=ok");
  assert.equal(ov.statusB, "stock", "AAPL 측 status=stock");
  return { case: "cause distinction (stock vs unsupported)" };
}

function assertSupportedList() {
  const list = supportedHoldingsTickers();
  for (const t of ["SPMO", "SPY", "QQQ", "SCHD", "IVV", "VTI", "QQQM"]) {
    assert.ok(list.includes(t), `supportedHoldingsTickers 에 ${t} 포함`);
  }
  return { case: "supported list includes SPMO + aliases", count: list.length };
}

function main() {
  const rows = [
    assertDirectFixtures(),
    assertProxyFallback(),
    assertCaseInsensitiveNormalization(),
    assertCauseDistinction(),
    assertSupportedList(),
  ];
  const pairResult = assertRepresentativePairs();
  console.log("Stock-compare holdings lookup & overlap regression passed.");
  console.table(rows);
  console.log("\nRepresentative ETF pair overlap:");
  console.table(pairResult.rows);
}

try {
  main();
} catch (error) {
  console.error("Stock-compare holdings regression failed.");
  console.error(error);
  process.exit(1);
}
