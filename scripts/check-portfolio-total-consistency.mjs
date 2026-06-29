#!/usr/bin/env node

// =============================================================
// PORTFOLIO-TOTAL-CONSISTENCY-FIX-1 verification.
//
// Reproduces the reported bug: on a Firestore snapshot the KPI / Parse Summary
// total (authoritative `current_snapshot.total_assets_krw`) is ~6.51억 while the
// 자산군 비중 donut (and other allocation charts) showed ~12.15억 — almost double.
//
// Root cause proven here:
//   bs-report-auto's `financial_status` (→ financeAssets) lists the COMPLETE
//   asset picture, including investment-account balances that ALSO appear in
//   `investment_status` (→ holdings). The charts summed holdings + financeAssets
//   and only excluded finance rows whose `category === "투자성"`. The producer
//   does not tag those rows with that exact string, so the investment value was
//   counted twice.
//
// This script maps a synthesized producer document through the REAL
// `mapPortfolioSnapshotRecordToViewModel` adapter, then asserts every allocation
// chart now reconciles to the authoritative total (no 2x), while the OLD filter
// would have doubled it. It also checks a second snapshot date and the legacy
// (localStorage) path for regressions.
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

// localStorage shim (krx name map reads it).
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { mapPortfolioSnapshotRecordToViewModel } = require("../lib/firestore/snapshot-viewmodel.ts");
const { buildAssetAllocationFromSnapshotLike } = require("../lib/asset-allocation-donut.ts");
const { buildAssetClassAllocation } = require("../lib/asset-class-allocation.ts");
const { buildPortfolioPageFromSnapshot } = require("../lib/portfolio-from-snapshots.ts");
const { reconcilePortfolioTotals } = require("../lib/portfolio-totals-reconcile.ts");
const {
  isInvestmentFinanceAsset,
  selectAllocationFinanceAssets,
} = require("../lib/portfolio-allocation-dedup.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function sum(rows, get) {
  return rows.reduce((acc, row) => acc + (get(row) || 0), 0);
}

// The OLD (buggy) finance-asset filter, kept here ONLY to prove the regression
// it caused (investment-account lumps survive → double count).
function oldFilterFinanceAssets(holdings, financeAssets) {
  return (financeAssets ?? []).filter((asset) => {
    if (asset.isDebt === true) return false;
    if ((holdings?.length ?? 0) > 0 && asset.category === "투자성") return false;
    return true;
  });
}

// Build a bs-report-auto style nested producer document. `financial_status`
// carries the complete picture (cash rows + investment-account lumps), and the
// investment lumps are deliberately NOT tagged category="투자성" (just like the
// real producer), so the legacy filter fails to dedup them.
function buildProducerRecord({ date, holdings, investmentLumps, cashRows, totals }) {
  return {
    id: date,
    data: {
      document_version: "1.1.0",
      snapshot: {
        snapshot_date: date,
        current_snapshot: {
          total_assets_krw: totals.totalAssets,
          total_investments_krw: totals.totalInvestments,
          investment_principal_krw: totals.principal,
          return_amount_krw: totals.totalInvestments - totals.principal,
          return_pct: ((totals.totalInvestments - totals.principal) / totals.principal) * 100,
          total_cash_krw: totals.totalCash,
          total_debt_krw: 0,
          net_worth_krw: totals.totalAssets,
        },
        investment_status: holdings,
        financial_status: [...cashRows, ...investmentLumps],
      },
    },
  };
}

