#!/usr/bin/env node
// =============================================================
// 역산 성과 분석 회귀 재현 스크립트.
//
// 가설: PR #158 (commit 264dd71) 이후 SnapshotBacktestSection 의 데이터 소스가
//   localStorage `snapshots` -> `mergedSnapshots`(Firestore 활성 스냅샷 우선) 로
//   바뀌었다. Firestore 스냅샷의 holdings 는 mapHolding 만 거치고
//   guessTicker/applyKnownQuoteTickerToHolding 의 "product_name 기반 티커 복원"
//   을 거치지 않는다. 따라서 ticker 필드가 비어 있는 미국 ETF 보유분은
//   getQuoteTickerForHolding 에서 현금(null)으로 분류되어 역산에서 "평탄(0%)"
//   처리되고, 포트폴리오 수익률이 비정상적으로 낮아진다.
//
// 이 스크립트는 실제 lib 함수를 사용해 그 메커니즘을 코드 레벨에서 재현한다.
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
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { guessTicker, getQuoteTickerForHolding } = require("../lib/ticker-mapper.ts");
const { applyKnownQuoteTickerToHolding } = require("../lib/holding-ticker-normalizer.ts");
const { buildSnapshotBacktest } = require("../lib/snapshot-backtest.ts");

// === 수정 후 SnapshotBacktestSection.resolveBacktestTicker 와 동일한 정규화 ===
// (데이터 소스 무관 티커 정규화: ticker 없으면 이름 기반 guessTicker 폴백 후 표준 티커 적용)
function resolveBacktestTicker(holding) {
  const hasTicker = typeof holding.ticker === "string" && holding.ticker.trim() !== "";
  const seeded = hasTicker
    ? holding
    : { ...holding, ticker: guessTicker(holding.cleanName ?? holding.productName ?? "").ticker ?? undefined };
  return applyKnownQuoteTickerToHolding(seeded);
}

// --- 합성 가격 히스토리: 2년간 +60% 상승하는 미국 ETF, 환율은 1300 고정. ---
function ramp(startVal, endVal) {
  const points = [];
  const months = 25;
  for (let i = 0; i < months; i += 1) {
    const d = new Date(Date.UTC(2024, 5 + i, 15));
    const close = startVal + ((endVal - startVal) * i) / (months - 1);
    points.push({ date: d.toISOString().slice(0, 10), close });
  }
  return points;
}
const PRICE_UP60 = ramp(100, 160); // +60%
const FX_FLAT = ramp(1300, 1300);
const asOf = "2026-06-15";

const priceHistories = {
  TQQQ: PRICE_UP60,
  QLD: PRICE_UP60,
  SPY: PRICE_UP60,
  QQQ: PRICE_UP60,
  SCHD: PRICE_UP60,
};
const benchmarkHistories = { spy: PRICE_UP60, qqq: PRICE_UP60, custom: PRICE_UP60 };

// buildEntries 를 컴포넌트에서 그대로 가져와 재현(동일 로직).
// applyFix=true 이면 수정본(resolveBacktestTicker) 을 적용한다.
function buildEntries(holdings, applyFix) {
  const map = new Map();
  for (const rawHolding of holdings ?? []) {
    const holding = applyFix ? resolveBacktestTicker(rawHolding) : rawHolding;
    const valueKRW =
      typeof holding.valueKRW === "number" && Number.isFinite(holding.valueKRW) && holding.valueKRW > 0
        ? holding.valueKRW
        : 0;
    if (valueKRW <= 0) continue;
    const quoteTicker = getQuoteTickerForHolding(holding);
    const isCash = !quoteTicker;
    const tickerUpper = (quoteTicker ?? "").toUpperCase();
    const isUsd = !isCash && !/^\d{6}(\.(KS|KQ))?$/.test(tickerUpper) && (holding.currency ?? "").toUpperCase() !== "KRW";
    const key = quoteTicker ?? `name:${(holding.productName ?? "").toUpperCase()}`;
    const existing = map.get(key);
    if (existing) existing.valueKRW += valueKRW;
    else map.set(key, { key, label: holding.productName, valueKRW, ticker: quoteTicker, isUsd, isCash });
  }
  return Array.from(map.values()).filter((e) => e.valueKRW >= 1_000_000);
}

function runBacktest(holdings, applyFix = false) {
  const entries = buildEntries(holdings, applyFix);
  const result = buildSnapshotBacktest({
    entries,
    priceHistories,
    benchmarkHistories,
    fxHistory: FX_FLAT,
    months: 24,
    asOfDate: asOf,
    customTicker: "SCHD",
    customLabel: "SCHD 투자 시",
    customIsUsd: true,
  });
  return { entries, result };
}

// 실제 보유: 미국 레버리지/지수 ETF 위주(현금 아님). 2년간 모두 +60% 상승했다.
const RAW = [
  { product_name: "키움 TQQQ", value_krw: 250_000_000, currency: "USD" },
  { product_name: "키움 QLD", value_krw: 150_000_000, currency: "USD" },
  { product_name: "미래에셋 SPY", value_krw: 100_000_000, currency: "USD" },
];

