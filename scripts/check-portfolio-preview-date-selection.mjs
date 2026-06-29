#!/usr/bin/env node

// =============================================================
// PORTFOLIO-TOTAL-CONSISTENCY-FIX-4 — preview 날짜 선택 플로우 시뮬레이션.
//
// 목적: 브라우저 없이도 "포트폴리오 관리 > 스냅샷 미리보기"에서 날짜를 하나씩 선택했을 때
// 화면에 그려지는 값(도넛 중앙 총자산 / 파싱 결과 요약 / Snapshot History 총자산)이
// 모두 동일한지를, components/portfolio/PortfolioPage.tsx 가 실제로 호출하는 함수·인자를
// 그대로 재현해 검증한다.
//
// 실제 데이터 분포를 모사한다:
//   - 최신(2026-06-29): Firestore 계약 스냅샷(mapPortfolioSnapshotRecordToViewModel 경유)
//     → authoritativeTotals 존재.
//   - 과거(06-19/06-16/06-15/06-12): localStorage(resultToSnapshot) 형태
//     → authoritativeTotals 없음, totalAssetKRW 만 stamp.
//   두 종류가 mergedSnapshots 로 합쳐지고, 드롭다운/히스토리에서 날짜를 선택하면
//   previewSnapshot 이 정해진다(PortfolioPage 와 동일한 선택 로직).
//
// 각 날짜에서 PortfolioPage 가 그리는 것과 동일하게:
//   donut center = buildAssetAllocationFromSnapshotLike(
//       { holdings: displayedHoldings, financeAssets },
//       { includeFinanceAssets:true,
//         authoritativeCashKRW: previewSnapshot.authoritativeTotals?.totalCashKRW ?? null,
//         authoritativeTotalAssetsKRW: getAuthoritativeTotalAssetsKRW(previewSnapshot) } ).totalKRW
//   parse summary 총자산 = parseSummaryFromSnapshot(previewSnapshot).totalAssetKRW
//   history 총자산      = previewSnapshot.totalAssetKRW
// 세 값이 같은지(= 보고된 06-16 도넛7.83 vs 파싱6.79 불일치 해소) 단언한다.
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

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { mapPortfolioSnapshotRecordToViewModel } = require("../lib/firestore/snapshot-viewmodel.ts");
const { buildAssetAllocationFromSnapshotLike } = require("../lib/asset-allocation-donut.ts");
const { parseSummaryFromSnapshot } = require("../lib/portfolio-parse-summary.ts");
const { getAuthoritativeTotalAssetsKRW } = require("../lib/portfolio-authoritative-total.ts");
const { mergePortfolioSnapshots } = require("../lib/portfolio-store.ts");
const { filterAggregateHoldings } = require("../lib/portfolio-summary-row.ts");
const { applyKrxTickerMappingsToHoldings } = require("../lib/krx-ticker-name-map.ts");
const { applyKnownQuoteTickerToHolding } = require("../lib/holding-ticker-normalizer.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}
function sum(rows, get) {
  return rows.reduce((acc, row) => acc + (get(row) || 0), 0);
}

function buildHoldings(inv) {
  const weights = [
    { product_name: "키움 TQQQ", ticker: "TQQQ", w: 0.42, pw: 0.40 },
    { product_name: "키움 QLD", ticker: "QLD", w: 0.20, pw: 0.20 },
    { product_name: "TIGER 미국S&P500", ticker: "360750", w: 0.21, pw: 0.22 },
    { product_name: "SCHD", ticker: "SCHD", w: 0.10, pw: 0.11 },
    { product_name: "마이크로소프트", ticker: "MSFT", w: 0.07, pw: 0.07 },
  ];
  const principal = Math.round(inv * 0.78);
  const rows = weights.map((it, i) => ({
    id: `h${i}`, broker: "키움증권", assetType: "해외주식",
    productName: it.product_name, ticker: it.ticker,
    valueKRW: Math.round(inv * it.w), principalKRW: Math.round(principal * it.pw),
  }));
  rows[0].valueKRW += inv - sum(rows, (r) => r.valueKRW);
  return rows;
}

function cashRows(cash, lump) {
  return [
    { id: "c1", groupName: "자유입출금 자산", productName: "토스뱅크 입출금통장", amountKRW: Math.round(cash * 0.55), category: "현금" },
    { id: "c2", groupName: "저축성 자산", productName: "KB 정기예금", amountKRW: Math.round(cash * 0.30), category: "예적금" },
    { id: "c3", groupName: "외화 자산", productName: "미국달러 예수금", amountKRW: cash - Math.round(cash * 0.55) - Math.round(cash * 0.30), category: "현금" },
    { id: "lump", groupName: "", productName: "메인 자산", amountKRW: lump, category: undefined },
  ];
}

// 과거(localStorage / resultToSnapshot) 스냅샷: authoritativeTotals 없음.
function buildPastSnapshot(scn) {
  const holdings = buildHoldings(scn.inv);
  const investmentValueKRW = sum(holdings, (h) => h.valueKRW);
  const investmentPrincipalKRW = sum(holdings, (h) => h.principalKRW);
  return {
    id: `local-${scn.date}-${Math.random().toString(36).slice(2, 7)}`,
    snapshotDate: scn.date,
    sourceFileName: `${scn.date}.xlsx`,
    totalAssetKRW: scn.total,
    totalDebtKRW: 0,
    netAssetKRW: scn.total,
    investmentPrincipalKRW,
    investmentValueKRW,
    returnAmountKRW: investmentValueKRW - investmentPrincipalKRW,
    returnPct: investmentPrincipalKRW > 0 ? ((investmentValueKRW - investmentPrincipalKRW) / investmentPrincipalKRW) * 100 : 0,
    holdings,
    financeAssets: cashRows(scn.cash, scn.lump),
    createdAt: new Date(0).toISOString(),
    metadata: { parserVersion: "stage2-tags-v1", excludedSmallCount: 0, excludedBelowMinimumCount: 0, excludedHoldingValueKRW: 0 },
  };
}

// 최신(Firestore 계약) 스냅샷: mapper 경유 → authoritativeTotals 존재.
function buildLatestSnapshot(scn) {
  const holdings = buildHoldings(scn.inv);
  return mapPortfolioSnapshotRecordToViewModel({
    id: scn.date,
    data: {
      document_version: "1.1.0",
      snapshot: {
        snapshot_date: scn.date,
        current_snapshot: {
          total_assets_krw: scn.total,
          total_investments_krw: scn.inv,
          investment_principal_krw: Math.round(scn.inv * 0.78),
          return_amount_krw: scn.inv - Math.round(scn.inv * 0.78),
          return_pct: 0,
          total_cash_krw: scn.cash,
          total_debt_krw: 0,
          net_worth_krw: scn.total,
        },
        investment_status: holdings.map((h) => ({
          product_name: h.productName, ticker: h.ticker, value_krw: h.valueKRW, principal_krw: h.principalKRW,
        })),
        financial_status: cashRows(scn.cash, scn.lump),
      },
    },
  });
}

// 보고된 날짜/총자산. 06-29 만 Firestore(권위), 나머지는 과거(localStorage).
const SCN = {
  "2026-06-29": { date: "2026-06-29", total: 651_465_228, inv: 600_000_000, cash: 51_465_228, lump: 90_000_000 },
  "2026-06-19": { date: "2026-06-19", total: 663_000_000, inv: 590_000_000, cash: 73_000_000, lump: 120_000_000 },
  "2026-06-16": { date: "2026-06-16", total: 679_000_000, inv: 600_000_000, cash: 79_000_000, lump: 104_000_000 },
  "2026-06-15": { date: "2026-06-15", total: 612_000_000, inv: 560_000_000, cash: 52_000_000, lump: 70_000_000 },
  "2026-06-12": { date: "2026-06-12", total: 588_000_000, inv: 540_000_000, cash: 48_000_000, lump: 64_000_000 },
};

console.log("check:portfolio-preview-date-selection");

// 실제 데이터 분포 재현: 최신은 Firestore, 과거는 localStorage.
const latest = buildLatestSnapshot(SCN["2026-06-29"]);
const localPast = ["2026-06-19", "2026-06-16", "2026-06-15", "2026-06-12"].map((d) => buildPastSnapshot(SCN[d]));

// PortfolioPage.mergedSnapshots 재현: mergePortfolioSnapshots(localStorage, [firestore]) → 날짜 내림차순.
const merged = [...mergePortfolioSnapshots(localPast, [latest])].sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1));

