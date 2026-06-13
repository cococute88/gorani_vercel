# Step 5B-2 TaxSavingTable Quote-Last Connection

Implementation date: 2026-06-13

This step connects `/watchlist` TaxSavingTable rows to the Step 5B-1 pure
calculation helper using current prices from `/api/quote/last` and dividend
amounts already present on calendar events. It does not redesign the UI, change
calendar provider/cache order, change canonical event ID rules, change custom
event storage, change Firestore schema, or implement the five-year historical
tax-saving metric.

## 1. Read Docs And Files

Repository structure was confirmed:

- Working root: `C:\gv\gorani_vercel`
- `original/` exists and remains read-only reference.
- `target/` does not exist and was not created.

Required documents read as UTF-8:

- `docs/AUDIT.md`
- `docs/STEP5B0_TAX_SAVING_CALC_AUDIT.md`
- `docs/STEP5B1_TAX_SAVING_PURE_FUNCTION.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`
- `docs/MOBILE_UI_M1_OVERFLOW_FIX.md`
- `docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`

Required current Next.js files read:

- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `lib/tax-saving-calculator.ts`
- `lib/calendar-event-provider.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `scripts/check-tax-saving-calculator.mjs`
- `scripts/check-calendar-provider.mjs`

Original reference read without modification:

- `original/modules/dividend_calendar.py`

Missing requested documents or files: none.

## 2. Changed Files

- `lib/mock-calendar-data.ts`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/TaxSavingTable.tsx`
- `scripts/check-tax-saving-calculator.mjs`
- `docs/STEP5B2_TAX_SAVING_TABLE_CONNECT.md`
- `docs/AUDIT.md`

## 3. Current Price Fetch Strategy

`DividendCalendarPage` now builds tax-saving candidate rows from the visible
month events, dedupes their tickers, and fetches each ticker with the existing
client-safe `fetchQuoteLast({ ticker })` path from `lib/calculator-data-provider.ts`.
That wrapper uses the existing quote client and `/api/quote/last`.

Safeguards:

- no fetch is made when there are no tax-saving rows;
- tickers are deduped by the row builder;
- loading tickers are tracked in state;
- async results are ignored after unmount or ticker/month changes;
- per-ticker quote failures become row warnings instead of crashes.

No new API route, dependency, persistent cache, or server-only client import was
added.

## 4. Event And Dividend Selection Rule

`buildTaxSavingRows(monthEvents, options)` still uses events from the current
visible month as the source set and deduplicates one row per ticker.

For each ticker:

1. Exclude custom events.
2. Prefer `ex_div` events with a positive `dividendAmount`.
3. If multiple eligible `ex_div` events exist, prefer the upcoming event on or
   after today's date.
4. If no upcoming eligible event exists, use the nearest eligible event in the
   visible month.
5. If no `ex_div` event exists, fall back to another positive non-earnings
   dividend event, such as `buy_by`, because the current provider may carry the
   same dividend amount on paired event types.
6. Keep `shouldBuyThisMonth` true when the visible month has a `buy_by` event
   for that ticker.

Rows with only earnings or otherwise missing dividend amount are retained as
uncalculable rows and show an unavailable value instead of `0.0`.

## 5. Calculation Flow

When both price and dividend amount are available, the row builder calls:

```ts
calculateExpectedDividendTaxSaving({
  currentPrice,
  dividendAmountPerShare,
})
```

The helper defaults remain:

- `investmentAmountUsd = 10000`
- `taxRetentionRate = 0.85`
- `dividendTaxRate = 0.22`

The row is populated with:

- `taxSavingUsd`
- `expectedShares`
- `expectedDividendUsd`
- `currentPrice`
- `dividendAmountPerShare`
- `canCalculate`
- `warnings`
- `source`

Real provider rows with `event.taxSavingUsd: 0` are no longer displayed as
`0.0` simply because the provider field is zero. The table now uses the computed
row result.

## 6. Missing Data Display Policy

`TaxSavingTable` now formats the tax-saving cell as:

- calculated row: one decimal, for example `14.6`;
- loading row: `...`;
- uncalculable row: `—`.

Missing current price and missing dividend amount therefore do not look like a
true zero. A displayed `0.0` can only come from a successful calculation whose
rounded result is genuinely zero.

## 7. Loading And Warning Behavior

Rows whose quote-last request is in flight receive `isLoading: true` and show
`...` in the existing tax-saving column.

Warnings are stored per row and exposed through the row title tooltip. This is a
small status affordance only; the table structure, card structure, columns,
spacing, and Buy badge layout were preserved.

## 8. Not Implemented

- No five-year historical tax-saving metric.
- No trading strategy/backtest connection.
- No calendar provider/cache fallback order change.
- No canonical event ID change.
- No custom event storage change.
- No Firestore schema change.
- No quote API route change.
- No UI layout redesign.
- No new dependencies.

## 9. Verification Results

Commands run:

| Command | Result |
| --- | --- |
| `npm.cmd run check:tax-saving` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run lint` | Passed, no ESLint warnings or errors |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run check:calendar-provider` | Passed |
| `npm.cmd run check:portfolio-parser` | Passed |
| `npm.cmd run check:portfolio-parser:private` | Passed |

Regression coverage added to `check:tax-saving`:

- original pure formula remains covered;
- missing price remains not calculable;
- missing dividend remains not calculable;
- row builder prefers `ex_div` over `buy_by`;
- row builder prefers upcoming eligible dividend event;
- custom events are excluded;
- missing quote/dividend rows do not produce calculated `0.0`.

## 10. Visual Check

Dev server was restarted after build/lint/typecheck:

- `http://127.0.0.1:3000/watchlist`

Browser checks:

- desktop width: tax table rendered calculated non-zero values (`14.6`, `12.9`,
  `4.4`, `1.8`, `1.7`, `0.3` in the checked data set), not all `0.0`;
- 320px viewport: no page overflow, no table cell out of viewport, Buy badges
  visible, no console errors;
- 390px viewport: no page overflow, no table cell out of viewport, Buy badges
  visible, no console errors.

The checked live data set did not contain a naturally missing price/dividend
row, so the visible page did not show `—` during this pass. The unavailable
state is covered by the lightweight regression check.

## 11. Next Step Recommendation

Recommended next step: add a small user-visible detail surface for row inputs
such as current price, dividend per share, and quote source, without changing the
table layout. Keep the five-year historical tax-saving metric separate.
