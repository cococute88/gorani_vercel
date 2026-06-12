# Step 5A-1 Calendar Canonical ID Apply

Update date: 2026-06-13

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/`
- No `target/` folder exists or was created.
- This step applies canonical event ids to the current mock/generated dividend calendar events and adds legacy meta fallback.
- This step does not implement real dividend fetches, future dividend estimation, cache refresh, API calls, custom event UI, or calendar UI redesign.

## Files Read

Context documents:

- `docs/AUDIT.md`
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP1_NAVIGATION_AUDIT.md`
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
- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/CalendarEventList.tsx`
- `components/watchlist/DividendSchedulePreview.tsx`
- `components/watchlist/SelectedDateList.tsx`
- `components/watchlist/DividendEventCalendar.tsx`
- `components/watchlist/DividendEventTable.tsx`
- `components/watchlist/FavoritesPanel.tsx`
- `lib/mock-calendar-data.ts`
- `lib/calendar-grid.ts`
- `lib/calendar-event-identity.ts`
- `lib/storage-keys.ts`
- `lib/firebase/firestore-repositories.ts`

All requested files existed. `components/watchlist/` was inspected by file listing and targeted reads.

## Previous Event ID Structure

The current mock calendar builder used ids in this shape:

```txt
{ticker}-{type}-{date}
```

Examples:

```txt
SCHD-buy_by-2026-06-09
SCHD-ex_div-2026-06-10
SCHD-pay-2026-06-23
```

`DividendCalendarPage` previously loaded event meta into `eventMetas` keyed only by `meta.eventId`, read meta with `eventMetas[event.id]`, and saved localStorage and Firestore meta under `event.id`.

## Applied Canonical ID Method

`lib/mock-calendar-data.ts` now uses `buildGeneratedCalendarEventId` from `lib/calendar-event-identity.ts` when mock/generated events are created.

New generated event ids use the stable namespace:

```txt
dividend:{TICKER}:{NORMALIZED_EVENT_TYPE}:{EVENT_DATE}
```

Examples:

```txt
dividend:SCHD:buy:2026-06-09
dividend:SCHD:ex_div:2026-06-10
dividend:SCHD:payment:2026-06-23
```

The mock event type strings remain unchanged for UI compatibility:

- UI type `buy_by` produces canonical type `buy`.
- UI type `pay` produces canonical type `payment`.
- UI type `ex_div` remains `ex_div`.
- UI type `earnings` remains `earnings`.

`sourceKind` is set to `sample` for current mock/generated events. `sourceKind` is not part of the canonical id.

## legacyEventId Preservation

The existing mock id is preserved on each generated event as `legacyEventId`.

Current event identity fields are:

```ts
{
  id: canonicalEventId,
  canonicalEventId,
  legacyEventId,
  sourceKind: "sample"
}
```

This means new renders use the canonical id as the primary event id, while existing saved meta keyed by the old mock id can still be found.

## Memo, Star, And Heart Lookup Order

`components/watchlist/DividendCalendarPage.tsx` now resolves meta in this order:

1. `event.canonicalEventId`
2. `event.legacyEventId`
3. `event.id`

Because `event.id` is now the canonical id for generated events, canonical meta wins when both canonical and legacy records exist.

Firestore load also indexes any returned meta by both:

- `meta.eventId`
- `meta.canonicalEventId`, when present

This keeps older and newer saved shapes readable without a bulk migration.

## Save Behavior

New meta writes use the canonical id:

- localStorage key: canonical event id
- Firestore document id: canonical event id
- stored `eventId`: canonical event id
- stored `canonicalEventId`: canonical event id

If a user sees existing legacy meta through fallback and then changes star, heart, or memo, the updated meta is naturally written under the canonical key. The old legacy key is not deleted and no full migration is run.

## Custom Event Namespace

No custom event UI/storage exists in the current Next.js watchlist screen.

The existing `lib/calendar-event-identity.ts` helper already reserves custom ids as:

```txt
custom:{uuid}
```

This step did not add a new custom event UI. Future custom event work should use `buildCustomCalendarEventId` and should store custom events separately from generated dividend events and generated cache payloads.

## Cache Connection

Calendar cache remains unconnected to the watchlist UI in this step.

No code was added for:

- real dividend fetch
- future dividend estimation
- cache refresh
- API calls
- cache load/save in `/watchlist`

The existing cache repository types remain available for a later step, and generated event canonical ids are now ready to be used inside future cache event payloads.

## Modified Files

- `lib/mock-calendar-data.ts`
  - Added optional `canonicalEventId`, `legacyEventId`, and `sourceKind` fields to `CalendarEvent`.
  - Switched generated mock `event.id` to the canonical dividend id.
  - Preserved the old mock id as `legacyEventId`.

- `components/watchlist/DividendCalendarPage.tsx`
  - Added canonical-first meta lookup with legacy fallback.
  - Saved localStorage and Firestore event meta under canonical ids.
  - Indexed Firestore reads by canonical id when available.

- `components/watchlist/CalendarEventDialog.tsx`
  - Built save payloads with canonical `eventId` and `canonicalEventId`.
  - Preserved `sourceKind` on saved meta.

- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
  - Added this implementation record.

- `docs/AUDIT.md`
  - Added Step 5A-1 completion link.

## Existing Data Compatibility

Existing localStorage and Firestore meta keyed by old mock ids remains readable through `legacyEventId` fallback.

Example fallback:

```txt
canonical: dividend:SCHD:buy:2026-06-09
legacy:    SCHD-buy_by-2026-06-09
```

If only `SCHD-buy_by-2026-06-09` exists in saved meta, the UI still shows the saved star, heart, or memo. The next edit saves the updated meta under `dividend:SCHD:buy:2026-06-09`.

No Firestore structure migration, localStorage full migration, or delete/rewrite migration script was added.

## Next Step 5A-2 Recommendations

1. Define the generated dividend cache payload shape that will carry these canonical ids.
2. Keep user meta in `calendarEvents/{canonicalEventId}` and generated payloads in cache-owned storage.
3. Add cache expiry and per-ticker cache ownership before live fetch wiring.
4. Connect one real provider behind the existing mock boundary with sample fallback.
5. Document any provider collision case only when real data exposes same ticker/type/date duplicates.
