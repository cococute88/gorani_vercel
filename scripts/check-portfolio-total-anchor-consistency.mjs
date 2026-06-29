#!/usr/bin/env node

// =============================================================
// PORTFOLIO-TOTAL-CONSISTENCY-FIX-2 verification (authoritative anchor).
//
// Reproduces the REMAINING (residual) bug after PORTFOLIO-TOTAL-CONSISTENCY-FIX-1:
//
//   On the live 2026-06-29 Firestore snapshot the authoritative total
//   (current_snapshot.total_assets_krw, used by Parse Summary / KPI cards) is
//   651,465,228원 (6.51억), but the allocation charts (자산군 비중 도넛 / 자산군
//   합산 / 자산 구성·목적별 / 투자·현금 비중) showed ~752,465,228원 (7.52억) —
//   a 1.155x inflation.
//
//   FIX-1 expanded the keyword de-dup (isInvestmentFinanceAsset) so MOST
//   investment-account rows in financial_status (which overlap investment_status
//   holdings) are dropped. But bs-report-auto does NOT guarantee an investment
//   keyword (투자/연금/증권/위탁/ETF...) on every such row. A row whose
//   group_name/product_name/category carries NONE of those signals survives the
//   keyword filter and is summed ON TOP of the holdings that already represent
//   the same money → residual double count (here exactly 1.155x).
//
//   FIX-2 anchors the de-dup to the authoritative cash total
//   (current_snapshot.total_cash_krw): when the kept "cash" rows overshoot the
//   authoritative cash, the overflow (= the keyword-less investment-account
//   lump) is dropped, so holdings + cash == authoritative total_assets for EVERY
//   chart. No number is fabricated or scaled — each surviving row keeps its real
//   amount; only the wrong summation path is corrected to the single SoT.
//
// This script maps a producer document (with a keyword-less investment lump)
// through the REAL mapper + REAL builders and asserts:
//   - the OLD path (no anchor) reproduces 7.52억 (1.155x),
//   - the NEW path (authoritative anchor) reconciles every chart to 6.51억,
//   - legacy/offline snapshots (no authoritative totals) are unchanged.
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
const { buildAssetClassAllocation } = require("../lib/asset-class-allocation.ts");
const { buildPortfolioPageFromSnapshot } = require("../lib/portfolio-from-snapshots.ts");
const { reconcilePortfolioTotals } = require("../lib/portfolio-totals-reconcile.ts");
const { selectAllocationFinanceAssets } = require("../lib/portfolio-allocation-dedup.ts");
const { parseSummaryFromSnapshot } = require("../lib/portfolio-parse-summary.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function sum(rows, get) {
  return rows.reduce((acc, row) => acc + (get(row) || 0), 0);
}

function approxEqual(a, b, tolerance = 1) {
  return Math.abs(a - b) <= tolerance;
}

// ---- The exact reported magnitudes (2026-06-29 snapshot) -------------------
const TOTAL_ASSETS = 651_465_228; // 6.51억 — authoritative (Parse Summary / KPI)
const TOTAL_CASH = 51_465_228; //   현금성 합계 (authoritative current_snapshot.total_cash_krw)
const TOTAL_INVESTMENTS = 600_000_000; // 6.00억 — sum of investment_status holdings

// Holdings (investment_status) summing to TOTAL_INVESTMENTS.
const HOLDINGS = [
  { product_name: "키움 TQQQ", ticker: "TQQQ", value_krw: 250_000_000, principal_krw: 150_000_000 },
  { product_name: "키움 QLD", ticker: "QLD", value_krw: 120_000_000, principal_krw: 90_000_000 },
  { product_name: "TIGER 미국S&P500", ticker: "360750", value_krw: 130_000_000, principal_krw: 100_000_000 },
  { product_name: "SCHD", ticker: "SCHD", value_krw: 60_000_000, principal_krw: 52_000_000 },
  { product_name: "마이크로소프트", ticker: "MSFT", value_krw: 40_000_000, principal_krw: 25_000_000 },
];

// Genuine cash rows (financial_status), summing to TOTAL_CASH, all clearly cash.
const CASH_ROWS = [
  { group_name: "자유입출금", product_name: "토스뱅크 입출금통장", amount_krw: 30_000_000, category: "현금" },
  { group_name: "저축성", product_name: "KB 정기예금", amount_krw: 15_000_000, category: "예적금" },
  { group_name: "외화", product_name: "미국달러 예수금", amount_krw: 6_465_228, category: "현금" },
];

// The leak: an investment-account aggregate in financial_status that overlaps the
// holdings, but whose name/group/category carries NO investment keyword (the
// producer reality FIX-1's keyword list does not cover). 101,000,000원 makes the
// old donut total exactly 752,465,228 (== 1.155x of 651,465,228).
const KEYWORDLESS_INVESTMENT_LUMP = {
  group_name: "",
  product_name: "메인 자산",
  amount_krw: 101_000_000,
  category: undefined,
};

