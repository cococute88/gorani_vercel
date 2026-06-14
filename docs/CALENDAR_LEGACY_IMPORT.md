# Calendar Legacy Import

Update date: 2026-06-14

## Scope

CALENDAR-LEGACY-IMPORT-1 adds a one-time, user-triggered import UI for an old Firebase Realtime Database dividend calendar export JSON.

Private source JSON files stay under `private/`, which is ignored by Git. The import UI reads the selected file in the browser and writes to Firestore only after the signed-in user presses the import button.

## Legacy RTDB Shape

The expected root object is:

```ts
{
  dividend_calendar: {
    _last_sync: string;
    cached_events: Record<string, LegacyDividendEvent[]>;
    custom_ce: Record<string, { name: string; symbol: string }>;
    marks: Record<string, { heart: boolean; star: boolean }>;
    memos: Record<string, string>;
    portfolios: Record<string, string[]>;
  }
}
```

`cached_events` rows may include `ticker`, `event_type`, `event_date`, `ex_div_date`, `payment_date`, `buy_deadline`, `dividend_amount`, `current_price`, `annual_yield`, `estimated`, and `is_etf`.

## Current Firestore Schema

Current calendar persistence is user-scoped:

- `users/{uid}/calendarEvents/{eventId}`: generated event metadata such as `star`, `heart`, and `memo`.
- `users/{uid}/calendarCustomEvents/{eventId}`: custom event bodies used by the current calendar UI.
- `users/{uid}/calendarTickers/{ticker}`: enabled calendar tickers.
- `users/{uid}/calendarCache/{ticker}`: generated provider cache.

The render-facing `CalendarEvent` shape uses:

- `id`
- `canonicalEventId`
- `legacyEventId?`
- `sourceKind`
- `title?`
- `ticker`
- `type`: `ex_div | buy_by | pay | earnings | custom`
- `date`
- `status`: `confirmed | estimated`
- `dividendAmount`
- `buyDeadline`
- `exDivDate`
- `paymentDate`
- `annualYield`
- `taxSavingUsd`
- optional user metadata such as `favorite` and `note`

Imported generated legacy events are stored as full event payloads in `users/{uid}/calendarEvents`, with `source: "legacy-rtdb-import"`. The calendar page now reads those full payloads and merges them with provider events.

Custom legacy events are written both to `users/{uid}/calendarEvents` for audit/import completeness and to `users/{uid}/calendarCustomEvents` so the existing UI can display them.

## Type Mapping

Legacy `event_type` maps to current event types:

| Legacy | Current |
| --- | --- |
| `ex_div` | `ex_div` |
| `buy` | `buy_by` |
| `payment` | `pay` |
| `earnings` | `earnings` |

Each imported event preserves:

- `ticker`
- `eventType` through current `type`
- `eventDate` through current `date`
- `exDivDate`
- `paymentDate`
- `buyDeadline`
- `dividendAmount`
- `currentPrice`
- `annualYield`
- `estimated` through current `status`
- `isEtf`
- `source: "legacy-rtdb-import"`
- `legacyId`
- `legacyEventId`
- `legacyPayload`

## custom_ce

Legacy `custom_ce[date] = { name, symbol }` is converted to a custom calendar event:

- `date`: legacy key
- `title`: `name`
- `ticker`: normalized `symbol`, or `CUSTOM`
- `type`: `custom`
- `sourceKind`: `custom`
- `source`: `legacy-rtdb-import`
- `legacyId`: `legacy_custom_${date}_${hash(name + symbol)}`

The deterministic custom ID is normalized through the existing `custom:` ID namespace.

## marks

Legacy marks are matched by:

```txt
${ticker}-${event_type}-${event_date}
```

When a match exists, `star` and `heart` are stored on the imported `calendarEvents` document. The original mark object is also preserved as `legacyMarks`.

## memos and portfolios

Ticker memos are not duplicated onto every event.

- Memos are preserved in `users/{uid}/legacyDividendCalendarMeta/memos`.
- Portfolios are preserved in `users/{uid}/legacyDividendCalendarMeta/portfolios`.

The current app has ticker watchlist persistence, but it does not have named legacy calendar portfolio storage. Therefore named portfolios are preserved as legacy metadata rather than being flattened into `calendarTickers`.

## Sentinel Date Policy

The importer excludes visible calendar events when:

- `event_date` is `2999-12-31`
- the year is `2100` or later
- the date is invalid or not `YYYY-MM-DD`

Excluded events are counted in preview as skipped placeholder/invalid events and are not written to visible calendar event documents.

## Dedupe Policy

The importer uses deterministic document IDs:

- Cached event: `legacy_${ticker}_${currentType}_${eventDate}`
- Custom event: existing `custom:` namespace with `legacy_custom_${date}_${hash}`

Writes use Firestore merge semantics. Importing the same JSON again updates the same document IDs instead of creating duplicates.

Preview reads existing Firestore document IDs and reports:

- new writes
- update writes
- excluded events

## Usage

1. Open `/dev/calendar-import`.
2. Sign in with Firebase auth.
3. Select the RTDB export JSON file from disk.
4. Review preview counts and target path.
5. Press `가져오기 실행`.
6. Open `/watchlist` to see imported generated and custom calendar events.

The importer does not provide delete-all, rollback, or destructive cleanup actions.

## Limits

- This is a client-side one-time import tool.
- It does not import legacy memos into every event.
- It preserves named legacy portfolios as metadata instead of changing the active watchlist.
- It does not delete or rewrite existing generated provider cache entries.
- It does not change Firebase config, auth setup, or Firestore rules.
