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
  buildDividendHoldingGroupsFromHoldings,
} = require("../lib/dividend-holdings-from-portfolio.ts");
const {
  dividendHoldingWeightPct,
} = require("../lib/mock-dividend-data.ts");

let seq = 0;
function holding(overrides) {
  seq += 1;
  return {
    id: `h-${seq}`,
    broker: "테스트증권",
    assetType: "해외주식",
    productName: "테스트",
    ticker: "SCHD",
    principalKRW: overrides.valueKRW ?? 1_000_000,
    valueKRW: overrides.valueKRW ?? 1_000_000,
    ...overrides,
  };
}

function rowValue(rows, ticker) {
  return rows.find((row) => row.ticker === ticker)?.valueKRW ?? 0;
}

function assertTaxableInclude() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①SCHD ②위탁 Schwab US Dividend Equity", ticker: "SCHD", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 1);
  assert.equal(rowValue(result.taxableHoldings, "SCHD"), 1_000_000);
  assert.equal(result.taxableTotalKRW, 1_000_000);
  return { case: "taxable include", taxableRows: result.taxableHoldings.length, taxableTotalKRW: result.taxableTotalKRW };
}

function assertTaxableExcludedByAmount() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①SCHD ②위탁 small", ticker: "SCHD", valueKRW: 200_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxableTotalKRW, 0);
  return { case: "taxable excluded by amount", taxableRows: result.taxableHoldings.length };
}

function assertTaxableExcludedBySmallTag() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①SPY ②위탁 #소액", ticker: "SPY", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxableTotalKRW, 0);
  return { case: "taxable excluded by #소액", taxableRows: result.taxableHoldings.length };
}

function assertTaxableExcludedByCategory() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①QQQ ②위탁 Invesco QQQ", ticker: "QQQ", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxableTotalKRW, 0);
  return { case: "taxable excluded by symbol group", taxableRows: result.taxableHoldings.length };
}

function assertTaxAdvantagedInclude() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①QQQ ②ISA Invesco QQQ", ticker: "QQQ", valueKRW: 500_000 }),
    holding({ productName: "①SCHD ②연금 Schwab", ticker: "SCHD", valueKRW: 600_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 2);
  assert.equal(result.taxAdvantagedTotalKRW, 1_100_000);
  return {
    case: "tax advantaged include",
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertMixedTotals() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①SCHD ②위탁", ticker: "SCHD", valueKRW: 1_000_000 }),
    holding({ productName: "①SPY ②위탁", ticker: "SPY", valueKRW: 2_000_000 }),
    holding({ productName: "①QQQ ②ISA", ticker: "QQQ", valueKRW: 500_000 }),
    holding({ productName: "①MSFT ②연금저축", ticker: "MSFT", valueKRW: 600_000 }),
    holding({ productName: "①MSFT ②위탁 #소액", ticker: "MSFT", valueKRW: 3_000_000 }),
  ]);

  assert.equal(result.taxableTotalKRW, 3_000_000);
  assert.equal(result.taxAdvantagedTotalKRW, 1_100_000);
  return {
    case: "mixed totals",
    taxableTotalKRW: result.taxableTotalKRW,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertSpyMarkerDisplayTicker() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({
      productName: "미래연금ACE미국S&P500 ①SPY ②연금 ③성장 ④연금",
      ticker: "",
      valueKRW: 57_610_140,
    }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "SPY");
  assert.equal(result.taxAdvantagedHoldings[0].valueKRW, 57_610_140);
  return {
    case: "①SPY marker display ticker",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertStatusPensionIncludesTaxAdvantaged() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금RISE미국S&P500 ④연금", ticker: "", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedTotalKRW, 1_000_000);
  return {
    case: "④연금 tax advantaged include",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
  };
}

function assertStatusIsaIncludesTaxAdvantaged() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "KODEX 미국S&P500 ④ISA", ticker: "", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedTotalKRW, 1_000_000);
  return {
    case: "④ISA tax advantaged include",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
  };
}