// Shared scenario factory. `pct` lets us tweak amounts per date.
function scenario(date, scale) {
  const holdings = [
    { product_name: "키움 TQQQ", ticker: "TQQQ", value_krw: 200_000_000 * scale, principal_krw: 120_000_000 * scale },
    { product_name: "키움 QLD", ticker: "QLD", value_krw: 100_000_000 * scale, principal_krw: 70_000_000 * scale },
    { product_name: "TIGER 미국S&P500", ticker: "360750", value_krw: 150_000_000 * scale, principal_krw: 120_000_000 * scale },
    { product_name: "SCHD", ticker: "SCHD", value_krw: 80_000_000 * scale, principal_krw: 70_000_000 * scale },
    { product_name: "마이크로소프트", ticker: "MSFT", value_krw: 34_000_000 * scale, principal_krw: 20_000_000 * scale },
  ];
  const totalInvestments = sum(holdings, (h) => h.value_krw);
  const principal = sum(holdings, (h) => h.principal_krw);

  // Investment-account lump rows in 재무현황. category is NOT "투자성" (producer
  // reality): the section/group/account name carries the investment signal.
  const investmentLumps = [
    { group_name: "투자성", product_name: "키움증권 위탁계좌", amount_krw: 300_000_000 * scale, category: "투자" },
    { group_name: "투자성", product_name: "미래에셋 개인연금", amount_krw: 150_000_000 * scale, category: "" },
    { group_name: "투자성", product_name: "한국투자 ISA", amount_krw: 114_000_000 * scale, category: undefined },
  ];
  const cashRows = [
    { group_name: "자유입출금", product_name: "토스뱅크 입출금통장", amount_krw: 50_000_000 * scale, category: "현금" },
    { group_name: "저축성", product_name: "KB 정기예금", amount_krw: 30_000_000 * scale, category: "예적금" },
    { group_name: "외화", product_name: "미국달러 예수금", amount_krw: 7_000_000 * scale, category: "현금" },
  ];
  const totalCash = sum(cashRows, (c) => c.amount_krw);
  const totalAssets = totalInvestments + totalCash;

  return buildProducerRecord({
    date,
    holdings,
    investmentLumps,
    cashRows,
    totals: { totalAssets, totalInvestments, totalCash, principal },
  });
}

function approxEqual(a, b, tolerance = 1) {
  return Math.abs(a - b) <= tolerance;
}

console.log("check:portfolio-total-consistency");

for (const { date, scale } of [
  { date: "2026-06-29", scale: 1 },
  { date: "2026-06-19", scale: 0.92 },
]) {
  const record = scenario(date, scale);
  const snapshot = mapPortfolioSnapshotRecordToViewModel(record);
  const authoritative = snapshot.authoritativeTotals;
  const totalAssets = authoritative.totalAssetsKRW;

  check(`[${date}] mapper stamped authoritative totals from current_snapshot`, () => {
    assert.ok(authoritative, "authoritativeTotals must be present");
    assert.equal(authoritative.source, "firestore-contract");
    assert.ok(totalAssets > 0);
  });

  check(`[${date}] KPI / Parse Summary total uses authoritative total (verbatim)`, () => {
    const totals = reconcilePortfolioTotals(snapshot);
    assert.equal(totals.totalFinancialAssetSource, "contract.total_assets_krw");
    assert.equal(totals.totalFinancialAssetKRW, totalAssets);
  });

  check(`[${date}] OLD filter doubled the donut total (reproduces the bug)`, () => {
    const oldFinance = oldFilterFinanceAssets(snapshot.holdings, snapshot.financeAssets);
    const oldDonutTotal =
      sum(snapshot.holdings, (h) => h.valueKRW) + sum(oldFinance, (a) => a.amountKRW);
    // The bug double-counts the investment value: old = total_assets + total_investments.
    const expectedInflated = totalAssets + authoritative.totalInvestmentsKRW;
    assert.ok(
      approxEqual(oldDonutTotal, expectedInflated, 2),
      `old donut=${oldDonutTotal} vs total_assets+total_investments=${expectedInflated}`,
    );
    const ratio = oldDonutTotal / totalAssets;
    // Matches the reported ~12.15억 / ~6.51억 ≈ 1.87x inflation.
    assert.ok(ratio > 1.8, `expected heavy inflation, got ratio=${ratio.toFixed(3)} (old=${oldDonutTotal}, total=${totalAssets})`);
  });

  check(`[${date}] NEW dedup drops investment-account lumps, keeps cash`, () => {
    const kept = selectAllocationFinanceAssets(snapshot.holdings, snapshot.financeAssets);
    // Only the 3 cash rows survive.
    assert.equal(kept.length, 3, `kept=${kept.map((k) => k.productName).join(", ")}`);
    const keptCash = sum(kept, (a) => a.amountKRW);
    assert.ok(approxEqual(keptCash, authoritative.totalCashKRW, 1), `cash kept=${keptCash} vs total_cash=${authoritative.totalCashKRW}`);
    // Every dropped row is an investment-account row.
    for (const asset of snapshot.financeAssets) {
      if (!kept.includes(asset) && asset.isDebt !== true) {
        assert.ok(isInvestmentFinanceAsset(asset), `row wrongly dropped: ${asset.productName}`);
      }
    }
  });

  check(`[${date}] 자산군 비중 도넛 total == authoritative total (no double count)`, () => {
    const { totalKRW } = buildAssetAllocationFromSnapshotLike({
      holdings: snapshot.holdings,
      financeAssets: snapshot.financeAssets,
    });
    assert.ok(approxEqual(totalKRW, totalAssets, 2), `donut total=${totalKRW} vs authoritative=${totalAssets}`);
  });

  check(`[${date}] 자산군 합산(asset-class) total == authoritative total`, () => {
    const slices = buildAssetClassAllocation(snapshot.holdings, snapshot.financeAssets);
    const total = sum(slices, (s) => s.valueKRW);
    assert.ok(approxEqual(total, totalAssets, 2), `asset-class total=${total} vs authoritative=${totalAssets}`);
  });

  check(`[${date}] 자산 구성/투자·현금 비중(page model) reconcile to authoritative total`, () => {
    const model = buildPortfolioPageFromSnapshot(snapshot);
    // KPI card uses authoritative total.
    assert.equal(model.summary.totalAssetKRW, totalAssets);
    // 자산 구성 도넛 slices sum to total assets (investments + cash, no 2x).
    const assetAllocTotal = sum(model.assetAllocation, (s) => s.amountKRW);
    assert.ok(approxEqual(assetAllocTotal, totalAssets, 3), `assetAllocation total=${assetAllocTotal} vs ${totalAssets}`);
    // 투자/현금 비중 percentages sum to ~100.
    const pctSum = sum(model.summary.stockCashTargets, (t) => t.current);
    assert.ok(Math.abs(pctSum - 100) <= 0.5, `invest+cash pct sum=${pctSum}`);
  });

  check(`[${date}] all allocation charts share ONE total basis`, () => {
    const donut = buildAssetAllocationFromSnapshotLike({
      holdings: snapshot.holdings,
      financeAssets: snapshot.financeAssets,
    }).totalKRW;
    const assetClass = sum(buildAssetClassAllocation(snapshot.holdings, snapshot.financeAssets), (s) => s.valueKRW);
    const model = buildPortfolioPageFromSnapshot(snapshot);
    const assetAlloc = sum(model.assetAllocation, (s) => s.amountKRW);
    assert.ok(approxEqual(donut, assetClass, 3), `donut=${donut} assetClass=${assetClass}`);
    assert.ok(approxEqual(donut, assetAlloc, 4), `donut=${donut} assetAlloc=${assetAlloc}`);
  });
}

