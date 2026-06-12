# Step 5A-0 Calendar Event ID And Cache Schema

Update date: 2026-06-12

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/`
- No `target/` folder exists or was created.
- This step fixes the event identity and cache ownership design before real dividend event wiring.
- This step does not implement real dividend event generation, estimation, migration, UI redesign, ledger logic, market temperature, QLD, or calculator changes.

## Files Read

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
- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/CalendarEventList.tsx`
- `components/watchlist/DividendSchedulePreview.tsx`
- `components/watchlist/FavoritesPanel.tsx`
- `components/watchlist/SelectedDateList.tsx`
- `components/watchlist/TickerManager.tsx`
- `lib/mock-calendar-data.ts`
- `lib/calendar-grid.ts`
- `lib/storage-keys.ts`
- `lib/firebase/firestore-repositories.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`

Context documents:

- `docs/AUDIT.md`
- `docs/STEP1_NAVIGATION_AUDIT.md`
- `docs/STEP2_COMPLETION_AUDIT.md`
- `docs/STEP3A_PORTFOLIO_DATA_FOUNDATION.md`
- `docs/STEP3B_PORTFOLIO_PARSER_FIELDS.md`
- `docs/STEP3C_PORTFOLIO_PARSER_FIXTURES.md`
- `docs/STEP3D_PORTFOLIO_REAL_SAMPLE_VALIDATION.md`

## Original Reference Summary

The Streamlit calendar stores all calendar data under the original Firebase Realtime Database node `users/{uid}/dividend_calendar`.

Important original subtrees:

- `portfolios`: portfolio name to ticker list.
- `memos`: ticker-level memo map, keyed by ticker.
- `marks`: event-level mark map, keyed by `DividendEvent.event_id`.
- `custom_ce`: custom calendar events keyed by date string.
- `cached_events`: ticker-level generated event cache.

Original generated event identity:

- `DividendEvent.event_id` returns `{ticker}-{event_type}-{event_date}`.
- Original event types are `ex_div`, `buy`, `payment`, and `earnings`.
- `marks` use the event id.
- ticker memos use ticker, not event id.
- cached events are saved per ticker as serialized generated events.

The Next.js implementation should not copy the original Realtime Database shape directly because it already has separate localStorage keys and Firestore collections.

## Current Next.js Event ID Structure

Current `lib/mock-calendar-data.ts` event types:

- `ex_div`
- `buy_by`
- `pay`
- `earnings`

Current mock event id generation:

```txt
{ticker}-{type}-{date}
```

Example:

```txt
SCHD-ex_div-2026-06-10
```

Current properties used for identity:

- `ticker` is uppercased in the mock event builder.
- `type` is the current UI/mock event type string.
- `date` is the event display date.
- `status`, dividend amount, related dates, and source are not included in the id.

This is deterministic for the current mock generator, but it is not a final real-data contract because it is tied to the mock event type spelling and lacks namespaces.

## Current Memo, Mark, And Storage Structure

Calendar event meta is saved in `components/watchlist/DividendCalendarPage.tsx`.

Local storage:

- Tickers: `STORAGE_KEYS.calendarTickers`
- Key value: `gorani.dividend-calendar.tickers.v1`
- Shape: JSON string array of tickers.
- Event meta: `STORAGE_KEYS.calendarEventMeta`
- Key value: `gorani.dividend-calendar.event-meta.v1`
- Shape: JSON object keyed by `event.id`.

Current event meta record:

```ts
type CalendarEventMeta = {
  eventId: string;
  ticker?: string;
  star?: boolean;
  heart?: boolean;
  memo?: string;
};
```

Firestore:

- Tickers path: `users/{uid}/calendarTickers/{TICKER}`
- Event meta path: `users/{uid}/calendarEvents/{eventId}`
- Calendar settings path: `users/{uid}/calendarSettings/default`
- Calendar cache path: `users/{uid}/calendarCache/{entryId}`

Current mock event to saved meta connection:

- `eventMetas` is a client map keyed by `event.id`.
- On load, Firestore metas are converted to `[meta.eventId, meta]`.
- On save, the document id and stored `eventId` both use `event.id`.
- On render, an event reads `eventMetas[event.id]`; `star`, `heart`, and `memo` are merged into the mock event display object.

