#!/usr/bin/env node

// ASSET-CLASS-DONUT-POLISH-2 회귀 테스트.
// /portfolio "보유 자산군 분석" 도넛(lib/asset-class-allocation.ts)의 현금성 라벨 정책을 검증한다.
//   1) 예적금·원화 현금성 자산은 최종 group label "원화" 로 합산된다.
//   2) USD/달러/외화 현금성 자산은 "달러" 로 별도 유지된다.
//   3) "예적금" / "현금" 라벨은 도넛/범례에 더 이상 노출되지 않는다.
//   4) 하늘색(#38BDF8)은 오직 "기타" 에만 쓴다.

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

const { classifyAssetClass, buildAssetClassAllocation } = require("../lib/asset-class-allocation.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("check:asset-class-donut-labels");

// 1. 예적금·원화 현금성 자산은 "원화"로 합산된다.
check("1) 예적금·현금성 원화 자산이 '원화'로 분류된다", () => {
  for (const text of ["예적금", "정기예적금", "자유적금", "예금", "RP 현금성", "예수금", "원화 파킹통장", "CMA 통장", "KRW 현금"]) {
    assert.equal(classifyAssetClass(text), "원화", `'${text}' → 원화 기대`);
  }
});

// 2. USD/달러/외화 현금성 자산은 "달러"로 유지된다.
check("2) USD/달러/외화 현금성 자산이 '달러'로 유지된다", () => {
  for (const text of ["미국달러 예수금", "USD 예수금", "외화 RP", "US$ 현금", "달러 파킹"]) {
    assert.equal(classifyAssetClass(text), "달러", `'${text}' → 달러 기대`);
  }
});

// 3. 보유종목/현금성 합산 도넛에 "예적금"/"현금" 라벨이 남지 않고, 원화/달러로 분리된다.
check("3) 도넛 범례에 예적금/현금 라벨이 없고 원화·달러가 분리된다", () => {
  const slices = buildAssetClassAllocation(
    [{ id: "h1", ticker: "TQQQ", productName: "키움TQQQ1", valueKRW: 4_000_000, principalKRW: 1_000_000 }],
    [
      { productName: "정기예적금", amountKRW: 63_180_000, category: "현금" },
      { productName: "원화 예수금", amountKRW: 1_520_000, category: "현금" },
      { productName: "미국달러 예수금", inferredTag: "달러", amountKRW: 5_000_000, category: "현금" },
    ],
  );
  const names = slices.map((s) => s.name);
  assert.ok(!names.includes("예적금"), "예적금 라벨이 남으면 안 된다");
  assert.ok(!names.includes("현금"), "현금 라벨이 남으면 안 된다");
  assert.ok(names.includes("원화"), "원화 라벨이 있어야 한다");
  assert.ok(names.includes("달러"), "달러 라벨이 있어야 한다");
  // 예적금 6,318만 + 원화 현금 152만 = 6,470만 이 "원화" 하나로 합산된다.
  const won = slices.find((s) => s.name === "원화");
  assert.equal(won.valueKRW, 64_700_000, "예적금+원화 현금이 원화로 합산되어야 한다");
});

// 4. 하늘색(#38BDF8)은 오직 "기타"에만 쓴다.
check("4) 하늘색은 오직 '기타'에만 쓴다", () => {
  const slices = buildAssetClassAllocation(
    [
      { id: "h1", ticker: "TQQQ", productName: "TQQQ", valueKRW: 1_000_000, principalKRW: 0 },
      { id: "h2", ticker: "GOOGL", productName: "구글", valueKRW: 500_000, principalKRW: 0 },
    ],
    [{ productName: "정기예적금", amountKRW: 1_000_000, category: "현금" }],
  );
  for (const s of slices) {
    if (s.color.toLowerCase() === "#38bdf8") {
      assert.equal(s.name, "기타", `하늘색은 기타만 (받은 값: ${s.name})`);
    }
    if (s.name === "기타") {
      assert.equal(s.color.toLowerCase(), "#38bdf8", "기타는 하늘색이어야 한다");
    }
  }
});

console.log(`\nAll ${passed} asset-class-donut-labels checks passed.`);
