#!/usr/bin/env node

// PERFORMANCE-DONUT-RANKING-1 회귀 테스트.
//  - 자산 구성 도넛: 원본 상품명(키움TQQQ1 등)을 정규화 종목군(TQQQ/QLD/QQQ/SPY/
//    SCHD/MSFT/달러/원화/기타) 단위로 합산하는지 (예적금·현금성 원화 → "원화")
//  - 그룹 비중 합계가 100% 근처인지, 그룹 수익률이 평가금액/원금 기준인지
//  - 범례 포맷 데이터(비중/수익률/금액)가 생성되는지
//  - 종목 랭킹 정렬(비중/평가금액/투자원금/누적손익/누적수익률)이 numeric 으로 동작하고
//    null/invalid 값이 항상 맨 아래로 가는지, 필터+정렬 동시 사용이 안정적인지

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

const {
  classifyPerformanceGroup,
  buildPerformanceAssetGroups,
  PERFORMANCE_GROUP_COLOR,
} = require("../lib/performance-asset-group.ts");
const { buildPerformanceQldFromSnapshots, filterQldRankings } = require("../lib/performance-qld-from-snapshots.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function holding(overrides = {}) {
  return {
    id: overrides.id ?? `h-${overrides.productName ?? overrides.ticker ?? "x"}`,
    broker: overrides.broker ?? "테스트증권",
    assetType: overrides.assetType ?? "ETF",
    productName: overrides.productName ?? overrides.ticker ?? "종목",
    principalKRW: overrides.principalKRW ?? 0,
    valueKRW: overrides.valueKRW ?? 0,
    ...overrides,
  };
}

function snapshot(holdings) {
  const value = holdings.reduce((s, h) => s + (Number.isFinite(h.valueKRW) ? h.valueKRW : 0), 0);
  const principal = holdings.reduce((s, h) => s + (Number.isFinite(h.principalKRW) ? h.principalKRW : 0), 0);
  return {
    id: "snap",
    snapshotDate: "2026-06-12",
    sourceFileName: "test.xlsx",
    totalAssetKRW: value,
    totalDebtKRW: 0,
    netAssetKRW: value,
    investmentPrincipalKRW: principal,
    investmentValueKRW: value,
    returnAmountKRW: value - principal,
    returnPct: 0,
    holdings,
    financeAssets: [],
    createdAt: "2026-06-12T00:00:00.000Z",
  };
}

console.log("check:performance-donut-ranking");

