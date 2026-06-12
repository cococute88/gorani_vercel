# Step 4C Dividend Capture Live Data

Update date: 2026-06-12

## Scope

Step 4C connects only the dividend capture simulator to quote history and historical dividend events from the free quote API. The Step 4A MDD calculator and Step 4B conversion calculator were left unchanged.

No `target/` folder was created. Files under `original/` were read as reference only and were not modified.

## Files Read

Original reference:

- `original/pages_app/3_dividend_sim.py`

Current Next.js files:

- `docs/AUDIT.md`
- `docs/STEP2_COMPLETION_AUDIT.md`
- `docs/STEP4A_MDD_LIVE_DATA.md`
- `docs/STEP4B_CONVERSION_LIVE_DATA.md`
- `app/calculator/page.tsx`
- `components/calculator/CalculatorPage.tsx`
- `components/calculator/DividendCaptureSimulator.tsx`
- `components/calculator/PreviewNotice.tsx`
- `lib/dividend-capture-calculator.ts`
- `lib/calculator-data-provider.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-types.ts`
- `lib/server/quote-fetchers.ts`

Missing requested files: none.

## Original Dividend Capture Logic Summary

The original Streamlit simulator:

- Fetches ticker price history and dividend history with yfinance.
- Iterates over actual historical dividend events.
- Finds the dividend event date in the price history.
- Uses the selected D-1 or D-2 open/close price as the buy price.
- Calculates after-tax dividend as `dividendAmount * (1 - taxRate / 100)`.
- Calculates breakeven as `buyPrice - afterTaxDividend`.
- Checks whether the high price during the allowed sell window reaches breakeven.
- Marks a round as success when breakeven is reached inside the allowed window.
- For failed rounds, uses the final window close to calculate return and searches later prices for recovery.

## Live Data Connection

`components/calculator/DividendCaptureSimulator.tsx` now calls:

- `/api/quote/history`
- `/api/quote/dividends`

Request behavior:

- `recent5yOnly=true` passes `range=5y`.
- Otherwise the existing `analysisMonths` input is converted into derived `start` and `end` dates.
- History prices are mapped to `{ date, open, high, low, close }`.
- Dividend events are mapped to `{ date, amount }`.
- The calculation receives API `source`, `warnings`, and `updatedAt` metadata.
- The existing submit-button UX is preserved. The default submitted input loads once on first render.

## Calculation Function Changes

`lib/dividend-capture-calculator.ts` now supports two paths:

- `simulateDividendCapture(input)` keeps the existing public sample fallback behavior.
- `simulateDividendCapture(input, { prices, dividends }, meta)` calculates from external quote history and dividend events.
- `simulateDividendCaptureFromHistory` is the pure price/dividend calculation path.

Invalid price rows are excluded when:

- Date is missing or not `YYYY-MM-DD`.
- Close is non-finite, NaN, null-like, or less than/equal to zero.
- Duplicate dates exist; the latest point for the date wins.

Missing or invalid `open`, `high`, or `low` values are repaired from close/open/close bounds so the calculation can continue without NaN chart or table output.

Invalid dividend events are excluded when:

- Date is missing or invalid.
- Amount is non-finite, NaN, null-like, or less than/equal to zero.
- Duplicate dates exist; the latest event for the date wins.

## Price And Dividend Date Matching

Dividend dates are not estimated or generated in the live path. Only `/api/quote/dividends` events are used.

Matching rules:

- If the dividend date exists in price history, that trading row is used.
- If the dividend date is a weekend/holiday or has no price row, the nearest following trading row is used as the dividend-event row.
- The buy price still comes from the D-1 or D-2 trading row before the matched dividend-event row.
- If there are not enough prior rows or sell-window rows, that dividend round is skipped and a warning is accumulated.

## Source, Warnings, Loading

Dividend capture result metadata now includes:

- `source`: `yahoo`, `stooq`, or `sample`
- `warnings`: API warnings plus calculation warnings
- `updatedAt`: latest timestamp from the history/dividend responses
- `usedStartDate` and `usedEndDate`

