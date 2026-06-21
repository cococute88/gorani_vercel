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
const schd = series(startISO, 25, 70, 0.008); // 사용자 선택 비교 티커(USD)
const fx = series(startISO, 25, 1300, 0.0); // 환율 평탄
const aceSpy = series(startISO, 25, 15000, 0.008); // 360200.KS (원화)

const result = buildSnapshotBacktest({
  entries: [
    { key: "360200.KS", label: "ACE 미국S&P500", valueKRW: 6_000_000, ticker: "360200.KS", proxyTicker: "SPY", isUsd: false, isCash: false },
    { key: "SGOV", label: "SGOV", valueKRW: 4_000_000, ticker: "SGOV", proxyTicker: undefined, isUsd: true, isCash: false },
    { key: "name:원화현금", label: "원화 현금", valueKRW: 2_000_000, ticker: null, isUsd: false, isCash: true },
  ],
  priceHistories: { "360200.KS": aceSpy, SGOV: series(startISO, 25, 100, 0.001) },
  benchmarkHistories: { spy, qqq, custom: schd },
  fxHistory: fx,
  months: 24,
  asOfDate: asOf,
  customTicker: "SCHD",
});

const SNAPSHOT_TOTAL = 12_000_000; // 현재 평가액 합계(= 그래프 마지막 값).
assert.equal(result.available, true, "백테스트 available");
assert.ok(result.points.length >= 20, `월별 포인트 수: ${result.points.length}`);
assert.equal(result.fxApplied, true, "환율 반영");

// [핵심] 그래프 마지막 값(= 포트폴리오 현재 가치)은 스냅샷 평가액과 정확히 일치해야 한다.
assert.equal(result.cards.portfolio.currentValueKRW, SNAPSHOT_TOTAL, "포트폴리오 현재가치 = 스냅샷 평가액");
const lastPoint = result.points[result.points.length - 1];
assert.equal(lastPoint.portfolio, SNAPSHOT_TOTAL, "그래프 마지막 점 = 카드 현재가치");

// [핵심] 원금은 현재 평가액이 아니라 "역산된 과거 원금"이며, 가격이 올랐으므로 현재값보다 작아야 한다.
assert.ok(result.basePrincipalKRW > 0, "원금 > 0");
assert.ok(result.basePrincipalKRW < SNAPSHOT_TOTAL, "역산 원금 < 현재 평가액(가격 상승 가정)");

for (const key of ["portfolio", "spy", "qqq", "custom"]) {
  assert.equal(result.cards[key].available, true, `${key} 카드 available`);
  // 모든 카드는 동일한 역산 원금을 기준으로 한다.
  assert.equal(result.cards[key].principalKRW, result.basePrincipalKRW, `${key} 원금 = 역산 원금`);
  assert.ok(Number.isFinite(result.cards[key].currentValueKRW), `${key} 현재가치 유한`);
}
// 사용자 선택 비교 티커 카드 라벨은 "<티커> 투자 시" 로 동적 생성된다.
assert.equal(result.cards.custom.label, "SCHD 투자 시", "custom 카드 라벨 동적 생성");
// 성장 가정이므로 포트폴리오 현재가치 > 역산 원금.
assert.ok(result.cards.portfolio.currentValueKRW > result.basePrincipalKRW, "성장 포트폴리오 > 원금");
// QQQ(1.5%/월) > SPY(1%/월) 누적
assert.ok(result.cards.qqq.currentValueKRW > result.cards.spy.currentValueKRW, "QQQ > SPY");
console.log("✓ buildSnapshotBacktest: 현재가치=스냅샷 / 원금 역산 / 그래프-카드 일치 / SPY·QQQ·커스텀 계산");

// ---- 5) 환율 미반영 케이스 ----
const noFx = buildSnapshotBacktest({
  entries: [{ key: "SGOV", label: "SGOV", valueKRW: 1_000_000, ticker: "SGOV", isUsd: true, isCash: false }],
  priceHistories: { SGOV: series(startISO, 25, 100, 0.001) },
  benchmarkHistories: { spy, qqq, custom: schd },
  fxHistory: null,
  months: 24,
  asOfDate: asOf,
  customTicker: "SCHD",
});
assert.equal(noFx.fxApplied, false, "환율 미반영 플래그");
assert.ok(noFx.warnings.includes("환율 미반영"), "환율 미반영 경고");
console.log("✓ 환율 데이터 없을 때 '환율 미반영' 플래그/경고");

// ---- 5b) 기간 선택(6개월) 및 기간별 포인트 수 ----
const sixMonth = buildSnapshotBacktest({
  entries: [
    { key: "360200.KS", label: "ACE 미국S&P500", valueKRW: 6_000_000, ticker: "360200.KS", proxyTicker: "SPY", isUsd: false, isCash: false },
  ],
  priceHistories: { "360200.KS": aceSpy },
  benchmarkHistories: { spy, qqq, custom: schd },
  fxHistory: fx,
  months: 6,
  asOfDate: asOf,
  customTicker: "QLD",
});
assert.equal(sixMonth.available, true, "6개월 백테스트 available");
assert.ok(sixMonth.points.length <= 8, `6개월 포인트 수 제한: ${sixMonth.points.length}`);
assert.ok(sixMonth.points.length < result.points.length, "6개월 포인트 < 2년 포인트");
assert.equal(sixMonth.cards.custom.label, "QLD 투자 시", "6개월 custom 라벨");
// 현재가치는 기간과 무관하게 스냅샷 평가액(6,000,000)과 일치한다.
assert.equal(sixMonth.cards.portfolio.currentValueKRW, 6_000_000, "6개월 현재가치 = 스냅샷 평가액");
console.log("✓ 기간(6개월) 선택 시 포인트 범위 축소 + 라벨 동적 변경");

// ---- 5c) 기간별 원금 차이 (2년 < 1년 < 6개월) ----
// 동일 종목·동일 현재 평가액에서, 가격이 우상향(0.8%/월)이면
// 더 먼 과거일수록 역산 원금이 작아져야 한다(req 7-2).
function aceOnlyPrincipal(monthsSel) {
  return buildSnapshotBacktest({
    entries: [
      { key: "360200.KS", label: "ACE 미국S&P500", valueKRW: 6_000_000, ticker: "360200.KS", proxyTicker: "SPY", isUsd: false, isCash: false },
    ],
    priceHistories: { "360200.KS": aceSpy },
    benchmarkHistories: { spy, qqq, custom: schd },
    fxHistory: fx,
    months: monthsSel,
    asOfDate: asOf,
    customTicker: "QLD",
  }).basePrincipalKRW;
}
const p24 = aceOnlyPrincipal(24);
const p12 = aceOnlyPrincipal(12);
const p6 = aceOnlyPrincipal(6);
assert.ok(p24 < p12 && p12 < p6, `기간별 원금 단조성 실패: 2년=${p24}, 1년=${p12}, 6개월=${p6}`);
assert.ok(p6 < 6_000_000, "6개월 원금 < 현재 평가액");
console.log(`✓ 기간별 원금 차이: 2년 ${Math.round(p24).toLocaleString()} < 1년 ${Math.round(p12).toLocaleString()} < 6개월 ${Math.round(p6).toLocaleString()}`);

// ---- 6) 빈 스냅샷 방어 ----
const empty = buildSnapshotBacktest({ entries: [], priceHistories: {}, benchmarkHistories: {}, fxHistory: null });
assert.equal(empty.available, false, "빈 입력 → available false (오류 미발생)");
console.log("✓ 빈 스냅샷/데이터 부족 시 오류 없이 안내 처리");

console.log("\n모든 검증 통과 ✅");
