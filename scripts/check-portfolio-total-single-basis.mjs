#!/usr/bin/env node

// =============================================================
// PORTFOLIO-TOTAL-CONSISTENCY-FIX-3 verification (single authoritative basis).
//
// 목표: "동일 스냅샷을 선택하면 포트폴리오의 모든 차트가 동일한 총자산(= Firestore
// 권위 current_snapshot.total_assets_krw)을 표시한다" 를 실제 호출 경로(REAL mapper +
// REAL builders)로 증명한다.
//
// FIX-1(키워드 dedup) / FIX-2(권위 현금 합계 row-drop) 이후에도 남은 잔차를 재현한다:
//   - bs-report-auto 의 financial_status 에 "키워드 없는" 투자 계좌 lump 가 섞여 있고,
//   - investment_status(보유종목)의 합계가 total_investments_krw 와 "정확히 같지 않은"
//     (소액 종목/반올림으로 어긋난) 실제 데이터.
//   이 두 조건이 겹치면 FIX-2 의 row-drop 만으로는 도넛 총자산을 권위 총자산에 맞출 수
//   없어 7.52억 / 7.83억 / 7.74억 / 6.95억 처럼 차트마다 총자산이 달라진다.
//
// FIX-3 은 현금성(비투자) bucket 을 권위 remainder(= 총자산 − Σ보유종목)에 정확히
// anchor 해, 모든 차트(자산군 도넛 / 자산군 합산 / 자산 구성·목적별 / 투자·현금 비중 /
// 월별 추이)의 총자산이 권위 총자산과 100% 일치하게 만든다. 숫자를 임의로 만들지 않고
// (보유종목 금액은 실값 유지) 현금성 bucket 만 권위 단일 기준에 reconcile 한다.
//
// 검증 스냅샷: 2026-06-29 / 2026-06-19 / 2026-06-16 / 2026-06-15 (요구 검증 항목).
// 각 스냅샷에서 KPI · Parse Summary · Snapshot History · 자산군 비중 · 종목별 비중 ·
// 목적별/자산구성 · 투자/현금 비중 · 월별 추이의 총자산이 모두 권위 총자산과 일치하는지
// 확인한다.
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
const { parseSummaryFromSnapshot } = require("../lib/portfolio-parse-summary.ts");
const { buildPortfolioAssetTrend } = require("../lib/portfolio-asset-trend.ts");
const {
  getAuthoritativeTotalAssetsKRW,
  getAuthoritativeTotalCashKRW,
} = require("../lib/portfolio-authoritative-total.ts");

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

// ---- 검증 스냅샷 시나리오 --------------------------------------------------
// 각 스냅샷은 "실제 데이터의 어긋남"을 일부러 담는다:
//   - investment_status(보유종목) 합계 ≠ total_investments_krw (소액 종목 일부가
//     투자 합계에는 들어가지만 보유종목 행에는 빠진 경우 등)
//   - financial_status 에 키워드 없는 투자 계좌 lump 가 섞여 FIX-2 를 빠져나감
//   - 100만원 미만 현금성 행(차트 표시에서 숨겨짐)
// 이래도 도넛 중앙 총자산은 권위 총자산과 100% 일치해야 한다.

function buildRecord(scn) {
  return {
    id: scn.date,
    data: {
      document_version: "1.1.0",
      snapshot: {
        snapshot_date: scn.date,
        current_snapshot: {
          total_assets_krw: scn.totalAssets,
          total_investments_krw: scn.totalInvestments,
          investment_principal_krw: scn.principal,
          return_amount_krw: scn.totalInvestments - scn.principal,
          return_pct: ((scn.totalInvestments - scn.principal) / scn.principal) * 100,
          total_cash_krw: scn.totalCash,
          total_debt_krw: 0,
          net_worth_krw: scn.totalAssets,
        },
        investment_status: scn.holdings,
        financial_status: scn.financial,
      },
    },
  };
}

