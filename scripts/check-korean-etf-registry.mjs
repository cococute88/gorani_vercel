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
    return originalResolveFilename.call(
      this,
      path.join(rootDir, request.slice(2)),
      parent,
      isMain,
      options,
    );
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

const {
  findKoreanEtfMapping,
} = require("../lib/korean-etf-registry.ts");
const {
  applyKnownQuoteTickerToHolding,
  normalizeHoldingTickerInfo,
} = require("../lib/holding-ticker-normalizer.ts");
const {
  buildDividendHoldingGroupsFromHoldings,
} = require("../lib/dividend-holdings-from-portfolio.ts");
const {
  buildAssetMapExposureFromHoldings,
  normalizeAssetMapTicker,
} = require("../lib/asset-map-exposure.ts");
const {
  getQuoteTickerForHolding,
  isQuoteEligibleHolding,
} = require("../lib/ticker-mapper.ts");

let seq = 0;
function holding(overrides) {
  seq += 1;
  return {
    id: `kr-etf-${seq}`,
    broker: "테스트증권",
    assetType: "ETF",
    productName: "테스트",
    ticker: "",
    principalKRW: overrides.valueKRW ?? 1_000_000,
    valueKRW: overrides.valueKRW ?? 1_000_000,
    ...overrides,
  };
}

function assertMappingCase({ caseName, inputs, quoteTicker, krxCode, dividendBucket, exposureProxy }) {
  for (const productName of inputs) {
    const match = findKoreanEtfMapping(productName);
    const info = normalizeHoldingTickerInfo(holding({ productName }));
    const applied = applyKnownQuoteTickerToHolding(holding({ productName, ticker: "" }));

    assert.equal(match?.quoteTicker, quoteTicker, `${productName}: registry quoteTicker`);
    assert.equal(info.quoteTicker, quoteTicker, `${productName}: normalizer quoteTicker`);
    assert.equal(info.krxCode, krxCode, `${productName}: krxCode`);
    assert.equal(info.dividendBucket, dividendBucket, `${productName}: dividendBucket`);
    assert.equal(info.exposureProxy, exposureProxy, `${productName}: exposureProxy`);
    assert.equal(info.source, "korean-etf-registry", `${productName}: source`);
    assert.equal(applied.ticker, quoteTicker, `${productName}: portfolio-manager fill`);
    assert.equal(getQuoteTickerForHolding(applied), quoteTicker, `${productName}: quote eligibility`);
    assert.equal(isQuoteEligibleHolding(applied), true, `${productName}: quote eligible`);
  }

  return {
    case: caseName,
    variants: inputs.length,
    quoteTicker,
    krxCode,
    dividendBucket,
    exposureProxy,
  };
}

function assertCashLikeCases() {
  const inputs = [
    "미래연금저축원MMF",
    "미래연금국채혼합MMF",
    "원MMF",
    "국채혼합MMF",
  ];

  for (const productName of inputs) {
    const info = normalizeHoldingTickerInfo(holding({ productName }));
    const dividend = buildDividendHoldingGroupsFromHoldings([
      holding({ productName, ticker: "", valueKRW: 1_000_000 }),
    ]);

    assert.equal(info.isCashLike, true, `${productName}: isCashLike`);
    assert.equal(info.quoteTicker, undefined, `${productName}: quoteTicker`);
    assert.equal(info.exposureProxy, undefined, `${productName}: exposureProxy`);
    assert.ok(info.warnings.includes("cash_like"), `${productName}: cash_like warning`);
    assert.equal(dividend.taxableHoldings.length, 0, `${productName}: taxable dividend rows`);
    assert.equal(dividend.taxAdvantagedHoldings.length, 0, `${productName}: tax advantaged dividend rows`);
    assert.equal(normalizeAssetMapTicker({ name: productName, ticker: "", assetType: "MMF", valueKRW: 1_000_000 }), null);
  }

  return { case: "cash-like/MMF exclusion", variants: inputs.length };
}

function assertFallbackCase(productName, dividendBucket, exposureProxy) {
  const info = normalizeHoldingTickerInfo(holding({ productName }));

  assert.equal(info.quoteTicker, undefined);
  assert.equal(info.dividendBucket, dividendBucket);
  assert.equal(info.exposureProxy, exposureProxy);
  assert.equal(info.source, "fallback");
  assert.ok(info.warnings.includes("missing_krx_code_mapping"));

  return {
    case: `${productName} fallback`,
    quoteTicker: "undefined",
    dividendBucket,
    exposureProxy,
    warning: info.warnings.join(", "),
  };
}