function assertSp500FallbackInfersSpy() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금RISE미국S&P500", ticker: "", accountName: "연금", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "SPY");
  return {
    case: "S&P500 fallback infers SPY",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
  };
}

function assertTaxableSpyDisplayTicker() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①SPY ②위탁", ticker: "", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 1);
  assert.equal(result.taxableHoldings[0].ticker, "SPY");
  assert.equal(result.taxableTotalKRW, 1_000_000);
  return {
    case: "taxable SPY included",
    ticker: result.taxableHoldings[0].ticker,
    taxableTotalKRW: result.taxableTotalKRW,
  };
}

function assertStrictTaxableInclude() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "삼성위탁SCHD ①SCHD ②위탁 ③배당 ④위탁", ticker: "", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings.length, 0);
  assert.equal(result.taxableHoldings[0].ticker, "SCHD");
  return {
    case: "strict taxable include",
    ticker: result.taxableHoldings[0].ticker,
    taxableTotalKRW: result.taxableTotalKRW,
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
  };
}

function assertTaxableExcludedByTaxAdvantagedSignal() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금RISE미국S&P500 ①SPY ②위탁 ③성장 ④위탁", ticker: "", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "SPY");
  return {
    case: "taxable excluded by tax advantaged signal",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxableRows: result.taxableHoldings.length,
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
  };
}

function assertIsaStatusOnlyInclude() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "KBISAACE미국S&P500 ①SPY ②기타 ③성장 ④ISA", ticker: "", valueKRW: 17_221_035 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "SPY");
  assert.equal(result.taxAdvantagedTotalKRW, 17_221_035);
  return {
    case: "④ISA only tax advantaged include",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertSp500FallbackWithoutMarker() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금RISE미국S&P500", ticker: "", valueKRW: 268_125 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "SPY");
  assert.equal(result.taxAdvantagedTotalKRW, 268_125);
  return {
    case: "S&P500 fallback without marker",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertTaxAdvantagedExcludesMmfCashLike() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금국채혼합MMF ①KRW ②연금 ③현금 ④연금", ticker: "", valueKRW: 43_513_200 }),
    holding({ productName: "미래연금저축원MMF", ticker: "", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxAdvantagedHoldings.length, 0);
  assert.equal(result.taxAdvantagedTotalKRW, 0);
  return {
    case: "tax advantaged excludes MMF cash-like",
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
  };
}

function assertTaxAdvantagedKoreanNasdaqBucket() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "KBISA ACE미국나스닥100 ④ISA", ticker: "", valueKRW: 2_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "QQQ");
  assert.equal(result.taxAdvantagedTotalKRW, 2_000_000);
  return {
    case: "Korean Nasdaq100 tax advantaged bucket",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertDividendRowsPreserveOriginalHoldings() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금ACE미국S&P500", ticker: "", valueKRW: 1_000_000 }),
    holding({ productName: "미래연금KINDEX미국S&P500", ticker: "", valueKRW: 2_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 2);
  assert.deepEqual(result.taxAdvantagedHoldings.map((row) => row.ticker), ["SPY", "SPY"]);
  assert.equal(result.taxAdvantagedTotalKRW, 3_000_000);
  return {
    case: "dividend rows preserve original holdings",
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertRowPreservingSpyTaxable() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "토스SPYM ①SPY ②위탁 ③성장 ④위탁", ticker: "", valueKRW: 5_000_000 }),
    holding({ productName: "토스VOO ①SPY ②위탁 ③성장 ④위탁", ticker: "", valueKRW: 600_000 }),
    holding({ productName: "KB위탁TIGER에센피 ①SPY ②위탁 ③성장 ④위탁", ticker: "", valueKRW: 6_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 3);
  assert.deepEqual(result.taxableHoldings.map((row) => row.ticker), ["SPY", "SPY", "SPY"]);
  assert.equal(result.taxableTotalKRW, 11_600_000);
  assert.equal(result.taxableTotalKRW, result.taxableHoldings.reduce((sum, row) => sum + row.valueKRW, 0));
  assert.ok(result.taxableHoldings.some((row) => row.name.includes("토스SPYM")));
  assert.ok(result.taxableHoldings.some((row) => row.name.includes("토스VOO")));
  assert.ok(result.taxableHoldings.some((row) => row.name.includes("KB위탁TIGER에센피")));

  return {
    case: "row-preserving SPY taxable",
    taxableRows: result.taxableHoldings.length,
    taxableTotalKRW: result.taxableTotalKRW,
    tickers: result.taxableHoldings.map((row) => row.ticker).join(", "),
  };
}

function assertLeveragedNasdaqExcludedFromTaxable() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "키움QQQ ①QQQ ②위탁 value", ticker: "QQQ", valueKRW: 1_000_000 }),
    holding({ productName: "토스QLD ①QLD ②위탁 value", ticker: "QLD", valueKRW: 1_000_000 }),
    holding({ productName: "삼성TQQQ ①TQQQ ②위탁 value", ticker: "TQQQ", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxableTotalKRW, 0);

  return {
    case: "QQQ/QLD/TQQQ excluded from taxable",
    taxableRows: result.taxableHoldings.length,
  };
}