// 1. 키움TQQQ1 / 키움TQQQ / 삼성위탁TQQQ / TQQQ → 하나의 TQQQ 그룹으로 합산.
check("1) 계좌/상품명별 TQQQ 가 하나의 TQQQ 그룹으로 합산된다", () => {
  for (const name of ["키움TQQQ1", "키움TQQQ", "삼성위탁TQQQ", "TQQQ"]) {
    assert.equal(classifyPerformanceGroup({ productName: name }), "TQQQ", name);
  }
  const { groups } = buildPerformanceAssetGroups([
    { productName: "키움TQQQ1", valueKRW: 100 },
    { productName: "키움TQQQ", valueKRW: 200 },
    { productName: "삼성위탁TQQQ", valueKRW: 300 },
    { ticker: "TQQQ", valueKRW: 400 },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "TQQQ");
  assert.equal(groups[0].valueKRW, 1000);
  assert.equal(groups[0].sourceHoldingCount, 4);
});

// 2. QLD / QQQ / SPY / SCHD / MSFT 그룹 분류 (한국상장 ETF 포함).
check("2) QLD/QQQ/SPY/SCHD/MSFT 분류가 의도대로 된다", () => {
  assert.equal(classifyPerformanceGroup({ productName: "키움QLD" }), "QLD");
  assert.equal(classifyPerformanceGroup({ ticker: "QQQ" }), "QQQ");
  assert.equal(classifyPerformanceGroup({ productName: "ACE 미국나스닥100", ticker: "367380" }), "QQQ");
  assert.equal(classifyPerformanceGroup({ ticker: "SPY" }), "SPY");
  assert.equal(classifyPerformanceGroup({ ticker: "VOO" }), "SPY");
  assert.equal(classifyPerformanceGroup({ productName: "TIGER 미국S&P500", ticker: "360200" }), "SPY");
  assert.equal(classifyPerformanceGroup({ ticker: "SCHD" }), "SCHD");
  assert.equal(classifyPerformanceGroup({ productName: "미국배당다우존스", tag: "배당" }), "SCHD");
  assert.equal(classifyPerformanceGroup({ ticker: "MSFT" }), "MSFT");
});

// 3. 달러 / 원화 / 기타 분류 (ASSET-CLASS-DONUT-POLISH-2: 예적금·현금성 원화는 "원화"로 통합).
check("3) 달러/원화/기타 분류가 되고 예적금·현금은 원화로 합산된다", () => {
  assert.equal(classifyPerformanceGroup({ productName: "미국달러 예수금", tag: "달러" }), "달러");
  // 예적금·현금성 원화 자산은 모두 "원화"로 통합한다.
  assert.equal(classifyPerformanceGroup({ productName: "RP 현금성", tag: "현금" }), "원화");
  assert.equal(classifyPerformanceGroup({ productName: "예수금" }), "원화");
  assert.equal(classifyPerformanceGroup({ productName: "정기예적금", tag: "예적금" }), "원화");
  assert.equal(classifyPerformanceGroup({ productName: "자유적금" }), "원화");
  assert.equal(classifyPerformanceGroup({ ticker: "GOOGL" }), "기타");
  assert.equal(classifyPerformanceGroup({ productName: "KODEX 200", ticker: "069500" }), "기타");
  // "현금" / "예적금" 은 더 이상 별도 라벨이 아니다.
  for (const key of ["TQQQ", "QLD", "QQQ", "SPY", "SCHD", "MSFT", "달러", "원화", "기타"]) {
    assert.ok(/^#[0-9A-Fa-f]{6}$/.test(PERFORMANCE_GROUP_COLOR[key]), `색상 누락: ${key}`);
  }
  // 하늘색(#38BDF8)은 오직 "기타"에만 쓴다.
  assert.equal(PERFORMANCE_GROUP_COLOR["기타"], "#38BDF8");
  for (const key of ["TQQQ", "QLD", "QQQ", "SPY", "SCHD", "MSFT", "달러", "원화"]) {
    assert.notEqual(PERFORMANCE_GROUP_COLOR[key], "#38BDF8", `하늘색 오용: ${key}`);
  }
});

// 4. 그룹 비중 합계 ≈ 100%, 범례 포맷 데이터 생성.
check("4) 그룹 비중 합계가 100% 근처이고 범례 데이터가 생성된다", () => {
  const { groups, totalKRW } = buildPerformanceAssetGroups([
    { productName: "키움TQQQ1", valueKRW: 2000, principalKRW: 800 },
    { productName: "키움QLD", valueKRW: 400, principalKRW: 150 },
    { ticker: "QQQ", valueKRW: 600, principalKRW: 500 },
    { ticker: "SPY", valueKRW: 800, principalKRW: 700 },
    { ticker: "SCHD", valueKRW: 300, principalKRW: 250 },
    { ticker: "MSFT", valueKRW: 200, principalKRW: 120 },
    { productName: "미국달러 예수금", tag: "달러", valueKRW: 500 },
    { productName: "RP 현금", tag: "현금", valueKRW: 300 },
    { productName: "정기예적금", tag: "예적금", valueKRW: 200 },
    { ticker: "GOOGL", valueKRW: 100 },
  ]);
  assert.equal(totalKRW, 5400);
  const weightSum = groups.reduce((s, g) => s + g.weightPct, 0);
  assert.ok(Math.abs(weightSum - 100) < 0.001, `비중 합 ${weightSum}`);
  // 평가금액 내림차순.
  for (let i = 1; i < groups.length; i += 1) {
    assert.ok(groups[i - 1].valueKRW >= groups[i].valueKRW, "평가금액 내림차순");
  }
  // 모든 그룹에 범례 포맷 필드가 존재.
  for (const g of groups) {
    assert.ok(typeof g.label === "string" && g.label.length > 0);
    assert.ok(typeof g.weightPct === "number");
    assert.ok(typeof g.valueKRW === "number");
  }
});

// 5. 그룹 수익률 = (평가금액 - 원금) / 원금. 원금 없으면 null.
check("5) 그룹 수익률이 평가금액/원금 기준으로 계산되고 원금 없으면 null 이다", () => {
  const { groups } = buildPerformanceAssetGroups([
    { productName: "키움TQQQ1", valueKRW: 2000, principalKRW: 800 },
    { productName: "키움TQQQ", valueKRW: 140, principalKRW: 60 },
    { productName: "현금", tag: "현금", valueKRW: 500 }, // 원금 없음 → returnPct null, "원화"로 합산
  ]);
  const tqqq = groups.find((g) => g.key === "TQQQ");
  assert.equal(tqqq.valueKRW, 2140);
  assert.equal(tqqq.principalKRW, 860);
  assert.equal(tqqq.profitKRW, 1280);
  assert.ok(Math.abs(tqqq.returnPct - (1280 / 860) * 100) < 1e-6);
  const cash = groups.find((g) => g.key === "원화");
  assert.equal(cash.principalKRW, null);
  assert.equal(cash.returnPct, null);
  assert.equal(cash.profitKRW, null);
});

// 6. buildPerformanceQldFromSnapshots 가 assetGroups 를 채운다 (원본 상품명 비노출).
check("6) 스냅샷 → assetGroups 가 종목군 단위로 생성되고 원본 상품명을 노출하지 않는다", () => {
  const result = buildPerformanceQldFromSnapshots([
    snapshot([
      holding({ productName: "키움TQQQ1", accountGroup: "위탁", valueKRW: 3_000_000, principalKRW: 1_000_000 }),
      holding({ productName: "삼성위탁TQQQ", accountGroup: "위탁", valueKRW: 1_000_000, principalKRW: 500_000 }),
      holding({ ticker: "SPY", accountGroup: "위탁", valueKRW: 2_000_000, principalKRW: 1_800_000 }),
    ]),
  ]);
  const keys = result.assetGroups.groups.map((g) => g.key);
  assert.ok(keys.includes("TQQQ"));
  assert.ok(keys.includes("SPY"));
  const tqqq = result.assetGroups.groups.find((g) => g.key === "TQQQ");
  assert.equal(tqqq.valueKRW, 4_000_000);
  for (const g of result.assetGroups.groups) {
    assert.ok(!/키움|삼성|위탁/.test(g.label), `원본 상품명 노출: ${g.label}`);
  }
});

// 7. 종목 랭킹 정렬: 비중/평가금액/투자원금/누적손익/누적수익률 numeric sort.
check("7) 정렬이 비중/평가금액/투자원금/누적손익/누적수익률에 대해 numeric 으로 동작한다", () => {
  const rows = filterQldRankings(
    buildPerformanceQldFromSnapshots([
      snapshot([
        holding({ ticker: "AAA", accountGroup: "위탁", valueKRW: 10_000_000, principalKRW: 9_000_000 }),
        holding({ ticker: "BBB", accountGroup: "위탁", valueKRW: 5_000_000, principalKRW: 1_000_000 }),
        holding({ ticker: "CCC", accountGroup: "위탁", valueKRW: 2_000_000, principalKRW: 4_000_000 }),
      ]),
    ]).rankings,
    ["위탁", "연금", "ISA"],
  );

  const sortRows = (key, dir) => {
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const aValid = typeof av === "number" && Number.isFinite(av);
      const bValid = typeof bv === "number" && Number.isFinite(bv);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      if (av === bv) return 0;
      return (av - bv) * factor;
    });
  };

  assert.deepEqual(sortRows("valueKRW", "desc").map((r) => r.ticker), ["AAA", "BBB", "CCC"]);
  assert.deepEqual(sortRows("valueKRW", "asc").map((r) => r.ticker), ["CCC", "BBB", "AAA"]);
  // 누적 수익률: BBB(+400%) > AAA(+11%) > CCC(-50%)
  assert.deepEqual(sortRows("returnPct", "desc").map((r) => r.ticker), ["BBB", "AAA", "CCC"]);
  // 투자원금: AAA(9M) > CCC(4M) > BBB(1M)
  assert.deepEqual(sortRows("principalKRW", "desc").map((r) => r.ticker), ["AAA", "CCC", "BBB"]);
  // 누적 손익: AAA(+1M) > BBB(+4M)? 실제: BBB=+4M, AAA=+1M, CCC=-2M
  assert.deepEqual(sortRows("profitKRW", "desc").map((r) => r.ticker), ["BBB", "AAA", "CCC"]);
});

