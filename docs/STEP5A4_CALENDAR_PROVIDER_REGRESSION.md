# Step 5A-4 Calendar Provider Regression

Update date: 2026-06-13

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/`
- `target/`: does not exist and was not created.
- This step strengthens calendar provider/cache regression coverage.
- This step does not redesign the calendar UI or add new product features.

## Files Read

Documents:

- `docs/AUDIT.md`
- `docs/FULL_REQUIREMENTS_REPLAY_UTF8_AUDIT.md`
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
- `docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`

Current Next.js files:

- `package.json`
- `lib/calendar-event-provider.ts`
- `lib/calendar-cache.ts`
- `lib/calendar-event-identity.ts`
- `lib/mock-calendar-data.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-data-provider.ts`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/CalendarGrid.tsx`
- `components/watchlist/CalendarEventDialog.tsx`

Original reference, read only:

- `original/modules/dividend_calendar.py`
- `original/core/sync.py`
- `original/core/firebase.py`

All requested files existed.

## Provider Pure Functions

`lib/calendar-event-provider.ts` already had the main provider logic split into testable functions:

- `buildDividendEventsFromHistory`
- `inferDividendFrequency`
- `projectEstimatedDividendEvents`
- `normalizeCalendarEventForCache`
- `buildCalendarTickerCacheFromEvents`

This step added/clarified:

- `getPreviousDividendBuyDate`
  - Exported pure helper for the buy deadline rule.
  - Returns the previous weekday before the ex-dividend date.
- `QuoteDividendsFetcher`
  - Allows `getRealDividendEventsForTicker` and `getCalendarEventsForTickersWithProvider` to receive a synthetic dividend fetcher in regression checks.
  - The production default remains `fetchQuoteDividends`.
- `normalizeGeneratedCalendarEventForCache`
  - Keeps generated cache payloads from carrying user meta-like fields such as `memo`, `note`, `star`, and `heart`.

The estimated projection loop now stops if weekend adjustment would push an estimated event beyond the 12-month projection end.

## Buy Deadline Helper

Current rule:

```txt
buy_by = previous weekday before ex_div date
```

Verified cases:

- Saturday ex-dividend date -> previous Friday
- Sunday ex-dividend date -> previous Friday
- Monday ex-dividend date -> previous Friday
- Tuesday through Friday ex-dividend dates -> previous weekday

This step intentionally does not implement a full US market holiday calendar.

## Regression Script

Added:

- `scripts/check-calendar-provider.mjs`
- `package.json` script: `check:calendar-provider`

The script uses Node plus the existing local TypeScript dependency. It does not add Jest, Vitest, Playwright, Cypress, or any new dependency.

The script uses synthetic fixtures and injected fetchers, so it does not require live Yahoo/API network access.

## Fixtures

Synthetic fixtures:

- SCHD-like quarterly dividend history:
  - 2025-06-25
  - 2025-09-24
  - 2025-12-24
  - 2026-03-25
- Monthly dividend history:
  - 2026-01-15
  - 2026-02-17
  - 2026-03-16
  - 2026-04-15
  - 2026-05-15
- Empty dividend history
- Insufficient one-row dividend history
- Fresh cache fixture
- Stale cache fixture
- Synthetic provider success, empty, and failure fetchers

## Historical Event Generation Results

Verified:

- Quarterly fixture creates both `ex_div` and `buy_by` events.
- Monthly fixture creates both `ex_div` and `buy_by` events.
- Empty fixture creates no events.
- Generated event `id` equals `canonicalEventId`.
- `legacyEventId` preserves the old mock-style `{TICKER}-{TYPE}-{DATE}` shape.
- Canonical IDs use `dividend:{TICKER}:{NORMALIZED_TYPE}:{DATE}`.
- Amount normalization does not change the canonical event id.

Observed script summary:

- Quarterly fixture: 8 events
- Monthly fixture: 10 events
- Empty fixture: 0 events

## Frequency Inference Results

Verified:

- Monthly fixture is inferred as `monthly`.
- Quarterly fixture is inferred as `quarterly`.
- One-row history returns no frequency/month step and records a warning.

Observed script summary:

- Monthly median interval: 30 days
- Quarterly median interval: 91 days
- Insufficient-data warnings: 1

## Estimated Projection Results

Verified with fixed test date `2026-06-13`:

- Estimated events carry `status: "estimated"`.
- Estimated events carry `sourceKind: "estimated"`.
- Estimated events keep canonical ID rules.
- `buy_by` and `ex_div` estimated events are created in pairs.
- No event date is generated beyond 12 months from the fixed test date.
- Insufficient frequency data skips projection.

Observed script summary:

- Estimated events: 8
- Last projected date: 2027-03-25
- Insufficient-data projection event count: 0

## Cache And Fallback Results

Verified:

- Fresh cache is preferred before provider fetch.
- Fresh-cache test called the synthetic provider 0 times.
- Stale cache does not block a successful provider fetch.
- Provider failure with stale cache falls back to cache.
- Empty provider result with stale cache falls back to cache.
- Provider failure without cache falls back to mock.
- Generated cache payload strips `memo`, `note`, `star`, and `heart`.

Observed script summary:

- Fresh cache fetch count: 0
- Provider fetch before stale fallback: 1
- Stale fallback source: `cache`
- Mock fallback event count: 3
- Sanitized cache event count: 1

## UI Change Status

No watchlist UI redesign was made.

Unchanged:

- CalendarGrid layout
- Event chip design
- Dialog/modal design
- Filter UI
- TaxSavingTable calculation behavior
- Custom event UI
- Economic calendar UI

## Verification Results

Commands run:

| Command | Result |
| --- | --- |
| `npm.cmd run check:portfolio-parser` | Passed |
| `npm.cmd run check:portfolio-parser:private` | Passed |
| `npm.cmd run check:calendar-provider` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run typecheck` | Passed |

## Screen Check

Dev server:

- `http://localhost:3131`

Route checked:

- `/watchlist`

Results:

- Page rendered.
- Calendar heading rendered.
- Data status rendered as `cache` during the check.
- Event chips were visible. Observed count: 11.
- Event dialog opened and closed.
- Memo input accepted `Step 5A-4 browser memo check`.
- Star marker was visible on the event chip.
- Heart marker was visible after leaving heart selected without star precedence.
- No browser console errors were observed.

## Not Done In This Step

- No `original/` modifications.
- No `target/` folder creation.
- No new UI library.
- No calendar layout redesign.
- No event chip redesign.
- No dialog redesign.
- No filter UI change.
- No cache refresh/clear button UI.
- No TaxSavingTable real calculation.
- No custom event UI.
- No economic calendar implementation.
- No Firestore migration scripts.
- No live-network requirement in regression checks.

## Remaining Limits

- Buy deadline skips weekends only. It does not know NYSE/US market holidays.
- Payment events are still not generated by the real provider because `/api/quote/dividends` does not provide payment dates.
- Projection is based on simple median interval and month-step inference.
- Firestore cache wrappers exist, but this step did not add Firestore cache sync verification.

## Next Step Recommendations

1. Add a market-holiday-aware buy deadline helper in a dedicated step if production accuracy requires it.
2. Add payment-date support only after a provider returns reliable payment dates.
3. Add Firestore cache sync regression checks once Firestore cache is connected to the watchlist provider path.
4. Keep UI meta migration separate from provider/cache regression work.
