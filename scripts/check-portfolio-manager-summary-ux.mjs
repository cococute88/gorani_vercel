#!/usr/bin/env node

// PORTFOLIO-MANAGER-SUMMARY-UX-POLISH-1 회귀 테스트.
// /portfolio-manager 파싱 결과 요약(3x3) / 스냅샷 상세 요약 / 소액 항목 숨김을 정적·기능 검증한다.
//   1) 총 부채 / 순자산 제거, 현금자산 / 투자자산 합계 명칭
//   2) 3x3 grid + overflow 방지 class
//   3) 스냅샷 상세 도넛 옆 요약 카드 렌더 경로
//   4) #소액 / 20만원 미만 보유종목 표시 단계 숨김 (lib 기능 테스트 포함)

import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");

// @/ alias + .ts 트랜스파일 (다른 check 스크립트와 동일 패턴).
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

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}
function assertAbsent(haystack, needle, where) {
  assert.ok(!haystack.includes(needle), `${where} 에 "${needle}" 가 남아 있으면 안 된다`);
}
function assertPresent(haystack, needle, where) {
  assert.ok(haystack.includes(needle), `${where} 에 "${needle}" 가 있어야 한다`);
}

const rows = [];

const summaryCard = read("components/portfolio/ParseSummaryCard.tsx");
const parsePreview = read("components/portfolio/PortfolioParsePreview.tsx");
const page = read("components/portfolio/PortfolioPage.tsx");
const holdingsTable = read("components/portfolio/HoldingsTable.tsx");

// 1. 총 부채 / 순자산 제거, 현금자산 / 투자자산 합계 명칭.
assertAbsent(summaryCard, "총 부채", "ParseSummaryCard");
assertAbsent(summaryCard, "순자산", "ParseSummaryCard");
assertAbsent(summaryCard, "평가금액 합계", "ParseSummaryCard");
assertPresent(summaryCard, "현금자산", "ParseSummaryCard");
assertPresent(summaryCard, "투자자산 합계", "ParseSummaryCard");
assertPresent(summaryCard, "총 금융자산", "ParseSummaryCard");
// 파싱 요약은 ParseSummaryCard 로 단일화 → 옛 라벨이 preview 에 남으면 안 된다.
assertAbsent(parsePreview, "총 부채", "PortfolioParsePreview");
assertAbsent(parsePreview, "순자산", "PortfolioParsePreview");
assertAbsent(parsePreview, "평가금액 합계", "PortfolioParsePreview");
rows.push({ case: "총부채/순자산 제거 · 현금자산/투자자산 합계 명칭", ok: true });

// 2. 3x3 grid + overflow 방지 class.
assertPresent(summaryCard, "md:grid-cols-3", "ParseSummaryCard");
assertPresent(summaryCard, "grid-cols-2", "ParseSummaryCard");
assertPresent(summaryCard, "min-w-0", "ParseSummaryCard");
assertPresent(summaryCard, "truncate", "ParseSummaryCard");
// 9개 타일 라벨이 모두 존재해야 3x3.
for (const label of [
  "총 금융자산",
  "투자자산 합계",
  "현금자산",
  "투자원금 합계",
  "수익금",
  "수익률",
  "인식 보유종목",
  "제외 항목",
  "보강 필드",
]) {
  assertPresent(summaryCard, label, "ParseSummaryCard 3x3");
}
rows.push({ case: "3x3 grid + overflow 방지 class", ok: true });

// 3. 스냅샷 상세: 도넛 옆 ParseSummaryCard 렌더 경로.
assertPresent(page, "ParseSummaryCard", "PortfolioPage");
assertPresent(page, "parseSummaryFromSnapshot", "PortfolioPage");
assertPresent(page, "AssetAllocationDonut", "PortfolioPage");
assert.ok(
  /previewSnapshot[\s\S]*AssetAllocationDonut[\s\S]*ParseSummaryCard/.test(page),
  "스냅샷 상세에서 도넛 + ParseSummaryCard 가 함께 렌더되어야 한다",
);
rows.push({ case: "스냅샷 상세 도넛 옆 요약 카드", ok: true });

