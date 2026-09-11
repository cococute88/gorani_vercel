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
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  DIVIDEND_MARKET_DATA_MAX_AGE_MS,
  requestDividendMarketData,
  resetDividendMarketDataRequestCacheForTests,
} = require("../lib/dividend-market-data-cache.ts");
const { buildDividendEstimatesForHoldings, computeSchdEquivalentGoalProgress } = require("../lib/dividend-estimates.ts");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function quote(ticker, price, source = "yahoo") {
  return { ticker, normalizedTicker: ticker, source, updatedAt: "2026-09-12T00:00:00.000Z", warnings: [], price, date: "2026-09-11" };
}

function dividends(ticker, amounts, source = "yahoo") {
  return {
    ticker,
    normalizedTicker: ticker,
    source,
    updatedAt: "2026-09-12T00:00:00.000Z",
    warnings: [],
    dividends: amounts.map((amount, index) => ({ date: `2026-${String((index + 1) * 3).padStart(2, "0")}-15`, amount })),
  };
}

function fx(rate, source = "yahoo") {
  return { pair: "USDKRW", source, updatedAt: "2026-09-12T00:00:00.000Z", warnings: [], rate, date: "2026-09-11" };
}

async function assertFxUsesDedicatedYahooPath() {
  const server = fs.readFileSync(path.join(rootDir, "lib/server/quote-fetchers.ts"), "utf8");
  const body = server.slice(server.indexOf("export async function getQuoteFx"));
  assert.match(body, /fetchYahooChart\(\{ ticker: symbol/);
  assert.doesNotMatch(body.slice(0, body.indexOf("type StockAnalysisDividendPayload") > 0 ? body.indexOf("type StockAnalysisDividendPayload") : body.length), /getQuoteHistory\(\{ ticker: symbol/);
  return { case: "FX bypasses stock ticker validator" };
}

async function assertLastKnownGoodRecovery() {
  resetDividendMarketDataRequestCacheForTests();
  const storage = memoryStorage();
  const now = Date.parse("2026-09-12T01:00:00.000Z");
  const live = await requestDividendMarketData({
    path: "/quote/fx?success",
    kind: "fx",
    key: "USDKRW",
    storage,
    now,
    fetcher: async () => fx(1341.05),
  });
  assert.equal(live.rate, 1341.05);

  resetDividendMarketDataRequestCacheForTests();
  const recovered = await requestDividendMarketData({
    path: "/quote/fx?failure",
    kind: "fx",
    key: "USDKRW",
    storage,
    now: now + 60_000,
    fetcher: async () => fx(1375, "sample"),
  });
  assert.equal(recovered.rate, 1341.05);
  assert.equal(recovered.source, "yahoo");
  assert.equal(recovered.cacheStatus, "stale");
  assert.equal(recovered.updatedAt, live.updatedAt, "provider 기준 시각을 보존해야 한다");
  assert.ok(recovered.warnings.some((warning) => warning.includes("최근 정상 데이터")));

  const estimate = buildDividendEstimatesForHoldings(
    [{ ticker: "SCHD", valueKRW: 10_000_000 }],
    { SCHD: { quote: quote("SCHD", 34), dividends: dividends("SCHD", [0.25, 0.26, 0.27, 0.28]), fx: recovered } },
    { afterTax: true, asOf: new Date("2026-12-31T00:00:00.000Z") },
  ).SCHD;
  assert.ok(estimate.annualDividendKRW > 0, "FX provider 실패 시 최근 정상 FX로 estimate를 유지해야 한다");
  const goal = computeSchdEquivalentGoalProgress({
    targetQty: 3300,
    evaluationKRW: 40_201_286,
    targetPriceKRW: 34.12 * recovered.rate,
  });
  assert.equal(goal.calculable, true);
  return { case: "FX last-known-good recovery", rate: recovered.rate, annualDividendKRW: estimate.annualDividendKRW, goalPct: goal.achievementPct };
}

async function assertTickerCachesRecoverIndependently() {
  resetDividendMarketDataRequestCacheForTests();
  const storage = memoryStorage();
  const now = Date.parse("2026-09-12T01:00:00.000Z");
  await Promise.all([
    requestDividendMarketData({ path: "/quote/JEPI?live", kind: "quote", key: "JEPI", storage, now, fetcher: async () => quote("JEPI", 56.65) }),
    requestDividendMarketData({ path: "/dividends/JEPI?live", kind: "dividends", key: "JEPI", storage, now, fetcher: async () => dividends("JEPI", [0.4, 0.41, 0.42, 0.43]) }),
  ]);
  resetDividendMarketDataRequestCacheForTests();
  const [cachedQuote, cachedDividends] = await Promise.all([
    requestDividendMarketData({ path: "/quote/JEPI?failed", kind: "quote", key: "JEPI", storage, now: now + 1_000, fetcher: async () => quote("JEPI", 100, "sample") }),
    requestDividendMarketData({ path: "/dividends/JEPI?failed", kind: "dividends", key: "JEPI", storage, now: now + 1_000, fetcher: async () => dividends("JEPI", [9], "sample") }),
  ]);
  assert.equal(cachedQuote.price, 56.65);
  assert.equal(cachedQuote.cacheStatus, "stale");
  assert.equal(cachedDividends.dividends.length, 4);
  assert.equal(cachedDividends.cacheStatus, "stale");
  return { case: "quote/dividend caches recover per ticker", quote: cachedQuote.price, events: cachedDividends.dividends.length };
}

async function assertExpiredDataIsRejected() {
  resetDividendMarketDataRequestCacheForTests();
  const storage = memoryStorage();
  const now = Date.parse("2026-09-12T01:00:00.000Z");
  await requestDividendMarketData({
    path: "/quote/SCHD?success",
    kind: "quote",
    key: "SCHD",
    storage,
    now,
    fetcher: async () => quote("SCHD", 34),
  });
  resetDividendMarketDataRequestCacheForTests();
  const expired = await requestDividendMarketData({
    path: "/quote/SCHD?expired",
    kind: "quote",
    key: "SCHD",
    storage,
    now: now + DIVIDEND_MARKET_DATA_MAX_AGE_MS.quote + 1,
    fetcher: async () => quote("SCHD", 100, "sample"),
  });
  assert.equal(expired.source, "sample");
  assert.equal(expired.cacheStatus, undefined);
  return { case: "expired cache rejected" };
}

async function assertInFlightDeduplication() {
  resetDividendMarketDataRequestCacheForTests();
  let calls = 0;
  const options = {
    path: "/quote/SPY?dedupe",
    kind: "quote",
    key: "SPY",
    storage: memoryStorage(),
    now: Date.parse("2026-09-12T01:00:00.000Z"),
    fetcher: async () => {
      calls += 1;
      await Promise.resolve();
      return quote("SPY", 764);
    },
  };
  const [first, second] = await Promise.all([
    requestDividendMarketData(options),
    requestDividendMarketData(options),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.price, second.price);
  return { case: "in-flight request dedupe", providerCalls: calls };
}

async function assertPartialTickerFailureIsIsolated() {
  const market = {
    SCHD: { quote: quote("SCHD", 34), dividends: dividends("SCHD", [0.25, 0.26, 0.27, 0.28]), fx: fx(1341) },
    JEPI: { quote: quote("JEPI", null, "sample"), dividends: dividends("JEPI", [0.4, 0.4, 0.4, 0.4]), fx: fx(1341) },
    JEPQ: { quote: quote("JEPQ", 60), dividends: dividends("JEPQ", [0.45, 0.46, 0.47, 0.48]), fx: fx(1341) },
    MSFT: { quote: quote("MSFT", 495), dividends: dividends("MSFT", [0.8], "sample"), fx: fx(1341) },
  };
  const estimates = buildDividendEstimatesForHoldings(
    Object.keys(market).map((ticker) => ({ ticker, valueKRW: 10_000_000 })),
    market,
    { asOf: new Date("2026-12-31T00:00:00.000Z") },
  );
  assert.ok(estimates.SCHD.annualDividendKRW > 0);
  assert.ok(estimates.JEPQ.annualDividendKRW > 0);
  assert.equal(estimates.JEPI.annualDividendKRW, undefined);
  assert.equal(estimates.MSFT.annualDividendKRW, undefined);
  const aggregate = Object.values(estimates).reduce((sum, estimate) => sum + (estimate.annualDividendKRW ?? 0), 0);
  assert.ok(aggregate > 0, "일부 ticker 실패가 정상 ticker aggregate를 제거하면 안 된다");
  return { case: "partial ticker failures isolated", available: 2, unavailable: 2, aggregate };
}

async function main() {
  const rows = [
    await assertFxUsesDedicatedYahooPath(),
    await assertLastKnownGoodRecovery(),
    await assertTickerCachesRecoverIndependently(),
    await assertExpiredDataIsRejected(),
    await assertInFlightDeduplication(),
    await assertPartialTickerFailureIsIsolated(),
  ];
  console.log("Dividend market-data resilience regression passed.");
  console.table(rows);
}

main().catch((error) => {
  console.error("Dividend market-data resilience regression failed.");
  console.error(error);
  process.exit(1);
});
