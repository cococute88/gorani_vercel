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
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const read = (rel) => fs.readFileSync(path.join(rootDir, rel), "utf8");
const dialog = read("components/watchlist/CalendarEventDialog.tsx");
const selected = read("components/watchlist/SelectedDateList.tsx");
const list = read("components/watchlist/CalendarEventList.tsx");
const page = read("components/watchlist/DividendCalendarPage.tsx");
const watchlist = read("components/watchlist/WatchlistPage.tsx");
const tickerMemoDialog = read("components/watchlist/TickerMemoDialog.tsx");
const tickerManager = read("components/watchlist/TickerManager.tsx");

const { lookupTickerMemo } = require("../lib/calendar-memo-matching.ts");

function assertMemoLookupFixtures() {
  const memos = {
    F: "ford memo",
    BCSF: "90.5% (29일, 1일) BDC(15.4)",
    OBDC: "93.8% (5일, 1일) BDC(15.4)",
    GSBD: "gsbd memo",
    FEPI: "fepi memo",
    "360200": "krx base memo",
  };
  assert.equal(lookupTickerMemo(memos, "F"), "ford memo", "F exact lookup");
  assert.equal(lookupTickerMemo(memos, "bcsf"), memos.BCSF, "lowercase BCSF lookup");
  assert.equal(lookupTickerMemo(memos, "OBDC"), memos.OBDC, "OBDC exact lookup");
  assert.equal(lookupTickerMemo(memos, "GSBD"), memos.GSBD, "GSBD exact lookup");
  assert.equal(lookupTickerMemo(memos, "fepi"), memos.FEPI, "FEPI lowercase lookup");
  assert.equal(lookupTickerMemo(memos, "360200.KS"), memos["360200"], ".KS suffix-stripped lookup");
  assert.equal(lookupTickerMemo(memos, "MISSING"), "", "missing memo returns empty");
}

function assertDialogMemoWiring() {
  assert.ok(dialog.includes("lookupTickerMemo"), "CalendarEventDialog uses shared ticker memo lookup helper");
  assert.ok(dialog.includes("tickerMemos?: Record<string, string>"), "CalendarEventDialog accepts ticker-level memo map");
  assert.ok(dialog.includes("onSaveTickerMemo?:"), "CalendarEventDialog accepts ticker-level save callback");
  assert.ok(dialog.includes("const tickerMemo = lookupTickerMemo(tickerMemos, event.ticker)"), "dialog resolves initial value from ticker-level memo first");
  assert.ok(dialog.includes("setMemo(tickerMemo || meta?.memo || event.note || \"\")"), "event memo is fallback, not primary source");
  assert.ok(dialog.includes("onSaveTickerMemo(event.ticker, memo)"), "dialog saves memo through ticker-level callback");
  assert.ok(!dialog.includes("star,\n      heart,\n      memo,"), "star/heart save does not duplicate ticker memo into event meta by default");
  assert.ok(dialog.includes("saveMeta({ memo })"), "event-level memo fallback path remains when no ticker save callback exists");
  assert.ok(tickerMemoDialog.includes("initialMemo") && tickerMemoDialog.includes("onSave(ticker, memo)"), "TickerMemoDialog remains prop-driven by same parent memo source");
  assert.ok(watchlist.includes("lookupTickerMemo(memos, memoTicker)"), "TickerMemoDialog initial memo uses shared lookup helper");
  assert.ok(watchlist.includes("saveLegacyDividendCalendarMemo"), "ticker memo save persists to legacy shared memo repository");
  assert.ok(tickerManager.includes("hasTickerMemo(memos, ticker)"), "ticker manager marks memo existence using shared matcher");
}

function assertSelectedDateAndTaxWiring() {
  assert.ok(selected.includes("tickerMemos") && selected.includes("taxSavingByTicker"), "SelectedDateList forwards memo and tax maps");
  assert.ok(list.includes("lookupTickerMemo"), "SelectedDateList cards resolve memos with shared matcher via CalendarEventList");
  assert.ok(list.includes("formatTaxSavingPer10k(row.taxSavingUsd)"), "SelectedDateList cards format tax from taxSavingByTicker source");
  assert.ok(page.includes("buildTaxSavingRows(monthEvents"), "DividendCalendarPage builds shared tax rows");
  assert.ok(page.includes("taxSavingByTicker"), "DividendCalendarPage builds per-ticker tax map");
  assert.ok(page.includes("taxSavingByTicker={taxSavingByTicker}"), "DividendCalendarPage passes tax map to CalendarEventDialog/SelectedDateList");
  assert.ok(dialog.includes("taxSavingByTicker?:"), "CalendarEventDialog accepts per-ticker tax map");
  assert.ok(dialog.includes("formatTaxSavingPer10k(taxSavingRow.taxSavingUsd)"), "CalendarEventDialog uses same formatted per-$10k tax source as selected-date cards");
  assert.ok(dialog.includes("event.taxSavingUsd > 0"), "CalendarEventDialog retains explicit event tax fallback");
}

function assertLabelsAndMeta() {
  assert.ok(dialog.includes("연간 배당률"), "annualYield label changed to annual dividend yield wording");
  assert.ok(!dialog.includes("연간 수익률"), "CalendarEventDialog no longer labels annualYield as total/price return");
  assert.ok(dialog.includes("절세액($10K)"), "summary tax label is present");
  assert.ok(dialog.includes("1회 절세 예상(과거5년)"), "historical five-year metric label is preserved and clarified");
  assert.ok(dialog.includes("star") && dialog.includes("heart") && page.includes("saveCalendarEventMeta"), "event star/heart meta path remains present");
}

assertMemoLookupFixtures();
assertDialogMemoWiring();
assertSelectedDateAndTaxWiring();
assertLabelsAndMeta();
console.log("Calendar dialog memo/tax-source rules passed.");
