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

const {
  LEGACY_DIVIDEND_IMPORT_SOURCE,
  buildLegacyDividendCalendarImportPlan,
  isLegacyPlaceholderDate,
  normalizeLegacyImportedCalendarEventDoc,
} = require("../lib/legacy-dividend-calendar-import.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeFixture() {
  return {
    dividend_calendar: {
      _last_sync: "2026-06-14T10:00:00.000Z",
      cached_events: {
        aapl: [
          {
            ticker: "aapl",
            event_type: "ex_div",
            event_date: "2026-05-10",
            ex_div_date: "2026-05-10",
            payment_date: "2026-05-30",
            buy_deadline: "2026-05-09",
            dividend_amount: "0.26",
            current_price: "190.5",
            annual_yield: "0.54",
            estimated: false,
            is_etf: false,
          },
          {
            ticker: "AAPL",
            event_type: "buy",
            event_date: "2026-05-09",
            ex_div_date: "2026-05-10",
            payment_date: "2026-05-30",
            buy_deadline: "2026-05-09",
            dividend_amount: 0.26,
            current_price: 190.5,
            annual_yield: 0.54,
            estimated: true,
            is_etf: false,
          },
          {
            ticker: "AAPL",
            event_type: "payment",
            event_date: "2026-05-30",
            ex_div_date: "2026-05-10",
            payment_date: "2026-05-30",
            buy_deadline: "2026-05-09",
            dividend_amount: 0.26,
            current_price: 190.5,
            annual_yield: 0.54,
          },
          {
            ticker: "AAPL",
            event_type: "earnings",
            event_date: "2026-06-01",
            dividend_amount: null,
            annual_yield: 0,
          },
          {
            ticker: "AAPL",
            event_type: "ex_div",
            event_date: "2999-12-31",
          },
          {
            ticker: "AAPL",
            event_type: "ex_div",
            event_date: "not-a-date",
          },
          {
            ticker: "AAPL",
            event_type: "ex_div",
            event_date: "2026-05-10",
            dividend_amount: 0.27,
          },
        ],
      },
      custom_ce: {
        "2026-06-15": {
          name: "IR meeting",
          symbol: "msft",
        },
      },
      marks: {
        "AAPL-ex_div-2026-05-10": {
          heart: false,
          star: true,
        },
      },
      memos: {
        aapl: "core position",
      },
      portfolios: {
        Main: ["aapl", "msft", "AAPL"],
      },
    },
  };
}

function assertPlan() {
  const fixture = makeFixture();
  const before = clone(fixture);
  const plan = buildLegacyDividendCalendarImportPlan(fixture);

  assert.deepEqual(fixture, before, "source JSON must not be mutated");
  assert.equal(plan.legacyLastSync, "2026-06-14T10:00:00.000Z");
  assert.equal(plan.stats.totalTickerCount, 1);
  assert.equal(plan.stats.cachedEventCount, 7);
  assert.equal(plan.stats.customEventCount, 1);
  assert.equal(plan.stats.marksCount, 1);
  assert.equal(plan.stats.memosCount, 1);
  assert.equal(plan.stats.portfoliosCount, 1);
  assert.equal(plan.stats.excludedEventCount, 2);
  assert.equal(plan.stats.excludedPlaceholderEventCount, 2);
  assert.equal(plan.stats.duplicateInputEventCount, 1);

  const byType = Object.fromEntries(plan.calendarEventDocs.map((event) => [event.type, event]));
  assert.equal(byType.ex_div.id, "legacy_AAPL_ex_div_2026-05-10");
  assert.equal(byType.ex_div.eventType, "ex_div");
  assert.equal(byType.ex_div.eventDate, "2026-05-10");
  assert.equal(byType.ex_div.legacyId, "AAPL-ex_div-2026-05-10");
  assert.equal(byType.ex_div.source, LEGACY_DIVIDEND_IMPORT_SOURCE);
  assert.equal(byType.ex_div.star, true);
  assert.equal(byType.ex_div.heart, false);
  assert.equal(byType.ex_div.dividendAmount, 0.27, "duplicate input should merge by deterministic id");
  assert.equal(byType.buy_by.type, "buy_by");
  assert.equal(byType.buy_by.status, "estimated");
  assert.equal(byType.pay.type, "pay");
  assert.equal(byType.earnings.type, "earnings");
  assert.equal(byType.ex_div.currentPrice, null);
  assert.equal(byType.ex_div.isEtf, false);

  const customDoc = plan.calendarEventDocs.find((event) => event.type === "custom");
  assert.ok(customDoc, "custom_ce should also be represented in calendarEvents");
  assert.match(customDoc.id, /^custom:legacy_custom_2026-06-15_/);
  assert.equal(customDoc.title, "IR meeting");
  assert.equal(customDoc.ticker, "MSFT");
  assert.equal(plan.customCalendarEvents.length, 1);
  assert.equal(plan.customCalendarEvents[0].id, customDoc.id);

  assert.deepEqual(plan.memosDoc.items, { AAPL: "core position" });
  assert.deepEqual(plan.portfoliosDoc.items, { Main: ["AAPL", "MSFT"] });
  assert.equal(plan.stats.estimatedFirestoreWriteCount, plan.calendarEventDocs.length + plan.customCalendarEvents.length + 2);

  const secondPlan = buildLegacyDividendCalendarImportPlan(makeFixture());
  assert.deepEqual(
    secondPlan.calendarEventDocs.map((event) => event.id),
    plan.calendarEventDocs.map((event) => event.id),
    "legacy ids must be deterministic across runs",
  );

  const normalized = normalizeLegacyImportedCalendarEventDoc(byType.ex_div);
  assert.ok(normalized);
  assert.equal(normalized.id, byType.ex_div.id);
  assert.equal(normalized.type, "ex_div");
  assert.equal(normalized.ticker, "AAPL");

  assert.equal(isLegacyPlaceholderDate("2999-12-31"), true);
  assert.equal(isLegacyPlaceholderDate("2100-01-01"), true);
  assert.equal(isLegacyPlaceholderDate("not-a-date"), true);
  assert.equal(isLegacyPlaceholderDate("2026-06-15"), false);

  return {
    calendarEventDocs: plan.calendarEventDocs.length,
    customCalendarEvents: plan.customCalendarEvents.length,
    excludedEvents: plan.excludedEvents.length,
    estimatedFirestoreWriteCount: plan.stats.estimatedFirestoreWriteCount,
  };
}

function assertInvalidSchema() {
  assert.throws(
    () => buildLegacyDividendCalendarImportPlan({ nope: true }),
    /dividend_calendar object was not found/,
  );
}

function main() {
  const summary = assertPlan();
  assertInvalidSchema();
  console.log("Legacy calendar import regression passed.");
  console.table([summary]);
}

main();
