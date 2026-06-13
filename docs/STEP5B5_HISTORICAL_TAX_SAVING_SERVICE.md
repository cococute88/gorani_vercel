# Step 5B-5 Historical Tax-Saving Service

Implementation date: 2026-06-13

This step adds a non-UI composition layer for the original-compatible
five-year historical tax-saving metric. It does not connect the metric to the
event dialog, TaxSavingTable, calendar provider/cache, quote API routes, or any
visible UI.

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
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`

Missing required documents: none.

Current Next.js files read:

- `lib/historical-tax-saving-calculator.ts`
- `lib/tax-saving-calculator.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-data-provider.ts`
- `lib/calendar-event-provider.ts`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/TaxSavingTable.tsx`
- `components/calculator/DividendCaptureSimulator.tsx`
- `scripts/check-tax-saving-calculator.mjs`
- `scripts/check-calendar-provider.mjs`
- `app/api/quote/dividends/route.ts`
- `app/api/quote/history/route.ts`

Original reference read without modification:

- `original/modules/dividend_calendar.py`

## 2. Added Service File

Added:

- `lib/historical-tax-saving-service.ts`

Exported function:

```ts
loadHistoricalTaxSavingMetricForTicker(ticker, options)
```

Exported result type:

```ts
HistoricalTaxSavingMetricLoadResult
```

The service composes existing quote dividend/history data into the pure helper
from Step 5B-4:

```ts
calculateHistoricalTaxSavingMetric({
  dividends,
  prices,
  investmentAmountUsd: 10000,
  taxRetentionRate: 0.85,
  taxEffectRate: 0.22,
})
```

## 3. Fetch Strategy

Production defaults use the existing client-safe quote wrapper path from
`lib/calculator-data-provider.ts`:

```ts
fetchQuoteDividends({ ticker, range: "5y" })
fetchQuoteHistory({ ticker, range: "5y" })
```

Those wrappers call the existing quote client/API paths:

- `/api/quote/dividends`
- `/api/quote/history`

No server-only fetchers are imported by the new service. No quote API route was
created or changed.

The service also accepts injected fetchers:

```ts
{
  fetchDividends?: typeof fetchQuoteDividends,
  fetchHistory?: typeof fetchQuoteHistory,
}
```

This keeps regression tests synthetic and network-free.

## 4. Quote Data Mapping Rules

Quote dividends map to:

```ts
HistoricalDividendPoint = {
  date: "YYYY-MM-DD",
  amount: number,
}
```

Rows are dropped with warnings when:

- date is missing or invalid
- amount is not a positive finite number

Quote history rows map to:

```ts
HistoricalPriceBar = {
  date: "YYYY-MM-DD",
  close: number,
  high: number,
}
```

Rows are dropped with warnings when:

- date is missing or invalid
- close is not a positive finite number
- high is missing or not a positive finite number

Ordinary missing data does not throw. The service returns warnings and a safe
zero-valued result when calculation is unavailable.

## 5. Result Shape

The service returns loading-independent metadata:

```ts
{
  ticker: string;
  canCalculate: boolean;
  taxSavingUsd: number;
  avgProfitPct: number;
  totalCount: number;
  successCount: number;
  failureCount: number;
  dividendCount: number;
  priceBarCount: number;
  source: "quote-api" | "injected";
  warnings: string[];
  calculatedAt: string;
}
```

`source` is `quote-api` for default production fetchers and `injected` when a
custom dividend or history fetcher is supplied.

## 6. Regression Test Cases

Extended:

- `scripts/check-tax-saving-calculator.mjs`

Added synthetic injected-fetcher cases:

1. Service success:
   - one dividend
   - previous trading day close
   - ex-dividend day high reaches break-even
   - expected `canCalculate = true`, `totalCount = 1`, `successCount = 1`
2. Service failure but valid sample:
   - ex-dividend high does not reach break-even
   - expected `canCalculate = true`, `successCount = 0`,
     `failureCount = 1`, `taxSavingUsd = 0`
3. Missing history:
   - dividends exist, history is empty
   - expected `canCalculate = false`, warning, `taxSavingUsd = 0`
4. Invalid ticker:
   - blank ticker
   - expected safe non-calculable result, warning, and no injected fetcher calls
5. Dropped invalid rows:
   - invalid dividend and price rows are ignored with warnings
   - expected no crash and valid rows still calculate

The script does not call the real quote network for these service cases.

## 7. Why UI Was Not Connected

This step intentionally prepares only the data composition layer. The intended
future display target is the event dialog auxiliary metric, matching the
original `1회 절세 예상(과거5년)` behavior.

Unchanged:

- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- event dialog behavior
- current TaxSavingTable row calculation
- calendar provider/cache fallback order
- quote API route behavior
- Firestore/cache schema

## 8. Remaining Work

- Decide event-dialog copy and unavailable-state display.
- Decide whether quote source details should be shown in the dialog.
- Add UI loading/cancellation behavior when this service is called from the
  selected event dialog.
- Consider a cache policy only after UI behavior is reviewed.

## 9. Next Step Recommendation

Next recommended step:

1. Connect `loadHistoricalTaxSavingMetricForTicker` to the event dialog only.
2. Keep the current TaxSavingTable formula unchanged.
3. Show unavailable, valid-zero, and warning states distinctly.
4. Continue using injected tests for data-layer behavior and visual/browser
   checks for the dialog integration.
