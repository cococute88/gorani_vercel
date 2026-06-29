#!/usr/bin/env node

// =============================================================
// PORTFOLIO-TOTAL-CONSISTENCY-FIX-4 verification (past-snapshot unification).
//
// 배경(PR #159 잔차):
//   PR #159(FIX-1~3)는 "권위 합계(authoritativeTotals)가 있는" Firestore 최신 스냅샷
//   (예: 2026-06-29)만 도넛/자산군/자산구성/투자·현금/월별추이 총자산을 권위 단일
//   기준으로 통일했다. 그러나 과거 스냅샷은 localStorage(resultToSnapshot) 경로로 저장돼
//   authoritativeTotals 가 없다. 직전 getAuthoritativeTotalAssetsKRW 는 이 경우 null 을
//   반환해 anchor 가 꺼졌고, 차트는 보유종목+현금성을 자가합산했다. 그 결과 과거 스냅샷은
//   도넛 중앙 총자산(예: 06-16 → 7.83억)이 KPI·파싱요약·히스토리(=totalAssetKRW, 6.79억)와
//   달라졌다.
//
// FIX-4:
//   getAuthoritativeTotalAssetsKRW 의 폴백을 totalAssetKRW 로 확장해, authoritativeTotals
//   유무(최신/과거)와 무관하게 모든 스냅샷이 같은 함수·같은 anchor 경로를 타게 한다.
//
// 이 스크립트는 "권위 합계가 없는 과거 스냅샷"(localStorage/resultToSnapshot 형태)을 직접
// 구성하고, 일부러 키워드 없는 투자 계좌 lump 를 financeAssets 에 섞어 자가합산이 권위
// 총자산을 초과하도록(=보고된 버그) 만든 뒤, FIX-4 적용 후 모든 차트가 totalAssetKRW
// 단일 기준으로 수렴함을 REAL builders 로 증명한다. 동시에 "anchor 미적용(=구버전 동작)"
// 에서는 발산함을 repro 로 남겨 회귀를 막는다.
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

const { buildAssetAllocationFromSnapshotLike } = require("../lib/asset-allocation-donut.ts");
const { buildAssetClassAllocation } = require("../lib/asset-class-allocation.ts");
const { buildPortfolioPageFromSnapshot } = require("../lib/portfolio-from-snapshots.ts");
const { reconcilePortfolioTotals } = require("../lib/portfolio-totals-reconcile.ts");
const { parseSummaryFromSnapshot } = require("../lib/portfolio-parse-summary.ts");
const { buildPortfolioAssetTrend } = require("../lib/portfolio-asset-trend.ts");
const {
  getAuthoritativeTotalAssetsKRW,
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

// ---- 과거(localStorage / resultToSnapshot) 스냅샷 시나리오 ------------------
// 핵심 조건(보고된 버그 재현):
//   - authoritativeTotals 가 없다(과거 스냅샷).
//   - totalAssetKRW 는 파서가 읽은 "진짜 총자산"(KPI·파싱요약·히스토리가 쓰는 값).
//   - financeAssets 에 키워드 없는 투자 계좌 lump 가 섞여 자가합산이 총자산을 초과한다.
//     (selectAllocationFinanceAssets 의 키워드 dedup 을 빠져나가고, 과거 스냅샷은
//      authoritativeCashKRW 도 없어 row-drop reconcile 도 못 한다.)
//   → 구버전: 도넛 중앙 = 보유종목 + 현금성 + lump > totalAssetKRW (예: 06-16 7.83억).
//   → FIX-4: 도넛 중앙 = totalAssetKRW (예: 06-16 6.79억).
const SCENARIOS = [
  // date, totalAssetKRW, investments(=Σholdings), genuineCash, keywordlessLump
  { date: "2026-06-29", total: 651_465_228, inv: 600_000_000, cash: 51_465_228, lump: 90_000_000 },
  { date: "2026-06-19", total: 663_000_000, inv: 590_000_000, cash: 73_000_000, lump: 120_000_000 },
  { date: "2026-06-16", total: 679_000_000, inv: 600_000_000, cash: 79_000_000, lump: 104_000_000 },
  { date: "2026-06-15", total: 612_000_000, inv: 560_000_000, cash: 52_000_000, lump: 70_000_000 },
  { date: "2026-06-12", total: 588_000_000, inv: 540_000_000, cash: 48_000_000, lump: 64_000_000 },
];

// 보유종목(투자) — Σ valueKRW == inv 가 되도록 비율 분배.
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
    id: `h${i}`,
    broker: "키움증권",
    assetType: "해외주식",
    productName: it.product_name,
    ticker: it.ticker,
    valueKRW: Math.round(inv * it.w),
    principalKRW: Math.round(principal * it.pw),
  }));
  // 반올림 잔차를 첫 종목에 흡수해 Σ == inv 보장.
  const drift = inv - sum(rows, (r) => r.valueKRW);
  rows[0].valueKRW += drift;
  return rows;
}

