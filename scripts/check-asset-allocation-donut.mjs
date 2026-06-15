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
    return originalResolveFilename.call(
      this,
      path.join(rootDir, request.slice(2)),
      parent,
      isMain,
      options,
    );
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

const {
  getAssetType,
  getSuperGroup,
  buildAssetAllocationDonut,
  buildAssetAllocationFromSnapshotLike,
} = require("../lib/asset-allocation-donut.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function holding(overrides = {}) {
  return {
    id: overrides.id ?? `h-${overrides.productName ?? overrides.ticker ?? "x"}`,
    broker: "테스트증권",
    assetType: "ETF",
    productName: overrides.productName ?? overrides.ticker ?? "테스트 자산",
    cleanName: overrides.cleanName,
    ticker: overrides.ticker,
    tag: overrides.tag,
    principalKRW: overrides.principalKRW ?? 1_000_000,
    valueKRW: overrides.valueKRW ?? 1_000_000,
    ...overrides,
  };
}

function typeOf(input) {
  return getAssetType(input);
}

console.log("check:asset-allocation-donut");

// 1. TQQQ/QLD/QQQ → 나스닥성(lev_nas)
check("1) TQQQ/QLD/QQQ 가 나스닥성(lev_nas) 으로 분류된다", () => {
  for (const ticker of ["TQQQ", "QLD", "QQQ", "QQQM"]) {
    const t = typeOf({ ticker });
    assert.equal(getSuperGroup(t), "lev_nas", `${ticker} → ${t}`);
  }
  assert.equal(typeOf({ ticker: "TQQQ" }), "leverage");
  assert.equal(typeOf({ ticker: "QLD" }), "leverage");
  assert.equal(typeOf({ ticker: "QQQ" }), "nasdaq");
  // 한국상장 나스닥100 ETF (상품명 기반)
  assert.equal(
    getSuperGroup(typeOf({ productName: "ACE 미국나스닥100", ticker: "367380" })),
    "lev_nas",
  );
});

// 2. SPY/SPYM/VOO/S&P500 KR → S&P/SNP 계열(spy)
check("2) SPY/SPYM/VOO/S&P500 한국상장 ETF 가 spy(S&P/SNP 계열) 로 분류된다", () => {
  for (const ticker of ["SPY", "SPYM", "VOO", "IVV", "SPLG"]) {
    assert.equal(typeOf({ ticker }), "spy", `${ticker}`);
  }
  assert.equal(typeOf({ productName: "TIGER 미국S&P500", ticker: "360750" }), "spy");
  assert.equal(typeOf({ productName: "KODEX 미국S&P500" }), "spy");
  assert.equal(getSuperGroup("spy"), "spy_div");
});

// 3. SCHD → 배당/SCHD 계열(dividend)
check("3) SCHD 가 배당(dividend) 으로 분류된다", () => {
  assert.equal(typeOf({ ticker: "SCHD" }), "dividend");
  assert.equal(typeOf({ productName: "미국배당다우존스", tag: "배당" }), "dividend");
  assert.equal(getSuperGroup("dividend"), "spy_div");
});

// 4. 현금/달러/예적금/MMF/SGOV → 현금성(cash_dol)
check("4) 현금/달러/예적금/MMF/SGOV 가 현금성(cash_dol) 으로 분류된다", () => {
  assert.equal(typeOf({ productName: "현금", tag: "현금" }), "cash");
  assert.equal(typeOf({ productName: "달러", tag: "달러" }), "dollar");
  assert.equal(typeOf({ productName: "미국달러 예수금" }), "dollar");
  assert.equal(typeOf({ productName: "정기예적금", tag: "예적금" }), "cash");
  assert.equal(typeOf({ ticker: "MMF" }), "cash");
  assert.equal(typeOf({ ticker: "SGOV" }), "cash");
  for (const t of ["cash", "dollar"]) {
    assert.equal(getSuperGroup(t), "cash_dol");
  }
});

