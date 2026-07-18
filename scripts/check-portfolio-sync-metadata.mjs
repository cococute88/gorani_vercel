#!/usr/bin/env node

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

const { mapPortfolioSnapshotRecordToViewModel } = require("../lib/firestore/snapshot-viewmodel.ts");
const { buildPortfolioAccountReturnRows } = require("../lib/portfolio-account-returns.ts");
const {
  mergePortfolioSnapshotMetadata,
  normalizePortfolioSnapshotMetadata,
} = require("../lib/portfolio-snapshot-metadata.ts");
const { guessTicker } = require("../lib/ticker-mapper.ts");

function record(holdings, financeAssets = []) {
  const investment = holdings.reduce((sum, row) => sum + row.amount_krw, 0);
  return {
    id: "2026-07-14",
    data: {
      document_version: "1.1.0",
      snapshot: {
        current_snapshot: {
          snapshot_date: "2026-07-14",
          total_assets_krw: investment,
          total_investments_krw: investment,
          investment_principal_krw: investment,
          return_amount_krw: 0,
          return_pct: 0,
          total_cash_krw: 0,
          total_debt_krw: 0,
          net_worth_krw: investment,
        },
        investment_status: holdings,
        financial_status: financeAssets,
      },
    },
  };
}

const rows = [
  { product_name: "키움TQQQ1 ①TQQQ ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 10 },
  { product_name: "키움TQQQ3 ①TQQQ ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 20 },
  { product_name: "키움QLD ①QLD ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 30 },
  { product_name: "QQQ 2배 프로셰어즈 ETF", account_type: "주식", principal_krw: 10_000_000, amount_krw: 13_011_166 },
  { product_name: "키움MSFT ①MSFT ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 40 },
  { product_name: "키움QQQ ①QQQ ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 50 },
  { product_name: "토스QQQM ①QQQ ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 60 },
  { product_name: "토스SPYM ①SPY ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 70 },
  { product_name: "토스QLD ①QLD ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 80 },
  { product_name: "토스VOO ①SPY ②위탁 ③성장 ④위성", account_type: "주식", amount_krw: 90 },
  { product_name: "삼성위탁SCHD ①SCHD ②위탁 ③배당 ④위배", account_type: "주식", amount_krw: 100 },
  { product_name: "ACE 미국S&P500 ①SPY ②연금 ③성장 ④연금", ticker: "360200.KS", account_type: "주식", amount_krw: 110 },
  { product_name: "RISE 미국나스닥100", ticker: "367380.KS", account_type: "주식", amount_krw: 120 },
  { product_name: "KODEX 미국나스닥100", ticker: "368590.KS", account_type: "주식", amount_krw: 130 },
  { product_name: "RISE 미국S&P500", ticker: "379780.KS", account_type: "주식", amount_krw: 140 },
  { product_name: "머니마켓액티브", ticker: "488770.KS", account_type: "펀드", amount_krw: 150 },
];
const finance = rows.map((row) => ({
  product_name: row.product_name,
  amount_krw: row.amount_krw,
  category: "투자성 자산",
}));

const snapshot = mapPortfolioSnapshotRecordToViewModel(record(rows, finance));
const expected = new Map([
  ["키움TQQQ1", "TQQQ"], ["키움TQQQ3", "TQQQ"], ["키움QLD", "QLD"],
  ["QQQ 2배 프로셰어즈 ETF", "QLD"], ["키움MSFT", "MSFT"], ["키움QQQ", "QQQ"],
  ["토스QQQM", "QQQM"], ["토스SPYM", "SPYM"], ["토스QLD", "QLD"],
  ["토스VOO", "VOO"], ["삼성위탁SCHD", "SCHD"], ["ACE 미국S&P500", "360200.KS"],
  ["RISE 미국나스닥100", "367380.KS"],
  ["KODEX 미국나스닥100", "368590.KS"], ["RISE 미국S&P500", "379780.KS"],
  ["머니마켓액티브", "488770.KS"],
]);
for (const holding of snapshot.holdings) {
  assert.equal(holding.ticker, expected.get(holding.cleanName), `ticker mismatch: ${holding.cleanName}`);
}

const qld = snapshot.holdings.find((holding) => holding.cleanName === "QQQ 2배 프로셰어즈 ETF");
assert.equal(qld.accountGroup, "위탁");
assert.ok(Number.isFinite(qld.returnPct), "원금과 평가금액이 있으면 수익률을 복원해야 함");
const qldFinance = snapshot.financeAssets.find((asset) => asset.cleanName === "QQQ 2배 프로셰어즈 ETF");
assert.equal(qldFinance.accountGroup, "위탁");

const accounts = buildPortfolioAccountReturnRows(snapshot);
assert.equal(accounts.rows.some((row) => row.label === "QQQ 2배 프로셰어즈 ETF"), false);
assert.equal(accounts.rows.some((row) => row.label === "위탁" && row.statusGroup === "위탁"), true);

// 기존 정상값 + 신규 빈 값: 정상값 보존. 수동값은 신규 명시 ticker보다 우선한다.
const base = {
  ...snapshot,
  holdings: [{ ...snapshot.holdings[4], id: "same", productName: "수동 종목", cleanName: "수동 종목", ticker: "MSFT", tickerSource: "manual", broker: "키움증권", accountName: "해외주식 위탁", currency: "USD", statusGroup: "위성" }],
  financeAssets: [{ id: "finance-existing", groupName: "", productName: "수동 종목", cleanName: "수동 종목", amountKRW: 1, accountGroup: "위탁", statusGroup: "위성" }],
};
const incomingBlank = {
  ...base,
  snapshotDate: "2026-07-15",
  holdings: [{ ...base.holdings[0], ticker: "   ", tickerSource: undefined, broker: "주식", accountName: undefined, currency: undefined, statusGroup: "주식" }],
  financeAssets: [{ ...base.financeAssets[0], accountGroup: "", statusGroup: "투자성 자산" }],
};
const preserved = mergePortfolioSnapshotMetadata(incomingBlank, [base]);
assert.equal(preserved.holdings[0].ticker, "MSFT");
assert.equal(preserved.holdings[0].broker, "키움증권");
assert.equal(preserved.holdings[0].accountName, "해외주식 위탁");
assert.equal(preserved.holdings[0].currency, "USD");
assert.equal(preserved.holdings[0].statusGroup, "위성");
assert.equal(preserved.financeAssets[0].accountGroup, "위탁");
assert.equal(preserved.financeAssets[0].statusGroup, "위성");

const incomingExplicitAgainstManual = {
  ...incomingBlank,
  holdings: [{ ...incomingBlank.holdings[0], ticker: "AAPL", tickerSource: "explicit" }],
};
assert.equal(mergePortfolioSnapshotMetadata(incomingExplicitAgainstManual, [base]).holdings[0].ticker, "MSFT");

const nonManualBase = {
  ...base,
  holdings: [{ ...base.holdings[0], tickerSource: "existing" }],
};
assert.equal(mergePortfolioSnapshotMetadata(incomingExplicitAgainstManual, [nonManualBase]).holdings[0].ticker, "AAPL");

// 동일 ticker가 서로 다른 실제 계좌에 있으면 계좌 합의를 만들지 않는다.
const ambiguous = normalizePortfolioSnapshotMetadata({
  ...snapshot,
  holdings: [
    { ...qld, id: "taxable", accountGroup: "위탁" },
    { ...qld, id: "isa", accountGroup: "ISA" },
    { ...qld, id: "unknown", productName: "QQQ 2배 프로셰어즈 ETF", cleanName: "QQQ 2배 프로셰어즈 ETF", accountGroup: "주식" },
  ],
  financeAssets: [],
}).snapshot;
assert.equal(ambiguous.holdings.find((holding) => holding.id === "unknown").accountGroup, "주식");

// 단순 유사 문구는 QLD로 오인하지 않는다.
assert.notEqual(guessTicker("QQQ 2배 수익을 목표로 하는 다른 ETN").ticker, "QLD");
assert.notEqual(guessTicker("QQQ 2배 ETF").ticker, "QLD");
assert.notEqual(guessTicker("ProShares Ultra QQQ 수익 추종 ETN").ticker, "QLD");

const koreanProxyOnly = normalizePortfolioSnapshotMetadata({
  ...snapshot,
  holdings: [{
    ...qld,
    id: "korean-proxy-only",
    productName: "KB위탁RISE나스닥 ①QQQ ②위탁 ③성장 ④위성",
    cleanName: "KB위탁RISE나스닥",
    ticker: undefined,
    tickerSource: undefined,
  }],
  financeAssets: [],
}).snapshot.holdings[0];
assert.equal(koreanProxyOnly.ticker, undefined, "국내 ETF 노출 태그 ①QQQ를 미국 상장 ticker로 승격하면 안 됨");

// 같은 입력을 세 번 처리해도 레코드 수/평가금액/결과가 변하지 않는다.
let repeated = snapshot;
const initialCount = repeated.holdings.length;
const initialTotal = repeated.holdings.reduce((sum, holding) => sum + holding.valueKRW, 0);
for (let i = 0; i < 3; i += 1) repeated = normalizePortfolioSnapshotMetadata(repeated).snapshot;
assert.equal(repeated.holdings.length, initialCount);
assert.equal(repeated.holdings.reduce((sum, holding) => sum + holding.valueKRW, 0), initialTotal);
assert.deepEqual(repeated.holdings.map((holding) => [holding.id, holding.ticker, holding.accountGroup]), snapshot.holdings.map((holding) => [holding.id, holding.ticker, holding.accountGroup]));

console.log("portfolio sync metadata regression: PASS", {
  holdings: snapshot.holdings.length,
  qldValueKRW: qld.valueKRW,
  repeatedRuns: 3,
});

if (process.argv.includes("--live")) {
  const response = await fetch("https://gorani-vercel.vercel.app/api/portfolio/latest-snapshot", { cache: "no-store" });
  assert.equal(response.ok, true, `live endpoint failed: ${response.status}`);
  const body = await response.json();
  assert.equal(body.source, "firestore");
  const before = body.snapshot;
  const normalizedLive = normalizePortfolioSnapshotMetadata(before);
  const beforeTotal = before.holdings.reduce((sum, holding) => sum + holding.valueKRW, 0);
  const afterTotal = normalizedLive.snapshot.holdings.reduce((sum, holding) => sum + holding.valueKRW, 0);
  const liveQld = normalizedLive.snapshot.holdings.find((holding) => holding.cleanName === "QQQ 2배 프로셰어즈 ETF");
  assert.equal(liveQld?.ticker, "QLD");
  assert.equal(liveQld?.accountGroup, "위탁");
  assert.equal(afterTotal, beforeTotal);
  console.log("live 2026-07-14 read-only projection: PASS", {
    snapshotDate: body.snapshotDate,
    ...normalizedLive.diagnostics,
    qldValueKRW: liveQld.valueKRW,
    qldAccountGroup: liveQld.accountGroup,
    totalUnchanged: afterTotal === beforeTotal,
  });
  if (process.argv.includes("--live-details")) {
    console.table(normalizedLive.snapshot.holdings.map((holding) => ({
      id: holding.id,
      product: holding.cleanName,
      ticker: holding.ticker ?? "-",
      account: holding.accountGroup ?? "-",
      source: holding.tickerSource ?? "-",
    })));
  }
}
