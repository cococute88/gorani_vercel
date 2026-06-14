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
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { buildTaxSavingRows } = require("../lib/mock-calendar-data.ts");
const {
  splitEconomicEventsByWeek,
  STATIC_US_ECONOMIC_EVENTS,
  formatEconomicEventDate,
} = require("../lib/economic-calendar-data.ts");

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

// ---------------------------------------------------------------------------
// 1. Tax table: buy-this-month tickers sorted first + highlight flag
// ---------------------------------------------------------------------------
function assertTaxSavingSortAndHighlight() {
  const events = [
    { ticker: "BUYHI", type: "ex_div", date: "2026-06-20", dividendAmount: 0.5, sourceKind: "declared" },
    { ticker: "BUYHI", type: "buy_by", date: "2026-06-19", dividendAmount: 0.5, sourceKind: "declared" },
    { ticker: "BUYLO", type: "ex_div", date: "2026-06-21", dividendAmount: 0.1, sourceKind: "declared" },
    { ticker: "BUYLO", type: "buy_by", date: "2026-06-20", dividendAmount: 0.1, sourceKind: "declared" },
    { ticker: "NOBUY", type: "ex_div", date: "2026-06-22", dividendAmount: 0.9, sourceKind: "declared" },
  ];
  const rows = buildTaxSavingRows(events, {
    todayIso: "2026-06-13",
    quoteByTicker: {
      BUYHI: { price: 100, source: "live" },
      BUYLO: { price: 100, source: "live" },
      NOBUY: { price: 100, source: "live" },
    },
  });

  assert.equal(rows.length, 3, "one row per ticker");
  // NOBUY has the highest tax saving but no buy event, so it must sink below both buy tickers.
  assert.deepEqual(rows.map((row) => row.ticker), ["BUYHI", "BUYLO", "NOBUY"], "buy tickers sort above non-buy even with lower tax");
  assert.equal(rows[0].shouldBuyThisMonth, true, "BUYHI is flagged for highlight");
  assert.equal(rows[1].shouldBuyThisMonth, true, "BUYLO is flagged for highlight");
  assert.equal(rows[2].shouldBuyThisMonth, false, "NOBUY is not highlighted");
  assert.ok(rows[0].taxSavingUsd > rows[1].taxSavingUsd, "within the buy group, higher tax sorts first");
  assert.ok(rows[2].taxSavingUsd > rows[0].taxSavingUsd, "fixture: NOBUY genuinely has the highest tax saving");

  return { order: rows.map((row) => row.ticker), highlighted: rows.filter((row) => row.shouldBuyThisMonth).length };
}

// ---------------------------------------------------------------------------
// 2. Economic calendar: this-week / next-week split, not dividend events
// ---------------------------------------------------------------------------
function assertEconomicWeekSplit() {
  const today = new Date("2026-06-14T00:00:00");
  const weeks = splitEconomicEventsByWeek(today, STATIC_US_ECONOMIC_EVENTS);

  assert.equal(weeks.thisWeek.label, "이번주");
  assert.equal(weeks.nextWeek.label, "다음주");
  assert.equal(weeks.source, "static");
  assert.ok(weeks.thisWeek.events.length > 0, "this week has events");
  assert.ok(weeks.nextWeek.events.length > 0, "next week has events");

  // Boundaries: this week = today..+6, next week = today+7..+13, disjoint.
  for (const event of weeks.thisWeek.events) {
    assert.ok(event.date >= weeks.thisWeek.startIso && event.date <= weeks.thisWeek.endIso, "this-week event within range");
  }
  for (const event of weeks.nextWeek.events) {
    assert.ok(event.date >= weeks.nextWeek.startIso && event.date <= weeks.nextWeek.endIso, "next-week event within range");
  }
  const thisDates = new Set(weeks.thisWeek.events.map((event) => event.date));
  for (const event of weeks.nextWeek.events) {
    assert.equal(thisDates.has(event.date), false, "this/next week dates are disjoint");
  }

  // Known fixtures: FOMC week (6/18) in this week, PCE/GDP (6/25) in next week.
  assert.ok(weeks.thisWeek.events.some((event) => event.date === "2026-06-18"), "FOMC day lands in this week");
  assert.ok(weeks.nextWeek.events.some((event) => event.date === "2026-06-25"), "PCE day lands in next week");

  // Economic events must NOT be dividend events.
  for (const event of [...weeks.thisWeek.events, ...weeks.nextWeek.events]) {
    assert.ok(typeof event.name === "string" && event.name.length > 0, "event has a name");
    assert.ok(typeof event.time === "string", "event has a time");
    assert.ok(["high", "medium", "low"].includes(event.importance), "event has importance");
    assert.equal("ticker" in event, false, "economic event has no ticker (not a dividend event)");
    assert.equal("dividendAmount" in event, false, "economic event has no dividendAmount");
  }

  // Sorted by date then time.
  const flat = weeks.thisWeek.events;
  for (let i = 1; i < flat.length; i += 1) {
    assert.ok(`${flat[i - 1].date} ${flat[i - 1].time}` <= `${flat[i].date} ${flat[i].time}`, "this week sorted by date/time");
  }

  assert.equal(formatEconomicEventDate("2026-06-18"), "6/18(목)", "date label includes weekday");

  return {
    thisWeek: weeks.thisWeek.events.length,
    nextWeek: weeks.nextWeek.events.length,
    range: [weeks.thisWeek.rangeLabel, weeks.nextWeek.rangeLabel],
  };
}