There is no custom event implementation in the current Next.js watchlist screen. The current custom-event behavior exists only in the original Streamlit reference.

## Current Cache Structure

The cache foundation exists but is unconnected to the watchlist UI.

Local storage:

- Reserved key: `gorani.dividend-calendar.cache.v1`
- No current watchlist load/save path uses it.

Firestore:

- Path: `users/{uid}/calendarCache/{entryId}`
- Existing repository functions:
  - `saveCalendarCacheEntry`
  - `loadCalendarCacheEntries`
  - `deleteCalendarCacheEntry`

Current `CalendarCacheEntry` is broad and entry-based:

```ts
type CalendarCacheEntry = {
  id: string;
  tickers: string[];
  month?: string;
  rangeStart?: string;
  rangeEnd?: string;
  events: Array<Record<string, unknown>>;
  source?: "firestore" | "cache" | "sample";
  warnings?: string[];
  expiresAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};
```

This step widens the type minimally for future per-ticker generated cache ownership:

- optional `ticker`
- optional `fetchedAt`
- optional `ttlHours`
- source can include `yahoo`

No cache migration or UI wiring was added.

## Breakage Risks

1. Mock type names differ from original and likely future real event names.
   - Current Next.js uses `buy_by` and `pay`.
   - Original uses `buy` and `payment`.
   - If real events switch to original names, existing meta keyed by `SCHD-buy_by-date` or `SCHD-pay-date` will not attach.

2. There is no namespace in the current id.
   - A generated dividend event, custom event, and economic event could collide if future code only uses date/title/ticker style ids.

3. `event.id` is the only current meta key.
   - localStorage and Firestore both depend on exact id string equality.
   - Any full replacement of mock IDs without a compatibility lookup or migration will orphan stars, hearts, and memos.

4. Source transitions can orphan meta if source is included in the primary id.
   - An estimated dividend later becoming declared should still be the same user-facing event when ticker, normalized type, and date match.

5. Amount is volatile.
   - Dividend amount corrections should not be part of the primary memo/mark id.

6. Cache and user meta must stay separate.
   - Generated cache expiration, refresh, or deletion must not delete `calendarEvents` meta records.

## Proposed Stable Event ID Rules

### Generated Dividend Events

Canonical generated dividend ids should use a namespace and normalized event type:

```txt
dividend:{TICKER}:{EVENT_TYPE}:{EVENT_DATE}
```

Normalization:

- ticker: trim, uppercase, remove unsafe characters.
- event type aliases:
  - `buy_by`, `buyby`, `buy-deadline` -> `buy`
  - `pay` -> `payment`
  - `ex-div`, `exdiv`, `ex_dividend` -> `ex_div`
- event date: ISO date segment, `YYYY-MM-DD`.

Examples:

```txt
dividend:SCHD:ex_div:2026-06-10
dividend:SCHD:buy:2026-06-09
dividend:SCHD:payment:2026-06-23
dividend:MSFT:earnings:2026-06-18
```

Primary id deliberately does not include amount. `normalizeCalendarAmount` exists for future comparison/content keys, but amount-only corrections must not remove user meta.

Primary id also deliberately does not include `declared`, `estimated`, or `sample` source kind. Source kind should be stored on event/cache metadata, not used as the primary canonical id for generated dividend events.

If a future provider returns two distinct same-ticker, same-type, same-day events, Step 5A-1 should add a collision suffix based on provider event id or a stable related-date hash. That collision path should be exceptional and documented at the moment real data exposes it.

### Estimated To Declared Strategy

Use canonical id first:

```txt
dividend:{TICKER}:{EVENT_TYPE}:{EVENT_DATE}
```

When an estimated event becomes declared but ticker, normalized event type, and event date remain the same:

- keep the same canonical id.
- update event payload/source metadata.
- keep `calendarEvents/{canonicalEventId}` user meta attached.

When declared data changes the date:

- keep old meta in place.
- Step 5A-1 should use a compatibility lookup window, for example same ticker plus same normalized type plus nearest previous estimated date, before deciding to migrate or alias.
- If migrating, write `canonicalEventId` on the meta target and preserve the previous `eventId` as a legacy lookup key until old clients are no longer relevant.

