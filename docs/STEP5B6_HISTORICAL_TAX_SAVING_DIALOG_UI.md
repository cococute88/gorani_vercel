# Step 5B-6 Historical Tax-Saving Dialog UI

Implementation date: 2026-06-13

This step connects the existing five-year historical tax-saving service
(`loadHistoricalTaxSavingMetricForTicker`) to the `CalendarEventDialog` as a
small, auxiliary read-only metric. It does not change the TaxSavingTable
formula, the calendar provider/cache, quote API routes, canonical event ids, or
custom-event storage.

## 1. Read Docs And Files

Repository structure was confirmed:

- Working root: `C:\gv\gorani_vercel`
- `original/` exists and remains read-only reference.
- `target/` does not exist and was not created.

Required documents read as UTF-8:

- `docs/AUDIT.md`
- `docs/STEP5B0_TAX_SAVING_CALC_AUDIT.md`
- `docs/STEP5B1_TAX_SAVING_PURE_FUNCTION.md`
- `docs/STEP5B2_TAX_SAVING_TABLE_CONNECT.md`
- `docs/STEP5B3_HISTORICAL_TAX_SAVING_AUDIT.md`
- `docs/STEP5B4_HISTORICAL_TAX_SAVING_HELPER.md`
- `docs/STEP5B5_HISTORICAL_TAX_SAVING_SERVICE.md`
- `docs/STEP5A6_CUSTOM_EVENT_UI.md`
- `docs/MOBILE_UI_M1_OVERFLOW_FIX.md`
- `docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`

Missing required documents: none.

Code read:

- `components/watchlist/CalendarEventDialog.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/TaxSavingTable.tsx`
- `lib/historical-tax-saving-service.ts`
- `lib/historical-tax-saving-calculator.ts`
- `lib/tax-saving-calculator.ts`
- `lib/calendar-event-identity.ts`
- `lib/calendar-event-provider.ts` (`isCustomCalendarEventLike`)
- `lib/event-visuals.ts`
- `lib/mock-calendar-data.ts` (`CalendarEvent` shape)
- `scripts/check-tax-saving-calculator.mjs`

## 2. Changed Files

- `components/watchlist/CalendarEventDialog.tsx`
  - Added eligibility helper, async metric loading state, and a compact
    auxiliary metric section.
- `docs/STEP5B6_HISTORICAL_TAX_SAVING_DIALOG_UI.md` (this file).
- `docs/AUDIT.md` (one line appended).

No other files were changed. `TaxSavingTable`, `DividendCalendarPage`, the
calendar provider, the quote API routes, and the service/calculator layers were
not modified.

## 3. Event Eligibility Rule

The auxiliary metric loads and renders only when the dialog event is a generated
dividend-related event with a ticker:

```txt
ticker exists (non-empty)
sourceKind !== "economic"
not custom (isCustomCalendarEventLike === false)
event.type ∈ { ex_div, buy_by, pay }
```

Notes:

- `CalendarEventDialog` already only receives generated events; custom events
  are routed to `CustomEventDialog` by `DividendCalendarPage.handleOpenEvent`.
  The eligibility helper still guards against custom/economic defensively.
- `earnings` events are intentionally excluded (not dividend-related).

## 4. Data Loading Behavior

- When the dialog opens with an eligible ticker, a client effect keyed on the
  ticker calls `loadHistoricalTaxSavingMetricForTicker(ticker)`.
- When the event is ineligible (no ticker, custom, economic, earnings), no fetch
  is made and no section is rendered.
- Async safety:
  - local `historicalMetric` / `isHistoricalMetricLoading` state
  - previous result is cleared when the ticker changes
  - a `cancelled` flag ignores stale results after close / ticker change
  - failures are caught and surface as the unavailable state (no crash)
- API-call frequency: the effect is keyed on the eligible ticker, so it fetches
  once per opened ticker and does not refetch while the dialog stays open. No
  persistent cache, Firestore change, or schema change was added.

## 5. UI States

Rendered only for eligible events. Label: `5년 회복 기준 절세효과`.
Helper caption: `과거 5년 배당락일에 당일 고가가 손익분기점을 회복한 사례 기준입니다.`

| State | Value | Detail |
| --- | --- | --- |
| Loading | `계산 중...` | caption |
| Failed request (metric null) | `—` | `계산 불가` |
| `canCalculate === false` | `—` | `계산 불가` (first warning in tooltip) |
| `canCalculate`, `successCount > 0` | `$<taxSavingUsd>` | `성공 N/T · 평균 회복여유 P.PP%` |
| `canCalculate`, `successCount === 0` | `$0.0` | `성공 사례 없음 · 0/T` (valid zero) |

The valid-zero state (`$0.0` + 성공 사례 없음) is distinct from the unavailable
state (`—` + 계산 불가).

## 6. Visual / Mobile Verification

- Reuses the existing dialog dark-theme card style
  (`border-[#273235] bg-[#101719]`), matching the `Info` cards.
- Compact: label + value on one row, two short caption lines below.
- Korean text uses the app-wide `word-break: keep-all`; no one-character
  wrapping and no horizontal overflow at 320px / 390px.
- No charts, tables, new dependencies, or layout redesign were added.

## 7. What Was Not Changed

- `TaxSavingTable` calculation, `buildTaxSavingRows`, current quote-last
  connection, and the main table formula are unchanged.
- Custom event create/edit/delete behavior is unchanged.
- Generated/economic event behavior, canonical event id rules, calendar
  provider/cache fallback order, quote API routes, Firestore schema, and the
  calculator/service formulas are unchanged.

## 8. Remaining Issues

- The metric refetches each time a ticker's dialog is reopened (no cross-open
  cache). This is intentional for this step; a small in-memory cache can be
  considered later if needed.
- Quote source/`source` field is not surfaced in the dialog; only success/zero/
  unavailable states and the first warning tooltip are shown.

## 9. Next Step Recommendation

1. Optionally add a tiny in-memory per-session cache keyed by ticker to avoid
   refetching on reopen.
2. Consider exposing the metric `source` (quote-api vs sample) as a small badge
   if product wants source transparency in the dialog.
3. Continue replacing remaining calendar mock paths module by module.
