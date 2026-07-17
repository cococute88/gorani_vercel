import assert from "node:assert/strict";
import { fallbackCurrency, fallbackExchange, resolveMddTicker } from "../lib/mdd-market.ts";

const expectOk = (input, market, candidates) => {
  const result = resolveMddTicker(input, market);
  assert.equal(result.ok, true, `${market} ${input} should be accepted`);
  assert.deepEqual(result.candidates, candidates);
};
const expectError = (input, market) => {
  const result = resolveMddTicker(input, market);
  assert.equal(result.ok, false, `${market} ${input} should be rejected`);
};

expectOk("SPY", "US", ["SPY"]);
expectOk(" brk-b ", "US", ["BRK-B"]);
expectOk("000660", "KR", ["000660.KS", "000660.KQ"]);
expectOk("000660.KS", "KR", ["000660.KS"]);
expectOk("247540.KQ", "KR", ["247540.KQ"]);
expectError("000660", "US");
expectError("SPY", "KR");
expectError("123", "KR");
expectError("1234567", "KR");
assert.equal(fallbackCurrency("000660.KS", "KR"), "KRW");
assert.equal(fallbackCurrency("SPY", "US"), "USD");
assert.equal(fallbackExchange("000660.KS"), "KOSPI");
assert.equal(fallbackExchange("247540.KQ"), "KOSDAQ");
console.log("MDD market ticker and currency metadata checks passed.");