No migration was run in this step.

### Custom Events

Custom event ids must use a separate namespace:

```txt
custom:{userGeneratedUuid}
```

Do not build custom ids from ticker or date because user custom events can be renamed, retickered, or moved to a different date.

Custom event deletion or editing must not touch generated dividend cache or generated event meta unless the user explicitly links them in a future feature.

### Economic Events

Economic event ids should use a separate namespace:

```txt
economic:{DATE}:{normalizedTitleHash}
```

The hash should be derived from a normalized title, not the array index. This step documents and implements the helper only; it does not implement economic calendar storage or UI wiring.

## Cache Ownership Design

Use separate ownership for generated data and user data.

Generated ticker cache:

```ts
type CalendarTickerCache = {
  ticker: string;
  events: DividendCalendarGeneratedEvent[];
  fetchedAt: string;
  expiresAt: string;
  source: "yahoo" | "sample" | "cache";
  warnings: string[];
};
```

Recommended Firestore document id:

```txt
users/{uid}/calendarCache/{TICKER}
```

Recommended localStorage shape under `gorani.dividend-calendar.cache.v1`:

```ts
Record<string, CalendarTickerCache>
```

where the key is normalized ticker.

User-owned data:

- ticker list: `calendarTickers`
- event meta: `calendarEvents/{canonicalEventId}`
- future custom events: separate collection/key, for example `calendarCustomEvents/{customId}` or a localStorage key distinct from cache.

Cache refresh rules:

- Replacing `calendarCache/{TICKER}` replaces only generated events for that ticker.
- Clearing cache deletes only generated cache entries.
- Clearing or refreshing cache must not delete `calendarEvents`, custom events, or ticker list records.
- Event payloads should contain source/warnings/fetched metadata, but user memo/mark data should remain outside the cache payload.

## Added Or Modified Functions And Types

Added `lib/calendar-event-identity.ts`:

- `CalendarEventSourceKind`
- `GeneratedCalendarEventSourceKind`
- `CalendarEventMetaTarget`
- `CalendarTickerCacheSource`
- `CalendarTickerCache`
- `GeneratedCalendarEventIdInput`
- `CustomCalendarEventIdInput`
- `EconomicCalendarEventIdInput`
- `CanonicalCalendarEventLike`
- `normalizeCalendarTicker`
- `normalizeCalendarEventType`
- `normalizeCalendarAmount`
- `buildGeneratedCalendarEventId`
- `buildCustomCalendarEventId`
- `buildEconomicCalendarEventId`
- `getCanonicalCalendarEventId`

Modified `lib/firebase/firestore-repositories.ts`:

- `CalendarEventMeta` now extends `CalendarEventMetaTarget`.
- `CalendarEventMeta` can carry optional `canonicalEventId` and `sourceKind`.
- `CalendarCacheEntry` can carry optional `ticker`, `fetchedAt`, and `ttlHours`.
- `CalendarCacheEntry.source` can now include `yahoo`.
- `saveCalendarCacheEntry` normalizes optional `ticker` when present.

## Areas Not Applied In This Step

- Existing mock event ids were not replaced.
- `DividendCalendarPage` still reads and writes meta by current `event.id`.
- No compatibility lookup was added.
- No saved meta migration was run.
- No real dividend event generation was implemented.
- No future dividend estimation was implemented.
- No custom event UI/storage was implemented in Next.js.
- No economic event UI/storage was implemented in Next.js.
- No calendar UI layout or dialog design was changed.
- No Firestore collection migration was performed.

## Next Step 5A-1 Recommendations

1. Introduce canonical id generation at the boundary where mock or real events are created.
2. Keep legacy `event.id` as `legacyEventId` during the first wiring step.
3. Read meta by canonical id first, then by legacy id as fallback.
4. When saving meta, write `eventId` as the canonical id and optionally preserve `canonicalEventId`.
5. Convert generated event cache to per-ticker ownership before connecting live dividend fetches.
6. Add cache expiry checks using `fetchedAt` and `expiresAt` or `ttlHours`.
7. Only after compatibility is verified, consider a one-time localStorage/Firestore meta migration.
