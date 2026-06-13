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
  buildCalendarTickerCacheFromEvents,
  buildDividendEventsFromHistory,
  getPreviousDividendBuyDate,
  getRealDividendEventsForTicker,
  inferDividendFrequency,
  mergeGeneratedAndCustomCalendarEvents,
  normalizeCalendarEventForCache,
  projectEstimatedDividendEvents,
} = require("../lib/calendar-event-provider.ts");

const {
  createCalendarTickerCacheEntry,
} = require("../lib/calendar-cache.ts");

const {
  calendarCustomEventToCalendarEvent,
  createCalendarCustomEvent,
  deleteCalendarCustomEvent,
  loadCalendarCustomEvents,
  normalizeCalendarCustomEvent,
  saveCalendarCustomEvents,
  upsertCalendarCustomEvent,
} = require("../lib/calendar-custom-events.ts");

const {
  buildGeneratedCalendarEventId,
  normalizeCalendarAmount,
} = require("../lib/calendar-event-identity.ts");

const {
  getEventVisual,
} = require("../lib/event-visuals.ts");

const TEST_TODAY = new Date("2026-06-13T00:00:00");

const quarterlyDividends = [
  { date: "2025-06-25", amount: 0.26 },
  { date: "2025-09-24", amount: 0.27 },
  { date: "2025-12-24", amount: 0.28 },
  { date: "2026-03-25", amount: 0.29 },
];

const monthlyDividends = [
  { date: "2026-01-15", amount: 0.1 },
  { date: "2026-02-17", amount: 0.1 },
  { date: "2026-03-16", amount: 0.1 },
  { date: "2026-04-15", amount: 0.1 },
  { date: "2026-05-15", amount: 0.1 },
];

function addMonths(date, months) {
  const next = new Date(date);
  const targetDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDay));
  return next;
}

function responseFor(ticker, dividends, source = "yahoo", warnings = []) {
  return {
    ticker,
    normalizedTicker: ticker.trim().toUpperCase(),
    source,
    updatedAt: TEST_TODAY.toISOString(),
    warnings,
    dividends,
  };
}

function byType(events, type) {
  return events.filter((event) => event.type === type);
}

function assertHistoricalEventGeneration() {
  const quarterlyEvents = buildDividendEventsFromHistory({
    ticker: "schd",
    dividends: quarterlyDividends,
    sourceKind: "declared",
  });
  const monthlyEvents = buildDividendEventsFromHistory({
    ticker: "o",
    dividends: monthlyDividends,
    sourceKind: "declared",
  });
  const emptyEvents = buildDividendEventsFromHistory({
    ticker: "empty",
    dividends: [],
    sourceKind: "declared",
  });

  assert.equal(byType(quarterlyEvents, "ex_div").length, quarterlyDividends.length);
  assert.equal(byType(quarterlyEvents, "buy_by").length, quarterlyDividends.length);
  assert.equal(byType(monthlyEvents, "ex_div").length, monthlyDividends.length);
  assert.equal(byType(monthlyEvents, "buy_by").length, monthlyDividends.length);
  assert.deepEqual(emptyEvents, []);

  const sampleEvent = quarterlyEvents.find((event) => event.type === "ex_div");
  assert.ok(sampleEvent, "historical fixture should include an ex_div event");
  assert.equal(sampleEvent.id, sampleEvent.canonicalEventId);
  assert.match(sampleEvent.canonicalEventId, /^dividend:SCHD:ex_div:\d{4}-\d{2}-\d{2}$/);
  assert.match(sampleEvent.legacyEventId, /^SCHD-ex_div-\d{4}-\d{2}-\d{2}$/);

  const idWithSmallAmount = buildGeneratedCalendarEventId({
    ticker: "SCHD",
    eventType: "ex_div",
    eventDate: "2026-03-25",
    amount: normalizeCalendarAmount(0.29),
  });
  const idWithCorrectedAmount = buildGeneratedCalendarEventId({
    ticker: "SCHD",
    eventType: "ex_div",
    eventDate: "2026-03-25",
    amount: normalizeCalendarAmount("0.290000"),
  });
  assert.equal(idWithSmallAmount, idWithCorrectedAmount, "amount normalization must not change the canonical event id");

  return {
    quarterlyEvents: quarterlyEvents.length,
    monthlyEvents: monthlyEvents.length,
    emptyEvents: emptyEvents.length,
  };
}

