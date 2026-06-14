#!/usr/bin/env node

// PORTFOLIO-CALCULATOR-UX-FIX-2 회귀 테스트.
// - 20만원 미만 계좌 숨김 (#2)
// - 자산 구성이 성장/배당/현금 3개로만 분류 (#3)
// - 보유종목 트리맵 최상위 그룹이 위탁/절세만 (#4)
// - 금액 formatter 가 원화 기호와 숫자를 NBSP 로 붙여 줄바꿈을 막음 (#5)

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

const { buildPortfolioPageFromSnapshot, MIN_VISIBLE_ACCOUNT_AMOUNT_KRW } = require("../lib/portfolio-from-snapshots.ts");
const { formatWon, formatWonSigned } = require("../lib/format.ts");

const WON = "₩";
const NBSP = " ";

function holding(overrides = {}) {
  return {
    id: overrides.id ?? `h-${overrides.productName ?? "x"}`,
    broker: overrides.broker ?? "테스트증권",
    assetType: overrides.assetType ?? "ETF",
    productName: overrides.productName ?? "테스트 ETF",
    principalKRW: overrides.principalKRW ?? 1_000_000,
    valueKRW: overrides.valueKRW ?? 1_100_000,
    ...overrides,
  };
}

function financeAsset(overrides = {}) {
  return {
    id: overrides.id ?? `fa-${overrides.productName ?? "x"}`,
    groupName: overrides.groupName ?? "자유입출금 자산",
    productName: overrides.productName ?? "테스트 통장",
    amountKRW: overrides.amountKRW ?? 500_000,
    category: overrides.category ?? "현금",
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  const holdings = overrides.holdings ?? [];
  const financeAssets = overrides.financeAssets ?? [];
  return {
    id: "snap",
    snapshotDate: "2026-06-12",
    sourceFileName: "test.xlsx",
    totalAssetKRW: overrides.totalAssetKRW ?? 100_000_000,
    totalDebtKRW: 0,
    netAssetKRW: 100_000_000,
    investmentPrincipalKRW: overrides.investmentPrincipalKRW ?? 0,
    investmentValueKRW: overrides.investmentValueKRW ?? 0,
    returnAmountKRW: 0,
    returnPct: 0,
    holdings,
    financeAssets,
    createdAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

function assertSmallAccountHidden() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      financeAssets: [
        financeAsset({ productName: "큰 통장", accountGroup: "위탁", amountKRW: 5_000_000 }),
        financeAsset({ productName: "소액 통장", accountGroup: "미확인", amountKRW: 11_111 }),
      ],
    }),
  );
  assert.equal(MIN_VISIBLE_ACCOUNT_AMOUNT_KRW, 200_000);
  const names = result.accountCards.map((c) => c.name);
  assert.ok(names.includes("위탁"), "큰 계좌는 표시되어야 한다");
  assert.ok(!names.includes("미확인"), "20만원 미만 계좌는 숨겨야 한다");
  const allocTotal = result.accountAllocation.reduce((sum, s) => sum + s.value, 0);
  assert.ok(Math.abs(allocTotal - 100) < 0.5, `표시 계좌 비중 합은 100% 여야 한다 (${allocTotal})`);
  return { case: "20만원 미만 계좌 숨김", visible: names.length };
}

function assertAssetAllocationGroups() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      holdings: [
        holding({ productName: "성장주", ticker: "QQQ", purposeGroup: "성장", valueKRW: 10_000_000 }),
        holding({ productName: "배당주", ticker: "SCHD", purposeGroup: "배당", valueKRW: 5_000_000 }),
        holding({ productName: "달러 예수금", ticker: "USD", assetType: "현금성", category: "현금", valueKRW: 3_000_000 }),
      ],
      financeAssets: [financeAsset({ productName: "파킹통장", amountKRW: 2_000_000, category: "현금" })],
    }),
  );
  const labels = result.assetAllocation.map((s) => s.name).sort();
  const allowed = new Set(["성장", "배당", "현금"]);
  for (const label of labels) {
    assert.ok(allowed.has(label), `자산 구성 라벨은 성장/배당/현금만 허용 (받은 값: ${label})`);
  }
  assert.ok(!labels.includes("기타"), "기타 그룹은 만들지 않는다");
  assert.ok(!labels.includes("주식") && !labels.includes("예적금"), "주식/예적금 라벨은 노출되지 않는다");
  return { case: "자산 구성 성장/배당/현금", labels: labels.join("/") };
}

function assertTreemapGroups() {
  const result = buildPortfolioPageFromSnapshot(
    snapshot({
      holdings: [
        holding({ productName: "위탁 성장주", accountGroup: "일반위탁", ticker: "QQQ", valueKRW: 10_000_000 }),
        holding({ productName: "ISA 배당주", accountGroup: "ISA", ticker: "SCHD", valueKRW: 5_000_000 }),
        holding({ productName: "연금 종목", accountGroup: "연금저축", ticker: "VOO", valueKRW: 4_000_000 }),
        holding({ productName: "분류 불명 종목", accountGroup: "", ticker: "ZZZ", valueKRW: 3_000_000 }),
      ],
    }),
  );
  const groups = new Set(result.treemapItems.map((i) => i.group));
  for (const group of groups) {
    assert.ok(group === "위탁" || group === "절세", `트리맵 그룹은 위탁/절세만 허용 (받은 값: ${group})`);
  }
  const byTicker = Object.fromEntries(result.treemapItems.map((i) => [i.ticker, i.group]));
  assert.equal(byTicker.SCHD, "절세");
  assert.equal(byTicker.VOO, "절세");
  assert.equal(byTicker.QQQ, "위탁");
  assert.equal(byTicker.ZZZ, "위탁", "분류 불명 종목은 위탁으로 기본 분류");
  return { case: "트리맵 위탁/절세", groups: Array.from(groups).join("/") };
}

function assertMoneyNoWrap() {
  const wonNbspDigit = new RegExp(`${WON}${NBSP}\\d`);
  for (const value of [178_000_000, 492_431_052, 583_108_674, 1_234_567_890]) {
    const won = formatWon(value);
    assert.ok(won.includes(WON + NBSP), `formatWon 은 ₩+NBSP 를 포함해야 한다: ${JSON.stringify(won)}`);
    assert.ok(!won.includes(WON + " "), "formatWon 은 ₩ 뒤에 일반 공백을 쓰면 안 된다");
    assert.ok(wonNbspDigit.test(won), "원화 기호 다음 숫자가 NBSP 로 붙어야 한다");
  }
  const signed = formatWonSigned(-583_108_674);
  assert.ok(signed.includes(WON + NBSP) && !signed.includes(WON + " "), "formatWonSigned 도 NBSP 사용");
  return { case: "금액 줄바꿈 방지(NBSP)", sample: JSON.stringify(formatWon(178_000_000)) };
}

function main() {
  const rows = [
    assertSmallAccountHidden(),
    assertAssetAllocationGroups(),
    assertTreemapGroups(),
    assertMoneyNoWrap(),
  ];
  console.log("Portfolio UX rules regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("Portfolio UX rules regression failed.");
  console.error(error);
  process.exit(1);
}
