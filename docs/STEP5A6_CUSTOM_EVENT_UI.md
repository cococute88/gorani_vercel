# Step 5A-6-1 Calendar Custom Event UI

Update date: 2026-06-13

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/` (not modified)
- `target/`: does not exist and was not created.
- This step connects the existing custom calendar event foundation (Step 5A-6-0) to the `/watchlist` UI: add / edit / delete custom events, and render them in the calendar grid and event lists.
- This step does **not** add new UI libraries, change package dependencies, redesign the calendar, change the provider/cache fallback order, change canonical dividend event ID rules, remove the legacy meta fallback, or touch memo/star/heart storage for generated events.

## Files Read

Documents (UTF-8):

- `docs/AUDIT.md`
- `docs/FULL_REQUIREMENTS_REPLAY_UTF8_AUDIT.md`
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
- `docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`
- `docs/STEP5A5_CALENDAR_UI_POLISH.md`
- `docs/STEP5A6_CUSTOM_EVENT_FOUNDATION.md`

Code:

- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/CalendarGrid.tsx`
- `components/watchlist/CalendarEventDialog.tsx`
- `components/watchlist/CalendarEventList.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `lib/calendar-custom-events.ts`
- `lib/calendar-event-provider.ts`
- `lib/event-visuals.ts`
- `lib/storage-keys.ts`
- `lib/calendar-event-identity.ts`
- `lib/mock-calendar-data.ts`
- `lib/firebase/firestore-repositories.ts` (custom event helpers)
- `package.json`

Original reference, read only:

- `original/modules/dividend_calendar.py`
- `original/core/sync.py`
- `original/core/firebase.py`

All requested files existed. No `original/` file was modified. No file was reported as missing.

## Added / Changed UI Components

- **Added** `components/watchlist/CustomEventDialog.tsx` — a lightweight modal used for both creating and editing a custom event. Exports `CustomEventSubmitInput`.
- **Changed** `components/watchlist/DividendCalendarPage.tsx`:
  - Added a compact `+ 일정 추가` button in the filter card header.
  - Added custom-event dialog open/edit/submit/delete handlers.
  - Routed all `onOpenEvent` callbacks (grid, selected-date list, key-event list, schedule preview) through a single `handleOpenEvent` that opens the custom dialog for custom events and the existing meta dialog for generated events.
- No change was needed in `CalendarGrid.tsx`, `CalendarEventList.tsx`, `CalendarEventDialog.tsx`, or `event-visuals.ts`: custom events already render through the `custom` visual (`사용자`) and `eventChipLabel` already shows the custom title.

## Custom Event Create UI

- The `+ 일정 추가` button (amber, matches the `custom` visual) sits in the 필터 card header, separated from the filter chips.
- Clicking it opens `CustomEventDialog` in create mode with fields:
  - 일정 제목 (required)
  - 날짜 (required, native `<input type="date">`, value stays `YYYY-MM-DD`)
  - 티커 (optional, uppercased on input)
  - 메모 (optional)
- Defaults: date = currently selected date, falling back to today; title/ticker/note empty.
- Validation (short Korean messages):
  - empty title → `일정 제목을 입력하세요.`
  - missing/invalid date → `날짜를 YYYY-MM-DD 형식으로 입력하세요.`
- On save, `createCalendarCustomEvent` builds the record and `upsertCalendarCustomEvent` persists it; the selected date jumps to the new event's date so it is immediately visible.

## Custom Event Edit / Delete UI

- Clicking a custom event (chip, list row, or schedule preview) opens `CustomEventDialog` in edit mode, prefilled from the stored `CalendarCustomEvent` (matched by `canonicalEventId`/`id`).
- Saving keeps the same custom ID (`createCalendarCustomEvent` is called with the existing `id` and `createdAt`), so edits do not create a new identity.
- A red `삭제` button is shown **only** in edit mode. It reveals an inline `삭제할까요?` confirmation with 삭제 / 취소 before the event is removed.
- Generated dividend events never reach this dialog (they open `CalendarEventDialog`), so they never show a delete button. The canonical/meta/legacy logic for generated events is untouched.

## localStorage Connection

- Uses the existing Step 5A-6-0 helpers only — no duplicate storage logic was added:
  - `createCalendarCustomEvent`
  - `upsertCalendarCustomEvent`
  - `deleteCalendarCustomEvent`
- Storage key remains `gorani.dividend-calendar.custom-events.v1`.
- Verified in the dev preview: a created event survives a page reload (re-loaded from localStorage) and is removed from storage on delete.

## Firestore Connection

- When a user is authenticated, create/edit calls `saveCalendarCustomEvent(uid, record)` and delete calls `deleteCalendarCustomEvent(uid, eventId)` from `lib/firebase/firestore-repositories.ts` (path `users/{uid}/calendarCustomEvents/{eventId}`).
- Firestore calls are best-effort: failures are routed to `warnFirestoreFallback` and the localStorage state remains the source of truth, preserving the fallback behavior.

## Generated / Custom Separation

- Custom events are still merged for display only via `mergeGeneratedAndCustomCalendarEvents`; they are never written into the generated cache (`calendarCache`) or generated meta (`calendarEvents`).
- The previous custom-note branch in `persistEventMeta` is retained as a defensive guard but is now effectively unused, since custom events route to `CustomEventDialog` instead of `CalendarEventDialog`.
- Memo / star / heart on generated events continue to use the existing `calendarEvents` meta path unchanged.

## Mobile Check

Verified in the dev preview:

- 320px: create/edit modal fits within the viewport, inputs are full width, action buttons fit, dialog body scrolls (`max-h-[90vh] overflow-y-auto`).
- 320px: the `+ 일정 추가` button shares the filter header row without overflow; filter chips wrap below.
- Calendar grid chips continue to truncate; layout is not more broken than before.

## Data / Logic NOT Changed

- Generated dividend provider/cache fallback order.
- Canonical generated dividend event ID rules and `legacyEventId` fallback.
- Generated cache schema and `calendarCache` contents.
- memo/star/heart meta storage for generated events.
- Quote API, calculators, portfolio parser / live quote files.
- `TaxSavingTable` (still mock) and economic calendar (still absent).
- No Firestore migration script was added.

## Verification

- `npm.cmd run check:portfolio-parser` — passed
- `npm.cmd run check:portfolio-parser:private` — passed
- `npm.cmd run check:calendar-provider` — passed
- `npm.cmd run build` — passed
- `npm.cmd run lint` — passed (no warnings/errors)
- `npm.cmd run typecheck` — passed

Dev preview (`/watchlist`) confirmed: button visible, create/edit/delete work, custom event shows on the grid and selected-date/key-event lists, generated events show no delete button, custom event persists across reload, modal does not break at 320px/390px, and no new console errors (only pre-existing Recharts `defaultProps` warnings from chart components).

## Remaining Issues

- Custom events do not yet support star/heart marks (only title/date/ticker/note). This was intentionally left out of this step.
- The unused custom-note branch in `persistEventMeta` could be removed in a later cleanup.

## Next Step Recommendation

1. Decide whether custom events need star/heart and, if so, store it on the `CalendarCustomEvent` record (not in generated meta).
2. Optionally remove the now-unused custom branch in `persistEventMeta`.
3. Consider a dedicated "내 일정" list section so custom events are easy to find independent of the dividend lists.
