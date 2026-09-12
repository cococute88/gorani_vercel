#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

const require = createRequire(import.meta.url);
const previousTsLoader = require.extensions[".ts"];
require.extensions[".ts"] = (mod, filename) => {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  mod._compile(output.outputText, filename);
};
const { buildDividendPerformanceBackcast } = require("../lib/dividend-performance-from-snapshots.ts");
const { buildAccountGroupPerformance } = require("../lib/dividend-ledger-performance.ts");
if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;

const page = readFileSync("components/dividend/DividendPage.tsx", "utf8");
const account = readFileSync("components/dividend/DividendAccountPerformanceSection.tsx", "utf8");

assert.ok(page.includes("quoteFxHistoryPath"), "성과분석 FX는 전용 fx-history client path를 사용해야 한다");
assert.ok(page.includes("QuoteFxHistoryResponse"), "전용 FX history 응답 타입을 사용해야 한다");
assert.ok(!page.includes('fetchHistory("KRW=X")'), "generic stock history에 KRW=X를 전달하면 안 된다");
assert.ok(!account.includes("FX_TICKER"), "계좌 성과가 generic KRW=X 요청을 별도로 만들면 안 된다");
assert.ok(!account.includes("quoteHistoryPath"), "계좌 성과는 부모의 공용 history 결과를 재사용해야 한다");

const priceHistories = {
  MSFT: [
    { date: "2024-09-10", close: 100 },
    { date: "2025-09-10", close: 110 },
    { date: "2026-09-10", close: 120 },
  ],
  QQQ: [
    { date: "2024-09-10", close: 200 },
    { date: "2025-09-10", close: 230 },
    { date: "2026-09-10", close: 250 },
  ],
};
const fxHistory = [
  { date: "2024-09-09", close: 1_300 },
  { date: "2025-09-09", close: 1_350 },
  { date: "2026-09-09", close: 1_400 },
];
const benchmark = [
  { date: "2024-09-10", close: 50 },
  { date: "2025-09-10", close: 55 },
  { date: "2026-09-10", close: 60 },
];
const taxableHoldings = [{ ticker: "MSFT", currency: "USD", quantity: 10, valueKRW: 1_680_000 }];
const taxAdvantagedHoldings = [{ ticker: "QQQ", currency: "USD", quantity: 5, valueKRW: 1_750_000 }];

const combined = buildDividendPerformanceBackcast({
  holdings: [...taxableHoldings, ...taxAdvantagedHoldings],
  priceHistories,
  fxHistory,
  benchmarkHistories: { schd: benchmark, sp500: benchmark },
  latestDate: "2026-09-10",
  months: 24,
});
assert.equal(combined.available, true, "holding history와 FX가 있으면 전체 성과가 available이어야 한다");
assert.equal(combined.points[0].portfolio, 10 * 100 * 1_300 + 5 * 200 * 1_300, "가격일보다 미래인 FX를 쓰지 않고 직전 영업일 환율을 사용해야 한다");
assert.ok(combined.points.every((point) => point.portfolio > 0), "USD holding backcast가 0으로 붕괴하면 안 된다");

const missingFx = buildDividendPerformanceBackcast({
  holdings: taxableHoldings,
  priceHistories,
  fxHistory: null,
  latestDate: "2026-09-10",
  months: 24,
});
assert.equal(missingFx.available, false);
assert.match(missingFx.unavailableReason ?? "", /USD\/KRW 과거 환율/, "FX 실패 원인을 가격 실패와 구분해야 한다");

const snapshots = [{
  id: "latest",
  snapshotDate: "2026-09-10",
  sourceFileName: "fixture",
  totalAssetKRW: 0,
  totalDebtKRW: 0,
  netAssetKRW: 0,
  investmentPrincipalKRW: 0,
  investmentValueKRW: 0,
  returnAmountKRW: 0,
  returnPct: 0,
  holdings: [],
  financeAssets: [],
  createdAt: "",
}];
const taxable = buildAccountGroupPerformance(snapshots, "위탁", { holdings: taxableHoldings, priceHistories, fxHistory, latestDate: "2026-09-10", months: 24 });
const taxAdvantaged = buildAccountGroupPerformance(snapshots, "절세", { holdings: taxAdvantagedHoldings, priceHistories, fxHistory, latestDate: "2026-09-10", months: 24 });
assert.equal(taxable.available, true, "위탁 성과가 available이어야 한다");
assert.equal(taxAdvantaged.available, true, "절세 성과가 available이어야 한다");
assert.ok(!taxable.warnings.some((warning) => warning.includes("비교선을 표시하지 않습니다")), "계좌별 benchmark를 별도 계산할 때 거짓 경고를 남기면 안 된다");

const schdFailed = buildDividendPerformanceBackcast({
  holdings: taxableHoldings,
  priceHistories,
  fxHistory,
  benchmarkHistories: { schd: null, sp500: benchmark },
  latestDate: "2026-09-10",
  months: 24,
});
assert.equal(schdFailed.available, true, "SCHD benchmark 실패가 portfolio 성과를 숨기면 안 된다");
assert.equal(schdFailed.kpis?.schdValueKRW, null);
assert.ok((schdFailed.kpis?.sp500ValueKRW ?? 0) > 0);

const sp500Failed = buildDividendPerformanceBackcast({
  holdings: taxableHoldings,
  priceHistories,
  fxHistory,
  benchmarkHistories: { schd: benchmark, sp500: null },
  latestDate: "2026-09-10",
  months: 24,
});
assert.equal(sp500Failed.available, true, "SPY benchmark 실패가 portfolio 성과를 숨기면 안 된다");
assert.ok((sp500Failed.kpis?.schdValueKRW ?? 0) > 0);
assert.equal(sp500Failed.kpis?.sp500ValueKRW, null);

console.log("✅ 배당 성과 FX 전용 경로·직전일 매칭·부분 실패·사유 구분 회귀 검증 통과");