// 보고된 4개 검증 스냅샷 + 보고된 총자산 배수(7.52/7.83/7.74/6.95 ÷ 6.51 ≈ 1.155/1.203/1.189/1.068)
// 를 재현하는 합성 시나리오. holdingsSum 과 total_investments 가 일부러 어긋난다.
const SCENARIOS = [
  {
    date: "2026-06-29",
    totalAssets: 651_465_228,
    totalInvestments: 600_000_000,
    totalCash: 51_465_228,
    principal: 470_000_000,
    // 보유종목 합계 = 598,000,000 (total_investments 600,000,000 보다 2,000,000 적음 — 소액 종목 누락)
    holdings: [
      { product_name: "키움 TQQQ", ticker: "TQQQ", value_krw: 250_000_000, principal_krw: 150_000_000 },
      { product_name: "키움 QLD", ticker: "QLD", value_krw: 120_000_000, principal_krw: 90_000_000 },
      { product_name: "TIGER 미국S&P500", ticker: "360750", value_krw: 130_000_000, principal_krw: 100_000_000 },
      { product_name: "SCHD", ticker: "SCHD", value_krw: 58_000_000, principal_krw: 50_000_000 },
      { product_name: "마이크로소프트", ticker: "MSFT", value_krw: 40_000_000, principal_krw: 25_000_000 },
    ],
    financial: [
      { group_name: "자유입출금", product_name: "토스뱅크 입출금통장", amount_krw: 30_000_000, category: "현금" },
      { group_name: "저축성", product_name: "KB 정기예금", amount_krw: 15_000_000, category: "예적금" },
      { group_name: "외화", product_name: "미국달러 예수금", amount_krw: 6_465_228, category: "현금" },
      // 키워드 없는 투자 계좌 lump (FIX-2 를 빠져나가 7.52억으로 부풀리던 원인).
      { group_name: "", product_name: "메인 자산", amount_krw: 101_000_000, category: undefined },
      // 100만원 미만 현금성(차트 표시에서 숨겨짐). 중앙 총자산엔 영향 없어야 한다.
      { group_name: "현금", product_name: "지갑 현금", amount_krw: 500_000, category: "현금" },
    ],
  },
  {
    date: "2026-06-19",
    totalAssets: 640_000_000,
    totalInvestments: 590_000_000,
    totalCash: 50_000_000,
    principal: 460_000_000,
    holdings: [
      { product_name: "키움 TQQQ", ticker: "TQQQ", value_krw: 240_000_000, principal_krw: 150_000_000 },
      { product_name: "키움 QLD", ticker: "QLD", value_krw: 118_000_000, principal_krw: 90_000_000 },
      { product_name: "TIGER 미국S&P500", ticker: "360750", value_krw: 128_000_000, principal_krw: 100_000_000 },
      { product_name: "SCHD", ticker: "SCHD", value_krw: 62_000_000, principal_krw: 55_000_000 },
      { product_name: "마이크로소프트", ticker: "MSFT", value_krw: 41_000_000, principal_krw: 25_000_000 },
    ],
    financial: [
      { group_name: "자유입출금", product_name: "토스뱅크", amount_krw: 28_000_000, category: "현금" },
      { group_name: "저축성", product_name: "정기예금", amount_krw: 16_000_000, category: "예적금" },
      { group_name: "외화", product_name: "달러 예수금", amount_krw: 6_000_000, category: "현금" },
      { group_name: "", product_name: "통합 계좌", amount_krw: 130_000_000, category: undefined },
    ],
  },
  {
    date: "2026-06-16",
    totalAssets: 695_000_000,
    totalInvestments: 640_000_000,
    totalCash: 55_000_000,
    principal: 500_000_000,
    holdings: [
      { product_name: "키움 TQQQ", ticker: "TQQQ", value_krw: 270_000_000, principal_krw: 160_000_000 },
      { product_name: "키움 QLD", ticker: "QLD", value_krw: 130_000_000, principal_krw: 100_000_000 },
      { product_name: "TIGER 미국S&P500", ticker: "360750", value_krw: 140_000_000, principal_krw: 110_000_000 },
      { product_name: "SCHD", ticker: "SCHD", value_krw: 60_000_000, principal_krw: 55_000_000 },
      { product_name: "마이크로소프트", ticker: "MSFT", value_krw: 38_000_000, principal_krw: 25_000_000 },
    ],
    financial: [
      { group_name: "자유입출금", product_name: "토스뱅크", amount_krw: 33_000_000, category: "현금" },
      { group_name: "저축성", product_name: "정기예금", amount_krw: 18_000_000, category: "예적금" },
      { group_name: "외화", product_name: "달러 예수금", amount_krw: 4_000_000, category: "현금" },
      { group_name: "증권", product_name: "위탁 합계", amount_krw: 90_000_000, category: "투자성" },
    ],
  },
  {
    date: "2026-06-15",
    totalAssets: 620_000_000,
    totalInvestments: 560_000_000,
    totalCash: 60_000_000,
    principal: 450_000_000,
    holdings: [
      { product_name: "키움 TQQQ", ticker: "TQQQ", value_krw: 220_000_000, principal_krw: 140_000_000 },
      { product_name: "키움 QLD", ticker: "QLD", value_krw: 110_000_000, principal_krw: 85_000_000 },
      { product_name: "TIGER 미국S&P500", ticker: "360750", value_krw: 125_000_000, principal_krw: 100_000_000 },
      { product_name: "SCHD", ticker: "SCHD", value_krw: 65_000_000, principal_krw: 60_000_000 },
      { product_name: "마이크로소프트", ticker: "MSFT", value_krw: 42_000_000, principal_krw: 25_000_000 },
    ],
    financial: [
      { group_name: "자유입출금", product_name: "토스뱅크", amount_krw: 35_000_000, category: "현금" },
      { group_name: "저축성", product_name: "정기예금", amount_krw: 20_000_000, category: "예적금" },
      { group_name: "외화", product_name: "달러 예수금", amount_krw: 5_000_000, category: "현금" },
      // 키워드 없는 lump.
      { group_name: "", product_name: "자산", amount_krw: 70_000_000, category: undefined },
    ],
  },
];

