#!/usr/bin/env node

// =============================================================
// ACCOUNT-CARD-MIN-VISIBILITY-1 verification.
//
// Requirements 8–11:
//   - Account cards must NOT be created for accounts whose evaluated value is
//     under 100만원 (1,000,000) — restoring the pre-Firestore UX.
//   - This is display-only: 총자산 / 계좌 합계 / 차트 / 파싱 / Firestore 데이터 /
//     계산식 / 수익률 must not change.
//   - The 100만원 hide must be applied AFTER account grouping.
//
// This script proves:
//   1) Processing order in buildPortfolioAccountReturnRows is GROUP -> FILTER:
//      same-account rows are summed first, then the 20만원 (data-layer) minimum
//      is applied to the grouped total.
//   2) The data layer threshold stays at 200,000 (so the 계좌별 비중 chart and
//      every calculation are byte-for-byte unchanged).
//   3) The new card threshold is 1,000,000 and hides sub-1M accounts, while the
//      rows themselves remain in the data layer (display-only).
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

const { MIN_VISIBLE_ACCOUNT_AMOUNT_KRW } = require("../lib/portfolio-account-returns.ts");
const { buildPortfolioPageFromSnapshot } = require("../lib/portfolio-from-snapshots.ts");
const {
  MIN_VISIBLE_ACCOUNT_CARD_AMOUNT_KRW,
  isVisibleAccountCard,
  selectVisibleAccountCards,
} = require("../lib/account-card-visibility.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function financeAsset(accountGroup, amountKRW, id) {
  return {
    id,
    groupName: accountGroup,
    productName: accountGroup,
    amountKRW,
    accountGroup,
    category: "현금",
  };
}

console.log("check:account-card-visibility");

check("data layer minimum stays 20만원 (chart/계산 unchanged) and card minimum is 100만원", () => {
  assert.equal(MIN_VISIBLE_ACCOUNT_AMOUNT_KRW, 200_000);
  assert.equal(MIN_VISIBLE_ACCOUNT_CARD_AMOUNT_KRW, 1_000_000);
});

// Snapshot: financeAssets drive account values (useFinanceValues = true).
const snapshot = {
  id: "2026-06-29",
  snapshotDate: "2026-06-29",
  holdings: [],
  financeAssets: [
    financeAsset("위탁A", 1_500_000, "f1"), // grouped 1.5M  -> data row + visible card
    financeAsset("입출금B", 500_000, "f2"), // grouped 500k  -> data row, but card hidden (<1M)
    financeAsset("연금C", 600_000, "f3"), // }
    financeAsset("연금C", 600_000, "f4"), // } grouped 1.2M -> proves group BEFORE filter
    financeAsset("소액D", 150_000, "f5"), // grouped 150k  -> dropped by data layer (<200k)
  ],
};

// `accountCards` is exactly what AssetAccountCards receives (PortfolioAccountRow[]
// with `.value`), produced via buildAccountRowsFromSnapshot -> buildPortfolioAccountReturnRows.
const model = buildPortfolioPageFromSnapshot(snapshot);
const cards = model.accountCards;
const byLabel = new Map(cards.map((r) => [r.name, r]));

check("order is GROUP -> FILTER: same-account rows summed, then 20만원 minimum on the grouped total", () => {
  // 연금C is two 600k rows summed to 1.2M (grouping happened before any filter).
  assert.ok(byLabel.has("연금C"), "연금C account row must exist");
  assert.equal(byLabel.get("연금C").value, 1_200_000);
  // 소액D grouped total 150k < 200k -> excluded by the data-layer minimum.
  assert.ok(!byLabel.has("소액D"), "소액D (<20만원 grouped) must be filtered out by data layer");
  assert.equal(model.accountAllocationSource, "financeAssets");
});

check("data layer keeps 20만원~100만원 accounts (display-only: 계산식이 이 계좌를 본다)", () => {
  // 입출금B (500k) passes the 20만원 data-layer minimum and remains in the rows
  // (calculations/account returns see it). The card is what gets hidden.
  assert.ok(byLabel.has("입출금B"), "입출금B must remain in data-layer rows");
  assert.equal(byLabel.get("입출금B").value, 500_000);
  // The 계좌별 비중 chart already filters at the 1M chart-amount minimum, so it
  // never showed 입출금B — i.e. the chart is unchanged by this fix (and the
  // cards now match the chart's existing 100만원 behavior).
  assert.ok(
    !model.accountAllocation.some((slice) => slice.name === "입출금B"),
    "accountAllocation chart already excludes the sub-1M account (chart unchanged)",
  );
});

check("card visibility hides sub-100만원 accounts AFTER grouping", () => {
  assert.equal(isVisibleAccountCard(byLabel.get("위탁A")), true); // 1.5M
  assert.equal(isVisibleAccountCard(byLabel.get("입출금B")), false); // 500k -> hidden
  assert.equal(isVisibleAccountCard(byLabel.get("연금C")), true); // grouped 1.2M -> shown
});

check("selectVisibleAccountCards hides the small card but does NOT mutate data rows", () => {
  const visible = selectVisibleAccountCards(cards);
  const visibleLabels = visible.map((r) => r.name).sort();
  assert.deepEqual(visibleLabels, ["연금C", "위탁A"]);
  // Original card rows untouched (input array preserved) — display-only.
  assert.ok(cards.some((r) => r.name === "입출금B"), "data rows must still contain 입출금B");
  assert.equal(cards.length, 3); // 위탁A, 입출금B, 연금C
});

check("group 합계 basis is unaffected by hiding (sum still includes the hidden 입출금B)", () => {
  // 계좌 합계(=display group subtotal) is computed from the full received rows
  // in the component; here we assert the data total that backs it is unchanged.
  const fullSum = cards.reduce((sum, r) => sum + (r.value ?? 0), 0);
  // 1.5M + 0.5M + 1.2M = 3.2M (hidden 입출금B's 0.5M is still part of the total).
  assert.equal(fullSum, 3_200_000);
  const visibleSum = selectVisibleAccountCards(cards).reduce((s, r) => s + r.value, 0);
  assert.ok(fullSum > visibleSum, "hiding cards must not be achieved by dropping the value from totals");
});

console.log(`\nAll ${passed} account-card-visibility checks passed.`);