// (A) localStorage/Excel 경로: 파서가 guessTicker 로 ticker 를 채운 뒤 저장한다.
const localHoldings = RAW.map((r, i) =>
  applyKnownQuoteTickerToHolding({
    id: `L${i}`,
    broker: "",
    assetType: "ETF",
    productName: r.product_name,
    ticker: guessTicker(r.product_name).ticker ?? undefined,
    valueKRW: r.value_krw,
    principalKRW: r.value_krw,
    currency: r.currency,
  }),
);

// (B) Firestore mapHolding 경로: producer 가 ticker/symbol 을 안 채운 경우
//     ticker 가 비어 있고, guessTicker 복원도 일어나지 않는다.
const firestoreHoldings = RAW.map((r, i) => ({
  id: `F${i}`,
  broker: "",
  assetType: "ETF",
  productName: r.product_name,
  ticker: undefined, // producer 가 미제공 → mapHolding 에서 그대로 비어 있음
  valueKRW: r.value_krw,
  principalKRW: r.value_krw,
  currency: r.currency,
}));

console.log("=".repeat(70));
console.log(" 역산 성과 분석 — Firestore 티커 미복원 회귀 재현");
console.log("=".repeat(70));

const local = runBacktest(localHoldings);
const fire = runBacktest(firestoreHoldings);

function summarize(tag, { entries, result }) {
  const cashCount = entries.filter((e) => e.isCash).length;
  const tickerCount = entries.filter((e) => !e.isCash).length;
  const pr = result.cards.portfolio.returnPct;
  const spy = result.cards.spy.returnPct;
  console.log(`\n[${tag}]`);
  console.log(`  엔트리: 티커인식 ${tickerCount} / 현금처리 ${cashCount}`);
  console.log(`  티커: ${entries.map((e) => e.ticker ?? "(현금)").join(", ")}`);
  console.log(`  포트폴리오 수익률: ${pr === null ? "n/a" : pr.toFixed(1) + "%"}`);
  console.log(`  SPY 수익률:        ${spy === null ? "n/a" : spy.toFixed(1) + "%"}`);
  return { cashCount, tickerCount, pr, spy };
}

const L = summarize("A. localStorage 경로(파서가 guessTicker 적용 — merge 이전 동작)", local);
const F = summarize("B. Firestore mapHolding 경로(ticker 미복원 — merge 이후 동작 / 버그)", fire);
const FIXED = summarize("C. Firestore 경로 + 수정본(resolveBacktestTicker 적용)", runBacktest(firestoreHoldings, true));

console.log("\n" + "-".repeat(70));
// 검증: localStorage 경로는 미국 ETF 3개 모두 티커 인식 → 포트폴리오 ≈ SPY(+60%).
assert.equal(L.tickerCount, 3, "localStorage: 3개 모두 티커 인식되어야 함");
assert.equal(L.cashCount, 0, "localStorage: 현금 처리 0건이어야 함");
assert.ok(Math.abs(L.pr - 60) < 1, `localStorage 포트폴리오 수익률 ≈ +60% (got ${L.pr})`);

// 재현: Firestore 경로는 ticker 미복원으로 3개 모두 현금 처리 → 포트폴리오 ≈ 0%.
assert.equal(F.tickerCount, 0, "Firestore(버그): 티커 인식 0건(전부 현금 오분류)");
assert.equal(F.cashCount, 3, "Firestore(버그): 3개 모두 현금 처리되어야(회귀 재현)");
assert.ok(F.pr === null || Math.abs(F.pr) < 1, `Firestore(버그) 포트폴리오 수익률 ≈ 0% (got ${F.pr})`);

// 핵심: 동일 보유·동일 원금·동일 가격인데 데이터 경로만 달라 수익률이 무너진다.
assert.ok(L.pr - (F.pr ?? 0) > 50, "동일 자산인데 경로 차이로 수익률이 50%p 이상 붕괴");

// 수정 검증: Firestore 경로에 수정본 적용 시 localStorage 경로와 동일하게 복원된다.
assert.equal(FIXED.tickerCount, 3, "수정본: Firestore holdings 3개 모두 티커 인식 복원");
assert.equal(FIXED.cashCount, 0, "수정본: 현금 오분류 0건");
assert.ok(Math.abs(FIXED.pr - L.pr) < 0.01, `수정본 포트폴리오 수익률 == localStorage 경로 (got ${FIXED.pr} vs ${L.pr})`);
assert.ok(Math.abs(FIXED.pr - FIXED.spy) < 1, "수정본: 포트폴리오·SPY 동일 기준(+60%)으로 일치");

console.log(" 재현 성공: 동일 보유종목인데 Firestore 경로에서는 ticker 미복원으로");
console.log(" 미국 ETF 가 전부 '현금'으로 분류되어 포트폴리오 수익률이 붕괴한다.");
console.log(" → merge 이전(localStorage 경로)에서는 정상(+60%).");
console.log(" 수정 성공: resolveBacktestTicker 적용 시 Firestore 경로도 +60% 로 복원되고");
console.log(" 포트폴리오·벤치마크가 동일 기준으로 계산된다.");
console.log("=".repeat(70));
