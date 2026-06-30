#!/usr/bin/env node

// Step-by-step data-flow trace for the dividend calendar pipeline, focused on
// RITM (Rithm Capital, monthly payer). It reproduces the real-world failure that
// PR #167 left unsolved: Yahoo's dividend history lags behind Polygon's already
// CONFIRMED next ex-date, so a Yahoo-seeded projection fabricated an ESTIMATED
// row a few days away from the confirmed one — and because the two ex-dates
// differ, neither the proximity dedup nor the exact-key cache merge removed it,
// leaving RITM showing BOTH a confirmed and an estimated row on different dates.
//
// This trace prints, for every stage, each event's:
//   event_type · ex_date · buy_date · payment_date · estimated · source
// so it is obvious WHERE an estimated row would appear and that it no longer does
// after seeding the projection from the union of confirmed sources (the original
// Streamlit `last_ex_div` behaviour in original/modules/dividend_calendar.py).
//
// Run: node scripts/trace-ritm-dividend-pipeline.mjs

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
  buildDeclaredDividendCalendarEvents,
  buildProjectedDividendCalendarEvents,
  mergeDeclaredAndProjectedEvents,
  mergeFetchedEventsWithExistingCache,
  buildLiveCalendarCacheEntry,
} = require("../lib/calendar-dividend-live.ts");

const TICKER = "RITM";
const TODAY = new Date("2026-06-30T00:00:00Z");

// --- Stage 0: simulated provider responses --------------------------------
// Polygon (declared, confirmed) — RITM pays monthly near month-end. The June 26
// and July 31 ex-dates are ALREADY CONFIRMED by Polygon (the case the user
// reported: "Polygon 기준 이미 확정").
const polygonRows = [
  { exDate: "2026-07-31", amount: 0.25, payDate: "2026-08-31" },
  { exDate: "2026-06-26", amount: 0.25, payDate: "2026-07-31" },
  { exDate: "2026-05-29", amount: 0.25, payDate: "2026-06-30" },
  { exDate: "2026-04-30", amount: 0.25, payDate: "2026-05-29" },
  { exDate: "2026-03-31", amount: 0.25, payDate: "2026-04-30" },
];

// Yahoo history (used for projection seed) — note it LAGS: its latest row is
// 2026-04-30, i.e. it does NOT yet know about the confirmed May/June/July ex-dates.
const yahooHistoryRows = [
  { date: "2026-04-30", amount: 0.25 },
  { date: "2026-03-31", amount: 0.25 },
  { date: "2026-02-27", amount: 0.25 },
  { date: "2026-01-30", amount: 0.25 },
  { date: "2025-12-31", amount: 0.25 },
  { date: "2025-11-28", amount: 0.25 },
  { date: "2025-10-31", amount: 0.25 },
  { date: "2025-09-30", amount: 0.25 },
];

function rowOf(event) {
  return {
    event_type: event.type,
    ex_date: event.exDivDate || "-",
    buy_date: event.type === "buy_by" ? event.date : event.buyDeadline || "-",
    payment_date: event.paymentDate || "-",
    estimated: event.status === "estimated",
    source: event.sourceKind,
  };
}

function printStage(title, events) {
  console.log(`\n=== ${title} (${events.length} events) ===`);
  const rows = [...events]
    .sort((a, b) => (a.exDivDate || a.date).localeCompare(b.exDivDate || b.date) || a.type.localeCompare(b.type))
    .map(rowOf);
  console.table(rows);
}

console.log(`\n################ RITM DIVIDEND PIPELINE TRACE (today=${TODAY.toISOString().slice(0, 10)}) ################`);

// --- Stage 1: Polygon API response ----------------------------------------
console.log("\n--- Stage 1: Polygon API response (declared rows) ---");
console.table(polygonRows);
console.log("--- Yahoo history rows (projection seed source) ---");
console.table(yahooHistoryRows);

// --- Stage 2: Declared events ---------------------------------------------
const declared = buildDeclaredDividendCalendarEvents(TICKER, polygonRows, "declared");
printStage("Stage 2 · Declared events (Polygon → confirmed)", declared);

