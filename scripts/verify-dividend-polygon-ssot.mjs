#!/usr/bin/env node

// Polygon Single-Source-of-Truth verification for the dividend-calendar refresh.
//
// Goal (restoring the original Streamlit "일정 최신화" behaviour in
// original/modules/dividend_calendar.py): when the refresh runs, the CONFIRMED
// declared series (Polygon on production) is the ONLY basis for both the
// confirmed events AND the estimated projection seed. Yahoo's dividend history —
// which lags ~one payout period behind — must NEVER advance the projection seed
// or fabricate a near-term ESTIMATED row for a period Polygon already confirms.
//
// This script feeds, for each ticker, BOTH:
//   1. a Polygon-style declared series that INCLUDES the confirmed upcoming
//      ex-date (exactly what Polygon returns on production), and
//   2. a deliberately LAGGING Yahoo history (latest row one period behind),
// then prints every generated Calendar Event
//   (ticker · eventType · source · estimated · exDate · buyDate · paymentDate)
// and asserts the upcoming dividend is CONFIRMED (not Estimated) and that no
// estimated row appears on/before the last confirmed ex-date.
//
// Run: node scripts/verify-dividend-polygon-ssot.mjs

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

const { mergeDeclaredAndProjectedEvents } = require("../lib/calendar-dividend-live.ts");

const TODAY = new Date("2026-06-30T00:00:00Z");

// Real confirmed data observed on 2026-06-30 (the upcoming ex-date is what
// Polygon/Streamlit treat as CONFIRMED; chart history lags behind it). Each
// `polygon` series is sorted desc exactly like Polygon's API response and
// INCLUDES the confirmed upcoming ex-date. Each `yahooLagging` history stops one
// period earlier, reproducing the real Yahoo lag that previously leaked an
// estimate (e.g. RITM 2026-04-06 + 3M = 2026-07-06).
const FIXTURES = [
  {
    ticker: "RITM",
    confirmedNextEx: "2026-07-02",
    polygon: [
      { exDate: "2026-07-02", amount: 0.25, payDate: "2026-07-31" },
      { exDate: "2026-04-06", amount: 0.25, payDate: "2026-04-30" },
      { exDate: "2025-12-31", amount: 0.25, payDate: "2026-01-30" },
      { exDate: "2025-10-01", amount: 0.25, payDate: "2025-10-31" },
      { exDate: "2025-06-30", amount: 0.25, payDate: "2025-07-31" },
    ],
    yahooLagging: [
      { date: "2025-06-30", amount: 0.25 },
      { date: "2025-10-01", amount: 0.25 },
      { date: "2025-12-31", amount: 0.25 },
      { date: "2026-04-06", amount: 0.25 },
    ],
  },
  {
    ticker: "BXSL",
    confirmedNextEx: "2026-06-30",
    polygon: [
      { exDate: "2026-06-30", amount: 0.77, payDate: "2026-07-24" },
      { exDate: "2026-03-31", amount: 0.77, payDate: "2026-04-24" },
      { exDate: "2025-12-31", amount: 0.77, payDate: "2026-01-26" },
      { exDate: "2025-09-30", amount: 0.77, payDate: "2025-10-24" },
      { exDate: "2025-06-30", amount: 0.77, payDate: "2025-07-24" },
    ],
    yahooLagging: [
      { date: "2025-06-30", amount: 0.77 },
      { date: "2025-09-30", amount: 0.77 },
      { date: "2025-12-31", amount: 0.77 },
      { date: "2026-03-31", amount: 0.77 },
    ],
  },
  {
    ticker: "OBDC",
    confirmedNextEx: "2026-06-30",
    polygon: [
      { exDate: "2026-06-30", amount: 0.37, payDate: "2026-07-15" },
      { exDate: "2026-03-31", amount: 0.37, payDate: "2026-04-15" },
      { exDate: "2025-12-31", amount: 0.37, payDate: "2026-01-15" },
      { exDate: "2025-09-30", amount: 0.37, payDate: "2025-10-15" },
    ],
    yahooLagging: [
      { date: "2025-09-30", amount: 0.37 },
      { date: "2025-12-31", amount: 0.37 },
      { date: "2026-03-31", amount: 0.37 },
    ],
  },
  {
    ticker: "GIS",
    confirmedNextEx: "2026-04-10",
    polygon: [
      { exDate: "2026-04-10", amount: 0.61, payDate: "2026-05-01" },
      { exDate: "2026-01-09", amount: 0.61, payDate: "2026-02-02" },
      { exDate: "2025-10-10", amount: 0.61, payDate: "2025-11-03" },
      { exDate: "2025-07-10", amount: 0.61, payDate: "2025-08-01" },
    ],
    yahooLagging: [
      { date: "2025-07-10", amount: 0.61 },
      { date: "2025-10-10", amount: 0.61 },
      { date: "2026-01-09", amount: 0.61 },
      { date: "2026-04-10", amount: 0.61 },
    ],
  },
  {
    ticker: "USB",
    confirmedNextEx: "2026-06-30",
    polygon: [
      { exDate: "2026-06-30", amount: 0.52, payDate: "2026-07-15" },
      { exDate: "2026-03-31", amount: 0.52, payDate: "2026-04-15" },
      { exDate: "2025-12-31", amount: 0.52, payDate: "2026-01-15" },
      { exDate: "2025-09-30", amount: 0.52, payDate: "2025-10-15" },
      { exDate: "2025-06-30", amount: 0.50, payDate: "2025-07-15" },
    ],
    yahooLagging: [
      { date: "2025-06-30", amount: 0.50 },
      { date: "2025-09-30", amount: 0.52 },
      { date: "2025-12-31", amount: 0.52 },
      { date: "2026-03-31", amount: 0.52 },
    ],
  },
];