The dividend capture screen now shows:

- Source badge.
- Loading state while history and dividends are fetched.
- Updated timestamp.
- Used date range.
- Warning panel for API fallback, mixed source, invalid rows, skipped rounds, or sample fallback.

If history and dividends use different sources, the combined source is shown as `sample` when either side is sample, otherwise `stooq` when history is stooq, otherwise `yahoo`.

## Sample Fallback Conditions

Sample fallback is used when:

- The quote API returns `source: "sample"` for history or dividends.
- The client quote request fails and `fetchQuoteHistory`/`fetchQuoteDividends` returns deterministic fallback data.
- Live/API prices contain fewer than three valid price rows.
- Live/API dividends contain no valid dividend events.
- Price/dividend date matching leaves no calculable rounds.
- The dividend capture calculator renders before live history and dividends finish loading.

The existing deterministic sample provider in `lib/calculator-data-provider.ts` remains in place and was not removed.

## Quote API Recheck

Finalized against a fresh local dev server on port `3107`.

| URL | Source | Count | First date | Last date | Latest value | Warnings |
| --- | --- | ---: | --- | --- | ---: | ---: |
| `/api/quote/history?ticker=SCHD&range=5y` | `yahoo` | 1259 | 2021-06-08 | 2026-06-11 | 32.529999 | 0 |
| `/api/quote/dividends?ticker=SCHD&range=5y` | `yahoo` | 20 | 2021-06-23 | 2026-03-25 | 0.257 | 0 |
| `/api/quote/history?ticker=ARCC&range=5y` | `yahoo` | 1259 | 2021-06-08 | 2026-06-11 | 19.07 | 0 |
| `/api/quote/dividends?ticker=ARCC&range=5y` | `yahoo` | 20 | 2021-06-14 | 2026-03-13 | 0.48 | 0 |
| `/api/quote/history?ticker=BCSF&range=5y` | `yahoo` | 1259 | 2021-06-08 | 2026-06-11 | 12.89 | 0 |
| `/api/quote/dividends?ticker=BCSF&range=5y` | `yahoo` | 21 | 2021-06-29 | 2026-03-16 | 0.42 | 0 |

## Screen Check

The `/calculator` screen was checked against the fresh local dev server on port `3107`.

| Scenario | Source | Rows | Warning panel | Result |
| --- | --- | ---: | --- | --- |
| `SCHD` | `YAHOO` | 12 | No | Cards, chart, and detail table rendered |
| `ARCC` | `YAHOO` | 12 | No | Cards, chart, and detail table rendered |
| `BCSF` | `YAHOO` | 13 | No | Cards, chart, and detail table rendered |
| `INVALID_TICKER_TEST_123` | `SAMPLE` | 12 | Yes | Sample fallback rendered without breaking |
| Restored `ARCC` | `YAHOO` | 12 | No | Live data returned normally |

## Modified Files

- `components/calculator/DividendCaptureSimulator.tsx`
- `components/calculator/PreviewNotice.tsx`
- `lib/dividend-capture-calculator.ts`
- `lib/calculator-types.ts`
- `docs/STEP4C_DIVIDEND_CAPTURE_LIVE_DATA.md`
- `docs/AUDIT.md`

## Still Mock Or Sample

- Dividend capture still uses deterministic sample data as fallback.
- MDD and conversion calculators retain their existing Step 4A/4B live-data paths.
- Dividend calendar events still use mock-generated events.
- Dividend page, market page, and QLD dashboard remain mock/static where they were before this step.
- Dividend calendar diversion, future dividend estimation, dividend ledger, market temperature, asset-map, QLD, and Firestore schema changes are not implemented in this step.

## Recommended Next Steps

1. Define stable dividend event IDs before replacing mock dividend calendar events.
2. Decide quote-cache ownership before persisting market or quote responses.
3. Add KRW MDD conversion only after deciding whether the UI should expose USD/KRW alignment details.