// 과거 스냅샷(권위 합계 없음) 구성. resultToSnapshot 가 만드는 형태와 동일하게
// totalAssetKRW 는 채우되 authoritativeTotals 는 두지 않는다.
function buildPastSnapshot(scn) {
  const holdings = buildHoldings(scn.inv);
  const investmentValueKRW = sum(holdings, (h) => h.valueKRW);
  const investmentPrincipalKRW = sum(holdings, (h) => h.principalKRW);
  // 현금성 행(진짜 현금) — 합계 == scn.cash. 달러/원화 혼합.
  const financeAssets = [
    { id: "c1", groupName: "자유입출금 자산", productName: "토스뱅크 입출금통장", amountKRW: Math.round(scn.cash * 0.55), category: "현금" },
    { id: "c2", groupName: "저축성 자산", productName: "KB 정기예금", amountKRW: Math.round(scn.cash * 0.30), category: "예적금" },
    { id: "c3", groupName: "외화 자산", productName: "미국달러 예수금", amountKRW: scn.cash - Math.round(scn.cash * 0.55) - Math.round(scn.cash * 0.30), category: "현금" },
    // 키워드 없는 투자 계좌 lump (자가합산을 부풀리는 원인).
    { id: "lump", groupName: "", productName: "메인 자산", amountKRW: scn.lump, category: undefined },
  ];
  return {
    id: `local-${scn.date}`,
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
    financeAssets,
    createdAt: new Date(0).toISOString(),
    metadata: { parserVersion: "stage2-tags-v1", excludedSmallCount: 0, excludedBelowMinimumCount: 0, excludedHoldingValueKRW: 0 },
    // authoritativeTotals 없음 (과거/localStorage 스냅샷).
  };
}

console.log("check:portfolio-past-snapshot-total-unification");

const snapshots = SCENARIOS.map(buildPastSnapshot);
const byDate = new Map(snapshots.map((s) => [s.snapshotDate, s]));

for (const scn of SCENARIOS) {
  const snap = byDate.get(scn.date);
  const T = scn.total;
  const selfSum = sum(snap.holdings, (h) => h.valueKRW) + sum(snap.financeAssets, (a) => a.amountKRW);

  check(`[${scn.date}] (precondition) authoritativeTotals 없음 & 자가합산(${selfSum}) > 권위(${T})`, () => {
    assert.equal(snap.authoritativeTotals, undefined);
    assert.ok(selfSum > T + 1_000_000, `selfSum=${selfSum} 가 권위=${T} 보다 충분히 커야 버그 재현`);
  });

  check(`[${scn.date}] FIX-4: getAuthoritativeTotalAssetsKRW == totalAssetKRW (${T})`, () => {
    assert.equal(getAuthoritativeTotalAssetsKRW(snap), T);
  });

  const authoritativeTotal = getAuthoritativeTotalAssetsKRW(snap);

  check(`[${scn.date}] KPI 총금융자산 == 권위 총자산`, () => {
    const totals = reconcilePortfolioTotals(snap);
    assert.equal(totals.totalFinancialAssetKRW, T);
  });

  check(`[${scn.date}] 파싱 결과 요약 총금융자산 == 권위 총자산`, () => {
    assert.equal(parseSummaryFromSnapshot(snap).totalAssetKRW, T);
  });

  check(`[${scn.date}] Snapshot History 총자산(snapshot.totalAssetKRW) == 권위 총자산`, () => {
    assert.equal(snap.totalAssetKRW, T);
  });

  check(`[${scn.date}] 도넛 중앙 총자산(자산군/종목별 비중) == 권위 총자산 (자가합산 금지)`, () => {
    const { totalKRW } = buildAssetAllocationFromSnapshotLike(
      { holdings: snap.holdings, financeAssets: snap.financeAssets },
      { authoritativeTotalAssetsKRW: authoritativeTotal },
    );
    assert.equal(totalKRW, T, `donut center=${totalKRW} vs 권위=${T} (selfSum=${selfSum})`);
  });

  check(`[${scn.date}] 자산군 합산(asset-class) Σ슬라이스 ≈ 권위 총자산 (100만원미만 숨김분 제외)`, () => {
    const slices = buildAssetClassAllocation(snap.holdings, snap.financeAssets, {
      authoritativeTotalAssetsKRW: authoritativeTotal,
    });
    const total = sum(slices, (s) => s.valueKRW);
    assert.ok(total <= T + 1 && T - total <= 1_000_000, `asset-class Σ=${total} vs 권위=${T}`);
    const pctSum = sum(slices, (s) => s.weightPct);
    assert.ok(pctSum <= 100.5, `ΣweightPct=${pctSum} > 100`);
  });

  check(`[${scn.date}] 목적별/자산구성 도넛 Σ금액 ≈ 권위 총자산 & KPI 총자산 == 권위`, () => {
    const model = buildPortfolioPageFromSnapshot(snap);
    assert.equal(model.summary.totalAssetKRW, T);
    const assetAllocTotal = sum(model.assetAllocation, (s) => s.amountKRW);
    assert.ok(T - assetAllocTotal <= 1_000_000 && assetAllocTotal <= T + 1, `assetAllocation Σ=${assetAllocTotal} vs 권위=${T}`);
  });

  check(`[${scn.date}] 투자/현금 비중 합 ≈ 100`, () => {
    const model = buildPortfolioPageFromSnapshot(snap);
    const pctSum = sum(model.summary.stockCashTargets, (t) => t.current);
    assert.ok(Math.abs(pctSum - 100) <= 0.5, `투자+현금=${pctSum} ≠ 100`);
  });

  check(`[${scn.date}] repro: anchor 미적용(구버전)이면 도넛 총자산이 권위와 어긋남`, () => {
    // authoritativeTotalAssetsKRW 를 주지 않으면(=직전 getAuthoritativeTotalAssetsKRW 가
    // null 을 반환하던 과거 스냅샷 경로) 키워드 없는 lump 때문에 자가합산으로 발산한다.
    const before = buildAssetAllocationFromSnapshotLike(
      { holdings: snap.holdings, financeAssets: snap.financeAssets },
      {},
    ).totalKRW;
    assert.notEqual(before, T, "anchor 없이도 일치하면 재현 시나리오가 무의미함");
    assert.ok(before > T + 1_000_000, `구버전 발산폭이 유의미해야 함 (before=${before}, 권위=${T})`);
  });
}