// 4. 소액 항목 표시 숨김 경로.
assertPresent(holdingsTable, "splitSmallHoldings", "HoldingsTable");
assertPresent(holdingsTable, "visibleHoldings", "HoldingsTable");
assertPresent(holdingsTable, "숨김", "HoldingsTable");
assert.ok(!holdingsTable.includes("{holdings.map"), "HoldingsTable 은 원본 holdings 가 아니라 visibleHoldings 를 렌더해야 한다");
rows.push({ case: "소액 항목 표시 숨김 경로", ok: true });

// 5. 기능 테스트: 소액 필터.
const { isHiddenSmallHolding, splitSmallHoldings, SMALL_HOLDING_THRESHOLD_KRW } = require(
  "../lib/portfolio-small-holdings.ts",
);
assert.equal(SMALL_HOLDING_THRESHOLD_KRW, 200000);
assert.equal(isHiddenSmallHolding({ id: "a", tag: "소액", valueKRW: 999999999 }), true, "#소액 태그는 숨김");
assert.equal(isHiddenSmallHolding({ id: "b", valueKRW: 150000 }), true, "20만원 미만은 숨김");
assert.equal(isHiddenSmallHolding({ id: "c", valueKRW: 200000 }), false, "20만원은 표시");
assert.equal(isHiddenSmallHolding({ id: "d", valueKRW: 0 }), false, "금액 없고 소액 태그 없으면 표시");
assert.equal(isHiddenSmallHolding({ id: "e", valueKRW: 500000 }), false, "20만원 이상은 표시");
const split = splitSmallHoldings([
  { id: "a", tag: "소액", valueKRW: 5_000_000 },
  { id: "b", valueKRW: 150000 },
  { id: "c", valueKRW: 300000 },
  { id: "d", valueKRW: 0 },
]);
assert.equal(split.hiddenCount, 2);
assert.deepEqual(split.visible.map((h) => h.id), ["c", "d"]);
rows.push({ case: "소액 필터 기능", ok: true });

// 6. 기능 테스트: 현금자산 view model.
const { computeCashAssetKRW, parseSummaryFromSnapshot } = require("../lib/portfolio-parse-summary.ts");
assert.equal(computeCashAssetKRW(null), null, "현금성 source 없으면 null");
assert.equal(computeCashAssetKRW([]), null, "빈 배열이면 null");
assert.equal(
  computeCashAssetKRW([{ category: "투자성", amountKRW: 100 }]),
  null,
  "현금/예적금 분류가 없으면 null",
);
assert.equal(
  computeCashAssetKRW([
    { category: "현금", amountKRW: 1_000_000 },
    { category: "예적금", amountKRW: 2_000_000 },
    { category: "투자성", amountKRW: 9_000_000 },
    { category: "현금", amountKRW: 500_000, isDebt: true },
  ]),
  3_000_000,
  "현금+예적금 합계 (부채/투자성 제외)",
);
const snapModel = parseSummaryFromSnapshot({
  snapshotDate: "2025-06-12",
  totalAssetKRW: 100,
  investmentValueKRW: 80,
  investmentPrincipalKRW: 70,
  returnAmountKRW: 10,
  returnPct: 14.3,
  holdings: [{ id: "h1", needsReview: true, ticker: "QQQ", valueKRW: 80 }],
  financeAssets: [{ category: "현금", amountKRW: 20 }],
  metadata: { excludedSmallCount: 3, excludedBelowMinimumCount: 1 },
});
assert.equal(snapModel.cashAssetKRW, 20);
assert.equal(snapModel.recognizedCount, 1);
assert.equal(snapModel.reviewCount, 1);
assert.equal(snapModel.excludedTotal, 4);
rows.push({ case: "현금자산/스냅샷 요약 view model", ok: true });

console.log("Portfolio manager summary UX checks passed.");
console.table(rows);