// 5. 기타 개별주 → other / MSFT 는 원본 Streamlit 기준 dividend
check("5) 기타 개별주는 other, MSFT 는 원본 기준 dividend 로 분류된다", () => {
  assert.equal(typeOf({ ticker: "GOOGL" }), "other");
  assert.equal(typeOf({ ticker: "NFLX" }), "other");
  assert.equal(getSuperGroup(typeOf({ ticker: "GOOGL" })), "other_grp");
  // 원본 logic/tracker.py: msft 는 dividend 그룹
  assert.equal(typeOf({ ticker: "MSFT" }), "dividend");
  // KODEX 의 'ko' 가 dividend 로 오분류되지 않는다 (정확 일치만 매칭)
  assert.equal(typeOf({ productName: "KODEX 200", ticker: "069500" }), "other");
});

// 6. 정렬: 같은 슈퍼그룹이 이웃하게(연속) 배치된다
check("6) 같은 슈퍼그룹이 연속(인접) 배치된다", () => {
  const items = [
    { ticker: "TQQQ", valueKRW: 3_000_000 },
    { productName: "현금", tag: "현금", valueKRW: 5_000_000 },
    { ticker: "SPY", valueKRW: 2_000_000 },
    { ticker: "GOOGL", valueKRW: 500_000 },
    { ticker: "QQQ", valueKRW: 1_000_000 },
    { productName: "달러", tag: "달러", valueKRW: 4_000_000 },
    { ticker: "SCHD", valueKRW: 1_500_000 },
  ];
  const { slices } = buildAssetAllocationDonut(items);
  const groups = slices.map((s) => s.superGroup);
  // 같은 슈퍼그룹은 한 번씩만 등장해야 한다 (연속 배치 → 그룹 구간이 끊기지 않음)
  const seen = new Set();
  let prev = null;
  for (const g of groups) {
    if (g !== prev) {
      assert.ok(!seen.has(g), `슈퍼그룹 ${g} 가 분리되어 등장함: ${groups.join(",")}`);
      seen.add(g);
      prev = g;
    }
  }
  // 타입 단위에서도 같은 타입이 연속(끊기지 않게) 배치되는지 확인
  const types = slices.map((s) => s.assetType);
  const seenTypes = new Set();
  let prevType = null;
  for (const t of types) {
    if (t !== prevType) {
      assert.ok(!seenTypes.has(t), `자산 타입 ${t} 가 분리되어 등장함: ${types.join(",")}`);
      seenTypes.add(t);
      prevType = t;
    }
  }
});

// 7. 동일 holdings → /portfolio · /portfolio-manager · 스냅샷 히스토리에서 동일 결과
check("7) 같은 holdings/financeAssets 는 항상 동일한 결과를 만든다", () => {
  const holdings = [
    holding({ ticker: "TQQQ", valueKRW: 3_000_000 }),
    holding({ ticker: "SCHD", valueKRW: 2_000_000 }),
    holding({ ticker: "GOOGL", valueKRW: 1_000_000 }),
  ];
  const financeAssets = [
    { id: "fa-1", groupName: "현금", productName: "현금", amountKRW: 1_000_000, category: "현금" },
    { id: "fa-2", groupName: "달러", productName: "미국달러", amountKRW: 500_000, category: "현금" },
  ];
  const a = buildAssetAllocationFromSnapshotLike({ holdings, financeAssets });
  const b = buildAssetAllocationFromSnapshotLike({ holdings, financeAssets });
  const c = buildAssetAllocationFromSnapshotLike({
    holdings: [...holdings],
    financeAssets: [...financeAssets],
  });
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.ok(a.slices.length === 5);
});

// 8. KRX 숫자 ticker 는 raw ticker 가 아니라 집계 카테고리 라벨을 쓴다
check("8) KRX 숫자 ticker 는 raw ticker 가 아니라 집계 카테고리 라벨로 표시된다", () => {
  const { slices } = buildAssetAllocationDonut([
    { ticker: "360200.KS", productName: "ACE 미국S&P500", valueKRW: 1_000_000 },
  ]);
  assert.equal(slices.length, 1);
  assert.equal(slices[0].name, "S&P500");
  assert.ok(!/^\d{6}/.test(slices[0].name), `숫자 ticker 노출됨: ${slices[0].name}`);
});

