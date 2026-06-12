# Step 5A-2 Calendar Cache Provider Boundary

Update date: 2026-06-13

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/`
- No `target/` folder exists or was created.
- This step implements the per-ticker calendar cache boundary, TTL helpers, localStorage helpers, Firestore per-ticker wrappers, and a provider boundary around the current mock events.
- This step does not connect real dividend fetches, `/api/quote/dividends`, future dividend estimation, calendar UI redesign, TaxSavingTable real calculations, migrations, QLD, market temperature, portfolio, or calculator work.

## Files Read

Context documents:

- `docs/AUDIT.md`
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
- `docs/STEP2_COMPLETION_AUDIT.md`

Original reference, read only:

- `original/modules/dividend_calendar.py`
- `original/core/sync.py`
- `original/core/firebase.py`

Current Next.js files:

- `app/watchlist/page.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `components/watchlist/CalendarGrid.tsx`
- `components/watchlist/CalendarEventDialog.tsx`
- `lib/mock-calendar-data.ts`
- `lib/calendar-grid.ts`
- `lib/calendar-event-identity.ts`
- `lib/storage-keys.ts`
- `lib/firebase/firestore-repositories.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`

All requested files existed.

## Existing Cache Structure

Local storage already reserved:

- Key: `STORAGE_KEYS.calendarCache`
- Value: `gorani.dividend-calendar.cache.v1`
- Previous status: reserved only; `/watchlist` did not read or write it.

Firestore already had a broad entry collection:

- Path: `users/{uid}/calendarCache/{entryId}`
- Existing functions:
  - `saveCalendarCacheEntry`
  - `loadCalendarCacheEntries`
  - `deleteCalendarCacheEntry`

Existing user-owned calendar data remains separate:

- Tickers: `users/{uid}/calendarTickers/{TICKER}`
- Event meta: `users/{uid}/calendarEvents/{canonicalEventId}`
- Settings: `users/{uid}/calendarSettings/default`

## Added And Aligned Cache Types

`lib/calendar-event-identity.ts` now defines `CalendarTickerCache` with an explicit schema version:

```ts
type CalendarTickerCache<TEvent = Record<string, unknown>> = {
  ticker: string;
  events: TEvent[];
  fetchedAt: string;
  expiresAt: string;
  source: "mock" | "yahoo" | "sample" | "cache";
  warnings: string[];
  schemaVersion: number;
};
```

`mock` was added as a cache source because Step 5A-2 routes current generated mock events through the provider boundary without pretending they came from Yahoo.

## TTL Policy

`lib/calendar-cache.ts` defines:

- `CALENDAR_TICKER_CACHE_SCHEMA_VERSION = 1`
- `DEFAULT_CALENDAR_TICKER_CACHE_TTL_HOURS = 24`

The selected default TTL is 24 hours. Dividend calendar events do not require second-level freshness, and a one-day boundary avoids unnecessary refresh pressure while still letting future real providers update daily.

The helper set includes:

- ticker normalization via `normalizeCalendarCacheTicker`
- per-ticker cache key generation via `getCalendarTickerCacheKey`
- expiration calculation via `getCalendarTickerCacheExpiresAt`
- entry creation via `createCalendarTickerCacheEntry`
- freshness checks via `isCalendarTickerCacheFresh`
- expiration checks via `isCalendarTickerCacheExpired`

Freshness requires:

- matching `schemaVersion`
- normalized non-empty ticker
- array `events`
- parseable `expiresAt`
- `expiresAt` later than the current time

## localStorage Cache Functions

`lib/calendar-cache.ts` adds client-safe localStorage helpers:

- `loadCalendarCacheMap`
- `saveCalendarCacheMap`
- `loadCalendarTickerCache`
- `saveCalendarTickerCache`
- `removeCalendarTickerCache`

These helpers:

- use `STORAGE_KEYS.calendarCache`
- return an empty cache during SSR/build or when `window.localStorage` is unavailable
- handle JSON parse failure by removing the broken cache key and returning an empty map
- normalize ticker keys before load/save/remove
- treat cache writes as best effort

The `/watchlist` UI does not yet persist provider output into localStorage. The helpers are ready for Step 5A-3 wiring.

## Firestore Cache Functions

`lib/firebase/firestore-repositories.ts` keeps the existing broad cache functions unchanged in shape:

- `saveCalendarCacheEntry`
- `loadCalendarCacheEntries`
- `deleteCalendarCacheEntry`

