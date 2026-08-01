import assert from "node:assert/strict";
import { resolveMddTicker } from "../lib/mdd-market.ts";

const code = "0049M0";
const metadataResponse = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
  headers: { accept: "application/json", "user-agent": "Mozilla/5.0 gorani-finance provider-verification" },
});
assert.equal(metadataResponse.ok, true, `Naver metadata HTTP ${metadataResponse.status}`);
const metadata = await metadataResponse.json() as {
  itemCode?: string;
  stockName?: string;
  stockExchangeName?: string;
  stockExchangeType?: { name?: string };
};
assert.equal(metadata.itemCode, code);
const marketText = `${metadata.stockExchangeName ?? ""} ${metadata.stockExchangeType?.name ?? ""}`.toUpperCase();
const suffix = marketText.includes("KOSDAQ") ? "KQ" : marketText.includes("KOSPI") ? "KS" : null;
assert.ok(suffix, `Unsupported market metadata: ${marketText}`);

const resolution = resolveMddTicker(code.toLowerCase(), "KR");
assert.equal(resolution.ok, true);
const finalSymbol = `${code}.${suffix}`;
if (resolution.ok) assert.ok(resolution.candidates.includes(finalSymbol));

const period1 = Math.floor(new Date("2025-01-01T00:00:00Z").getTime() / 1000);
const period2 = Math.floor(Date.now() / 1000);
const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(finalSymbol)}`);
url.searchParams.set("period1", String(period1));
url.searchParams.set("period2", String(period2));
url.searchParams.set("interval", "1d");
url.searchParams.set("events", "div");
const yahooResponse = await fetch(url, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0 quote-api" } });
assert.equal(yahooResponse.ok, true, `Yahoo ${finalSymbol} HTTP ${yahooResponse.status}`);
const yahoo = await yahooResponse.json() as {
  chart?: { result?: Array<{ meta?: { symbol?: string; currency?: string; fullExchangeName?: string }; timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
};
const result = yahoo.chart?.result?.[0];
assert.equal(result?.meta?.symbol, finalSymbol);
assert.equal(result?.meta?.currency, "KRW");
const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
assert.ok(closes.length >= 2, `${finalSymbol} requires at least two positive daily closes`);
assert.ok(!closes.every((value) => value === 0));

console.log(JSON.stringify({
  requestedCode: code,
  normalizedCode: resolution.ok ? resolution.requestedTicker : null,
  metadataMarket: metadata.stockExchangeName ?? metadata.stockExchangeType?.name,
  finalYahooSymbol: finalSymbol,
  resolvedYahooSymbol: result?.meta?.symbol,
  exchange: result?.meta?.fullExchangeName,
  currency: result?.meta?.currency,
  positiveDailyCloses: closes.length,
  firstClose: closes[0],
  lastClose: closes.at(-1),
}, null, 2));
