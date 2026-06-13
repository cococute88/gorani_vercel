# Step 5A-6-0 Calendar Custom Event Foundation

Update date: 2026-06-13

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/`
- `target/`: does not exist and was not created.
- This step implements the custom calendar event storage/CRUD foundation and generated/custom merge guard.
- This step does not add a custom event creation/edit form, redesign the calendar UI, or change the generated dividend provider/cache fallback order.

## Files Read

Documents, read as UTF-8:

- `docs/AUDIT.md`
- `docs/FULL_REQUIREMENTS_REPLAY_UTF8_AUDIT.md`
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
- `docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`
- `docs/STEP5A5_CALENDAR_UI_POLISH.md`

Current Next.js files:

- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/CalendarGrid.tsx`
- `components/watchlist/CalendarEventDialog.tsx`
- `components/watchlist/CalendarEventList.tsx`
- `components/watchlist/DividendSchedulePreview.tsx`
- `lib/calendar-event-provider.ts`
- `lib/calendar-cache.ts`
- `lib/calendar-event-identity.ts`
- `lib/storage-keys.ts`
- `lib/firebase/firestore-repositories.ts`
- `lib/calendar-grid.ts`
- `lib/event-visuals.ts`
- `lib/mock-calendar-data.ts`
- `scripts/check-calendar-provider.mjs`
- `package.json`

Original reference, read only:

- `original/modules/dividend_calendar.py`
- `original/core/sync.py`
- `original/core/firebase.py`

All requested files existed. No `original/` file was modified.

## Custom Event Type

`lib/calendar-custom-events.ts` adds a separate user-owned custom event type:

```ts
type CalendarCustomEvent = {
  id: string;
  canonicalEventId: string;
  sourceKind: "custom";
  title: string;
  date: string;
  type: "custom";
  ticker?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};
```

The existing render-facing `CalendarEvent` type now accepts `type: "custom"` and optional `title`, but generated dividend fields remain unchanged for backward compatibility.

## Custom Event ID Rule

Custom event IDs use the reserved namespace:

```txt
custom:{uuid-or-stable-user-generated-id}
```

`createCalendarCustomEvent` generates `custom:{uuid}` IDs by default. `normalizeCalendarCustomEvent` preserves the same ID when `title`, `date`, `ticker`, or `note` changes, so custom event edits do not create new identities.

Custom IDs are not derived from ticker/date/title.

## localStorage Storage

New storage key:

```txt
gorani.dividend-calendar.custom-events.v1
```

Functions added in `lib/calendar-custom-events.ts`:

- `loadCalendarCustomEvents`
- `saveCalendarCustomEvents`
- `upsertCalendarCustomEvent`
- `deleteCalendarCustomEvent`
- `createCalendarCustomEvent`
- `normalizeCalendarCustomEvent`
- `calendarCustomEventToCalendarEvent`
- `dedupeCalendarCustomEvents`
- `isCalendarCustomEventId`

The localStorage helpers are client-safe, return `[]` during SSR/build, fall back to `[]` on JSON parse failure, and never touch the generated dividend cache key.

## Firestore Repository

`lib/firebase/firestore-repositories.ts` now has custom event repository helpers:

- `saveCalendarCustomEvent`
- `loadCalendarCustomEvents`
- `deleteCalendarCustomEvent`

Firestore path:

```txt
users/{uid}/calendarCustomEvents/{eventId}
```

This is intentionally separate from:

- `users/{uid}/calendarEvents/{eventId}` for memo/star/heart meta
- `users/{uid}/calendarCache/{ticker}` for generated dividend cache

No Firestore migration script was added.

## Provider Merge

`lib/calendar-event-provider.ts` adds:

- `mergeGeneratedAndCustomCalendarEvents(generated, custom)`
- `isCustomCalendarEventLike(event)`

The merge helper:

- normalizes generated event identity through the existing canonical event path
- adapts custom events into renderable `CalendarEvent` objects
- keeps the first event for each duplicate ID
- sorts by date, ticker, type, then id

`DividendCalendarPage` loads custom events from localStorage and, when authenticated, merges in Firestore custom events. The displayed event list is built from provider generated events plus custom events through the merge helper.

## Generated Cache Separation

`buildCalendarTickerCacheFromEvents` now filters out custom events before writing generated cache entries. `normalizeGeneratedCalendarEventForCache` also throws if called directly with a custom event.

This preserves the boundary:

- generated provider/cache data stays under `calendarCache`
- custom user-owned events stay under `calendarCustomEvents`
- generated memo/star/heart meta remains under `calendarEvents`

For custom events shown through the current dialog, note updates are routed back to the custom event record instead of saving a custom event body into generated event meta.

## UI Connection Scope

UI changes were deliberately minimal:

- custom events can be included in `CalendarGrid`, selected-date lists, and month key-event lists
- `custom` gets a fallback visual style in the existing event visual system
- unknown future event types fall back to the custom visual instead of crashing
- the filter row includes the existing-style `사용자` filter chip

No custom event form/modal, calendar layout redesign, event chip redesign, dialog redesign, or source badge redesign was added.

## Regression Check Additions

`scripts/check-calendar-provider.mjs` now verifies:

- custom event IDs start with `custom:`
- custom date/title/ticker survive normalization and upsert
- field edits keep the same custom ID
- generated and custom events can merge
- duplicate custom IDs are guarded
- custom events are excluded from generated cache entries
- custom/unknown type visual fallback is safe
- localStorage CRUD helpers work with a Node storage stub

## Not Done In This Step

- No custom event create/edit/delete UI was implemented.
- No CalendarGrid layout change was made.
- No event chip or dialog design change was made.
- No provider/cache fallback order was changed.
- No canonical generated dividend ID rule was changed.
- No legacy meta fallback was removed.
- No Firestore migration script was added.
- No TaxSavingTable real calculation or economic calendar implementation was added.
- No package dependency was changed.

## Next Claude UI Step

The next UI step should:

1. Add a small custom event create/edit/delete flow that calls the new custom event helpers.
2. Keep custom event edits on `calendarCustomEvents`, not `calendarEvents` or `calendarCache`.
3. Decide whether custom events should support separate star/heart behavior or only title/date/ticker/note.
4. Add clear delete confirmation for custom events only.
5. Re-check mobile dialog behavior after custom event fields are introduced.