check("mergedSnapshots 가 5개 날짜를 모두 포함하고 최신순 정렬", () => {
  assert.deepEqual(merged.map((s) => s.snapshotDate), ["2026-06-29", "2026-06-19", "2026-06-16", "2026-06-15", "2026-06-12"]);
});

// PortfolioPage 의 날짜 선택 → previewSnapshot 도출 로직 재현.
function selectByDate(date) {
  const target = merged.find((s) => s.snapshotDate === date);
  assert.ok(target, `${date} 스냅샷을 mergedSnapshots 에서 찾을 수 없음`);
  return target;
}

// PortfolioPage 의 displayedHoldings 파생 재현.
function displayedHoldingsOf(previewSnapshot) {
  return applyKrxTickerMappingsToHoldings(filterAggregateHoldings(previewSnapshot.holdings ?? [])).holdings.map(applyKnownQuoteTickerToHolding);
}

// PortfolioPage 미리보기 도넛 center 재현(AssetAllocationDonut 가 호출하는 그대로).
function previewDonutCenter(previewSnapshot) {
  const displayedHoldings = displayedHoldingsOf(previewSnapshot);
  const { totalKRW } = buildAssetAllocationFromSnapshotLike(
    { holdings: displayedHoldings, financeAssets: previewSnapshot.financeAssets ?? [] },
    {
      includeFinanceAssets: true,
      authoritativeCashKRW: previewSnapshot.authoritativeTotals?.totalCashKRW ?? null,
      authoritativeTotalAssetsKRW: getAuthoritativeTotalAssetsKRW(previewSnapshot),
    },
  );
  return totalKRW;
}

