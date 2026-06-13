# Step 5B-4 Historical Tax-Saving Pure Helper

Implementation date: 2026-06-13

This step adds a pure helper for the original Streamlit historical tax-saving
auxiliary metric. It does not connect the metric to the event dialog,
TaxSavingTable, quote APIs, calendar provider/cache, or any visible UI.

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
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`

Missing required documents: none.

Current Next.js files read:

- `lib/tax-saving-calculator.ts`
- `scripts/check-tax-saving-calculator.mjs`
- `lib/quote-types.ts`
- `lib/quote-client.ts`
- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `lib/mock-calendar-data.ts`

Original reference read without modification:

- `original/modules/dividend_calendar.py`

## 2. Original Formula Inspected

Original function:

- File: `original/modules/dividend_calendar.py`
- Function: `get_historical_tax_saving(ticker: str) -> float`
- Observed lines: 1019-1044

Original constants:

```txt
INVESTMENT_BUDGET = 10000
TAX_RETENTION_RATE = 0.85
DIVIDEND_TAX_RATE = 0.22
```

Original flow:

```txt
history = yfinance history(period="5y", auto_adjust=False)
dividends = rows where Dividends > 0
buy_price = previous trading row Close
after_tax_div = dividend_amount * 0.85
break_even_price = buy_price - after_tax_div
success = ex-dividend day High >= break_even_price
profit_pct for successful rows = after_tax_div / buy_price * 100
avg_profit = average(successful profit_pct values)
tax_saving = avg_profit / 100 * 10000 * 0.22
```

Important difference from the tentative prompt formula:

- The prompt proposed `((exDivHigh - breakEvenPrice) / buyPrice) * 100` if the
  original did not differ.
- The original differs. It uses ex-dividend high only as a recovery success
  check, then records `after_tax_dividend / buy_price * 100` for successful
  rows.
- The implementation follows the original formula.

## 3. Implemented Helper File

Added:

- `lib/historical-tax-saving-calculator.ts`

Exported constants:

```ts
DEFAULT_HISTORICAL_TAX_SAVING_INVESTMENT_USD = 10000
DEFAULT_HISTORICAL_TAX_RETENTION_RATE = 0.85
DEFAULT_HISTORICAL_TAX_EFFECT_RATE = 0.22
```

Exported function:

```ts
calculateHistoricalTaxSavingMetric(input)
```

The helper is pure:

- no React dependency
- no network calls
- no quote client usage
- no cache reads/writes
- no UI formatting

## 4. Input And Output Types

Input types:

```ts
HistoricalDividendPoint = { date: string; amount: number }
HistoricalPriceBar = { date: string; close: number; high: number }
HistoricalTaxSavingInput = {
  dividends: HistoricalDividendPoint[]
  prices: HistoricalPriceBar[]
  investmentAmountUsd?: number
  taxRetentionRate?: number
  taxEffectRate?: number
}
```

Output types:

```ts
HistoricalTaxSavingSample = {
  exDivDate: string
  previousTradingDate: string
  dividendAmount: number
  buyPrice: number
  exDivHigh: number
  afterTaxDividend: number
  breakEvenPrice: number
  success: boolean
  profitPct: number
}

HistoricalTaxSavingResult = {
  canCalculate: boolean
  taxSavingUsd: number
  avgProfitPct: number
  totalCount: number
  successCount: number
  failureCount: number
  samples: HistoricalTaxSavingSample[]
  warnings: string[]
}
```

## 5. Calculation Rules

For each dividend point:

1. Normalize date to `YYYY-MM-DD`.
2. Require `amount > 0`.
3. Find the ex-dividend price bar by exact date.
4. Find the latest price bar before the ex-dividend date.
5. Use previous trading day close as `buyPrice`.
6. Use ex-dividend day high as `exDivHigh`.
7. Compute `afterTaxDividend = dividendAmount * taxRetentionRate`.
8. Compute `breakEvenPrice = buyPrice - afterTaxDividend`.
9. Mark success when `exDivHigh >= breakEvenPrice`.
10. For successful rows, compute original-compatible
    `profitPct = afterTaxDividend / buyPrice * 100`.

Final result:

```txt
avgProfitPct = average(successful profitPct values)
taxSavingUsd = avgProfitPct / 100 * investmentAmountUsd * taxEffectRate
```

## 6. Success And Failure Handling

- Successful rows contribute to `avgProfitPct`.
- Failed rows are included in `totalCount` and `failureCount`.
- Failed rows do not lower the average because the original averages successful
  rows only.
- If valid samples exist but none are successful:
  - `canCalculate = true`
  - `successCount = 0`
  - `avgProfitPct = 0`
  - `taxSavingUsd = 0`

## 7. Missing Data Handling

Warnings are returned instead of throwing for ordinary missing or malformed
data.

Covered warnings include:

- no dividends
- no price history
- invalid dividend date
- invalid dividend amount
- missing ex-dividend price bar
- missing previous trading day price bar
- invalid buy price
- invalid ex-dividend high
- invalid investment amount
- invalid tax rates

If no valid sample can be built, the result is:

```txt
canCalculate = false
taxSavingUsd = 0
samples = []
warnings = non-empty
```

This keeps missing data distinct from valid data with zero successful rows.

## 8. Regression Test Cases

Extended:

- `scripts/check-tax-saving-calculator.mjs`

Historical synthetic cases:

1. Full recovery success:
   - previous close `100`
   - dividend `1`
   - after-tax dividend `0.85`
   - break-even `99.15`
   - ex-dividend high `100`
   - expected `profitPct = 0.85`, `taxSavingUsd = 18.7`
2. Partial recovery success:
   - previous close `100`
   - dividend `1`
   - break-even `99.15`
   - ex-dividend high `99.50`
   - expected original-compatible `profitPct = 0.85`,
     `taxSavingUsd = 18.7`
   - note: the prompt's tentative recovery-surplus formula would produce
     `0.35` and `7.7`, but the inspected original formula does not.
3. Failure excluded:
   - ex-dividend high `99.00`
   - expected `canCalculate = true`, `totalCount = 1`, `successCount = 0`,
     `taxSavingUsd = 0`
4. Mixed success/failure average:
   - one successful sample and one failed sample
   - expected `avgProfitPct = 0.85`, `successCount = 1`,
     `failureCount = 1`, `taxSavingUsd = 18.7`
5. Missing data:
   - missing price history
   - missing previous trading day
   - expected `canCalculate = false`, warnings, `taxSavingUsd = 0`

The script still covers the current Step 5B-1/5B-2 TaxSavingTable calculation
and row builder behavior.

## 9. Why UI Was Not Connected

This step intentionally avoids visible behavior changes.

Unchanged:

- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- current TaxSavingTable row calculation
- event dialog
- calendar provider/cache
- quote API routes
- portfolio parser/live quote logic

The historical metric is intended for a future event-dialog auxiliary display,
not as a replacement for the current `종목별 예상 절세액` table value.

## 10. Verification Results

Commands run during this step:

| Command | Result |
| --- | --- |
| `npm.cmd run check:tax-saving` | Passed |

Full requested verification command results are reported in the completion
response.

## 11. Next Step Recommendation

Recommended next step:

1. Add a small non-UI composition layer that fetches five-year dividends and
   five-year price history for a selected ticker.
2. Feed those results into `calculateHistoricalTaxSavingMetric`.
3. Decide the display status wording for sample fallback, unavailable history,
   and valid zero-success results.
4. Connect the metric to the event dialog only after the data-loading and status
   policy are reviewed.