console.log("check:portfolio-total-single-basis");

const mappedByDate = new Map();

for (const scn of SCENARIOS) {
  const snapshot = mapPortfolioSnapshotRecordToViewModel(buildRecord(scn));
  mappedByDate.set(scn.date, snapshot);
  const authoritativeTotal = getAuthoritativeTotalAssetsKRW(snapshot);
  const authoritativeCash = getAuthoritativeTotalCashKRW(snapshot);

  check(`[${scn.date}] 권위 총자산 stamp = current_snapshot.total_assets_krw (${scn.totalAssets})`, () => {
    assert.equal(authoritativeTotal, scn.totalAssets);
    assert.equal(snapshot.totalAssetKRW, scn.totalAssets);
  });

  check(`[${scn.date}] KPI 총금융자산 == 권위 총자산`, () => {
    const totals = reconcilePortfolioTotals(snapshot);
    assert.equal(totals.totalFinancialAssetSource, "contract.total_assets_krw");
    assert.equal(totals.totalFinancialAssetKRW, scn.totalAssets);
  });

  check(`[${scn.date}] Parse Summary 총금융자산 == 권위 총자산`, () => {
    assert.equal(parseSummaryFromSnapshot(snapshot).totalAssetKRW, scn.totalAssets);
  });

  check(`[${scn.date}] Snapshot History 총자산(snapshot.totalAssetKRW) == 권위 총자산`, () => {
    assert.equal(snapshot.totalAssetKRW, scn.totalAssets);
  });

  // 보유종목 합계가 total_investments 와 일부러 다른 시나리오임을 명시한다(실데이터 재현).
  const holdingsSum = sum(snapshot.holdings, (h) => h.valueKRW);

  check(`[${scn.date}] 종목별/자산군 비중 도넛 중앙 총자산 == 권위 총자산 (자가합산 금지)`, () => {
    const { totalKRW } = buildAssetAllocationFromSnapshotLike(
      { holdings: snapshot.holdings, financeAssets: snapshot.financeAssets },
      {
        authoritativeCashKRW: authoritativeCash,
        authoritativeTotalAssetsKRW: authoritativeTotal,
      },
    );
    assert.equal(totalKRW, scn.totalAssets, `donut center=${totalKRW} vs 권위=${scn.totalAssets} (holdingsSum=${holdingsSum})`);
  });

  check(`[${scn.date}] 자산군 합산(asset-class) Σ슬라이스 ≈ 권위 총자산 (100만원미만 숨김분 제외)`, () => {
    const slices = buildAssetClassAllocation(snapshot.holdings, snapshot.financeAssets, {
      authoritativeCashKRW: authoritativeCash,
      authoritativeTotalAssetsKRW: authoritativeTotal,
    });
    const total = sum(slices, (s) => s.valueKRW);
    // anchor 후 Σ슬라이스는 권위 총자산에서 100만원 미만 숨김분만큼만 작을 수 있다.
    assert.ok(total <= scn.totalAssets + 1, `asset-class Σ=${total} > 권위=${scn.totalAssets}`);
    assert.ok(scn.totalAssets - total <= 1_000_000, `asset-class Σ=${total} 가 권위=${scn.totalAssets} 보다 100만원 넘게 작음`);
    // 비중 분모가 권위 총자산이므로 Σ weightPct ≤ 100 (+오차).
    const pctSum = sum(slices, (s) => s.weightPct);
    assert.ok(pctSum <= 100.5, `ΣweightPct=${pctSum} > 100`);
  });

  check(`[${scn.date}] 자산 구성(목적별) 도넛 Σ금액 ≈ 권위 총자산, Σ비중 ≈ 100`, () => {
    const model = buildPortfolioPageFromSnapshot(snapshot);
    assert.equal(model.summary.totalAssetKRW, scn.totalAssets);
    const assetAllocTotal = sum(model.assetAllocation, (s) => s.amountKRW);
    assert.ok(
      scn.totalAssets - assetAllocTotal <= 1_000_000 && assetAllocTotal <= scn.totalAssets + 1,
      `assetAllocation Σ=${assetAllocTotal} vs 권위=${scn.totalAssets}`,
    );
  });

  check(`[${scn.date}] 투자/현금 비중 == 권위 total_investments / total_cash`, () => {
    const model = buildPortfolioPageFromSnapshot(snapshot);
    const investPct = model.summary.stockCashTargets.find((t) => t.name === "투자")?.current ?? 0;
    const cashPct = model.summary.stockCashTargets.find((t) => t.name === "현금")?.current ?? 0;
    const expectedInvest = Number(((scn.totalInvestments / (scn.totalInvestments + scn.totalCash)) * 100).toFixed(1));
    assert.ok(Math.abs(investPct - expectedInvest) <= 0.2, `투자 비중=${investPct} vs 기대=${expectedInvest}`);
    assert.ok(Math.abs(investPct + cashPct - 100) <= 0.2, `투자+현금=${investPct + cashPct} ≠ 100`);
  });

  check(`[${scn.date}] 모든 도넛/자산군/자산구성이 동일한 단일 총자산 기준을 공유`, () => {
    const donut = buildAssetAllocationFromSnapshotLike(
      { holdings: snapshot.holdings, financeAssets: snapshot.financeAssets },
      { authoritativeCashKRW: authoritativeCash, authoritativeTotalAssetsKRW: authoritativeTotal },
    ).totalKRW;
    const model = buildPortfolioPageFromSnapshot(snapshot);
    // 도넛 중앙 총자산 == KPI 총자산 == Parse Summary == 권위 총자산.
    assert.equal(donut, scn.totalAssets);
    assert.equal(model.summary.totalAssetKRW, scn.totalAssets);
    assert.equal(parseSummaryFromSnapshot(snapshot).totalAssetKRW, scn.totalAssets);
  });
}