for (const date of Object.keys(SCN)) {
  const expected = SCN[date].total;
  const isLatest = date === "2026-06-29";

  check(`[preview 선택: ${date}] (소스=${isLatest ? "Firestore(권위)" : "localStorage(과거)"}) 도넛 중앙 == 파싱요약 == 히스토리 == ${expected}`, () => {
    const preview = selectByDate(date);
    // 과거 스냅샷은 authoritativeTotals 가 없어야(=실제 분포) 한다.
    if (!isLatest) assert.equal(preview.authoritativeTotals, undefined, `${date} 과거 스냅샷에 authoritativeTotals 가 있으면 안 됨`);

    const donut = previewDonutCenter(preview);
    const parse = parseSummaryFromSnapshot(preview).totalAssetKRW;
    const history = preview.totalAssetKRW;

    assert.equal(donut, expected, `${date} 도넛 중앙=${donut} ≠ ${expected}`);
    assert.equal(parse, expected, `${date} 파싱요약=${parse} ≠ ${expected}`);
    assert.equal(history, expected, `${date} 히스토리=${history} ≠ ${expected}`);
    // 핵심: 도넛 == 파싱(=보고된 06-16 7.83 vs 6.79 불일치가 사라짐).
    assert.equal(donut, parse, `${date} 도넛(${donut}) != 파싱(${parse})`);
  });
}

check("[핵심] 06-16 도넛 중앙 총자산 == 파싱 결과 요약(보고된 7.83억 vs 6.79억 불일치 해소)", () => {
  const preview = selectByDate("2026-06-16");
  const donut = previewDonutCenter(preview);
  const parse = parseSummaryFromSnapshot(preview).totalAssetKRW;
  assert.equal(donut, 679_000_000);
  assert.equal(parse, 679_000_000);
});

check("[불변] 날짜만 바뀌고 계산 경로(함수/인자)는 동일 — 최신/과거 모두 같은 식으로 도출", () => {
  // 최신/과거 모두 동일한 previewDonutCenter 경로를 타며, 결과는 각자의 totalAssetKRW.
  for (const date of Object.keys(SCN)) {
    const preview = selectByDate(date);
    assert.equal(previewDonutCenter(preview), SCN[date].total);
  }
});

console.log(`\nAll ${passed} portfolio-preview-date-selection checks passed.`);