function buildRecord() {
  return {
    id: "2026-06-29",
    data: {
      document_version: "1.1.0",
      snapshot: {
        snapshot_date: "2026-06-29",
        current_snapshot: {
          total_assets_krw: TOTAL_ASSETS,
          total_investments_krw: TOTAL_INVESTMENTS,
          investment_principal_krw: sum(HOLDINGS, (h) => h.principal_krw),
          return_amount_krw: TOTAL_INVESTMENTS - sum(HOLDINGS, (h) => h.principal_krw),
          return_pct: 0,
          total_cash_krw: TOTAL_CASH,
          total_debt_krw: 0,
          net_worth_krw: TOTAL_ASSETS,
        },
        investment_status: HOLDINGS,
        financial_status: [...CASH_ROWS, KEYWORDLESS_INVESTMENT_LUMP],
      },
    },
  };
}

console.log("check:portfolio-total-anchor-consistency");

const snapshot = mapPortfolioSnapshotRecordToViewModel(buildRecord());
const authoritative = snapshot.authoritativeTotals;

check("mapper stamped authoritative totals (6.51억 / 0.51억 cash) verbatim", () => {
  assert.ok(authoritative, "authoritativeTotals must be present");
  assert.equal(authoritative.totalAssetsKRW, TOTAL_ASSETS);
  assert.equal(authoritative.totalCashKRW, TOTAL_CASH);
});

check("Parse Summary uses authoritative total (6.51억)", () => {
  const summary = parseSummaryFromSnapshot(snapshot);
  assert.equal(summary.totalAssetKRW, TOTAL_ASSETS);
});

check("KPI / reconcile uses authoritative total (6.51억, verbatim)", () => {
  const totals = reconcilePortfolioTotals(snapshot);
  assert.equal(totals.totalFinancialAssetSource, "contract.total_assets_krw");
  assert.equal(totals.totalFinancialAssetKRW, TOTAL_ASSETS);
});

check("WITHOUT anchor (FIX-1 keyword only) the keyword-less lump LEAKS → 7.52억 (1.155x)", () => {
  // Reproduce the OLD chart path: call the de-dup WITHOUT the authoritative anchor.
  const kept = selectAllocationFinanceAssets(snapshot.holdings, snapshot.financeAssets);
  const oldDonutTotal = sum(snapshot.holdings, (h) => h.valueKRW) + sum(kept, (a) => a.amountKRW);
  assert.equal(oldDonutTotal, 752_465_228, `old donut total=${oldDonutTotal}`);
  const ratio = oldDonutTotal / TOTAL_ASSETS;
  assert.ok(approxEqual(ratio, 1.155, 0.001), `ratio=${ratio.toFixed(4)} (expected ~1.155)`);
  // The keyword filter kept the lump because it has no investment signal.
  assert.ok(kept.some((a) => a.productName === "메인 자산"), "keyword filter should leak the lump");
});

check("WITH anchor the lump is dropped; kept cash == authoritative cash (0.51억)", () => {
  const kept = selectAllocationFinanceAssets(snapshot.holdings, snapshot.financeAssets, {
    authoritativeCashKRW: TOTAL_CASH,
  });
  assert.ok(!kept.some((a) => a.productName === "메인 자산"), "anchor must drop the keyword-less lump");
  const keptCash = sum(kept, (a) => a.amountKRW);
  assert.ok(approxEqual(keptCash, TOTAL_CASH, 1), `kept cash=${keptCash} vs authoritative=${TOTAL_CASH}`);
  // All 3 genuine cash rows survive.
  assert.equal(kept.length, 3, `kept=${kept.map((k) => k.productName).join(", ")}`);
});

check("자산군 비중 도넛 total == authoritative 6.51억 (anchored)", () => {
  const { totalKRW } = buildAssetAllocationFromSnapshotLike(
    { holdings: snapshot.holdings, financeAssets: snapshot.financeAssets },
    { authoritativeCashKRW: authoritative.totalCashKRW },
  );
  assert.ok(approxEqual(totalKRW, TOTAL_ASSETS, 2), `donut total=${totalKRW} vs ${TOTAL_ASSETS}`);
});

check("자산군 합산(asset-class) total == authoritative 6.51억 (anchored)", () => {
  const slices = buildAssetClassAllocation(snapshot.holdings, snapshot.financeAssets, {
    authoritativeCashKRW: authoritative.totalCashKRW,
  });
  const total = sum(slices, (s) => s.valueKRW);
  assert.ok(approxEqual(total, TOTAL_ASSETS, 2), `asset-class total=${total} vs ${TOTAL_ASSETS}`);
});