// ---- 월별 자산 추이: 각 월의 누적 합계가 그 달 스냅샷의 권위 총자산과 일치 ----------
check("[월별 추이] 각 월 스택 합계가 그 달 스냅샷의 권위 총자산과 일치(100만원미만 숨김분 제외)", () => {
  const snapshots = SCENARIOS.map((scn) => mappedByDate.get(scn.date));
  const { series, points } = buildPortfolioAssetTrend(snapshots);
  assert.ok(points.length >= 1, "월별 추이 포인트가 있어야 한다");
  // 각 스냅샷은 서로 다른 달(06-29/06-19/06-16/06-15 → 2026-06 하나)로 묶이므로
  // 대표(최신 06-29)만 남는다. 대표 달의 합계가 권위 총자산과 일치하는지 본다.
  for (const point of points) {
    const stackTotal = series.reduce((acc, s) => acc + (point[s.key] || 0), 0);
    // 그 달 대표 스냅샷의 권위 총자산을 찾는다(monthKey=YYYY-MM).
    const rep = SCENARIOS.map((scn) => mappedByDate.get(scn.date))
      .filter((s) => s.snapshotDate.slice(0, 7) === point.monthKey)
      .sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1))[0];
    const authoritativeTotal = getAuthoritativeTotalAssetsKRW(rep);
    assert.ok(
      authoritativeTotal - stackTotal <= 1_000_000 && stackTotal <= authoritativeTotal + 1,
      `월 ${point.monthKey} 스택합=${stackTotal} vs 권위=${authoritativeTotal}`,
    );
  }
});