function assertPensionSpyTaxAdvantagedOnly() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금RISE미국S&P500 ①SPY ②위탁 ③성장 ④연금", ticker: "", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "SPY");

  return {
    case: "pension SPY tax-advantaged only",
    taxableRows: result.taxableHoldings.length,
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
    ticker: result.taxAdvantagedHoldings[0].ticker,
  };
}

function assertIsaQqqIncludedInTaxAdvantaged() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "KBISAACE미국나스닥100 ①QQQ ②ISA ③성장 ④ISA", ticker: "", valueKRW: 10_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "QQQ");
  assert.equal(result.taxAdvantagedTotalKRW, 10_000_000);

  return {
    case: "ISA QQQ tax-advantaged include",
    ticker: result.taxAdvantagedHoldings[0].ticker,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertMmfKrwExcludedWithWarning() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금국채혼합MMF ①KRW ②연금 ③현금 ④연금", ticker: "", valueKRW: 43_000_000 }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("cash_like")));

  return {
    case: "KRW/MMF excluded from tax-advantaged",
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
    warnings: result.warnings.length,
  };
}

function assertMinimumValueExcludedFromBoth() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "미래연금RISE미국S&P500 ①SPY ②연금 ④연금", ticker: "", valueKRW: 200_000 }),
    holding({ productName: "토스VOO ①SPY ②위탁 ④위탁", ticker: "", valueKRW: 200_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 0);
  assert.equal(result.taxAdvantagedHoldings.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("below_minimum_value")));

  return {
    case: "<= 200,000 excluded from both",
    taxableRows: result.taxableHoldings.length,
    taxAdvantagedRows: result.taxAdvantagedHoldings.length,
  };
}

function assertKoreanEtfQuoteTickerUsesDividendBucket() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({
      productName: "KBISAACE미국S&P500 ①SPY ②ISA ③성장 ④ISA",
      ticker: "360200.KS",
      valueKRW: 17_000_000,
    }),
  ]);

  assert.equal(result.taxAdvantagedHoldings.length, 1);
  assert.equal(result.taxAdvantagedHoldings[0].ticker, "SPY");
  assert.notEqual(result.taxAdvantagedHoldings[0].ticker, "360200.KS");

  return {
    case: "Korean ETF quoteTicker uses dividendBucket",
    quoteTicker: "360200.KS",
    displayTicker: result.taxAdvantagedHoldings[0].ticker,
  };
}