Minimal alignment added:

- `CalendarCacheEntry.source` now accepts `mock`
- `CalendarCacheEntry.schemaVersion` is optional
- `CalendarCacheEntry` remains compatible with existing `id`, `ticker`, `tickers`, month/range, events, warnings, timestamps, and expires fields

New per-ticker wrapper functions:

- `saveCalendarTickerCacheEntry`
- `loadCalendarTickerCacheEntry`
- `deleteCalendarTickerCacheEntry`

These wrappers store per-ticker generated cache documents at:

```txt
users/{uid}/calendarCache/{TICKER}
```

They convert between `CalendarTickerCache<Record<string, unknown>>` and the existing `CalendarCacheEntry` shape. No Firestore migration script was created, and the existing `calendarEvents` meta collection was not changed.

## Provider Boundary

`lib/calendar-event-provider.ts` adds the provider boundary for calendar events:

- `getMockCalendarEventsForTicker`
- `getCalendarEventsForTicker`
- `getCalendarEventsForTickers`
- `mergeCalendarEventsWithCache`
- `normalizeCalendarEventForCache`
- `buildCalendarTickerCacheFromEvents`

Current provider kind:

```ts
type CalendarEventProviderKind = "mock";
```

This intentionally leaves a clear future replacement point for a real provider without changing `DividendCalendarPage` again.

## Mock Events Through Provider Boundary

`components/watchlist/DividendCalendarPage.tsx` no longer calls `buildMockCalendarEvents(...)` directly. It now calls:

```ts
getCalendarEventsForTickers({
  tickers,
  year: month.getFullYear(),
  month: month.getMonth() + 1,
})
```

Internally, Step 5A-2 still uses `buildMockCalendarEvents(...)`, but only behind the provider function.

The default `/watchlist` path does not prefer persisted cache yet. This preserves current month-by-month mock behavior and avoids accidentally rendering a previous month's per-ticker cache while the real provider range policy is still undefined.

## canonicalEventId And legacyEventId

`normalizeCalendarEventForCache` preserves the Step 5A-1 identity contract:

- `id` is the canonical event id
- `canonicalEventId` is set when missing
- `legacyEventId` is preserved when present
- `sourceKind` defaults to `sample` for current mock/generated events
- ticker is normalized

`DividendCalendarPage` still resolves meta in canonical-first order:

1. `event.canonicalEventId`
2. `event.legacyEventId`
3. `event.id`

No saved meta migration or legacy meta deletion was performed.

## Real Provider Not Connected In This Step

The real provider was intentionally not connected because Step 5A-2 is a boundary and cache-shape step. Connecting real dividend data now would require decisions that belong to Step 5A-3:

- declared vs estimated event generation rules
- date range and cache range ownership
- provider warnings and partial failure display
- `/api/quote/dividends` UI fetch timing
- collision handling for same ticker/type/date events

No `/api/quote/dividends` call was added to `/watchlist`.

## Modified Files

- `lib/calendar-event-identity.ts`
  - Added `mock` to `CalendarTickerCacheSource`
  - Added `schemaVersion` to `CalendarTickerCache`
- `lib/calendar-cache.ts`
  - Added per-ticker cache schema, TTL helpers, freshness checks, and localStorage helpers
- `lib/calendar-event-provider.ts`
  - Added provider boundary around current mock event generation
- `components/watchlist/DividendCalendarPage.tsx`
  - Replaced direct mock builder call with `getCalendarEventsForTickers`
- `lib/firebase/firestore-repositories.ts`
  - Aligned `CalendarCacheEntry` source/schema fields
  - Added per-ticker calendar cache wrapper functions
- `docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`
  - Added this implementation record
- `docs/AUDIT.md`
  - Added Step 5A-2 completion link

## Verification

Commands:

- `npm.cmd run typecheck`: passed during implementation before documentation
- Final build/lint/typecheck results are recorded in the completion report for this step.

## Next Step 5A-3 Recommendations

1. Add a real dividend provider behind `CalendarEventProviderKind` without changing the calendar UI.
2. Define provider range ownership before enabling cache reads in the default `/watchlist` path.
3. Convert raw dividend API data into canonical generated events while preserving `legacyEventId` fallback.
4. Save successful per-ticker real provider output through `saveCalendarTickerCache` and optionally `saveCalendarTickerCacheEntry`.
5. Add partial failure warnings per ticker without deleting existing user meta.
