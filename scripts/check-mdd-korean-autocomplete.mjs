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

const { isDirectKoreanTicker, isKoreanStockNameQuery, normalizeKoreanStockSearchText, rankKoreanStockSearchResults } = require("../lib/korean-stock-search.ts");
const mdd = fs.readFileSync(path.join(rootDir, "components/calculator/MddCalculator.tsx"), "utf8");
const route = fs.readFileSync(path.join(rootDir, "app/api/quote/korean-stock-search/route.ts"), "utf8");
const provider = fs.readFileSync(path.join(rootDir, "lib/server/korean-stock-search.ts"), "utf8");

assert.equal(isKoreanStockNameQuery("SK하이닉스"), true);
assert.equal(isKoreanStockNameQuery("하이닉스"), true);
assert.equal(isKoreanStockNameQuery("삼성"), false, "Korean name search starts at three normalized characters");
assert.equal(isKoreanStockNameQuery("타겟위클리"), true);
assert.equal(isKoreanStockNameQuery("위클리커버드"), true);
assert.equal(isKoreanStockNameQuery("커버드콜"), true);
assert.equal(isKoreanStockNameQuery("KODEX 200"), true);
assert.equal(isKoreanStockNameQuery("코드"), false, "Korean name search starts at three normalized characters");
assert.equal(isKoreanStockNameQuery("000660"), false);
assert.equal(isDirectKoreanTicker("000660.KS"), true);
assert.equal(isDirectKoreanTicker("247540.KQ"), true);
assert.equal(normalizeKoreanStockSearchText(" KODEX 200-타겟위클리(커버드콜) "), "kodex200타겟위클리커버드콜");

const targetWeekly = { code: "498400", symbol: "498400.KS", displayName: "KODEX 200타겟위클리커버드콜", market: "KOSPI", exchange: "KOSPI", currency: "KRW", quoteType: "ETF" };
const searchFixture = [
  { code: "069500", symbol: "069500.KS", displayName: "KODEX 200", market: "KOSPI", exchange: "KOSPI", currency: "KRW", quoteType: "ETF" },
  targetWeekly,
  { code: "005930", symbol: "005930.KS", displayName: "삼성전자", market: "KOSPI", exchange: "KOSPI", currency: "KRW", quoteType: "EQUITY" },
  targetWeekly,
];
for (const query of ["타겟위클리", "위클리커버드", "커버드콜", "200타겟", "kodex 타겟", "타겟 위클리", "498400"]) {
  const results = rankKoreanStockSearchResults(query, searchFixture);
  assert.equal(results[0]?.code, "498400", `${query} returns the target weekly ETF first`);
}
assert.ok(rankKoreanStockSearchResults("KODEX 200", searchFixture).some((result) => result.code === "498400"), "KODEX 200 includes the target weekly ETF");
assert.equal(rankKoreanStockSearchResults("삼성전자", searchFixture)[0]?.code, "005930", "exact official name ranks first");

assert.ok(mdd.includes('md:grid-cols-[minmax(0,1fr)_auto]'), "desktop input and period controls share one grid row");
assert.ok(!mdd.includes('>분석 기간</label>'), "visible analysis-period label is removed");
assert.ok(mdd.includes("setTimeout(async () =>") && mdd.includes("}, 250)"), "Korean name search is debounced");
assert.ok(mdd.includes("koreanSearchAbortRef.current?.abort()") && mdd.includes("requestId !== koreanSearchRequestRef.current"), "stale autocomplete responses are cancelled/ignored");
assert.ok(mdd.includes("ArrowDown") && mdd.includes("ArrowUp") && mdd.includes("Escape"), "keyboard autocomplete navigation is supported");
assert.ok(mdd.includes("/api/quote/korean-stock-search"), "browser calls only the normalized internal search API");
assert.ok(route.includes("isKoreanStockNameQuery"), "server route validates name-search requests");
assert.ok(route.includes("status: 502"), "upstream search failures remain distinct from an empty successful result");
assert.ok(provider.includes("corpList.do?method=download") && provider.includes("etfItemList.nhn"), "server builds a cached KRX stock plus Naver ETF master");
assert.ok(provider.includes("MASTER_REVALIDATE_MS") && provider.includes("masterRequest"), "stock master avoids repeated upstream downloads");
assert.ok(provider.includes("/^\\d{6}$/") && provider.includes("KOREAN_STOCK_SEARCH_LIMIT"), "only supported KRX codes and bounded results are exposed");

console.log("MDD Korean autocomplete checks passed.");
