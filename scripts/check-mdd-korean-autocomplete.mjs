import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { isDirectKoreanTicker, isKoreanStockNameQuery, rankKoreanStockSearchResults } = require("../lib/korean-stock-search.ts");
const mdd = fs.readFileSync(path.join(rootDir, "components/calculator/MddCalculator.tsx"), "utf8");
const route = fs.readFileSync(path.join(rootDir, "app/api/quote/korean-stock-search/route.ts"), "utf8");
const provider = fs.readFileSync(path.join(rootDir, "lib/server/korean-stock-search.ts"), "utf8");

assert.equal(isKoreanStockNameQuery("SK하이닉스"), true);
assert.equal(isKoreanStockNameQuery("하이닉스"), true);
assert.equal(isKoreanStockNameQuery("삼성"), true);
assert.equal(isKoreanStockNameQuery("000660"), false);
assert.equal(isDirectKoreanTicker("000660.KS"), true);
assert.equal(isDirectKoreanTicker("247540.KQ"), true);

const ranked = rankKoreanStockSearchResults("삼성", [
  { code: "009150", symbol: "009150.KS", displayName: "삼성전기", market: "KOSPI", exchange: "KOSPI", currency: "KRW", quoteType: "EQUITY" },
  { code: "005930", symbol: "005930.KS", displayName: "삼성전자", market: "KOSPI", exchange: "KOSPI", currency: "KRW", quoteType: "EQUITY" },
  { code: "005930", symbol: "005930.KS", displayName: "삼성전자", market: "KOSPI", exchange: "KOSPI", currency: "KRW", quoteType: "EQUITY" },
]);
assert.equal(ranked.length, 2, "duplicate code is removed");
assert.equal(ranked[0].code, "009150", "prefix candidates are ordered deterministically");

assert.ok(mdd.includes('md:grid-cols-[minmax(0,1fr)_auto]'), "desktop input and period controls share one grid row");
assert.ok(!mdd.includes('>분석 기간</label>'), "visible analysis-period label is removed");
assert.ok(mdd.includes("setTimeout(async () =>") && mdd.includes("}, 250)"), "Korean name search is debounced");
assert.ok(mdd.includes("koreanSearchAbortRef.current?.abort()") && mdd.includes("requestId !== koreanSearchRequestRef.current"), "stale autocomplete responses are cancelled/ignored");
assert.ok(mdd.includes("ArrowDown") && mdd.includes("ArrowUp") && mdd.includes("Escape"), "keyboard autocomplete navigation is supported");
assert.ok(mdd.includes("/api/quote/korean-stock-search"), "browser calls only the normalized internal search API");
assert.ok(route.includes("isKoreanStockNameQuery") && provider.includes("front-api/search/autoComplete"), "server route validates and proxies Naver autocomplete");
assert.ok(provider.includes("/^\\d{6}$/") && provider.includes("KOREAN_STOCK_SEARCH_LIMIT"), "only supported KRX codes and bounded results are exposed");

console.log("MDD Korean autocomplete checks passed.");