function assertBucketTickerUpgradeCase({ productName, currentTicker, quoteTicker, krxCode, dividendBucket, exposureProxy }) {
  const input = holding({ productName, ticker: currentTicker });
  const info = normalizeHoldingTickerInfo(input);
  const applied = applyKnownQuoteTickerToHolding(input);

  assert.equal(info.quoteTicker, quoteTicker, `${productName}: quoteTicker`);
  assert.equal(info.krxCode, krxCode, `${productName}: krxCode`);
  assert.equal(info.dividendBucket, dividendBucket, `${productName}: dividendBucket`);
  assert.equal(info.exposureProxy, exposureProxy, `${productName}: exposureProxy`);
  assert.ok(info.warnings.includes("upgraded_bucket_ticker_to_korean_quote_ticker"), `${productName}: upgrade warning`);
  assert.equal(applied.ticker, quoteTicker, `${productName}: applied ticker`);

  return {
    case: `${productName} bucket ticker upgrade`,
    from: currentTicker,
    quoteTicker,
    dividendBucket,
    exposureProxy,
  };
}

function assertTrueKrxTickerPreservation() {
  const withSuffix = applyKnownQuoteTickerToHolding(holding({ productName: "KBISAACE미국S&P500", ticker: "360200.KS" }));
  const withoutSuffix = applyKnownQuoteTickerToHolding(holding({ productName: "KBISAACE미국S&P500", ticker: "360200" }));
  const info = normalizeHoldingTickerInfo(holding({ productName: "KBISAACE미국S&P500", ticker: "360200" }));

  assert.equal(withSuffix.ticker, "360200.KS");
  assert.equal(withoutSuffix.ticker, "360200.KS");
  assert.equal(info.quoteTicker, "360200.KS");

  return {
    case: "true KRX ticker preservation",
    withSuffix: withSuffix.ticker,
    withoutSuffix: withoutSuffix.ticker,
  };
}

function assertUnknownKoreanEtfWithBucketTicker() {
  const input = holding({ productName: "알수없는운용사미국S&P500", ticker: "SPY" });
  const info = normalizeHoldingTickerInfo(input);
  const applied = applyKnownQuoteTickerToHolding(input);

  assert.equal(info.quoteTicker, undefined);
  assert.equal(info.dividendBucket, "SPY");
  assert.equal(info.exposureProxy, "SPY");
  assert.ok(info.warnings.includes("missing_krx_code_mapping"));
  assert.equal(applied.ticker, undefined);
  assert.equal(getQuoteTickerForHolding(input), null);
  assert.equal(isQuoteEligibleHolding(input), false);

  return {
    case: "unknown Korean ETF with bucket ticker",
    quoteTicker: "undefined",
    appliedTicker: applied.ticker ?? "blank",
    warning: info.warnings.join(", "),
  };
}

function assertManualTickerPreservation() {
  const input = holding({ productName: "ACE미국S&P500", ticker: "360200.KS" });
  const info = normalizeHoldingTickerInfo(input);
  const applied = applyKnownQuoteTickerToHolding(input);

  assert.equal(info.quoteTicker, "360200.KS");
  assert.equal(info.source, "manual");
  assert.equal(applied.ticker, "360200.KS");

  return {
    case: "manual ticker preservation",
    quoteTicker: info.quoteTicker,
    source: info.source,
  };
}

function assertPortfolioManagerFillOnlyWhenKnown() {
  const known = applyKnownQuoteTickerToHolding(holding({ productName: "ACE미국나스닥100", ticker: "" }));
  const unknown = applyKnownQuoteTickerToHolding(holding({ productName: "알수없는운용사미국S&P500", ticker: "" }));

  assert.equal(known.ticker, "367380.KS");
  assert.equal(unknown.ticker, "");

  return {
    case: "portfolio manager quote ticker fill",
    knownTicker: known.ticker,
    unknownTicker: unknown.ticker || "blank",
  };
}

function assertAssetMapUsesExposureProxy() {
  assert.equal(
    normalizeAssetMapTicker({
      ticker: "367380.KS",
      name: "ACE미국나스닥100",
      assetType: "ETF",
      valueKRW: 1_000_000,
    }),
    "QQQ",
  );
  assert.equal(
    normalizeAssetMapTicker({
      ticker: "360750.KS",
      name: "ISA TIGER미국S&P500",
      assetType: "ETF",
      valueKRW: 1_000_000,
    }),
    "SPY",
  );

  const result = buildAssetMapExposureFromHoldings([
    { ticker: "379780.KS", name: "미래연금RISE미국S&P500", valueKRW: 1_000_000, assetType: "ETF" },
  ]);

  assert.equal(result.coveredEtfValueKRW, 1_000_000);
  assert.ok(result.effectiveHoldingsTop.some((row) => row.sources.includes("SPY")));

  return {
    case: "asset-map exposure proxy",
    coveredEtfValueKRW: result.coveredEtfValueKRW,
    source: result.effectiveHoldingsTop[0]?.sources.join(", "),
  };
}

function assertDividendRowsUseBucketAndPreserveRows() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금ACE미국S&P500", valueKRW: 1_000_000 }),
    holding({ productName: "KBISA ACE미국나스닥100 ④ISA", valueKRW: 2_000_000 }),
    holding({ productName: "미래연금저축원MMF", valueKRW: 3_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 2);
  assert.deepEqual(result.taxAdvantagedHoldings.map((row) => row.ticker).sort(), ["QQQ", "SPY"]);
  assert.equal(result.taxAdvantagedTotalKRW, 3_000_000);

  return {
    case: "dividend bucket row preservation",
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
    tickers: result.taxAdvantagedHoldings.map((row) => row.ticker).join(", "),
  };
}

