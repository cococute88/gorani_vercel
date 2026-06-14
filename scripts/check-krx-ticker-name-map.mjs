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
  STORAGE_KEYS,
} = require("../lib/storage-keys.ts");
const {
  applyKrxTickerMappingsToHoldings,
  findKrxTickerMappingForHolding,
  loadKrxTickerNameMap,
  normalizeKrxTickerForTickerMap,
  normalizeProductNameForTickerMap,
  upsertKrxTickerMapping,
} = require("../lib/krx-ticker-name-map.ts");

const STORAGE_KEY = STORAGE_KEYS.krxTickerNameMap;

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(values.entries());
    },
  };
}

function holding(overrides = {}) {
  return {
    id: overrides.id ?? "h-1",
    broker: "테스트증권",
    assetType: "ETF",
    productName: "KBISA KODEX 200 ETF (위탁)",
    principalKRW: 1_000_000,
    valueKRW: 1_100_000,
    ticker: "",
    ...overrides,
  };
}

function assertTickerNormalization() {
  assert.deepEqual(normalizeKrxTickerForTickerMap("069500"), {
    ticker: "069500",
    displayTicker: "069500.KS",
    suffix: "KS",
  });
  assert.deepEqual(normalizeKrxTickerForTickerMap(" 005930.ks "), {
    ticker: "005930",
    displayTicker: "005930.KS",
    suffix: "KS",
  });
  assert.deepEqual(normalizeKrxTickerForTickerMap("123456.KQ"), {
    ticker: "123456",
    displayTicker: "123456.KQ",
    suffix: "KQ",
  });
  assert.equal(normalizeKrxTickerForTickerMap("A005930"), null);
  assert.equal(normalizeKrxTickerForTickerMap("05930"), null);

  return { case: "ticker normalization", valid: 3, rejected: 2 };
}

function assertProductNameNormalization() {
  const normalized = [
    "KBISA KODEX 200 ETF (위탁)",
    "KODEX 200",
    "미래연금 KODEX 200 상장지수펀드",
    "KODEX-200 #①SPY #②ISA",
  ].map(normalizeProductNameForTickerMap);

  assert.deepEqual(normalized, ["KODEX200", "KODEX200", "KODEX200", "KODEX200"]);
  assert.notEqual(
    normalizeProductNameForTickerMap("KODEX 200(H)"),
    normalizeProductNameForTickerMap("KODEX 200"),
    "meaningful hedge marker should stay distinct",
  );

  return { case: "product name normalization", normalized: normalized[0] };
}

function assertStorageAndReuse() {
  const storage = createStorage();
  const saved = upsertKrxTickerMapping({
    holding: holding(),
    tickerInput: "069500",
    storage,
    now: "2026-06-14T00:00:00.000Z",
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.entry.ticker, "069500");
  assert.equal(saved.entry.displayTicker, "069500.KS");
  assert.equal(saved.normalizedProductName, "KODEX200");

  const loaded = loadKrxTickerNameMap(storage);
  assert.equal(loaded.KODEX200.ticker, "069500");
  assert.equal(loaded.KODEX200.displayTicker, "069500.KS");

  const reused = findKrxTickerMappingForHolding(holding({ productName: "KODEX 200", cleanName: "KODEX 200" }), loaded);
  assert.equal(reused?.displayTicker, "069500.KS");

  return { case: "storage and reuse", key: saved.normalizedProductName, ticker: saved.entry.displayTicker };
}

function assertApplyPolicyAndNoMutation() {
  const storage = createStorage();
  const saved = upsertKrxTickerMapping({
    rawProductName: "KBISA KODEX 200 ETF",
    tickerInput: "069500.KS",
    storage,
    now: "2026-06-14T00:00:00.000Z",
  });
  assert.equal(saved.ok, true);

  const original = [
    holding({ id: "empty", productName: "KODEX 200", cleanName: "KODEX 200", ticker: "" }),
    holding({ id: "existing", productName: "KODEX 200", cleanName: "KODEX 200", ticker: "111111.KS" }),
    holding({ id: "other", productName: "TIGER 200", cleanName: "TIGER 200", ticker: "" }),
  ];
  const before = JSON.stringify(original);
  const applied = applyKrxTickerMappingsToHoldings(original, saved.map);

  assert.equal(applied.appliedCount, 1);
  assert.equal(applied.holdings[0].ticker, "069500.KS");
  assert.equal(applied.holdings[0].tickerConfidence, "high");
  assert.equal(applied.holdings[0].needsReview, false);
  assert.equal(applied.holdings[1].ticker, "111111.KS");
  assert.equal(applied.holdings[2].ticker, "");
  assert.equal(JSON.stringify(original), before, "source holdings should not be mutated");

  return { case: "apply policy and immutability", applied: applied.appliedCount };
}

function assertInvalidAndMalformedDefense() {
  const storage = createStorage();
  const invalid = upsertKrxTickerMapping({
    rawProductName: "KODEX 200",
    tickerInput: "ABCDEF",
    storage,
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, "invalid_ticker");
  assert.equal(storage.getItem(STORAGE_KEY), null);

  assert.deepEqual(loadKrxTickerNameMap(createStorage({ [STORAGE_KEY]: "{not-json" })), {});
  assert.deepEqual(
    loadKrxTickerNameMap(createStorage({
      [STORAGE_KEY]: JSON.stringify({
        KODEX200: { ticker: "bad", displayTicker: "bad", rawProductName: "KODEX 200" },
        TIGER200: { ticker: "102110", displayTicker: "102110.KS", rawProductName: "TIGER 200" },
      }),
    })),
    {
      TIGER200: {
        ticker: "102110",
        displayTicker: "102110.KS",
        rawProductName: "TIGER 200",
        updatedAt: "",
      },
    },
  );

  const emptyApply = applyKrxTickerMappingsToHoldings([holding({ ticker: "" })], {});
  assert.equal(emptyApply.appliedCount, 0);
  assert.equal(emptyApply.holdings[0].ticker, "");

  return { case: "invalid and malformed defense", rejected: true };
}

function main() {
  const rows = [
    assertTickerNormalization(),
    assertProductNameNormalization(),
    assertStorageAndReuse(),
    assertApplyPolicyAndNoMutation(),
    assertInvalidAndMalformedDefense(),
  ];

  console.log("KRX ticker name map regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("KRX ticker name map regression failed.");
  console.error(error);
  process.exit(1);
}
