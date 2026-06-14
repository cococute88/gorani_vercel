#!/usr/bin/env node

// PORTFOLIO-CALCULATOR-UX-FIX-2 #6 회귀 테스트.
// - 요약 preview 는 Top 5 만, 상세 종목 랭킹은 Top 제한 없이 전체 rows 를 생성하는지
// - 위탁/연금/ISA 계좌 분류가 동작하는지
// - 위탁/연금/ISA 필터가 상세 랭킹 평가금액만 올바르게 재집계하는지

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
  buildPerformanceQldFromSnapshots,
  filterQldRankings,
  classifyPerformanceAccountType,
} = require("../lib/performance-qld-from-snapshots.ts");

function holding(overrides = {}) {
  return {
    id: overrides.id ?? `h-${overrides.ticker ?? "x"}-${overrides.accountGroup ?? ""}`,
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

function assertAccountTypeClassification() {
  assert.equal(classifyPerformanceAccountType(holding({ accountGroup: "키움 ISA" })), "ISA");
  assert.equal(classifyPerformanceAccountType(holding({ accountGroup: "연금저축펀드" })), "연금");
  assert.equal(classifyPerformanceAccountType(holding({ accountGroup: "IRP 계좌" })), "연금");
  assert.equal(classifyPerformanceAccountType(holding({ accountGroup: "일반위탁" })), "위탁");
  assert.equal(classifyPerformanceAccountType(holding({ accountGroup: "" })), "위탁");
  return { case: "계좌 유형 분류", ok: true };
}

function assertSummaryTop5AndFullRanking() {
  // 12개 종목 → summary preview 는 전체 기준 Top 5, 상세 랭킹은 12개 모두 반환되어야 한다.
  const holdings = Array.from({ length: 12 }, (_, i) =>
    holding({ ticker: `T${i}`, accountGroup: "위탁", valueKRW: (12 - i) * 1_000_000, principalKRW: 1_000_000 }),
  );
  const result = buildPerformanceQldFromSnapshots([snapshot(holdings)]);
  assert.equal(result.topHoldings.length, 5, "요약 preview 는 Top 5 만 포함해야 한다");
  assert.equal(result.rankings.length, 12, "전체 12개 종목이 랭킹에 포함되어야 한다");
  assert.deepEqual(
    result.topHoldings.map((r) => r.ticker),
    result.rankings.slice(0, 5).map((r) => r.ticker),
    "요약 Top 5 는 상세 랭킹의 전체 기준 평가금액순 상위 5개여야 한다",
  );
  // 평가금액순 정렬 확인.
  for (let i = 1; i < result.rankings.length; i += 1) {
    assert.ok(result.rankings[i - 1].valueKRW >= result.rankings[i].valueKRW, "평가금액 내림차순이어야 한다");
  }
  return { case: "요약 Top5 + 전체 랭킹", summaryCount: result.topHoldings.length, rankingCount: result.rankings.length };
}

function assertFilters() {
  const holdings = [
    holding({ ticker: "AAA", accountGroup: "위탁", valueKRW: 10_000_000, principalKRW: 8_000_000 }),
    holding({ ticker: "BBB", accountGroup: "연금저축", valueKRW: 6_000_000, principalKRW: 5_000_000 }),
    holding({ ticker: "CCC", accountGroup: "ISA", valueKRW: 4_000_000, principalKRW: 3_000_000 }),
    // 동일 티커가 위탁과 ISA 양쪽에 존재 → 필터에 따라 평가금액이 달라져야 한다.
    holding({ ticker: "DDD", accountGroup: "위탁", valueKRW: 2_000_000, principalKRW: 1_500_000 }),
    holding({ ticker: "DDD", accountGroup: "ISA", valueKRW: 1_000_000, principalKRW: 900_000 }),
  ];
  const result = buildPerformanceQldFromSnapshots([snapshot(holdings)]);
  const summaryBeforeFilter = result.topHoldings.map((r) => `${r.ticker}:${r.valueKRW}`);

  const all = filterQldRankings(result.rankings, ["위탁", "연금", "ISA"]);
  const allTickers = all.map((r) => r.ticker).sort();
  assert.deepEqual(allTickers, ["AAA", "BBB", "CCC", "DDD"], "전체 선택 시 4개 종목");
  const dddAll = all.find((r) => r.ticker === "DDD");
  assert.equal(dddAll.valueKRW, 3_000_000, "DDD 전체 평가금액 = 위탁+ISA");

  const isaOnly = filterQldRankings(result.rankings, ["ISA"]);
  const isaTickers = isaOnly.map((r) => r.ticker).sort();
  assert.deepEqual(isaTickers, ["CCC", "DDD"], "ISA 만 선택 시 ISA 소속 종목만");
  assert.equal(isaOnly.find((r) => r.ticker === "DDD").valueKRW, 1_000_000, "ISA 선택 시 DDD 는 ISA 분만");

  const isaPension = filterQldRankings(result.rankings, ["ISA", "연금"]);
  const ipTickers = isaPension.map((r) => r.ticker).sort();
  assert.deepEqual(ipTickers, ["BBB", "CCC", "DDD"], "ISA+연금 선택 시 위탁 전용(AAA) 제외");

  const brokerageOnly = filterQldRankings(result.rankings, ["위탁"]);
  assert.ok(!brokerageOnly.some((r) => r.ticker === "BBB" || r.ticker === "CCC"), "위탁만 선택 시 연금/ISA 전용 제외");
  assert.equal(brokerageOnly.find((r) => r.ticker === "DDD").valueKRW, 2_000_000, "위탁 선택 시 DDD 는 위탁 분만");
  assert.deepEqual(
    result.topHoldings.map((r) => `${r.ticker}:${r.valueKRW}`),
    summaryBeforeFilter,
    "계좌 필터는 상세 랭킹 재집계에만 적용되고 요약 Top 5 데이터는 변경하지 않아야 한다",
  );
  assert.deepEqual(
    result.topHoldings.map((r) => r.ticker),
    ["AAA", "BBB", "CCC", "DDD"],
    "요약 Top 5 는 필터와 무관하게 전체 기준 평가금액순이어야 한다",
  );

  // 비중은 필터된 합계 기준으로 재계산되어 합이 100% 에 수렴한다.
  const weightSum = isaOnly.reduce((s, r) => s + (r.weightPct ?? 0), 0);
  assert.ok(Math.abs(weightSum - 100) < 0.5, `필터 후 비중 합 100% (${weightSum})`);

  return { case: "위탁/연금/ISA 필터", allCount: all.length, isaCount: isaOnly.length };
}

function main() {
  const rows = [assertAccountTypeClassification(), assertSummaryTop5AndFullRanking(), assertFilters()];
  console.log("Performance ranking filters regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("Performance ranking filters regression failed.");
  console.error(error);
  process.exit(1);
}