// ---------------------------------------------------------------------------
// 3. UI source rules
// ---------------------------------------------------------------------------
function assertTaxTableSource() {
  const source = read("components/watchlist/TaxSavingTable.tsx");
  const colCount = (source.match(/<col\s/g) ?? []).length;
  assert.equal(colCount, 2, "tax table has exactly two columns (Buy column removed)");
  assert.equal(/>Buy</.test(source), false, "no Buy button/label remains");
  assert.equal(source.includes("overflow-y-auto"), true, "tax table body scrolls internally");
  assert.equal(/max-h-\[\d+px\]/.test(source), true, "tax table caps its height");
  assert.equal(source.includes("bg-blue-500/10"), true, "highlight uses a light blue row tint");
  assert.equal(source.includes("shouldBuyThisMonth"), true, "highlight is driven by shouldBuyThisMonth");

  return { colCount };
}

function assertEconomicSectionSource() {
  const source = read("components/watchlist/EconomicCalendarSection.tsx");
  assert.equal(source.includes("splitEconomicEventsByWeek"), true, "economic section uses the week splitter");
  assert.equal(source.includes("lg:grid-cols-2"), true, "economic section is a 2-column grid on desktop");
  assert.equal(source.includes("overflow-y-auto"), true, "long week table scrolls internally");
  assert.equal(source.includes("주요 미국 경제 일정"), true, "section keeps the original Streamlit title");
  assert.equal(source.includes("mock-calendar-data"), false, "economic section does not reuse dividend event data");

  return { ok: true };
}

function assertPageWiring() {
  const source = read("components/watchlist/DividendCalendarPage.tsx");
  assert.equal(source.includes("EconomicCalendarSection"), true, "page renders the economic section");
  assert.equal(source.includes("이번 달 주요 일정"), false, "the dividend-event '이번 달 주요 일정' list is gone");
  assert.equal(source.includes("260px"), true, "right rail width is reduced");
  // Regression guards: import/calendar plumbing stays intact.
  assert.equal(source.includes("loadLegacyImportedCalendarEvents"), true, "legacy imported events still load");
  assert.equal(source.includes("mergeGeneratedAndCustomCalendarEvents"), true, "custom event merge still wired");
  assert.equal(source.includes("DividendSchedulePreview"), true, "full dividend schedule preview still present");

  return { ok: true };
}

function main() {
  const taxSort = assertTaxSavingSortAndHighlight();
  const econ = assertEconomicWeekSplit();
  const taxSource = assertTaxTableSource();
  const econSource = assertEconomicSectionSource();
  const pageWiring = assertPageWiring();

  console.log("Calendar UX rules passed.");
  console.table([taxSort]);
  console.table([econ]);
  console.table([{ ...taxSource, ...econSource, ...pageWiring }]);
}

main();