// 9. empty holdings → 안전한 empty result
check("9) empty/누락 입력은 빈 결과를 반환한다", () => {
  assert.deepEqual(buildAssetAllocationDonut([]), { slices: [], totalKRW: 0 });
  assert.deepEqual(buildAssetAllocationDonut(null), { slices: [], totalKRW: 0 });
  assert.deepEqual(buildAssetAllocationDonut(undefined), { slices: [], totalKRW: 0 });
  assert.deepEqual(
    buildAssetAllocationFromSnapshotLike({ holdings: [], financeAssets: [] }),
    { slices: [], totalKRW: 0 },
  );
});

// 10. invalid/0/NaN value 방어
check("10) invalid/0/NaN/음수 금액을 방어한다", () => {
  const { slices, totalKRW } = buildAssetAllocationDonut([
    { ticker: "SPY", valueKRW: Number.NaN },
    { ticker: "QQQ", valueKRW: 0 },
    { ticker: "SCHD", valueKRW: -100 },
    { ticker: "TQQQ", valueKRW: Number.POSITIVE_INFINITY },
    { ticker: "VOO", valueKRW: 1_000_000 },
  ]);
  assert.equal(slices.length, 1);
  assert.equal(slices[0].assetType, "spy");
  assert.equal(totalKRW, 1_000_000);
  assert.equal(slices[0].value, 100);
});

// 11. 투자성 재무자산은 보유종목과 중복 집계되지 않는다
check("11) holdings 가 있으면 투자성 재무자산은 이중집계되지 않는다", () => {
  const holdings = [holding({ ticker: "SPY", valueKRW: 1_000_000 })];
  const financeAssets = [
    { id: "fa-inv", groupName: "투자", productName: "투자성 합계", amountKRW: 999_999, category: "투자성" },
    { id: "fa-cash", groupName: "현금", productName: "현금", amountKRW: 1_000_000, category: "현금" },
  ];
  const { slices, totalKRW } = buildAssetAllocationFromSnapshotLike({ holdings, financeAssets });
  assert.equal(totalKRW, 2_000_000); // 투자성 재무자산(999,999)은 제외
  assert.equal(slices.length, 2);
});

function sliceByType(slices, type) {
  return slices.find((slice) => slice.assetType === type);
}

function assertNoRawLabels(slices, rawLabels) {
  const labels = slices.map((slice) => slice.name);
  for (const raw of rawLabels) {
    assert.ok(!labels.some((label) => label.includes(raw)), `${raw} 노출됨: ${labels.join(", ")}`);
  }
}

check("12) 레버리지 보유종목명이 하나의 나스닥 레버리지 슬라이스로 합산된다", () => {
  const { slices, totalKRW } = buildAssetAllocationDonut([
    { productName: "키움TQQQ1", valueKRW: 100 },
    { productName: "키움TQQQ3", valueKRW: 200 },
    { productName: "키움QLD", valueKRW: 300 },
    { productName: "토스QLD", valueKRW: 400 },
  ]);
  assert.equal(totalKRW, 1000);
  assert.equal(slices.length, 1);
  assert.equal(slices[0].assetType, "leverage");
  assert.equal(slices[0].name, "나스닥 레버리지");
  assert.equal(slices[0].amountKRW, 1000);
  assert.equal(slices[0].sourceHoldingCount, 4);
  assertNoRawLabels(slices, ["키움TQQQ1", "키움TQQQ3", "키움QLD", "토스QLD"]);
});

check("13) QQQ/한국상장 나스닥100 상품명이 하나의 나스닥 슬라이스로 합산된다", () => {
  const { slices } = buildAssetAllocationDonut([
    { productName: "QQQ", valueKRW: 100 },
    { productName: "ACE미국나스닥100", valueKRW: 200 },
    { productName: "RISE미국나스닥100", valueKRW: 300 },
  ]);
  assert.equal(slices.length, 1);
  assert.equal(slices[0].assetType, "nasdaq");
  assert.equal(slices[0].amountKRW, 600);
});