function assertMiraePensionDistinction() {
  const miraeAsset = normalizeHoldingTickerInfo(holding({ productName: "미래에셋증권" }));
  const miraeAssetDividend = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래에셋증권", valueKRW: 1_000_000 }),
  ]);
  const pension = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금ACE미국S&P500", valueKRW: 1_000_000 }),
  ]);

  assert.equal(miraeAsset.quoteTicker, undefined);
  assert.equal(miraeAsset.dividendBucket, undefined);
  assert.equal(miraeAsset.isCashLike, false);
  assert.equal(miraeAssetDividend.taxAdvantagedHoldings.length, 0);
  assert.equal(pension.taxAdvantagedHoldings.length, 1);
  assert.equal(pension.taxAdvantagedHoldings[0].ticker, "SPY");

  return {
    case: "Mirae Asset vs future pension",
    miraeRows: miraeAssetDividend.taxAdvantagedHoldings.length,
    pensionTicker: pension.taxAdvantagedHoldings[0].ticker,
  };
}

function main() {
  const rows = [
    assertMappingCase({
      caseName: "ACE S&P500 variants",
      inputs: ["ACE미국S&P500", "미래연금ACE미국S&P500", "KBISA ACE미국S&P500", "KBISAACE미국S&P500"],
      quoteTicker: "360200.KS",
      krxCode: "360200",
      dividendBucket: "SPY",
      exposureProxy: "SPY",
    }),
    assertMappingCase({
      caseName: "ACE Nasdaq100 variants",
      inputs: ["ACE미국나스닥100", "미래연금ACE미국나스닥100", "KBISA ACE미국나스닥100", "KBISAACE미국나스닥100"],
      quoteTicker: "367380.KS",
      krxCode: "367380",
      dividendBucket: "QQQ",
      exposureProxy: "QQQ",
    }),
    assertMappingCase({
      caseName: "RISE S&P500 variants",
      inputs: ["RISE미국S&P500", "미래연금RISE미국S&P500", "KBISARISE미국S&P500", "KBISA RISE미국S&P500", "KBSTAR미국S&P500"],
      quoteTicker: "379780.KS",
      krxCode: "379780",
      dividendBucket: "SPY",
      exposureProxy: "SPY",
    }),
    assertMappingCase({
      caseName: "RISE Nasdaq100 variants",
      inputs: ["RISE미국나스닥100", "KBISARISE미국나스닥100", "KBISA RISE미국나스닥100", "미래연금RISE미국나스닥100", "KBSTAR미국나스닥100"],
      quoteTicker: "368590.KS",
      krxCode: "368590",
      dividendBucket: "QQQ",
      exposureProxy: "QQQ",
    }),
    assertMappingCase({
      caseName: "TIGER S&P500 variants",
      inputs: ["TIGER미국S&P500", "ISA TIGER미국S&P500", "ISATIGER미국S&P500", "KB위탁TIGER에센피", "TIGER에센피"],
      quoteTicker: "360750.KS",
      krxCode: "360750",
      dividendBucket: "SPY",
      exposureProxy: "SPY",
    }),
    assertCashLikeCases(),
    assertFallbackCase("알수없는운용사미국S&P500", "SPY", "SPY"),
    assertFallbackCase("알수없는운용사미국나스닥100", "QQQ", "QQQ"),
    assertBucketTickerUpgradeCase({
      productName: "KBISAACE미국S&P500",
      currentTicker: "SPY",
      quoteTicker: "360200.KS",
      krxCode: "360200",
      dividendBucket: "SPY",
      exposureProxy: "SPY",
    }),
    assertBucketTickerUpgradeCase({
      productName: "KBISAACE미국나스닥100",
      currentTicker: "QQQ",
      quoteTicker: "367380.KS",
      krxCode: "367380",
      dividendBucket: "QQQ",
      exposureProxy: "QQQ",
    }),
    assertBucketTickerUpgradeCase({
      productName: "KBISARISE미국나스닥100",
      currentTicker: "QQQ",
      quoteTicker: "368590.KS",
      krxCode: "368590",
      dividendBucket: "QQQ",
      exposureProxy: "QQQ",
    }),
    assertBucketTickerUpgradeCase({
      productName: "ISATIGER미국S&P500",
      currentTicker: "SPY",
      quoteTicker: "360750.KS",
      krxCode: "360750",
      dividendBucket: "SPY",
      exposureProxy: "SPY",
    }),
    assertTrueKrxTickerPreservation(),
    assertUnknownKoreanEtfWithBucketTicker(),
    assertMiraePensionDistinction(),
    assertManualTickerPreservation(),
    assertPortfolioManagerFillOnlyWhenKnown(),
    assertAssetMapUsesExposureProxy(),
    assertDividendRowsUseBucketAndPreserveRows(),
  ];

  console.log("Korean ETF registry regression passed.");
  console.table(rows);
}

main();
