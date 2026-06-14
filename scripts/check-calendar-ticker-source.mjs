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
  resolveCalendarTickerSource,
  resolveCalendarTickers,
  isValidManualCalendarTickerList,
  createManualCalendarTickerList,
  readValidManualOverrideTickers,
  extractTickersFromCalendarEvents,
  flattenLegacyPortfolioTickers,
  MANUAL_CALENDAR_TICKERS_SOURCE,
  MANUAL_CALENDAR_TICKERS_VERSION,
} = require("../lib/calendar-ticker-source.ts");

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

// ---------------------------------------------------------------------------
// 1. Stale (metadata-less) override must NOT shadow imported legacy data.
// ---------------------------------------------------------------------------
function assertStaleOverrideIgnored() {
  const importedEvents = [
    { ticker: "BCSF", type: "ex_div" },
    { ticker: "FEPI", type: "ex_div" },
    { ticker: "OTF", type: "buy_by" },
  ];
  const legacyEventTickers = extractTickersFromCalendarEvents(importedEvents);

  // The old stored shape is a bare array → stale, ignored.
  const staleArray = ["QQQ", "SPY", "MSFT", "360200.KS"];
  const resolved = resolveCalendarTickerSource({
    manualOverride: staleArray,
    legacyEventTickers,
    fallbackTickers: ["SCHD"],
  });
  assert.equal(resolved.source, "legacy-events", "stale array override does not win");
  assert.deepEqual(resolved.tickers, ["BCSF", "FEPI", "OTF"], "imported legacy tickers used, not stale holdings");
  assert.equal(resolved.tickers.includes("QQQ"), false, "no stale QQQ");
  assert.equal(resolved.tickers.includes("360200.KS"), false, "no stale KRX holding");

  // A metadata-less object is also stale.
  const staleObject = { tickers: ["QQQ", "SPY"] };
  assert.deepEqual(
    resolveCalendarTickerSource({ manualOverride: staleObject, legacyEventTickers }).tickers,
    ["BCSF", "FEPI", "OTF"],
    "metadata-less object override ignored",
  );

  return { resolved: resolved.tickers };
}

// ---------------------------------------------------------------------------
// 2. Only a valid metadata-tagged manual override wins.
// ---------------------------------------------------------------------------
function assertValidManualOverrideWins() {
  const legacyEventTickers = ["BCSF", "FEPI", "OTF"];
  const manual = createManualCalendarTickerList(["bcsf", "otf"]);

  assert.equal(manual.source, MANUAL_CALENDAR_TICKERS_SOURCE);
  assert.equal(manual.version, MANUAL_CALENDAR_TICKERS_VERSION);
  assert.deepEqual(manual.tickers, ["BCSF", "OTF"], "manual list normalized");
  assert.ok(isValidManualCalendarTickerList(manual), "created list is valid");

  const resolved = resolveCalendarTickerSource({ manualOverride: manual, legacyEventTickers });
  assert.equal(resolved.source, "manual", "valid manual override wins");
  assert.deepEqual(resolved.tickers, ["BCSF", "OTF"], "manual tickers used");

  // Empty manual override falls through to legacy.
  const emptyManual = createManualCalendarTickerList([]);
  const fellThrough = resolveCalendarTickerSource({ manualOverride: emptyManual, legacyEventTickers });
  assert.equal(fellThrough.source, "legacy-events", "empty manual override falls back to legacy");

  // Version < 2 is rejected.
  assert.equal(isValidManualCalendarTickerList({ source: MANUAL_CALENDAR_TICKERS_SOURCE, version: 1, tickers: ["X"] }), false, "version 1 rejected");
  assert.deepEqual(readValidManualOverrideTickers(["QQQ"]), [], "bare array yields no override tickers");
  assert.deepEqual(readValidManualOverrideTickers(manual), ["BCSF", "OTF"], "valid override yields tickers");

  return { manual: resolved.tickers };
}

// ---------------------------------------------------------------------------
// 3. Priority chain + /portfolio holdings are never a source.
// ---------------------------------------------------------------------------
function assertPriorityChain() {
  // portfolios > events > memos > fallback
  assert.equal(
    resolveCalendarTickerSource({ legacyPortfolioTickers: ["OTF"], legacyEventTickers: ["BCSF"], legacyMemoKeys: ["F"], fallbackTickers: ["SCHD"] }).source,
    "legacy-portfolios",
  );
  assert.equal(
    resolveCalendarTickerSource({ legacyEventTickers: ["BCSF"], legacyMemoKeys: ["F"], fallbackTickers: ["SCHD"] }).source,
    "legacy-events",
  );
  assert.equal(resolveCalendarTickerSource({ legacyMemoKeys: ["F"], fallbackTickers: ["SCHD"] }).source, "legacy-memos");
  assert.equal(resolveCalendarTickerSource({ fallbackTickers: ["SCHD"] }).source, "fallback");
  assert.equal(resolveCalendarTickerSource({}).source, "empty");

  // helper extraction excludes custom + dedupes; portfolios flatten across groups.
  assert.deepEqual(
    extractTickersFromCalendarEvents([
      { ticker: "OTF", type: "ex_div" },
      { ticker: "OTF", type: "buy_by" },
      { ticker: "NOTE", type: "custom" },
    ]),
    ["OTF"],
  );
  assert.deepEqual(flattenLegacyPortfolioTickers({ a: ["otf", "fepi"], b: ["fepi", "bcsf"] }), ["OTF", "FEPI", "BCSF"]);

  assert.deepEqual(resolveCalendarTickers({ legacyEventTickers: ["bcsf"] }), ["BCSF"]);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 4. Page wiring: WatchlistPage uses the manual-override loader, not the stale
//    per-ticker collection or /portfolio snapshots.
// ---------------------------------------------------------------------------
function assertPageWiring() {
  const page = read("components/watchlist/WatchlistPage.tsx");
  assert.ok(page.includes("loadManualCalendarTickers"), "page loads the metadata-tagged manual override");
  assert.ok(page.includes("saveManualCalendarTickers"), "page saves a metadata-tagged manual override");
  assert.ok(page.includes("readValidManualOverrideTickers"), "page validates stored override before using it");
  assert.equal(page.includes("loadCalendarTickers("), false, "page no longer reads the stale calendarTickers collection");
  assert.equal(page.includes("usePortfolioSnapshots"), false, "page never derives tickers from /portfolio snapshots");

  return { ok: true };
}

function main() {
  const stale = assertStaleOverrideIgnored();
  const manual = assertValidManualOverrideWins();
  const priority = assertPriorityChain();
  const wiring = assertPageWiring();

  console.log("Calendar ticker source rules passed.");
  console.table([{ ...stale, ...manual, ...priority, ...wiring }]);
}

main();