function assertBuyDeadlineHelper() {
  const cases = [
    ["Saturday ex-div", "2026-06-13", "2026-06-12"],
    ["Sunday ex-div", "2026-06-14", "2026-06-12"],
    ["Monday ex-div", "2026-06-15", "2026-06-12"],
    ["Tuesday ex-div", "2026-06-16", "2026-06-15"],
    ["Wednesday ex-div", "2026-06-17", "2026-06-16"],
    ["Thursday ex-div", "2026-06-18", "2026-06-17"],
    ["Friday ex-div", "2026-06-19", "2026-06-18"],
  ];

  for (const [name, exDivDate, expectedBuyDate] of cases) {
    assert.equal(getPreviousDividendBuyDate(exDivDate), expectedBuyDate, name);
  }

  return Object.fromEntries(cases.map(([name, exDivDate]) => [name, getPreviousDividendBuyDate(exDivDate)]));
}

function assertFrequencyInference() {
  const monthly = inferDividendFrequency(monthlyDividends.map((dividend) => dividend.date));
  const quarterly = inferDividendFrequency(quarterlyDividends.map((dividend) => dividend.date));
  const insufficient = inferDividendFrequency(["2026-03-25"]);

  assert.equal(monthly.frequency, "monthly");
  assert.equal(monthly.months, 1);
  assert.equal(quarterly.frequency, "quarterly");
  assert.equal(quarterly.months, 3);
  assert.equal(insufficient.frequency, null);
  assert.equal(insufficient.months, null);
  assert.equal(insufficient.warnings.length > 0, true);

  return {
    monthly: monthly.medianIntervalDays,
    quarterly: quarterly.medianIntervalDays,
    insufficientWarnings: insufficient.warnings.length,
  };
}

