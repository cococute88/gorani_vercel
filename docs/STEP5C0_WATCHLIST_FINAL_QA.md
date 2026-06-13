# Step 5C-0 — Watchlist Final QA and Regression Audit

QA date: 2026-06-13

Scope: audit-only pass over `/watchlist` (dividend calendar). No feature work,
no formula/provider/cache/schema changes. Allowed in this step: tiny typo/bug
fixes, documentation, and this QA report. No code changes were required.

## 1. Documents and Files Read

Documents (read as UTF-8):

- `docs/AUDIT.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`
- `docs/STEP5A6_CUSTOM_EVENT_FOUNDATION.md`
- `docs/STEP5A6_CUSTOM_EVENT_UI.md`
- `docs/STEP5B0_TAX_SAVING_CALC_AUDIT.md`
- `docs/STEP5B1_TAX_SAVING_PURE_FUNCTION.md`
- `docs/STEP5B2_TAX_SAVING_TABLE_CONNECT.md`
- `docs/STEP5B3_HISTORICAL_TAX_SAVING_AUDIT.md`
- `docs/STEP5B4_HISTORICAL_TAX_SAVING_HELPER.md`
- `docs/STEP5B5_HISTORICAL_TAX_SAVING_SERVICE.md`
- `docs/STEP5B6_HISTORICAL_TAX_SAVING_DIALOG_UI.md`
- `docs/STEP5B7_HISTORICAL_TAX_SAVING_DIALOG_CACHE.md`
- `docs/MOBILE_UI_M1_OVERFLOW_FIX.md`
- `docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`

All required documents were present; none missing.

Code inspected:

