import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCompareTickerInput } from "../lib/backtest-compare-tickers.ts";
import { resolveKrxSeriesError } from "../lib/krx-series-error.ts";
import { parseKrxTicker } from "../lib/krx-ticker.ts";
import { resolveMddTicker } from "../lib/mdd-market.ts";
import { checkPortfolioSeriesAvailability } from "../lib/portfolio-compare/availability.ts";
import type { PortfolioCompareRequest, ResolvedMarketSeries } from "../lib/portfolio-compare/types.ts";
import { normalizePortfolioTicker, validatePortfolioCompareRequest } from "../lib/portfolio-compare/validation.ts";
import { hasUsablePricePoints } from "../lib/price-series-validation.ts";
import { resolvedMarketSeriesCacheKey } from "../lib/resolved-market-series-client.ts";

function expectKorean(input: string, candidates: string[]) {
  const result = resolveMddTicker(input, "KR");
  assert.equal(result.ok, true, `${input} should be a valid Korean ticker`);
  if (result.ok) assert.deepEqual(result.candidates, candidates);
}

for (const [input, candidates] of [
  ["000660", ["000660.KS", "000660.KQ"]],
  ["0049M0", ["0049M0.KS", "0049M0.KQ"]],
  ["0049m0", ["0049M0.KS", "0049M0.KQ"]],
  ["0049M0.KS", ["0049M0.KS"]],
  ["0049m0.kq", ["0049M0.KQ"]],
] as const) expectKorean(input, [...candidates]);

assert.equal(parseKrxTicker("0049m0")?.code, "0049M0");
assert.equal(normalizePortfolioTicker("0049m0", "KR"), "0049M0");
assert.equal(normalizePortfolioTicker("0049M0.KS", "KR"), "0049M0");
assert.equal(resolveCompareTickerInput("0049m0").ok, true);
assert.deepEqual(resolveCompareTickerInput("0049m0"), { ok: true, ticker: "0049M0", market: "KR" });

for (const input of ["12345", "1234567", "   ", "삼성전자", "0049@0", "0049M0.KS.KS", "0049M0.KQ.KS", "0049M0..KS"]) {
  assert.equal(resolveMddTicker(input, "KR").ok, false, `${input} should be rejected`);
}

for (const ticker of ["QQQ", "JEPQ", "JEPI", "SPY"]) {
  assert.deepEqual(resolveCompareTickerInput(ticker), { ok: true, ticker, market: "US" });
}

const validRequest: PortfolioCompareRequest = {
  portfolioA: { name: "A", holdings: [{ id: "a1", market: "KR", ticker: "0049m0", weightPct: 100 }] },
  portfolioB: { name: "B", holdings: [{ id: "b1", market: "KR", ticker: "000660", weightPct: 100 }] },
  baseCurrency: "KRW",
  returnMode: "tr",
  analysisMode: "actual",
};
assert.deepEqual(validatePortfolioCompareRequest(validRequest), [], "portfolio A/B share alphanumeric KRX validation");
assert.ok(validatePortfolioCompareRequest({
  ...validRequest,
  portfolioB: { ...validRequest.portfolioB, holdings: [{ ...validRequest.portfolioB.holdings[0], weightPct: 99 }] },
}).some((message) => message.includes("100%")), "weight total validation remains active");

assert.notEqual(resolvedMarketSeriesCacheKey("KR", "0049M0"), resolvedMarketSeriesCacheKey("KR", "0049N0"));
assert.equal(resolvedMarketSeriesCacheKey("KR", "0049m0"), resolvedMarketSeriesCacheKey("KR", "0049M0"));

assert.equal(hasUsablePricePoints([{ date: "2026-01-01", close: 1 }, { date: "2026-01-02", close: 2 }]), true);
assert.equal(hasUsablePricePoints([{ date: "2026-01-01", close: 0 }, { date: "2026-01-02", close: Number.NaN }]), false);
assert.equal(hasUsablePricePoints([{ date: "2026-01-01", close: Number.POSITIVE_INFINITY }, { date: "2026-01-02", close: null }]), false);

function fixture(ticker: string, close = 100): ResolvedMarketSeries {
  return {
    requestedTicker: ticker,
    resolvedSymbol: ticker === "0049M0" ? "0049M0.KS" : ticker,
    name: ticker,
    market: ticker === "SPY" ? "US" : "KR",
    exchange: ticker === "SPY" ? "NYSEArca" : "KOSPI",
    currency: ticker === "SPY" ? "USD" : "KRW",
    source: "yahoo",
    points: [
      { date: "2026-01-01", close, adjClose: close },
      { date: "2026-01-02", close, adjClose: close },
    ],
    dataStart: "2026-01-01",
    dataEnd: "2026-01-02",
    warnings: [],
  };
}

const availability = await checkPortfolioSeriesAvailability([
  { key: "A:a1", label: "포트폴리오 A", ticker: "0049M0", market: "KR" },
  { key: "B:b1", label: "포트폴리오 B", ticker: "000660", market: "KR" },
], async (ticker) => fixture(ticker));
assert.ok(availability.every((row) => row.error === null));
assert.equal(availability[0].resolvedSymbol, "0049M0.KS");

const unusable = await checkPortfolioSeriesAvailability([
  { key: "B:bad", label: "포트폴리오 B", ticker: "BAD", market: "US" },
], async () => fixture("BAD", 0));
assert.match(unusable[0].error ?? "", /가격 데이터/);

assert.equal(resolveKrxSeriesError({ requestedTicker: "XXXX00", metadataStatus: "not_found" }).status, 404);
assert.match(resolveKrxSeriesError({ requestedTicker: "0049M0", metadataStatus: "found" }).error, /현재 제공자/);
assert.equal(resolveKrxSeriesError({ requestedTicker: "0049M0", metadataStatus: "unavailable" }).status, 502);

for (const file of [
  "lib/krx-ticker.ts",
  "lib/mdd-market.ts",
  "lib/portfolio-compare/validation.ts",
  "lib/resolved-market-series-client.ts",
]) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /(?:parseInt|parseFloat|Number)\s*\([^\n]*(?:ticker|code)/i, `${file} must not coerce ticker/code to a number`);
}

console.log("KRX alphanumeric ticker validation, normalization, cache, availability, and error checks passed.");
