import assert from "node:assert/strict";

import { authoritativeAlertCacheEntry } from "../lib/calendar-alert-cache";
import {
  getRealDividendEventsForTicker,
  isCustomCalendarEventLike,
} from "../lib/calendar-event-provider";
import type { CalendarTickerCache, CalendarTickerCacheSource } from "../lib/calendar-event-identity";
import type { CalendarEvent } from "../lib/mock-calendar-data";

function event(
  sourceKind: CalendarEvent["sourceKind"],
  status: CalendarEvent["status"] = sourceKind === "estimated" ? "estimated" : "confirmed",
): CalendarEvent {
  return {
    id: `dividend:TEST:buy:2026-08-10:${sourceKind}`,
    canonicalEventId: `dividend:TEST:buy:2026-08-10:${sourceKind}`,
    sourceKind,
    title: "TEST deadline",
    ticker: "TEST",
    type: "buy_by",
    date: "2026-08-10",
    status,
    dividendAmount: 1,
    buyDeadline: "2026-08-10",
    exDivDate: "2026-08-11",
    paymentDate: "2026-08-25",
    annualYield: 3,
    taxSavingUsd: 0,
  };
}

function cache(
  source: CalendarTickerCacheSource,
  events: CalendarEvent[],
  freshness: "fresh" | "stale" = "fresh",
): CalendarTickerCache<CalendarEvent> {
  return {
    ticker: "TEST",
    events,
    fetchedAt: freshness === "fresh" ? "2026-07-25T00:00:00.000Z" : "2026-01-01T00:00:00.000Z",
    expiresAt: freshness === "fresh" ? "2099-01-01T00:00:00.000Z" : "2026-01-02T00:00:00.000Z",
    source,
    warnings: [],
    schemaVersion: 1,
  };
}

assert.equal(
  authoritativeAlertCacheEntry(cache("sample", [event("declared")])),
  null,
  "source=sample is rejected",
);
assert.equal(
  authoritativeAlertCacheEntry(cache("mock", [event("declared")])),
  null,
  "source=mock is rejected",
);
assert.equal(
  authoritativeAlertCacheEntry(cache("cache", [event("sample")])),
  null,
  "source=cache cannot promote an event whose sourceKind=sample",
);
assert.equal(
  authoritativeAlertCacheEntry(cache("cache", [{ ...event("declared"), sourceKind: undefined }])),
  null,
  "missing event provenance is rejected instead of treated as provider-backed",
);

const freshSampleReuse = await getRealDividendEventsForTicker({
  ticker: "TEST",
  year: 2026,
  month: 8,
  cache: cache("sample", [event("sample")]),
  preferFreshCache: true,
});
assert.equal(freshSampleReuse.cacheEntry.source, "cache", "fresh cache reuse rewrites the entry source");
assert.equal(
  authoritativeAlertCacheEntry(freshSampleReuse.cacheEntry),
  null,
  "fresh sample cache reuse remains rejected by event provenance",
);

const staleSampleReuse = await getRealDividendEventsForTicker({
  ticker: "TEST",
  year: 2026,
  month: 8,
  cache: cache("sample", [event("sample")], "stale"),
  preferFreshCache: true,
  fetchDividends: async () => {
    throw new Error("provider unavailable");
  },
});
assert.equal(staleSampleReuse.cacheEntry.source, "cache", "stale fallback rewrites the entry source");
assert.equal(
  authoritativeAlertCacheEntry(staleSampleReuse.cacheEntry),
  null,
  "stale sample cache fallback remains rejected by event provenance",
);

const sampleProjection = await getRealDividendEventsForTicker({
  ticker: "TEST",
  year: 2026,
  month: 8,
  today: new Date("2026-07-25T00:00:00.000Z"),
  fetchDividends: async () => ({
    ticker: "TEST",
    normalizedTicker: "TEST",
    source: "sample",
    warnings: ["sample fallback"],
    updatedAt: "2026-07-25T00:00:00.000Z",
    dividends: [
      { date: "2026-04-01", amount: 1 },
      { date: "2026-05-01", amount: 1 },
      { date: "2026-06-01", amount: 1 },
    ],
  }),
});
const sampleProjectedEvents = sampleProjection.events.filter((row) => row.status === "estimated");
assert.ok(sampleProjectedEvents.length > 0, "sample history creates projected rows for the regression fixture");
assert.ok(
  sampleProjectedEvents.every((row) => row.sourceKind === "sample"),
  "sample-derived projections preserve sample provenance",
);
const reusedSampleProjection = await getRealDividendEventsForTicker({
  ticker: "TEST",
  year: 2026,
  month: 8,
  cache: sampleProjection.cacheEntry,
  preferFreshCache: true,
});
assert.equal(reusedSampleProjection.cacheEntry.source, "cache", "sample projection cache is reused as cache");
assert.equal(
  authoritativeAlertCacheEntry(reusedSampleProjection.cacheEntry),
  null,
  "sample-derived projections remain blocked after cache reuse",
);

const declared = cache("yahoo", [event("declared")]);
assert.deepEqual(
  authoritativeAlertCacheEntry(declared),
  declared,
  "normal Yahoo/declared events are persisted",
);

const estimated = cache("yahoo", [event("estimated")]);
assert.deepEqual(
  authoritativeAlertCacheEntry(estimated),
  estimated,
  "estimated events remain allowed by the product contract",
);

const mixed = cache("cache", [event("sample"), event("declared")]);
assert.deepEqual(
  authoritativeAlertCacheEntry(mixed)?.events.map((row) => row.sourceKind),
  ["declared"],
  "sample rows are removed without discarding valid rows from the same cache",
);

assert.equal(
  isCustomCalendarEventLike({ ...event("custom"), type: "custom" }),
  true,
  "custom event routing remains unchanged and outside generated-cache persistence",
);

console.log("calendar alert cache provenance checks passed");