function assertEstimatedProjection() {
  const frequency = inferDividendFrequency(quarterlyDividends.map((dividend) => dividend.date));
  const events = projectEstimatedDividendEvents({
    ticker: "SCHD",
    dividends: quarterlyDividends,
    frequency,
    today: TEST_TODAY,
  });
  const projectionEnd = addMonths(TEST_TODAY, 12);

  assert.equal(events.length > 0, true);
  assert.equal(byType(events, "ex_div").length, byType(events, "buy_by").length);
  for (const event of events) {
    assert.equal(event.status, "estimated");
    assert.equal(event.sourceKind, "estimated");
    assert.equal(event.id, event.canonicalEventId);
    assert.match(event.canonicalEventId, /^dividend:SCHD:(buy|ex_div):\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${event.date}T00:00:00`).getTime() <= projectionEnd.getTime(), true);
  }

  const insufficientFrequency = inferDividendFrequency(["2026-03-25"]);
  const skipped = projectEstimatedDividendEvents({
    ticker: "SCHD",
    dividends: quarterlyDividends.slice(0, 1),
    frequency: insufficientFrequency,
    today: TEST_TODAY,
  });
  assert.deepEqual(skipped, []);

  return {
    estimatedEvents: events.length,
    lastProjectedDate: events.at(-1)?.date,
    skippedForInsufficientData: skipped.length,
  };
}

async function assertCacheFallbackPriority() {
  const providerEvents = buildDividendEventsFromHistory({
    ticker: "SCHD",
    dividends: quarterlyDividends.slice(-1),
    sourceKind: "declared",
  });
  const freshCache = buildCalendarTickerCacheFromEvents("SCHD", providerEvents, "yahoo", ["fresh fixture"]);
  let freshFetchCount = 0;
  const freshResult = await getRealDividendEventsForTicker({
    ticker: "SCHD",
    year: 2026,
    month: 6,
    cache: freshCache,
    preferFreshCache: true,
    fetchDividends: async () => {
      freshFetchCount += 1;
      throw new Error("fresh cache should prevent provider fetch");
    },
    today: TEST_TODAY,
  });
  assert.equal(freshResult.source, "cache");
  assert.equal(freshFetchCount, 0);
  assert.deepEqual(freshResult.events.map((event) => event.id), freshCache.events.map((event) => event.id));

  const staleCache = createCalendarTickerCacheEntry({
    ticker: "SCHD",
    events: providerEvents,
    fetchedAt: "2000-01-01T00:00:00.000Z",
    ttlHours: 1,
    source: "yahoo",
    warnings: ["stale fixture"],
  });
  let providerFetchCount = 0;
  const providerResult = await getRealDividendEventsForTicker({
    ticker: "SCHD",
    year: 2026,
    month: 6,
    cache: staleCache,
    preferFreshCache: true,
    fetchDividends: async () => {
      providerFetchCount += 1;
      return responseFor("SCHD", quarterlyDividends);
    },
    today: TEST_TODAY,
  });
  assert.equal(providerResult.source, "yahoo");
  assert.equal(providerFetchCount, 1);
  assert.equal(providerResult.events.length > staleCache.events.length, true);

  const staleFallback = await getRealDividendEventsForTicker({
    ticker: "SCHD",
    year: 2026,
    month: 6,
    cache: staleCache,
    preferFreshCache: true,
    fetchDividends: async () => {
      throw new Error("synthetic provider failure");
    },
    today: TEST_TODAY,
  });
  assert.equal(staleFallback.source, "cache");
  assert.equal(staleFallback.events.length, staleCache.events.length);
  assert.equal(staleFallback.warnings.some((warning) => warning.includes("provider failure")), true);

  const mockFallback = await getRealDividendEventsForTicker({
    ticker: "SCHD",
    year: 2026,
    month: 6,
    cache: null,
    preferFreshCache: true,
    fetchDividends: async () => {
      throw new Error("synthetic provider failure");
    },
    today: TEST_TODAY,
  });
  assert.equal(mockFallback.source, "mock");
  assert.equal(mockFallback.events.length > 0, true);
  assert.equal(mockFallback.warnings.at(-1), "Mock calendar fallback was used.");

  const emptyWithStale = await getRealDividendEventsForTicker({
    ticker: "SCHD",
    year: 2026,
    month: 6,
    cache: staleCache,
    preferFreshCache: true,
    fetchDividends: async () => responseFor("SCHD", []),
    today: TEST_TODAY,
  });
  assert.equal(emptyWithStale.source, "cache");
  assert.equal(emptyWithStale.warnings.some((warning) => warning.includes("returned no dividend rows")), true);

  const metaPollutedEvent = {
    ...normalizeCalendarEventForCache(providerEvents[0]),
    memo: "user memo must not be cached",
    note: "rendered user note must not be cached",
    star: true,
    heart: true,
  };
  const sanitizedCache = buildCalendarTickerCacheFromEvents("SCHD", [metaPollutedEvent], "yahoo");
  assert.equal("memo" in sanitizedCache.events[0], false);
  assert.equal("note" in sanitizedCache.events[0], false);
  assert.equal("star" in sanitizedCache.events[0], false);
  assert.equal("heart" in sanitizedCache.events[0], false);

  return {
    freshCacheFetches: freshFetchCount,
    providerFetchesBeforeStaleFallback: providerFetchCount,
    staleFallbackSource: staleFallback.source,
    mockFallbackEvents: mockFallback.events.length,
    sanitizedCacheEvents: sanitizedCache.events.length,
  };
}

function installLocalStorageStub() {
  const store = new Map();
  global.window = {
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    },
  };
  return store;
}

function assertCustomEventFoundation() {
  installLocalStorageStub();

  const customEvent = createCalendarCustomEvent({
    id: "My Event UUID",
    title: "IR 미팅",
    date: "2026-06-20",
    ticker: "schd",
    note: "사용자 일정 메모",
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
  });

  assert.match(customEvent.id, /^custom:/);
  assert.equal(customEvent.id, customEvent.canonicalEventId);
  assert.equal(customEvent.sourceKind, "custom");
  assert.equal(customEvent.type, "custom");
  assert.equal(customEvent.ticker, "SCHD");
  assert.equal(customEvent.date, "2026-06-20");
  assert.equal(customEvent.title, "IR 미팅");

  saveCalendarCustomEvents([customEvent]);
  assert.equal(loadCalendarCustomEvents().length, 1);

  const updated = {
    ...customEvent,
    title: "IR 미팅 수정",
    date: "2026-06-21",
    ticker: "JEPI",
    updatedAt: "2026-06-14T00:00:00.000Z",
  };
  const afterUpsert = upsertCalendarCustomEvent(updated);
  assert.equal(afterUpsert.length, 1);
  assert.equal(afterUpsert[0].id, customEvent.id, "custom id must stay stable when fields change");
  assert.equal(afterUpsert[0].title, "IR 미팅 수정");
  assert.equal(afterUpsert[0].date, "2026-06-21");
  assert.equal(afterUpsert[0].ticker, "JEPI");

  const generatedEvents = buildDividendEventsFromHistory({
    ticker: "SCHD",
    dividends: quarterlyDividends.slice(0, 1),
    sourceKind: "declared",
  });
  const merged = mergeGeneratedAndCustomCalendarEvents(generatedEvents, [afterUpsert[0], afterUpsert[0]]);
  assert.equal(merged.filter((event) => event.id === customEvent.id).length, 1, "duplicate custom ids should be guarded during merge");
  assert.equal(merged.some((event) => event.sourceKind === "custom"), true);
  assert.equal(merged.length, generatedEvents.length + 1);

  const customCalendarEvent = calendarCustomEventToCalendarEvent(afterUpsert[0]);
  const cacheEntry = buildCalendarTickerCacheFromEvents("SCHD", [generatedEvents[0], customCalendarEvent], "yahoo");
  assert.equal(cacheEntry.events.some((event) => event.id === customEvent.id), false, "custom events must not enter generated cache entries");

  const normalized = normalizeCalendarCustomEvent({ ...customEvent, id: customEvent.id.toUpperCase() });
  assert.ok(normalized);
  assert.equal(normalized.id, customEvent.id);

  assert.equal(getEventVisual("custom").label, "사용자");
  assert.equal(getEventVisual("future_unknown_type").label, "사용자");

  const afterDelete = deleteCalendarCustomEvent(customEvent.id);
  assert.equal(afterDelete.length, 0);

  return {
    customId: customEvent.id,
    mergedEvents: merged.length,
    cacheEventsAfterCustomSanitize: cacheEntry.events.length,
    visualFallback: getEventVisual("future_unknown_type").label,
  };
}

async function main() {
  const historical = assertHistoricalEventGeneration();
  const buyDeadlines = assertBuyDeadlineHelper();
  const frequency = assertFrequencyInference();
  const estimated = assertEstimatedProjection();
  const cacheFallback = await assertCacheFallbackPriority();
  const customEvents = assertCustomEventFoundation();

  console.log("Calendar provider regression passed.");
  console.table([historical]);
  console.table([frequency]);
  console.table([estimated]);
  console.table([cacheFallback]);
  console.table([customEvents]);
  console.log("Buy deadline fixture results:");
  console.table([buyDeadlines]);
}

main().catch((error) => {
  console.error("Calendar provider regression failed.");
  console.error(error);
  process.exit(1);
});