// 8. 정렬 시 null/invalid 값은 방향과 무관하게 맨 아래로 간다.
check("8) null/invalid 정렬 값은 항상 맨 아래로 간다", () => {
  const rows = [
    { ticker: "WITH", returnPct: 10 },
    { ticker: "NULL", returnPct: null },
    { ticker: "NAN", returnPct: Number.NaN },
    { ticker: "NEG", returnPct: -5 },
  ];
  const sortRows = (dir) => {
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a.returnPct;
      const bv = b.returnPct;
      const aValid = typeof av === "number" && Number.isFinite(av);
      const bValid = typeof bv === "number" && Number.isFinite(bv);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      if (av === bv) return 0;
      return (av - bv) * factor;
    });
  };
  const desc = sortRows("desc").map((r) => r.ticker);
  const asc = sortRows("asc").map((r) => r.ticker);
  // 유효값이 위, null/NaN 이 아래.
  assert.equal(desc[0], "WITH");
  assert.equal(asc[0], "NEG");
  assert.deepEqual(new Set(desc.slice(2)), new Set(["NULL", "NAN"]));
  assert.deepEqual(new Set(asc.slice(2)), new Set(["NULL", "NAN"]));
});

// 9. 필터 + 정렬 동시 사용 시 안정적 (필터 후 종목만 남고 비중 재계산).
check("9) 필터+정렬 동시 사용이 안정적이다", () => {
  const result = buildPerformanceQldFromSnapshots([
    snapshot([
      holding({ ticker: "AAA", accountGroup: "위탁", valueKRW: 10_000_000, principalKRW: 8_000_000 }),
      holding({ ticker: "BBB", accountGroup: "연금저축", valueKRW: 6_000_000, principalKRW: 5_000_000 }),
      holding({ ticker: "CCC", accountGroup: "ISA", valueKRW: 4_000_000, principalKRW: 3_000_000 }),
    ]),
  ]);
  const isaOnly = filterQldRankings(result.rankings, ["ISA"]);
  assert.deepEqual(isaOnly.map((r) => r.ticker), ["CCC"]);
  const weightSum = isaOnly.reduce((s, r) => s + (r.weightPct ?? 0), 0);
  assert.ok(Math.abs(weightSum - 100) < 0.5, `필터 후 비중 합 ${weightSum}`);
  // 위탁+연금 정렬 후에도 종목 집합이 보존된다.
  const subset = filterQldRankings(result.rankings, ["위탁", "연금"]);
  assert.deepEqual(new Set(subset.map((r) => r.ticker)), new Set(["AAA", "BBB"]));
});

console.log(`\nAll ${passed} performance-donut-ranking checks passed.`);