// ---- Legacy (localStorage) path regression -------------------------------
// Legacy snapshots carry financeAssets classified by banksalad-parser as
// 현금/예적금/투자성/기타. The fix must keep the SAME behavior there:
//   투자성 → dropped, 현금/예적금 → kept, 기타(misc, e.g. 보험) → kept.
check("[legacy] 투자성 dropped; 현금/예적금/기타 kept (no regression)", () => {
  const holdings = [{ id: "h1", ticker: "SPY", valueKRW: 1_000_000 }];
  const financeAssets = [
    { id: "f1", groupName: "투자성", productName: "투자성 합계", amountKRW: 999_999, category: "투자성" },
    { id: "f2", groupName: "현금", productName: "현금", amountKRW: 500_000, category: "현금" },
    { id: "f3", groupName: "저축성", productName: "정기적금", amountKRW: 300_000, category: "예적금" },
    { id: "f4", groupName: "기타", productName: "보장성 보험 해약환급금", amountKRW: 200_000, category: "기타" },
    { id: "f5", groupName: "부채", productName: "신용대출", amountKRW: 100_000, category: "기타", isDebt: true },
  ];
  const kept = selectAllocationFinanceAssets(holdings, financeAssets);
  const keptIds = kept.map((a) => a.id).sort();
  assert.deepEqual(keptIds, ["f2", "f3", "f4"], `kept=${keptIds.join(",")}`);
  // Debt always excluded; investment (투자성) excluded; misc 기타 kept.
});

check("[legacy] no holdings → all non-debt finance assets kept (no overlap risk)", () => {
  const financeAssets = [
    { id: "f1", groupName: "투자성", productName: "투자성 합계", amountKRW: 999_999, category: "투자성" },
    { id: "f2", groupName: "현금", productName: "현금", amountKRW: 500_000, category: "현금" },
    { id: "f3", groupName: "부채", productName: "대출", amountKRW: 100_000, isDebt: true },
  ];
  const kept = selectAllocationFinanceAssets([], financeAssets);
  assert.deepEqual(kept.map((a) => a.id).sort(), ["f1", "f2"]);
});

console.log(`\nAll ${passed} portfolio-total-consistency checks passed.`);
