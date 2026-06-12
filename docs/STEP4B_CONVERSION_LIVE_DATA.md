# Step 4B Conversion Live Data

Update date: 2026-06-12

## Scope

Step 4B connects only the conversion calculator to quote history data from `/api/quote/history`. The MDD calculator was left in its Step 4A state. Dividend capture, dividend calendar, dividend ledger, market temperature, asset-map, QLD, Firestore schema, paid APIs, and UI redesign work were left unchanged.

No `target/` folder was created. Files under `original/` were read as reference only and were not modified.

## Files Read

Original reference:

- `original/pages_app/4_conversion_analysis.py`

Current Next.js files:

- `docs/AUDIT.md`
- `docs/STEP2_COMPLETION_AUDIT.md`
- `docs/STEP4A_MDD_LIVE_DATA.md`
- `app/calculator/page.tsx`
- `components/calculator/CalculatorPage.tsx`
- `components/calculator/ConversionCalculator.tsx`
- `components/calculator/MddCalculator.tsx`
- `components/calculator/PreviewNotice.tsx`
- `lib/conversion-calculator.ts`
- `lib/calculator-data-provider.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-types.ts`
- `lib/server/quote-fetchers.ts`

Missing requested files: none.

## Original Conversion Logic Summary

The original Streamlit conversion page:

- Fetches full price history for the sell ticker and buy ticker.
- Normalizes history frames and extracts close prices.
- Joins both close series by exact trading date.
- Uses only common trading days.
- Calculates conversion ratio as `Sell_Close / Buy_Close`.
- Calculates the latest conversion ratio and average conversion ratio.
- Computes the common start date from the later first trading date of the two tickers.
- Shows the used date range, latest ratio, average ratio, chart, and detail table.

## Live Data Connection

`components/calculator/ConversionCalculator.tsx` now calls `fetchQuoteHistory` from `lib/calculator-data-provider.ts` for both submitted tickers.

Request behavior:

- Sell ticker request: `/api/quote/history?ticker={sellTicker}&start={YYYY-MM-DD}&end={YYYY-MM-DD}`
- Buy ticker request: `/api/quote/history?ticker={buyTicker}&start={YYYY-MM-DD}&end={YYYY-MM-DD}`
- Both API responses are mapped to `{ date, close }`.
- The calculation function receives both price arrays plus `source`, `warnings`, and `updatedAt` metadata.
- The existing submit-button UX is preserved. The default submitted input loads once on first render.

## Calculation Function Changes

`lib/conversion-calculator.ts` now supports two paths:

- `calculateConversion(input)` keeps the existing public sample fallback behavior.
- `calculateConversion(input, { sellPrices, buyPrices }, meta)` calculates from external quote history.
- `calculateConversionFromPrices` is the pure close-price conversion path.

Invalid price rows are excluded when:

- Date is missing or not `YYYY-MM-DD`.
- Close is non-finite, NaN, null-like, or less than/equal to zero.
- Duplicate dates exist; the latest point for the date wins.

The live calculation:

- Sorts each ticker's prices by ascending date.
- Inner joins by exact date.
- Uses only common trading days.
- Calculates `ratio = sellClose / buyClose`.
- Uses the latest common trading day for the current ratio.
- Preserves the existing average-months setting for the average-ratio window.
- Preserves the existing sell-share, sell-fee, buy-fee, net-sell-amount, buyable-shares, leftover-cash, judgment, chart, and table outputs.

## Common Trading Day Handling

The used conversion period is now the first and last date of the joined common trading-day series.

For the default `TQQQ` to `SCHD` input on the fresh local dev server:

- Requested period: `2023-06-10` to `2026-06-10`
- Common used period shown in the UI: `2023-06-12` to `2026-06-10`
- Source: `YAHOO`

If fewer than two common trading days remain, the calculator returns warnings and falls back to deterministic sample data so the chart and cards do not break.

## Source, Warnings, Loading

Conversion result metadata now includes:

- `source`: `yahoo`, `stooq`, or `sample`
- `warnings`: API warnings plus calculation warnings
- `updatedAt`: latest timestamp from the two quote responses
- `sellFirstDate` and `buyFirstDate`
- `usedStartDate` and `usedEndDate`

The conversion screen now shows:

- Source badge.
- Loading state while both histories are fetched.
- Updated timestamp.
- Warning panel for API fallback, mixed source, invalid rows, or sample fallback.
- Error panel if the client call throws unexpectedly.

If one ticker is live and the other returns sample data, the combined source is shown as `SAMPLE` and the mixed-source warning is displayed.

## Sample Fallback Conditions

Sample fallback is used when:

- The quote API returns `source: "sample"` for either ticker.
- The client quote request fails and `fetchQuoteHistory` returns deterministic fallback.
- Live/API prices contain fewer than two common valid trading days.
- The conversion calculator renders before live history finishes loading.

The existing deterministic sample provider in `lib/calculator-data-provider.ts` remains in place and was not removed.

## Quote API Recheck

Finalized against a fresh local dev server on port `3106`.

| URL | Source | Count | First date | Last date | Latest close | Warnings |
| --- | --- | ---: | --- | --- | ---: | ---: |
| `/api/quote/history?ticker=TQQQ&range=1y` | `yahoo` | 252 | 2025-06-11 | 2026-06-11 | 76.010002 | 0 |
| `/api/quote/history?ticker=SCHD&range=1y` | `yahoo` | 252 | 2025-06-11 | 2026-06-11 | 32.529999 | 0 |
| `/api/quote/history?ticker=QQQ&range=1y` | `yahoo` | 252 | 2025-06-11 | 2026-06-11 | 717.119995 | 0 |
| `/api/quote/history?ticker=SPY&range=1y` | `yahoo` | 252 | 2025-06-11 | 2026-06-11 | 737.76001 | 0 |

## Screen Check

The `/calculator` screen was checked against the fresh local dev server on port `3106`.

- Opened `/calculator`.
- Selected the `매도전환 계산기` tab.
- Default `TQQQ` to `SCHD` loaded `source: YAHOO`.
- Result cards rendered latest ratio, average ratio, deviation, and buyable shares.
- Conversion ratio chart and detail table rendered without breaking.
- Invalid sell ticker `INVALID_TICKER_TEST_123` showed `source: SAMPLE`, API warnings, mixed-source warning, and sample fallback calculation.
- Restored the sell ticker to `TQQQ`; the screen returned to `source: YAHOO`.

## Modified Files

- `components/calculator/ConversionCalculator.tsx`
- `components/calculator/PreviewNotice.tsx`
- `lib/conversion-calculator.ts`
- `lib/calculator-types.ts`
- `docs/STEP4B_CONVERSION_LIVE_DATA.md`
- `docs/AUDIT.md`

## Still Mock Or Sample

- Dividend capture simulator still uses synchronous sample data.
- Conversion calculator still uses deterministic sample data as fallback.
- MDD calculator still uses its Step 4A live history path and sample fallback.
- Dividend calendar events still use mock-generated events.
- Dividend page, market page, and QLD dashboard remain mock/static where they were before this step.
- KRW MDD conversion is not implemented in this step.

## Recommended Next Steps

1. Connect the dividend capture simulator to quote history and dividend events.
2. Add KRW MDD conversion only after deciding whether the UI should expose USD/KRW alignment details.
3. Define stable dividend event IDs before replacing mock dividend calendar events.
4. Decide quote-cache ownership before persisting market or quote responses.