check("14) SPY/VOO/SPYM/한국상장 S&P500 상품명이 하나의 S&P500 슬라이스로 합산된다", () => {
  const { slices } = buildAssetAllocationDonut([
    { productName: "SPY", valueKRW: 100 },
    { productName: "VOO", valueKRW: 200 },
    { productName: "SPYM", valueKRW: 300 },
    { productName: "ACE미국S&P500", valueKRW: 400 },
    { productName: "RISE미국S&P500", valueKRW: 500 },
  ]);
  assert.equal(slices.length, 1);
  assert.equal(slices[0].assetType, "spy");
  assert.equal(slices[0].amountKRW, 1500);
});

check("15) 혼합 포트폴리오는 카테고리 라벨만 만들고 합계/비율을 보존한다", () => {
  const rawLabels = ["키움TQQQ1", "ACE미국나스닥100", "토스SPYM", "삼성위탁SCHD", "CMA예수금", "알수없는상품"];
  const { slices, totalKRW } = buildAssetAllocationDonut([
    { productName: rawLabels[0], valueKRW: 1000 },
    { productName: rawLabels[1], valueKRW: 600 },
    { productName: rawLabels[2], valueKRW: 1500 },
    { productName: rawLabels[3], valueKRW: 700 },
    { productName: rawLabels[4], valueKRW: 300 },
    { productName: rawLabels[5], valueKRW: 200 },
  ]);
  assert.equal(totalKRW, 4300);
  assert.equal(sliceByType(slices, "leverage").amountKRW, 1000);
  assert.equal(sliceByType(slices, "nasdaq").amountKRW, 600);
  assert.equal(sliceByType(slices, "spy").amountKRW, 1500);
  assert.equal(sliceByType(slices, "dividend").amountKRW, 700);
  assert.equal(sliceByType(slices, "cash").amountKRW, 300);
  assert.equal(sliceByType(slices, "other").amountKRW, 200);
  assertNoRawLabels(slices, rawLabels);
  const pctSum = slices.reduce((sum, slice) => sum + slice.value, 0);
  assert.ok(Math.abs(pctSum - 100) <= 0.3, `percent sum=${pctSum}`);
});

check("16) 한국 ETF wrapper 상품명은 원문이 아니라 자산군 라벨로 표시된다", () => {
  const rawLabels = ["미래연금ACE미국S&P500", "KBISAACE미국나스닥100", "삼성위탁SCHD", "키움TQQQ1"];
  const { slices } = buildAssetAllocationDonut(rawLabels.map((productName, idx) => ({ productName, valueKRW: 100 * (idx + 1) })));
  assertNoRawLabels(slices, rawLabels);
  assert.deepEqual(new Set(slices.map((slice) => slice.name)), new Set(["S&P500", "나스닥", "배당", "나스닥 레버리지"]));
});

check("17) 사용자 제보 예시는 레버리지/S&P500/배당만 노출하고 원문 계좌명을 숨긴다", () => {
  const rawLabels = ["키움TQQQ1", "키움TQQQ3", "키움QLD", "삼성위탁TQQQ", "토스SPYM", "토스VOO", "삼성위탁SCHD"];
  const { slices } = buildAssetAllocationDonut(rawLabels.map((productName) => ({ productName, valueKRW: 100 })));
  assert.equal(sliceByType(slices, "leverage").amountKRW, 400);
  assert.equal(sliceByType(slices, "spy").amountKRW, 200);
  assert.equal(sliceByType(slices, "dividend").amountKRW, 100);
  assertNoRawLabels(slices, rawLabels);
  assert.deepEqual(new Set(slices.map((slice) => slice.name)), new Set(["나스닥 레버리지", "S&P500", "배당"]));
});

console.log(`\nAll ${passed} asset-allocation-donut checks passed.`);