// --- Stage 3a: Projection seeded from YAHOO ONLY (the old, buggy behaviour) -
const projectedYahooOnly = buildProjectedDividendCalendarEvents(TICKER, yahooHistoryRows, TODAY);
printStage(
  "Stage 3a · Projection seeded from YAHOO-ONLY history (OLD behaviour — note the spurious May/Jun/Jul estimates)",
  projectedYahooOnly,
);
const spuriousOld = projectedYahooOnly.filter(
  (e) => e.type === "ex_div" && e.exDivDate <= "2026-07-31",
);
console.log(
  `OLD projection produced ${spuriousOld.length} estimated ex_div row(s) on/before the last confirmed ex-date (2026-07-31): ` +
    `${spuriousOld.map((e) => e.exDivDate).join(", ") || "none"}`,
);

// --- Stage 3b: Projection seeded from UNION (the fix) ----------------------
const projectionSeed = mergeFetchedEventsWithExistingCache; // referenced for clarity; not used here
void projectionSeed;
const events = mergeDeclaredAndProjectedEvents(TICKER, polygonRows, yahooHistoryRows, TODAY);
const projectedAfter = events.filter((e) => e.status === "estimated");
printStage(
  "Stage 3b · Projection after union-seed fix (estimates start only AFTER last confirmed 2026-07-31)",
  projectedAfter,
);

// --- Stage 4: Merge (declared + projected) --------------------------------
printStage("Stage 4 · Merge result (declared + surviving projected)", events);

// --- Stage 5: Dedupe vs existing cache (simulate repeated 최신화) ----------
// existingEvents simulates a prior page-load cache that contained Yahoo-only
// estimated rows (including a spurious 2026-07-30 estimate near the confirmed
// 2026-07-31). The merge must keep the confirmed row and never resurrect the
// estimate.
const staleEstimatedCache = projectedYahooOnly; // contains the spurious estimates
const dedupedFirst = mergeFetchedEventsWithExistingCache(staleEstimatedCache, events);
printStage("Stage 5 · Dedupe vs stale estimated cache (1st 최신화)", dedupedFirst);
const dedupedSecond = mergeFetchedEventsWithExistingCache(dedupedFirst, events);
printStage("Stage 5 · Dedupe again (2nd 최신화 — must be identical, no regeneration)", dedupedSecond);

// --- Stage 6: Cache entry --------------------------------------------------
const cacheEntry = buildLiveCalendarCacheEntry(TICKER, dedupedFirst, "polygon", []);
console.log(`\n=== Stage 6 · Cache entry (ticker=${cacheEntry.ticker}, source=${cacheEntry.source}, events=${cacheEntry.events.length}) ===`);

// --- Stage 7: Final UI events ---------------------------------------------
printStage("Stage 7 · Final UI events", cacheEntry.events);

// --- Assertions (verification of the fix) ---------------------------------
const confirmedJul = events.filter((e) => e.type === "ex_div" && e.exDivDate === "2026-07-31");
assert.equal(confirmedJul.length, 1, "exactly one ex_div for the confirmed 2026-07-31 dividend");
assert.equal(confirmedJul[0].status, "confirmed", "RITM 7/31 ex-div is CONFIRMED, not estimated");

const buyJul = events.find((e) => e.type === "buy_by" && e.exDivDate === "2026-07-31");
assert.equal(buyJul.status, "confirmed", "RITM 7/31 buy is confirmed");
const payJul = events.find((e) => e.type === "pay" && e.exDivDate === "2026-07-31");
assert.equal(payJul.date, "2026-08-31", "declared payment date preserved verbatim");

// No estimated row anywhere on or before the last confirmed ex-date.
const lingeringEstimates = events.filter((e) => e.status === "estimated" && e.exDivDate <= "2026-07-31");
assert.equal(lingeringEstimates.length, 0, "no estimated row for any confirmed period (<= 2026-07-31)");

// Repeated refresh is idempotent (no duplicate / regenerated estimates).
assert.equal(dedupedFirst.length, dedupedSecond.length, "repeated 최신화 does not change event count");

// Future estimates still roll forward beyond the confirmed window.
assert.ok(events.some((e) => e.status === "estimated" && e.exDivDate > "2026-07-31"), "genuine future estimates still projected");

console.log("\n✅ RITM trace assertions passed: confirmed Polygon dividends suppress estimated projections at the projection stage; refresh is idempotent.");