// ---- 모든 날짜에서 도넛 중앙 == 파싱요약 == 히스토리 == KPI == 권위 총자산 -----------
check("모든 날짜에서 도넛 중앙 == 파싱요약 == 히스토리 == KPI (단일 기준)", () => {
  for (const scn of SCENARIOS) {
    const snap = byDate.get(scn.date);
    const authoritativeTotal = getAuthoritativeTotalAssetsKRW(snap);
    const donut = buildAssetAllocationFromSnapshotLike(
      { holdings: snap.holdings, financeAssets: snap.financeAssets },
      { authoritativeTotalAssetsKRW: authoritativeTotal },
    ).totalKRW;
    const parse = parseSummaryFromSnapshot(snap).totalAssetKRW;
    const history = snap.totalAssetKRW;
    const kpi = reconcilePortfolioTotals(snap).totalFinancialAssetKRW;
    assert.equal(donut, scn.total, `${scn.date} donut`);
    assert.equal(parse, scn.total, `${scn.date} parse`);
    assert.equal(history, scn.total, `${scn.date} history`);
    assert.equal(kpi, scn.total, `${scn.date} kpi`);
  }
});

// ---- 월별 자산 추이: 각 월 대표 스냅샷의 스택 합계가 그 달 권위 총자산과 일치 ----------
check("[월별 추이] 각 월 스택 합계가 그 달 대표 스냅샷의 권위 총자산과 일치(100만원미만 숨김분 제외)", () => {
  const { series, points } = buildPortfolioAssetTrend(snapshots);
  assert.ok(points.length >= 1, "월별 추이 포인트가 있어야 한다");
  for (const point of points) {
    const stackTotal = series.reduce((acc, s) => acc + (point[s.key] || 0), 0);
    const rep = snapshots
      .filter((s) => s.snapshotDate.slice(0, 7) === point.monthKey)
      .sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1))[0];
    const authoritativeTotal = getAuthoritativeTotalAssetsKRW(rep);
    assert.ok(
      authoritativeTotal - stackTotal <= 1_000_000 && stackTotal <= authoritativeTotal + 1,
      `월 ${point.monthKey} 스택합=${stackTotal} vs 권위=${authoritativeTotal}`,
    );
  }
});

// ---- 회귀: totalAssetKRW 도 0/없음인 진짜 빈 스냅샷은 여전히 자가합산(anchor off) ------
check("[regression] totalAssetKRW=0 & 권위 합계 없음 → null 반환(자가합산 유지)", () => {
  const empty = {
    id: "empty",
    snapshotDate: "2025-01-01",
    sourceFileName: "empty.xlsx",
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
  };
  assert.equal(getAuthoritativeTotalAssetsKRW(empty), null);
  const { totalKRW } = buildAssetAllocationFromSnapshotLike(
    { holdings: empty.holdings, financeAssets: empty.financeAssets },
    { authoritativeTotalAssetsKRW: getAuthoritativeTotalAssetsKRW(empty) },
  );
  assert.equal(totalKRW, 15_000_000, `빈 스냅샷 자가합산 total=${totalKRW}`);
});

console.log(`\nAll ${passed} portfolio-past-snapshot-total-unification checks passed.`);