// ---- 버그 재현: anchor(authoritativeTotalAssetsKRW) 없이는 도넛 총자산이 어긋난다 ----
check("[repro] anchor 미적용 시 2026-06-29 도넛 총자산이 권위(6.51억)와 어긋남", () => {
  const snapshot = mappedByDate.get("2026-06-29");
  // authoritativeTotalAssetsKRW 를 주지 않으면(FIX-2 row-drop 까지만) 키워드 없는 lump
  // (1.01억)와 row 단위 drop 의 거친 보정 때문에 도넛 총자산이 권위 총자산과 달라진다
  // — 이것이 보고된 버그(차트마다 7.52억/7.83억/... 처럼 제각각). row-drop 은 큰 현금 행을
  // 통째로 떨궈 과소계상하거나 lump 가 살아남아 과대계상하는 등 양방향으로 어긋난다.
  const before = buildAssetAllocationFromSnapshotLike(
    { holdings: snapshot.holdings, financeAssets: snapshot.financeAssets },
    { authoritativeCashKRW: getAuthoritativeTotalCashKRW(snapshot) },
  ).totalKRW;
  assert.notEqual(before, 651_465_228, "anchor 없이도 일치하면 재현 시나리오가 무의미함");
  assert.ok(Math.abs(before - 651_465_228) > 1_000_000, `발산폭이 유의미해야 함 (before=${before})`);
  // anchor 를 주면 정확히 권위 총자산으로 수렴.
  const after = buildAssetAllocationFromSnapshotLike(
    { holdings: snapshot.holdings, financeAssets: snapshot.financeAssets },
    {
      authoritativeCashKRW: getAuthoritativeTotalCashKRW(snapshot),
      authoritativeTotalAssetsKRW: getAuthoritativeTotalAssetsKRW(snapshot),
    },
  ).totalKRW;
  assert.equal(after, 651_465_228, `anchor 후 도넛 총자산=${after} ≠ 권위 651465228`);
});

// ---- 회귀: 권위 합계가 없는 레거시/오프라인 스냅샷은 자가합산 유지 -----------------
check("[regression] 권위 합계 없는 레거시 스냅샷은 anchor 미적용(자가합산 유지)", () => {
  const legacy = {
    id: "legacy",
    snapshotDate: "2025-01-01",
    sourceFileName: "legacy.xlsx",
    totalAssetKRW: 0,
    totalDebtKRW: 0,
    netAssetKRW: 0,
    investmentPrincipalKRW: 0,
    investmentValueKRW: 0,
    returnAmountKRW: 0,
    returnPct: 0,
    holdings: [{ id: "h1", broker: "", assetType: "주식", productName: "SPY", ticker: "SPY", principalKRW: 9_000_000, valueKRW: 10_000_000 }],
    financeAssets: [{ id: "f1", groupName: "현금", productName: "현금", amountKRW: 5_000_000, category: "현금" }],
    createdAt: new Date(0).toISOString(),
    // authoritativeTotals 없음
  };
  // 권위 총자산이 없으므로 anchor 없이 자가합산(10,000,000 + 5,000,000 = 15,000,000).
  const { totalKRW } = buildAssetAllocationFromSnapshotLike(
    { holdings: legacy.holdings, financeAssets: legacy.financeAssets },
    {},
  );
  assert.equal(totalKRW, 15_000_000, `legacy 자가합산 total=${totalKRW}`);
});

console.log(`\nAll ${passed} portfolio-total-single-basis checks passed.`);
