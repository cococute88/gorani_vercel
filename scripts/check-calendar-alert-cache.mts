import assert from "node:assert/strict";

import {
  alertCacheEntriesNeedingPersistence,
  authoritativeAlertCacheEntry,
  calendarProviderContextMatches,
  isCurrentPersistedAlertCacheEntry,
  sanitizedPersistedAlertCacheEntry,
  shouldReplacePersistedCalendarCache,
} from "../lib/calendar-alert-cache";
import {
  getRealDividendEventsForTicker,
  isCustomCalendarEventLike,
} from "../lib/calendar-event-provider";
import {
  buildLiveCalendarCacheEntry,
  mergeFetchedEventsWithExistingCache,
} from "../lib/calendar-dividend-live";
import { mergeCalendarEventCacheMaps, mergeCalendarTickerCacheEntries } from "../lib/calendar-event-retention";
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
  schemaVersion = 2,
): CalendarTickerCache<CalendarEvent> {
  return {
    ticker: "TEST",
    events,
    fetchedAt: freshness === "fresh" ? "2026-07-25T00:00:00.000Z" : "2026-01-01T00:00:00.000Z",
    expiresAt: freshness === "fresh" ? "2099-01-01T00:00:00.000Z" : "2026-01-02T00:00:00.000Z",
    source,
    warnings: [],
    schemaVersion,
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
assert.deepEqual(
  sanitizedPersistedAlertCacheEntry(cache("sample", [event("sample")])).events,
  [],
  "previously persisted sample caches are scrubbed to authoritative empty documents",
);
assert.equal(
  authoritativeAlertCacheEntry(cache("cache", [event("estimated")], "fresh", 1)),
  null,
  "legacy cache schema rejects sample-derived rows formerly mislabeled as estimated",
);

const v1Declared = cache("cache", [event("declared")], "fresh", 1);
const v2Provider = cache("yahoo", [event("declared"), event("estimated")], "fresh", 2);
assert.deepEqual(
  sanitizedPersistedAlertCacheEntry(v1Declared).events.map((row) => row.sourceKind),
  ["declared"],
  "v1 declared rows remain available as a read-only fallback during upgrade",
);
const v1PersistedTickers = new Set(
  isCurrentPersistedAlertCacheEntry(v1Declared) ? [v1Declared.ticker] : [],
);
assert.deepEqual(
  alertCacheEntriesNeedingPersistence({ TEST: v2Provider }, v1PersistedTickers),
  [v2Provider],
  "a readable v1 declared cache does not block its provider-backed v2 replacement",
);
assert.deepEqual(
  alertCacheEntriesNeedingPersistence({ TEST: v2Provider }, new Set()),
  [v2Provider],
  "a missing Firestore cache persists the provider-backed v2 result",
);
assert.deepEqual(
  alertCacheEntriesNeedingPersistence({ TEST: v1Declared }, v1PersistedTickers),
  [],
  "a v1 fallback result is never re-persisted or marked current while awaiting v2",
);

const v2PersistedTickers = new Set(
  isCurrentPersistedAlertCacheEntry(v2Provider) ? [v2Provider.ticker] : [],
);
assert.deepEqual(
  alertCacheEntriesNeedingPersistence({ TEST: v2Provider }, v2PersistedTickers),
  [],
  "a fully safe persisted v2 cache does not create a repeated write",
);

const expiredV2 = cache("yahoo", [event("declared"), event("estimated")], "stale", 2);
const expiredV2PersistedTickers = new Set(
  isCurrentPersistedAlertCacheEntry(expiredV2, new Date("2026-07-25T00:00:00.000Z"))
    ? [expiredV2.ticker]
    : [],
);
assert.deepEqual(
  [...expiredV2PersistedTickers],
  [],
  "an expired safe v2 Firestore cache does not suppress the provider refresh",
);
assert.deepEqual(
  alertCacheEntriesNeedingPersistence(
    { TEST: v2Provider },
    expiredV2PersistedTickers,
    new Date("2026-07-25T00:00:00.000Z"),
  ),
  [v2Provider],
  "a fresh provider v2 result replaces an expired safe Firestore cache",
);
assert.deepEqual(
  alertCacheEntriesNeedingPersistence(
    { TEST: expiredV2 },
    expiredV2PersistedTickers,
    new Date("2026-07-25T00:00:00.000Z"),
  ),
  [],
  "an expired fallback result is not re-persisted as though it were refreshed",
);

assert.equal(
  shouldReplacePersistedCalendarCache(v2Provider, expiredV2),
  false,
  "a mark save cannot overwrite a newer live/provider cache with its stale displayed snapshot",
);
assert.equal(
  shouldReplacePersistedCalendarCache(expiredV2, v2Provider),
  true,
  "a newer live/provider cache replaces an older persisted snapshot",
);
assert.equal(
  shouldReplacePersistedCalendarCache(v1Declared, v2Provider),
  true,
  "a safe schema upgrade replaces v1 even when cache timestamps overlap",
);
assert.equal(
  shouldReplacePersistedCalendarCache(null, v2Provider),
  true,
  "the first metadata save persists its displayed cache body",
);
assert.equal(
  shouldReplacePersistedCalendarCache(v2Provider, v2Provider),
  false,
  "an identical cache is not rewritten",
);
const sameTimestampDifferentCache = {
  ...v2Provider,
  events: [{ ...event("declared"), date: "2026-09-10" }],
};
assert.equal(
  shouldReplacePersistedCalendarCache(sameTimestampDifferentCache, v2Provider),
  false,
  "an equal-timestamp cache with different safe content is not overwritten",
);
const sameTimestampSupersetCache = {
  ...v2Provider,
  events: [...v2Provider.events, { ...event("estimated"), date: "2026-08-11", id: "dividend:TEST:buy:2026-08-11", canonicalEventId: "dividend:TEST:buy:2026-08-11" }],
};
assert.equal(
  shouldReplacePersistedCalendarCache(v2Provider, sameTimestampSupersetCache),
  true,
  "a same-revision cache may add a retained event without deleting the persisted body",
);
const preservationBase = cache("yahoo", [event("declared")]);
const olderCandidateWithMissingEvent = {
  ...cache("yahoo", [sameTimestampSupersetCache.events.at(-1)!], "stale"),
};
const restoredWithoutRevisionRollback = mergeCalendarTickerCacheEntries(preservationBase, olderCandidateWithMissingEvent);
assert.equal(
  restoredWithoutRevisionRollback.fetchedAt,
  preservationBase.fetchedAt,
  "restoring a missing event keeps the newest cache revision metadata",
);
assert.equal(
  restoredWithoutRevisionRollback.events.length,
  2,
  "a stale snapshot may restore an omitted event without replacing newer events",
);
assert.equal(
  shouldReplacePersistedCalendarCache(preservationBase, restoredWithoutRevisionRollback),
  true,
  "the merged superset is eligible for an atomic Firestore preservation write",
);
const persistedMixedForCleanup = cache("cache", [event("sample"), event("declared")]);
assert.equal(
  shouldReplacePersistedCalendarCache(
    persistedMixedForCleanup,
    sanitizedPersistedAlertCacheEntry(persistedMixedForCleanup),
  ),
  true,
  "a sanitizer may conditionally clean the exact equal-version document it read",
);

const v1Unsafe = cache("cache", [event("sample"), event("estimated")], "fresh", 1);
assert.deepEqual(
  sanitizedPersistedAlertCacheEntry(v1Unsafe).events,
  [],
  "unsafe v1 sample-derived events are removed from the alert cache",
);
assert.deepEqual(
  alertCacheEntriesNeedingPersistence(
    { TEST: v2Provider },
    new Set(isCurrentPersistedAlertCacheEntry(v1Unsafe) ? [v1Unsafe.ticker] : []),
  ),
  [v2Provider],
  "an unsafe v1 tombstone still allows a real v2 provider replacement",
);

const userADefault = { uid: "user-a", portfolioId: "default" };
assert.equal(
  calendarProviderContextMatches(userADefault, "user-a", "default"),
  true,
  "provider results may persist only for their owning user and portfolio",
);
assert.equal(
  calendarProviderContextMatches(userADefault, "user-b", "default"),
  false,
  "a cached provider result from the prior account cannot persist for the new uid",
);
assert.equal(
  calendarProviderContextMatches(userADefault, "user-a", "named"),
  false,
  "a stale portfolio result cannot contaminate another portfolio during upgrade",
);
assert.equal(
  calendarProviderContextMatches(null, "user-a", "default"),
  false,
  "unowned initial provider state cannot write to an authenticated account",
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

const retainedSample = { ...event("sample"), date: "2026-08-10", exDivDate: "2026-08-11" };
const liveDeclared = { ...event("declared"), date: "2026-09-10", exDivDate: "2026-09-11" };
const liveMerged = mergeFetchedEventsWithExistingCache([retainedSample], [liveDeclared]);
const liveAlertEntry = sanitizedPersistedAlertCacheEntry(
  buildLiveCalendarCacheEntry("TEST", liveMerged, "polygon"),
);
assert.deepEqual(
  liveAlertEntry.events.map((row) => row.sourceKind),
  ["declared"],
  "live refresh persistence removes retained sample rows before Firestore write",
);

const apamBuyBy = {
  ...event("estimated"),
  id: "dividend:APAM:buy:2026-08-14",
  canonicalEventId: "dividend:APAM:buy:2026-08-14",
  ticker: "APAM",
  type: "buy_by" as const,
  date: "2026-08-14",
  buyDeadline: "2026-08-14",
  exDivDate: "2026-08-17",
};
const apamExDiv = {
  ...event("estimated"),
  id: "dividend:APAM:ex_div:2026-08-17",
  canonicalEventId: "dividend:APAM:ex_div:2026-08-17",
  ticker: "APAM",
  type: "ex_div" as const,
  date: "2026-08-17",
  buyDeadline: "2026-08-14",
  exDivDate: "2026-08-17",
};
const expiredApamCache: CalendarTickerCache<CalendarEvent> = {
  ...cache("yahoo", [apamBuyBy, apamExDiv], "stale"),
  ticker: "APAM",
};

const apamAfterAutomaticRefresh = await getRealDividendEventsForTicker({
  ticker: "APAM",
  year: 2026,
  month: 8,
  today: new Date("2026-08-17T00:00:00.000Z"),
  cache: expiredApamCache,
  preferFreshCache: true,
  fetchDividends: async () => ({
    ticker: "APAM",
    normalizedTicker: "APAM",
    source: "yahoo",
    warnings: [],
    updatedAt: "2026-08-17T00:00:00.000Z",
    dividends: [
      { date: "2025-09-01", amount: 0.5 },
      { date: "2025-12-01", amount: 0.5 },
      { date: "2026-03-02", amount: 0.5 },
    ],
  }),
});
assert.deepEqual(
  apamAfterAutomaticRefresh.events
    .filter((row) => row.ticker === "APAM" && (row.date === "2026-08-14" || row.date === "2026-08-17"))
    .map((row) => `${row.date}:${row.type}`),
  ["2026-08-14:buy_by", "2026-08-17:ex_div"],
  "expired-cache automatic refresh retains the APAM 2026-08-14 and 2026-08-17 schedule",
);

assert.deepEqual(
  mergeFetchedEventsWithExistingCache([apamBuyBy, apamExDiv], []).map((row) => row.date),
  ["2026-08-14", "2026-08-17"],
  "an empty refresh response cannot delete existing APAM events",
);

const confirmedApamExDiv = { ...apamExDiv, sourceKind: "declared" as const, status: "confirmed" as const, dividendAmount: 0.82 };
const apamIdentityUpgrade = mergeFetchedEventsWithExistingCache([apamExDiv], [confirmedApamExDiv]);
assert.equal(apamIdentityUpgrade.length, 1, "the same canonical event identity is deduplicated");
assert.equal(apamIdentityUpgrade[0].sourceKind, "declared", "a confirmed provider row upgrades the same estimated identity");

const owlSameDate = { ...confirmedApamExDiv, id: "dividend:OWL:ex_div:2026-08-17", canonicalEventId: "dividend:OWL:ex_div:2026-08-17", ticker: "OWL" };
assert.equal(
  mergeFetchedEventsWithExistingCache([apamExDiv], [owlSameDate]).length,
  2,
  "different tickers on the same date do not collide",
);

const owlCache: CalendarTickerCache<CalendarEvent> = {
  ...cache("polygon", [owlSameDate]),
  ticker: "OWL",
};
const mergedPartialCacheMap = mergeCalendarEventCacheMaps(
  { APAM: expiredApamCache },
  { OWL: owlCache },
);
assert.deepEqual(
  Object.keys(mergedPartialCacheMap).sort(),
  ["APAM", "OWL"],
  "a partial cloud/local cache response cannot remove an omitted ticker",
);
assert.deepEqual(
  mergedPartialCacheMap.APAM.events.map((row) => row.date),
  ["2026-08-14", "2026-08-17"],
  "local-to-cloud cache merge preserves exact ISO dates without timezone movement",
);

const peerTickers = ["SBRA", "CHRD", "MLPA", "OMF"];
const peerCacheMap = Object.fromEntries(peerTickers.map((ticker, index) => {
  const date = `2026-08-${String(18 + index).padStart(2, "0")}`;
  const peerEvent = { ...confirmedApamExDiv, id: `dividend:${ticker}:ex_div:${date}`, canonicalEventId: `dividend:${ticker}:ex_div:${date}`, ticker, date, exDivDate: date };
  return [ticker, { ...cache("polygon", [peerEvent]), ticker }];
}));
assert.deepEqual(
  Object.keys(mergeCalendarEventCacheMaps({ APAM: expiredApamCache, ...peerCacheMap }, { OWL: owlCache })).sort(),
  ["APAM", "CHRD", "MLPA", "OMF", "OWL", "SBRA"],
  "partial ticker refresh preserves APAM, OWL, SBRA, CHRD, MLPA, and OMF independently",
);

const apamAfterEmptyProvider = await getRealDividendEventsForTicker({
  ticker: "APAM",
  year: 2026,
  month: 8,
  cache: expiredApamCache,
  preferFreshCache: true,
  fetchDividends: async () => ({
    ticker: "APAM",
    normalizedTicker: "APAM",
    source: "yahoo",
    warnings: [],
    updatedAt: "2026-08-17T00:00:00.000Z",
    dividends: [],
  }),
});
assert.deepEqual(
  apamAfterEmptyProvider.events.map((row) => row.date),
  ["2026-08-14", "2026-08-17"],
  "an empty automatic provider response retains the APAM cache",
);

const apamAfterProviderFailure = await getRealDividendEventsForTicker({
  ticker: "APAM",
  year: 2026,
  month: 8,
  cache: expiredApamCache,
  preferFreshCache: true,
  fetchDividends: async () => {
    throw new Error("500 / timeout / network failure");
  },
});
assert.deepEqual(
  apamAfterProviderFailure.events.map((row) => row.date),
  ["2026-08-14", "2026-08-17"],
  "500, timeout, or network failure retains the APAM cache",
);

const apamAfterSampleFallback = await getRealDividendEventsForTicker({
  ticker: "APAM",
  year: 2026,
  month: 8,
  cache: expiredApamCache,
  preferFreshCache: true,
  fetchDividends: async () => ({
    ticker: "APAM",
    normalizedTicker: "APAM",
    source: "sample",
    warnings: ["provider unavailable"],
    updatedAt: "2026-08-17T00:00:00.000Z",
    dividends: [{ date: "2026-09-01", amount: 1 }],
  }),
});
assert.deepEqual(
  apamAfterSampleFallback.events.map((row) => row.date),
  ["2026-08-14", "2026-08-17"],
  "sample fallback data cannot replace a persisted provider cache",
);

const mixed = cache("cache", [event("sample"), event("declared")]);
assert.deepEqual(
  authoritativeAlertCacheEntry(mixed)?.events.map((row) => row.sourceKind),
  ["declared"],
  "sample rows are removed without discarding valid rows from the same cache",
);
assert.deepEqual(
  sanitizedPersistedAlertCacheEntry(mixed).events.map((row) => row.sourceKind),
  ["declared"],
  "previously persisted mixed caches retain only explicit provider-backed rows",
);

assert.equal(
  isCustomCalendarEventLike({ ...event("custom"), type: "custom" }),
  true,
  "custom event routing remains unchanged and outside generated-cache persistence",
);

console.log("calendar alert cache provenance checks passed");
