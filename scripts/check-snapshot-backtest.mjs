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

// localStorage shim (krx name map reads it).
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { guessTicker, getQuoteTickerForHolding } = require("../lib/ticker-mapper.ts");
const { applyKnownQuoteTickerToHolding, normalizeHoldingTickerInfo } = require("../lib/holding-ticker-normalizer.ts");
const { buildSnapshotBacktest } = require("../lib/snapshot-backtest.ts");

function holding(overrides = {}) {
  return {
    id: overrides.id ?? "h",
    broker: "",
    assetType: overrides.assetType ?? "ETF",
    productName: overrides.productName ?? "",
    principalKRW: overrides.principalKRW ?? 0,
    valueKRW: overrides.valueKRW ?? 0,
    ...overrides,
  };
}

// ---- 1) SGOV 변형 인식 ----
for (const name of ["SGOV", "SGOV US", "SGOV ETF", "sgov"]) {
  const mapped = applyKnownQuoteTickerToHolding(holding({ productName: name, ticker: guessTicker(name).ticker ?? undefined }));
  assert.equal(mapped.ticker, "SGOV", `SGOV 변형 인식 실패: "${name}" → ${mapped.ticker}`);
}
// SGOV 는 현금성이 아니라 실제 가격 사용(quote ticker = SGOV)
assert.equal(getQuoteTickerForHolding(holding({ productName: "SGOV", ticker: "SGOV" })), "SGOV", "SGOV quote ticker");
console.log("✓ SGOV / SGOV US / SGOV ETF → SGOV 인식");

// ---- 2) MMF → 488770.KS, 현금성 처리 ----
for (const name of ["KODEX 머니마켓액티브", "Kodex머니마켓액티브", "MMF", "원MMF"]) {
  const mapped = applyKnownQuoteTickerToHolding(holding({ productName: name }));
  assert.equal(mapped.ticker, "488770.KS", `MMF 매핑 실패: "${name}" → ${mapped.ticker}`);
  // 현금성으로 취급되어 getQuoteTickerForHolding 은 null(=백테스트에서 현금 처리).
  assert.equal(getQuoteTickerForHolding(mapped), null, `MMF 는 현금성으로 처리되어야 함: ${name}`);
  assert.equal(normalizeHoldingTickerInfo(mapped).isCashLike, true, `MMF isCashLike: ${name}`);
}
console.log("✓ KODEX 머니마켓액티브 / MMF / 원MMF → 488770.KS (현금성)");

// ---- 3) 한국 ETF 우선순위(360200.KS) ----
assert.equal(getQuoteTickerForHolding(holding({ productName: "ACE 미국S&P500", ticker: "360200.KS" })), "360200.KS", "한국 ETF 티커");
assert.equal(normalizeHoldingTickerInfo(holding({ productName: "ACE 미국S&P500" })).exposureProxy, "SPY", "ACE S&P500 fallback proxy = SPY");
console.log("✓ 한국 ETF 360200.KS 인식 + 대표 ETF(SPY) 폴백 프록시");

// ---- 4) buildSnapshotBacktest 기본 계산 ----
function series(startDate, count, startClose, monthlyGrowth) {
  const out = [];
  const d = new Date(`${startDate}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const date = new Date(d);
    date.setUTCMonth(date.getUTCMonth() + i);
    out.push({ date: date.toISOString().slice(0, 10), close: startClose * (1 + monthlyGrowth) ** i });
  }
  return out;
}
const today = new Date();
const start = new Date(today);
start.setUTCMonth(start.getUTCMonth() - 24);
const startISO = start.toISOString().slice(0, 10);
const asOf = today.toISOString().slice(0, 10);

const spy = series(startISO, 25, 400, 0.01); // 미국 USD
const qqq = series(startISO, 25, 300, 0.015);
const kospi = series(startISO, 25, 2500, 0.005); // 원화
const fx = series(startISO, 25, 1300, 0.0); // 환율 평탄
const aceSpy = series(startISO, 25, 15000, 0.008); // 360200.KS (원화)

const result = buildSnapshotBacktest({
  entries: [
    { key: "360200.KS", label: "ACE 미국S&P500", valueKRW: 6_000_000, ticker: "360200.KS", proxyTicker: "SPY", isUsd: false, isCash: false },
    { key: "SGOV", label: "SGOV", valueKRW: 4_000_000, ticker: "SGOV", proxyTicker: undefined, isUsd: true, isCash: false },
    { key: "name:원화현금", label: "원화 현금", valueKRW: 2_000_000, ticker: null, isUsd: false, isCash: true },
  ],
  priceHistories: { "360200.KS": aceSpy, SGOV: series(startISO, 25, 100, 0.001) },
  benchmarkHistories: { spy, qqq, kospi },
  fxHistory: fx,
  months: 24,
  asOfDate: asOf,
});

assert.equal(result.available, true, "백테스트 available");
assert.equal(result.basePrincipalKRW, 12_000_000, "원금 합계");
assert.ok(result.points.length >= 20, `월별 포인트 수: ${result.points.length}`);
assert.equal(result.fxApplied, true, "환율 반영");
for (const key of ["portfolio", "spy", "qqq", "kospi"]) {
  assert.equal(result.cards[key].available, true, `${key} 카드 available`);
  assert.equal(result.cards[key].principalKRW, 12_000_000, `${key} 원금`);
  assert.ok(Number.isFinite(result.cards[key].currentValueKRW), `${key} 현재가치 유한`);
}
// 현금(200만)은 평탄 → 포트폴리오 최종값은 (성장한 ACE+SGOV) + 200만 현금.
assert.ok(result.cards.portfolio.currentValueKRW > result.basePrincipalKRW, "성장 포트폴리오 > 원금");
// QQQ(1.5%/월) > SPY(1%/월) 누적
assert.ok(result.cards.qqq.currentValueKRW > result.cards.spy.currentValueKRW, "QQQ > SPY");
console.log("✓ buildSnapshotBacktest: 포트폴리오/SPY/QQQ/KOSPI 계산 + 현금 평탄 처리");

// ---- 5) 환율 미반영 케이스 ----
const noFx = buildSnapshotBacktest({
  entries: [{ key: "SGOV", label: "SGOV", valueKRW: 1_000_000, ticker: "SGOV", isUsd: true, isCash: false }],
  priceHistories: { SGOV: series(startISO, 25, 100, 0.001) },
  benchmarkHistories: { spy, qqq, kospi },
  fxHistory: null,
  months: 24,
  asOfDate: asOf,
});
assert.equal(noFx.fxApplied, false, "환율 미반영 플래그");
assert.ok(noFx.warnings.includes("환율 미반영"), "환율 미반영 경고");
console.log("✓ 환율 데이터 없을 때 '환율 미반영' 플래그/경고");

// ---- 6) 빈 스냅샷 방어 ----
const empty = buildSnapshotBacktest({ entries: [], priceHistories: {}, benchmarkHistories: {}, fxHistory: null });
assert.equal(empty.available, false, "빈 입력 → available false (오류 미발생)");
console.log("✓ 빈 스냅샷/데이터 부족 시 오류 없이 안내 처리");

console.log("\n모든 검증 통과 ✅");