- `components/watchlist/WatchlistPage.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/CalendarGrid.tsx`
- `components/watchlist/CalendarEventDialog.tsx`
- `components/watchlist/CustomEventDialog.tsx`
- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendSchedulePreview.tsx`
- `components/watchlist/TickerManager.tsx`
- `lib/calendar-event-provider.ts`
- `lib/calendar-cache.ts` (via provider usage)
- `lib/calendar-event-identity.ts` (via provider usage)
- `lib/calendar-custom-events.ts`
- `lib/tax-saving-calculator.ts`
- `lib/historical-tax-saving-calculator.ts` (via service usage)
- `lib/historical-tax-saving-service.ts`
- `lib/historical-tax-saving-session-cache.ts`
- `lib/mock-calendar-data.ts` (`buildTaxSavingRows`)
- `scripts/check-calendar-provider.mjs`, `scripts/check-tax-saving-calculator.mjs`

## 2. QA Scope

`/watchlist` only. User flows: basic page load, calendar grid, event dialog
(generated dividend events + historical tax-saving metric), custom event
create/edit/delete, TaxSavingTable, DividendSchedulePreview, TickerManager, and
cache/provider behavior. Viewports: desktop, 390px, 320px.

## 3. Tested Flows

1. Page load (desktop / 390 / 320)
2. Calendar grid layout + event chips + +N overflow + open-event click
3. Event dialog for a generated `ex_div` event (JEPI) + historical metric load
4. Custom event create → edit → delete (localStorage persistence)
5. TaxSavingTable live values + Buy column
6. DividendSchedulePreview collapse/table at mobile
7. TickerManager input/select/add/remove/chips
8. Cache/provider source badge + warnings + sanitization (via check scripts)

## 4. Desktop / Mobile Visual Result

| Viewport | Page-level overflow (`scrollWidth > clientWidth`) | Result |
| --- | --- | --- |
| desktop | false | Pass — dark theme intact, grid + sidebar layout clean |
| 390px | false (0 offenders) | Pass — chips truncate, filters wrap, no h-scroll |
| 320px | false (0 offenders) | Pass — calendar fits, tables/cards stack cleanly |

- Dark theme intact across all sections; no white/unstyled HTML regression.
- Day numbers stay top-left; event chips truncate (`JEPI …`, `QQQ …`) without
  ugly wrapping; `+N` overflow indicator renders top-right.
- Source/status badge (`CACHE` / `LOADING` / `YAHOO` / `MOCK`) is compact and
  understandable; provider warning line is truncated with a full-text `title`.

## 5. Functional Result

- Page loads without crash on all viewports.
- Console "errors" are limited to the known Recharts `defaultProps` deprecation
  warning (documented in `CLAUDE.md`, `recharts@2.12.7`) and its React component
  stack trace. No runtime crash, no watchlist-specific error.
- Loading/fallback states are not misleading: provider falls back to cache then
  mock with explicit warnings; the badge reflects the active source.

## 6. TaxSavingTable Result

- No longer all `0.0`. Live quote-last values observed:
  SCHD 14.6, JEPI 12.9, SPY 4.4, QQQ 1.8, TQQQ 1.7, QLD 0.3.
- Missing/invalid data path renders `—` (amber), not a misleading `0.0`; loading
  renders `...`. Logic confirmed in `buildTaxSavingRows` +
  `calculateExpectedDividendTaxSaving` (warnings short-circuit to
  `canCalculate: false`).
- Buy column visible; `Buy` chip shown when a `buy_by` event exists this month.
- Table uses the current sidebar formula (investment $10k, retention 0.85, tax
  0.22) — independent from the historical dialog metric. No regression at mobile.

## 7. Historical Metric Dialog Result

- Generated `ex_div`/`buy_by`/`pay` events with a ticker show the auxiliary
  "5년 회복 기준 절세효과" card. JEPI observed: `$13.3`, `성공 46/60 ·
  평균 회복여유 0.61%`, `출처: quote-api`.
- Source badge (`출처:`) renders compactly only once a metric is available.
- Eligibility gate (`isHistoricalMetricEligible`) correctly excludes custom and
  economic events, and events without a ticker.
- States are visually safe: loading (`계산 중...`), valid-zero
  (`성공 사례 없음 · 0/N`), and unavailable (`—` / `계산 불가`, amber) are all
  handled; failures are converted to a safe unavailable result.
- Stale-result protection: the load effect keys on `historicalTicker` and uses a
  `cancelled` guard, so switching events quickly cannot surface a stale ticker's
  result. Confirmed by code review.
- Session cache (`historical-tax-saving-session-cache.ts`) is module-scope,
  in-memory only, keyed by uppercased ticker, TTL 30m, with in-flight dedup —
  reopening the same event avoids a refetch. Confirmed by `check:tax-saving`
  cache fixtures (`loaderCalls`: fresh-hit 1, in-flight-dedup 1, expiry 2,
  failure-unavailable 1).

## 8. Custom Event Result

- Create works: "QA 테스트 일정" persisted to
  `gorani.dividend-calendar.custom-events.v1` (count 1).
- Edit works: title updated to "QA 수정됨" in place (count stays 1).
- Delete works: confirm-then-delete returns to 0 remaining.
- Custom events open the lightweight "일정 수정" dialog and show **no** historical
  tax-saving metric (verified `hasMetric: false`).
- Generated dividend events open the read/meta dialog with **no** delete button
  (only memo `저장`); custom events have the delete button.
- Custom events persist locally and are kept separate from the generated cache.

## 9. DividendSchedulePreview Result

- Dark theme intact; no native white table regression.
- Collapse/expand ("접기"/"펼치기") works.
- Mobile (320/390): only 종목/타입/배당락 columns shown (others `hidden
  sm:table-cell`); no one-character Korean wrapping; content fits so the
  `overflow-x-auto` wrapper produces no fake horizontal scroll.

## 10. TickerManager Result

- Input/select/+ button and chip styling keep the dark theme.
- "+" add button stays aligned (`h-10 w-10 shrink-0`); add via button and Enter
  both work; Korean labels do not wrap to one character per line.
- Adding/removing tickers does not crash; chips render with an `X` remove
  control; "Save / Update" present.

## 11. Cache / Provider Result

- Generated cache strips user meta: `normalizeGeneratedCalendarEventForCache`
  removes `heart/memo/note/star`, and throws if a custom event is passed in.
- Custom events are excluded from the generated cache
  (`buildCalendarTickerCacheFromEvents` filters `isCustomCalendarEventLike`).
- `check:calendar-provider` passed: fresh-cache short-circuit, stale fallback
  source = `cache`, mock fallback, custom/merge sanitization
  (`cacheEventsAfterCustomSanitize: 1`), and weekday buy-deadline fixtures.
- Historical session cache is memory-only (no localStorage/sessionStorage/
  Firestore/IndexedDB).
- No Firestore schema change; no source/fallback path produces misleading
  values (missing data → `—`, not `0.0`).

## 12. P0 / P1 Findings

None. No crash, no broken flow, no severe data-mislead, no calculation-display
defect found in `/watchlist`.

## 13. P2 / P3 Findings

- **P2 — CalendarEventDialog static zeros.** The Info grid cells "연간 수익률"
  (`event.annualYield`) and "절세액($10k)" (`event.taxSavingUsd`) always render
  `0.00%` / `$0.0` for generated dividend events, because `makeDividendEvent`
  bakes those two fields to `0`. Sitting next to the live historical metric
  (`$13.3`) and the TaxSavingTable value (JEPI 12.9), the static `$0.0` can read
  as misleading. It is pre-existing and lives in generated-event construction,
  so it is intentionally **out of scope** for this audit-only step. See §12 of
  the next-step recommendation.
- **P3 — Recharts deprecation noise.** Console emits the known
  `defaultProps will be removed` warning from `recharts@2.12.7` (shared layout/
  other routes, not watchlist logic). Already tracked in `CLAUDE.md`; cosmetic.

## 14. Recommended Next Fix (Step 5C-1, optional)

In `CalendarEventDialog`, for generated dividend events either (a) hide the
"연간 수익률" and "절세액($10k)" Info cells when the underlying value is `0`/unset,
or (b) render `—` instead of `0.00%` / `$0.0`, so the static event-level fields
do not visually contradict the live historical metric and the TaxSavingTable.
This is display-only and must not touch the tax/historical formulas, the
generated-event construction defaults, the provider/cache, or the Firestore
schema.

## 15. What Was Not Changed

No source files were modified in this step. Specifically unchanged:
`original/`, TaxSavingTable formula, historical tax-saving formula, quote API
routes, calendar provider/cache fallback order, canonical event ID rules, custom
event storage, Firestore schema, calculator formulas, portfolio parser/live
quote logic, and dependencies. No `target/` folder was created.

## Verification Commands

| Command | Result |
| --- | --- |
| `npm.cmd run check:tax-saving` | Pass (pure + service + cache fixtures) |
| `npm.cmd run build` | Pass (14/14 static pages, no type/lint errors) |
| `npm.cmd run lint` | Pass (no ESLint warnings or errors) |
| `npm.cmd run typecheck` | Pass (`tsc --noEmit` clean) |
| `npm.cmd run check:calendar-provider` | Pass (provider/cache/custom fixtures) |
| `npm.cmd run check:portfolio-parser` | Pass (exit 0) |
| `npm.cmd run check:portfolio-parser:private` | Pass (exit 0) |

Dev server was stopped before `build` and restarted afterward for the visual QA
(desktop / 390 / 320).