function rowOf(event) {
  return {
    ticker: event.ticker,
    eventType: event.type,
    source: event.sourceKind,
    estimated: event.status === "estimated",
    exDate: event.exDivDate || "-",
    buyDate: event.type === "buy_by" ? event.date : event.buyDeadline || "-",
    paymentDate: event.paymentDate || "-",
  };
}

console.log(`\n############ POLYGON SSOT DIVIDEND VERIFICATION (today=${TODAY.toISOString().slice(0, 10)}) ############`);

let failures = 0;
for (const fixture of FIXTURES) {
  const { ticker, polygon, yahooLagging, confirmedNextEx } = fixture;
  // Exactly the production refresh call: declared = Polygon (SSOT), history =
  // lagging Yahoo (must NOT influence the seed).
  const events = mergeDeclaredAndProjectedEvents(ticker, polygon, yahooLagging, TODAY);

  console.log(`\n=== ${ticker} · confirmed next ex=${confirmedNextEx} (${events.length} events) ===`);
  console.table(
    [...events]
      .sort((a, b) => (a.exDivDate || a.date).localeCompare(b.exDivDate || b.date) || a.type.localeCompare(b.type))
      .map(rowOf),
  );

  try {
    // 1) The upcoming dividend is CONFIRMED (declared), never Estimated.
    const nextEx = events.filter((e) => e.type === "ex_div" && e.exDivDate === confirmedNextEx);
    assert.equal(nextEx.length, 1, `${ticker}: exactly one ex_div on the confirmed next ex-date ${confirmedNextEx}`);
    assert.equal(nextEx[0].status, "confirmed", `${ticker}: next ex-date ${confirmedNextEx} must be CONFIRMED`);
    assert.equal(nextEx[0].sourceKind, "declared", `${ticker}: next ex-date must come from declared (Polygon)`);

    // 2) Buy + Payment for that dividend also exist and are confirmed.
    const buy = events.find((e) => e.type === "buy_by" && e.exDivDate === confirmedNextEx);
    const pay = events.find((e) => e.type === "pay" && e.exDivDate === confirmedNextEx);
    assert.ok(buy && buy.status === "confirmed", `${ticker}: confirmed Buy for ${confirmedNextEx}`);
    assert.ok(pay && pay.status === "confirmed", `${ticker}: confirmed Payment for ${confirmedNextEx}`);

    // 3) No ESTIMATED row may land on/before the last confirmed ex-date — this is
    //    the RITM 2026-07-06 symptom; it must be gone.
    const lastConfirmedEx = events
      .filter((e) => e.type === "ex_div" && e.status === "confirmed")
      .map((e) => e.exDivDate)
      .sort()
      .at(-1);
    const leaking = events.filter((e) => e.status === "estimated" && e.exDivDate <= lastConfirmedEx);
    assert.equal(leaking.length, 0, `${ticker}: no estimated row on/before last confirmed ex ${lastConfirmedEx}; found ${leaking.map((e) => e.exDivDate).join(", ")}`);

    // 4) Idempotency — re-running the refresh must not change the result count.
    const again = mergeDeclaredAndProjectedEvents(ticker, polygon, yahooLagging, TODAY);
    assert.equal(again.length, events.length, `${ticker}: repeated 최신화 is idempotent`);

    console.log(`✅ ${ticker}: next ex ${confirmedNextEx} CONFIRMED; no leaking estimate; idempotent.`);
  } catch (error) {
    failures += 1;
    console.error(`❌ ${ticker}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// RITM-specific guard: the previously-reported spurious 2026-07-06 estimate must
// never be produced.
const ritmEvents = mergeDeclaredAndProjectedEvents("RITM", FIXTURES[0].polygon, FIXTURES[0].yahooLagging, TODAY);
const ritmJul6 = ritmEvents.filter((e) => (e.exDivDate || e.date) === "2026-07-06");
try {
  assert.equal(ritmJul6.length, 0, `RITM: the spurious 2026-07-06 estimated ex-date must not exist`);
  console.log(`\n✅ RITM: no 2026-07-06 estimated ex-date generated (was the reported bug).`);
} catch (error) {
  failures += 1;
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) FAILED.`);
  process.exit(1);
}
console.log(`\nAll Polygon-SSOT verifications passed.`);