function assertVisibleTotalsMatchRows() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "삼성위탁SCHD ①SCHD ②위탁 ③배당 ④위탁", ticker: "", valueKRW: 1_000_000 }),
    holding({ productName: "토스SPYM ①SPY ②위탁 ③성장 ④위탁", ticker: "", valueKRW: 5_000_000 }),
    holding({ productName: "KBISAACE미국나스닥100 ①QQQ ②ISA ③성장 ④ISA", ticker: "", valueKRW: 10_000_000 }),
    holding({ productName: "미래연금국채혼합MMF ①KRW ②연금 ③현금 ④연금", ticker: "", valueKRW: 43_000_000 }),
  ]);

  const taxableSum = result.taxableHoldings.reduce((sum, row) => sum + row.valueKRW, 0);
  const taxAdvantagedSum = result.taxAdvantagedHoldings.reduce((sum, row) => sum + row.valueKRW, 0);

  assert.equal(result.taxableTotalKRW, taxableSum);
  assert.equal(result.taxAdvantagedTotalKRW, taxAdvantagedSum);
  assert.equal(result.taxableTotalKRW, 6_000_000);
  assert.equal(result.taxAdvantagedTotalKRW, 10_000_000);
  assert.equal([...result.taxableHoldings, ...result.taxAdvantagedHoldings].some((row) => row.ticker === "—"), false);

  return {
    case: "totals match visible rows",
    taxableTotalKRW: result.taxableTotalKRW,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertStrictMixedTotals() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "삼성위탁SCHD ①SCHD ②위탁 ③배당 ④위탁", ticker: "", valueKRW: 1_000_000 }),
    holding({ productName: "키움QQQ ①QQQ ②위탁 ③성장 ④위탁", ticker: "QQQ", valueKRW: 1_000_000 }),
    holding({ productName: "미래연금RISE미국S&P500 ①SPY ②위탁 ③성장 ④위탁", ticker: "", valueKRW: 1_000_000 }),
    holding({ productName: "미래연금ACE미국S&P500 ①SPY ②연금 ③성장 ④연금", ticker: "", valueKRW: 57_610_140 }),
    holding({ productName: "KBISAACE미국S&P500 ①SPY ②기타 ③성장 ④ISA", ticker: "", valueKRW: 17_221_035 }),
    holding({ productName: "미래연금RISE미국S&P500", ticker: "", valueKRW: 268_125 }),
    holding({ productName: "토스VOO ①SPY ②위탁 ③성장 ④위탁", ticker: "", valueKRW: 200_000 }),
    holding({ productName: "토스VOO ①SPY ②위탁 ③성장 ④위탁 #소액", ticker: "", valueKRW: 1_000_000 }),
    holding({ productName: "미래연금국채혼합MMF ①KRW ②연금 ③현금 ④연금", ticker: "", valueKRW: 43_513_200 }),
  ]);

  assert.equal(result.taxableTotalKRW, 1_000_000);
  assert.equal(result.taxAdvantagedTotalKRW, 76_099_300);
  return {
    case: "strict mixed totals",
    taxableTotalKRW: result.taxableTotalKRW,
    taxAdvantagedTotalKRW: result.taxAdvantagedTotalKRW,
  };
}

function assertQuantityAverageCostCurrentPricePreserved() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({
      productName: "①SPY ②위탁 SPDR S&P 500",
      ticker: "SPY",
      valueKRW: 3_000_000,
      quantity: 19,
      averageCost: 330.69,
      currentPrice: 390.74,
      currency: "USD",
    }),
  ]);

  assert.equal(result.taxableHoldings.length, 1);
  assert.equal(result.taxableHoldings[0].quantity, 19);
  assert.equal(result.taxableHoldings[0].averageCost, 330.69);
  assert.equal(result.taxableHoldings[0].averageCostCurrency, "USD");
  assert.equal(result.taxableHoldings[0].currentPrice, 390.74);
  assert.equal(result.taxableHoldings[0].currentPriceCurrency, "USD");

  return {
    case: "quantity/avg/current preserved",
    quantity: result.taxableHoldings[0].quantity,
    averageCost: result.taxableHoldings[0].averageCost,
    currentPrice: result.taxableHoldings[0].currentPrice,
  };
}

