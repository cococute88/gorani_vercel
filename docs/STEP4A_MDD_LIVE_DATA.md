# Step 4A MDD Live Data

Update date: 2026-06-12

## Scope

Step 4A connects only the MDD calculator to quote history data from `/api/quote/history`. Dividend capture, conversion, dividend calendar, dividend ledger, market temperature, asset-map, QLD, and Firestore schema work were left unchanged.

No `target/` folder was created. Files under `original/` were read as reference only and were not modified.

## Files Read

Original reference:

- `original/pages_app/7_mdd_calculator.py`
- `original/logic/market.py`

Current Next.js files:

- `docs/AUDIT.md`
- `docs/STEP2_COMPLETION_AUDIT.md`
- `docs/STEP2A_QUOTE_API.md`
- `docs/STEP2B_STORAGE_REPOSITORY.md`
- `app/calculator/page.tsx`
- `components/calculator/CalculatorPage.tsx`
- `components/calculator/MddCalculator.tsx`
- `components/calculator/CalculatorPresetControls.tsx`
- `components/calculator/ConversionCalculator.tsx`
- `components/calculator/DividendCaptureSimulator.tsx`
- `components/calculator/PreviewNotice.tsx`
- `lib/mdd-calculator.ts`
- `lib/calculator-data-provider.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-types.ts`

Missing requested files: none.

## Original MDD Logic Summary

The original Streamlit MDD path uses close prices ordered by date:

- Running peak: cumulative max of close prices.
- Drawdown: `current_close / running_peak - 1`.
- MDD: the minimum drawdown value.
- Peak date: highest close date up to the trough date.
- Trough date: date of the deepest drawdown.
- Recovery date: first date after trough where close is greater than or equal to the MDD peak price.
- If no recovery exists, recovery date is null/unrecovered.
- KRW conversion aligns USD close prices with USD/KRW by date and forward-fills FX rates before calculating a KRW close series.

Step 4A implements the USD close-price MDD path first. The existing KRW selector is preserved, but MDD calculation is still based on USD close prices.

## Live Data Connection

`components/calculator/MddCalculator.tsx` now calls `fetchQuoteHistory` from `lib/calculator-data-provider.ts`.

Request behavior:

- Non-custom periods pass `range` to `/api/quote/history`.
- Custom periods pass `start` and `end`.
- The API response prices are mapped to `{ date, close }`.
- The MDD result receives API `source`, `warnings`, and `updatedAt`.
- The calculator still runs from the submit button UX, with an initial load for the default submitted input.

API route used:

- `/api/quote/history?ticker={ticker}&range={6m|1y|3y|5y}`
- `/api/quote/history?ticker={ticker}&start={YYYY-MM-DD}&end={YYYY-MM-DD}` for custom periods

## Calculation Function Changes

`lib/mdd-calculator.ts` now separates sample generation from live-price calculation:

- `normalizeMddPrices` filters invalid rows and sorts by ascending date.
- `calculateMddFromPrices` is the pure close-price MDD calculation path.
- `calculateMdd` preserves the existing public signature and handles sample fallback.
- Live prices are no longer overwritten by `currentPrice`, `highPrice`, or `lowPrice`.
- Those manual price fields are used only by the sample fallback path.

Invalid inputs are excluded when:

- Date is missing or invalid.
- Close is null-like, NaN, non-finite, or less than/equal to zero.
- Duplicate dates exist; the latest point for the date wins.

If fewer than two valid close prices remain, the calculator returns warnings and uses the sample fallback path where possible.

## Source, Warnings, Loading, Error

MDD result metadata now includes:

- `source`: `yahoo`, `stooq`, or `sample`
- `warnings`: API warnings plus calculation warnings
- `updatedAt`: quote response timestamp when available

The MDD screen now shows:

- Loading state while history is fetched.
- Source badge.
- Warning panel.
- Error panel if the client call throws.
- Sample badge/warnings when source is `sample`.

## Sample Fallback Conditions

Sample fallback is used when:

- The quote API itself returns `source: "sample"`.
- The client quote request fails and `fetchQuoteHistory` returns its deterministic fallback.
- Live/API prices contain fewer than two valid close values.
- The MDD calculator is rendered before live history finishes loading.

The existing deterministic sample provider remains in `lib/calculator-data-provider.ts`; it was not removed.

## Quote API Recheck

Finalized against a fresh local dev server on port `3105`.

| URL | Source | Count | First date | Last date | Latest close | Warnings |
| --- | --- | ---: | --- | --- | ---: | ---: |
| `/api/quote/history?ticker=QQQ&range=1y` | `yahoo` | 252 | 2025-06-11 | 2026-06-11 | 717.119995 | 0 |
| `/api/quote/history?ticker=SPY&range=1y` | `yahoo` | 252 | 2025-06-11 | 2026-06-11 | 737.76001 | 0 |
| `/api/quote/history?ticker=SCHD&range=5y` | `yahoo` | 1259 | 2021-06-08 | 2026-06-11 | 32.529999 | 0 |

## Screen Check

The `/calculator` screen was checked against a fresh local dev server on port `3105` after older dev servers showed stale Next.js chunk errors during hot reload/build cycles.

- MDD tab with default `QQQ` loaded `source: YAHOO`.
- Latest-price card showed `QQQ yahoo data`.
- Changing the period to `6 months` kept `source: YAHOO`.
- Invalid ticker `INVALID_TICKER_TEST_123` showed `source: SAMPLE`, a warning panel, and sample data labels.
- The screen was restored to `QQQ` after the fallback check.

## Modified Files

- `components/calculator/MddCalculator.tsx`
- `components/calculator/PreviewNotice.tsx`
- `lib/mdd-calculator.ts`
- `lib/calculator-types.ts`
- `docs/STEP4A_MDD_LIVE_DATA.md`
- `docs/AUDIT.md`

## Still Mock Or Sample

- Dividend capture simulator still uses synchronous sample data.
- Conversion calculator still uses synchronous sample data.
- Dividend calendar events still use mock-generated events.
- Dividend page, market page, and QLD dashboard remain mock/static where they were before this step.
- KRW MDD conversion is not implemented in Step 4A.

## Recommended Next Steps

1. Connect the conversion calculator to quote history as a separate narrow step.
2. Connect the dividend capture simulator to quote history and dividends after preserving its current fallback behavior.
3. Add KRW MDD conversion only after deciding whether the UI should expose USD/KRW alignment details.
4. Define stable dividend event IDs before replacing mock dividend calendar events.