check("자산 구성·목적별 / 투자·현금 비중 reconcile to authoritative 6.51억 (page model)", () => {
  const model = buildPortfolioPageFromSnapshot(snapshot);
  // KPI card.
  assert.equal(model.summary.totalAssetKRW, TOTAL_ASSETS);
  // 자산 구성 도넛 slices sum to authoritative total (no 1.155x).
  const assetAllocTotal = sum(model.assetAllocation, (s) => s.amountKRW);
  assert.ok(approxEqual(assetAllocTotal, TOTAL_ASSETS, 3), `assetAllocation total=${assetAllocTotal} vs ${TOTAL_ASSETS}`);
  // 투자/현금 비중 percentages sum to ~100.
  const pctSum = sum(model.summary.stockCashTargets, (t) => t.current);
  assert.ok(Math.abs(pctSum - 100) <= 0.5, `invest+cash pct sum=${pctSum}`);
  // 투자 비중 amount basis == authoritative investments; 현금 basis == authoritative cash.
  const investPct = model.summary.stockCashTargets.find((t) => t.name === "투자")?.current ?? 0;
  const expectedInvestPct = Number(((TOTAL_INVESTMENTS / TOTAL_ASSETS) * 100).toFixed(1));
  assert.ok(Math.abs(investPct - expectedInvestPct) <= 0.5, `invest pct=${investPct} vs ~${expectedInvestPct}`);
});

check("ALL allocation charts share ONE total basis (6.51억)", () => {
  const donut = buildAssetAllocationFromSnapshotLike(
    { holdings: snapshot.holdings, financeAssets: snapshot.financeAssets },
    { authoritativeCashKRW: authoritative.totalCashKRW },
  ).totalKRW;
  const assetClass = sum(
    buildAssetClassAllocation(snapshot.holdings, snapshot.financeAssets, {
      authoritativeCashKRW: authoritative.totalCashKRW,
    }),
    (s) => s.valueKRW,
  );
  const model = buildPortfolioPageFromSnapshot(snapshot);
  const assetAlloc = sum(model.assetAllocation, (s) => s.amountKRW);
  assert.ok(approxEqual(donut, assetClass, 3), `donut=${donut} assetClass=${assetClass}`);
  assert.ok(approxEqual(donut, assetAlloc, 4), `donut=${donut} assetAlloc=${assetAlloc}`);
  assert.ok(approxEqual(donut, TOTAL_ASSETS, 4), `donut=${donut} authoritative=${TOTAL_ASSETS}`);
});

// ---- Regression guards -----------------------------------------------------

check("[regression] anchor does NOT over-trim when keyword de-dup already reconciles", () => {
  // financial_status with ONLY genuine cash (no leak): kept cash already == authoritative cash.
  const cleanSnap = mapPortfolioSnapshotRecordToViewModel({
    id: "2026-06-29",
    data: {
      document_version: "1.1.0",
      snapshot: {
        snapshot_date: "2026-06-29",
        current_snapshot: {
          total_assets_krw: TOTAL_ASSETS,
          total_investments_krw: TOTAL_INVESTMENTS,
          investment_principal_krw: 0,
          return_amount_krw: 0,
          return_pct: 0,
          total_cash_krw: TOTAL_CASH,
          total_debt_krw: 0,
          net_worth_krw: TOTAL_ASSETS,
        },
        investment_status: HOLDINGS,
        financial_status: [...CASH_ROWS],
      },
    },
  });
  const kept = selectAllocationFinanceAssets(cleanSnap.holdings, cleanSnap.financeAssets, {
    authoritativeCashKRW: TOTAL_CASH,
  });
  assert.equal(kept.length, 3, "all genuine cash rows kept (no over-trim)");
  assert.ok(approxEqual(sum(kept, (a) => a.amountKRW), TOTAL_CASH, 1));
});

check("[regression] legacy/offline snapshot (no authoritative cash) keeps keyword behavior", () => {
  const holdings = [{ id: "h1", ticker: "SPY", valueKRW: 1_000_000 }];
  const financeAssets = [
    { id: "f1", groupName: "투자성", productName: "투자성 합계", amountKRW: 999_999, category: "투자성" },
    { id: "f2", groupName: "현금", productName: "현금", amountKRW: 500_000, category: "현금" },
    { id: "f3", groupName: "기타", productName: "보장성 보험 해약환급금", amountKRW: 200_000, category: "기타" },
    { id: "f4", groupName: "부채", productName: "신용대출", amountKRW: 100_000, isDebt: true },
  ];
  // No authoritativeCashKRW passed → unchanged keyword behavior: 투자성 dropped, 현금/기타 kept, 부채 dropped.
  const kept = selectAllocationFinanceAssets(holdings, financeAssets);
  assert.deepEqual(kept.map((a) => a.id).sort(), ["f2", "f3"], `kept=${kept.map((a) => a.id).join(",")}`);
});

console.log(`\nAll ${passed} portfolio-total-anchor-consistency checks passed.`);