function assertMissingQuantityAverageCostStayMissing() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({
      productName: "①SCHD ②위탁 Schwab US Dividend Equity",
      ticker: "SCHD",
      valueKRW: 1_000_000,
    }),
  ]);

  assert.equal(result.taxableHoldings.length, 1);
  assert.equal(result.taxableHoldings[0].quantity, undefined);
  assert.equal(result.taxableHoldings[0].averageCost, undefined);

  return {
    case: "missing quantity/avg remain undefined",
    quantityDisplay: "—",
    averageCostDisplay: "—",
  };
}

function assertDividendHoldingWeightCalculation() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①SPY ②위탁 A", ticker: "SPY", valueKRW: 3_000_000 }),
    holding({ productName: "①SCHD ②위탁 B", ticker: "SCHD", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 2);
  const byName = Object.fromEntries(result.taxableHoldings.map((row) => [row.name, row]));
  assert.equal(dividendHoldingWeightPct(byName["①SPY ②위탁 A"], result.taxableTotalKRW), 75);
  assert.equal(dividendHoldingWeightPct(byName["①SCHD ②위탁 B"], result.taxableTotalKRW), 25);
  assert.equal(dividendHoldingWeightPct(byName["①SPY ②위탁 A"], 0), null);

  return {
    case: "table weight calculation",
    aWeightPct: dividendHoldingWeightPct(byName["①SPY ②위탁 A"], result.taxableTotalKRW),
    bWeightPct: dividendHoldingWeightPct(byName["①SCHD ②위탁 B"], result.taxableTotalKRW),
  };
}

function assertDuplicateSpyRowsStillSeparate() {
  const result = buildDividendHoldingGroupsFromHoldings([
    holding({ productName: "①SPY ②위탁 SPY lot A", ticker: "SPY", valueKRW: 3_000_000 }),
    holding({ productName: "①SPY ②위탁 SPY lot B", ticker: "SPY", valueKRW: 1_000_000 }),
  ]);

  assert.equal(result.taxableHoldings.length, 2);
  assert.deepEqual(result.taxableHoldings.map((row) => row.ticker), ["SPY", "SPY"]);
  assert.deepEqual(result.taxableHoldings.map((row) => row.name), [
    "①SPY ②위탁 SPY lot A",
    "①SPY ②위탁 SPY lot B",
  ]);

  return {
    case: "duplicate SPY rows still separate",
    taxableRows: result.taxableHoldings.length,
    tickers: result.taxableHoldings.map((row) => row.ticker).join(", "),
  };
}

function main() {
  const rows = [
    assertTaxableInclude(),
    assertTaxableExcludedByAmount(),
    assertTaxableExcludedBySmallTag(),
    assertTaxableExcludedByCategory(),
    assertTaxAdvantagedInclude(),
    assertMixedTotals(),
    assertSpyMarkerDisplayTicker(),
    assertStatusPensionIncludesTaxAdvantaged(),
    assertStatusIsaIncludesTaxAdvantaged(),
    assertSp500FallbackInfersSpy(),
    assertTaxableSpyDisplayTicker(),
    assertStrictTaxableInclude(),
    assertTaxableExcludedByTaxAdvantagedSignal(),
    assertIsaStatusOnlyInclude(),
    assertSp500FallbackWithoutMarker(),
    assertTaxAdvantagedExcludesMmfCashLike(),
    assertTaxAdvantagedKoreanNasdaqBucket(),
    assertDividendRowsPreserveOriginalHoldings(),
    assertRowPreservingSpyTaxable(),
    assertLeveragedNasdaqExcludedFromTaxable(),
    assertPensionSpyTaxAdvantagedOnly(),
    assertIsaQqqIncludedInTaxAdvantaged(),
    assertMmfKrwExcludedWithWarning(),
    assertMinimumValueExcludedFromBoth(),
    assertKoreanEtfQuoteTickerUsesDividendBucket(),
    assertVisibleTotalsMatchRows(),
    assertStrictMixedTotals(),
    assertQuantityAverageCostCurrentPricePreserved(),
    assertMissingQuantityAverageCostStayMissing(),
    assertDividendHoldingWeightCalculation(),
    assertDuplicateSpyRowsStillSeparate(),
  ];

  console.log("Dividend holdings group regression passed.");
  console.table(rows);
}

main();
