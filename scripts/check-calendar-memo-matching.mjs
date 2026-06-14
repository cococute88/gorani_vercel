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
  canonicalMemoTickerKey,
  stripTickerSuffix,
  memoLookupKeys,
  lookupTickerMemo,
  hasTickerMemo,
  mergeMemoMaps,
} = require("../lib/calendar-memo-matching.ts");

function assertNormalization() {
  assert.equal(canonicalMemoTickerKey("  f  "), "F", "trims + uppercases single-letter ticker");
  assert.equal(canonicalMemoTickerKey("ohi"), "OHI", "uppercases");
  assert.equal(canonicalMemoTickerKey("360200.ks"), "360200.KS", "keeps suffix in canonical key");
  assert.equal(stripTickerSuffix("360200.KS"), "360200", "strips .KS suffix");
  assert.equal(stripTickerSuffix("005930.KQ"), "005930", "strips .KQ suffix");
  assert.equal(stripTickerSuffix("F"), "F", "single-letter ticker unaffected by suffix strip");
}

function assertLookupOrder() {
  // legacy memo map keyed by canonical uppercase ticker
  const memos = { F: "ford note", OHI: "reit note", "360200.KS": "krx note" };

  // exact / uppercase / suffix-stripped resolution
  assert.equal(lookupTickerMemo(memos, "F"), "ford note", "single-letter exact match");
  assert.equal(lookupTickerMemo(memos, "f"), "ford note", "lowercase resolves via uppercase key");
  assert.equal(lookupTickerMemo(memos, "OHI"), "reit note", "exact uppercase match");
  assert.equal(lookupTickerMemo(memos, "360200.KS"), "krx note", "suffixed ticker exact match");

  // suffix-stripped fallback: memo stored under base ticker, displayed with suffix
  const stripped = { "360200": "base note" };
  assert.equal(lookupTickerMemo(stripped, "360200.KS"), "base note", "suffix-stripped fallback hits base key");

  assert.equal(lookupTickerMemo(memos, "ZZZ"), "", "missing memo returns empty string");
  assert.equal(hasTickerMemo(memos, "F"), true, "hasTickerMemo true when present");
  assert.equal(hasTickerMemo(memos, "ZZZ"), false, "hasTickerMemo false when absent");

  // lookup key order: exact, uppercase, canonical, suffix-stripped
  assert.deepEqual(memoLookupKeys("360200.ks"), ["360200.ks", "360200.KS", "360200"], "key order exact/upper(canonical)/stripped");
}

function assertMerge() {
  const legacy = { F: "legacy ford", OHI: "legacy reit" };
  const local = { f: "edited ford", APAM: "new note" }; // local overrides + adds, re-keyed canonically
  const merged = mergeMemoMaps(legacy, local);
  assert.equal(merged.F, "edited ford", "local edit overrides legacy (canonical key)");
  assert.equal(merged.OHI, "legacy reit", "untouched legacy memo preserved");
  assert.equal(merged.APAM, "new note", "new local memo added");

  // empty string clears
  const cleared = mergeMemoMaps({ F: "x" }, { F: "" });
  assert.equal("F" in cleared, false, "empty memo clears the entry");
}

function assertSaveReadRoundtrip() {
  // Simulate: legacy import loads { F: ... }, user opens F (sees legacy memo),
  // edits it, saves under the canonical key, reloads → same key resolves.
  const legacy = { F: "ford legacy memo", "360200.KS": "krx legacy memo" };

  // Open before any edit → legacy memo is the initial value.
  assert.equal(lookupTickerMemo(legacy, "f"), "ford legacy memo", "single-letter F shows legacy memo on open");
  assert.equal(lookupTickerMemo(legacy, "360200.ks"), "krx legacy memo", ".KS ticker shows legacy memo on open");
  assert.equal(lookupTickerMemo(legacy, "ZZZ"), "", "missing memo → empty textarea");

  // Save an edit under the canonical key, then reload (merge legacy ⊕ local).
  const savedKey = canonicalMemoTickerKey("f");
  const local = { [savedKey]: "ford edited memo" };
  const reloaded = mergeMemoMaps(legacy, local);
  assert.equal(lookupTickerMemo(reloaded, "F"), "ford edited memo", "edit persists across reload under same key");
  assert.equal(lookupTickerMemo(reloaded, "360200.KS"), "krx legacy memo", "untouched legacy memo survives reload");
}

function main() {
  assertNormalization();
  assertLookupOrder();
  assertMerge();
  assertSaveReadRoundtrip();
  console.log("Calendar memo matching rules passed.");
}

main();
