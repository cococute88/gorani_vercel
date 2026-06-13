# Step 5B-1 TaxSavingTable Pure Calculation Function

Implementation date: 2026-06-13

This step adds the pure calculation function needed for the future
`/watchlist` TaxSavingTable data path. It does not connect UI, fetch latest
prices, change calendar provider/cache behavior, or modify `original/`.

## 1. Read Docs And Files

Repository structure was confirmed:

- Working root: `C:\gv\gorani_vercel`
- `original/` exists and remains read-only reference.
- `target/` does not exist and was not created.

Required documents read as UTF-8:

- `docs/AUDIT.md`
- `docs/STEP5B0_TAX_SAVING_CALC_AUDIT.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`
- `docs/MOBILE_UI_M1_OVERFLOW_FIX.md`
- `docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`

Current Next.js files read:

- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `lib/calendar-event-provider.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/mock-calendar-data.ts`
- `scripts/check-calendar-provider.mjs`
- `package.json`

Original reference files read without modification:

- `original/modules/dividend_calendar.py`

Helper search was performed for existing tax/dividend calculation helpers. No
existing helper matched this specific calendar sidebar formula, so a new small
helper was added.

Missing requested documents or files: none.

## 2. Implemented Formula

The helper implements the original calendar sidebar heuristic:

```ts
expectedShares = Math.floor(investmentAmountUsd / currentPrice)
expectedDividendUsd = expectedShares * dividendAmountPerShare
taxSavingUsd = expectedDividendUsd * taxRetentionRate * dividendTaxRate
```

This is a deterministic calculation copied from the original app sidebar
behavior. It is not legal or tax advice.

The historical five-year event-dialog formula from the original app was not
implemented in this step.

## 3. Constants Used

Exported defaults in `lib/tax-saving-calculator.ts`:

```ts
DEFAULT_TAX_SAVING_INVESTMENT_USD = 10000
DEFAULT_TAX_RETENTION_RATE = 0.85
DEFAULT_DIVIDEND_TAX_RATE = 0.22
```

These match the Step 5B-1 decision and the original calendar constants:

```py
INVESTMENT_BUDGET = 10_000
TAX_RETENTION_RATE = 0.85
DIVIDEND_TAX_RATE = 0.22
```

## 4. Input And Output Types

Added input type:

```ts
export type TaxSavingCalculationInput = {
  investmentAmountUsd?: number;
  currentPrice: number | null | undefined;
  dividendAmountPerShare: number | null | undefined;
  taxRetentionRate?: number;
  dividendTaxRate?: number;
};
```

Added result type:

```ts
export type TaxSavingCalculationResult = {
  canCalculate: boolean;
  expectedShares: number;
  expectedDividendUsd: number;
  taxSavingUsd: number;
  warnings: string[];
};
```

Added function:

```ts
export function calculateExpectedDividendTaxSaving(
  input: TaxSavingCalculationInput
): TaxSavingCalculationResult
```

## 5. Validation Rules

The helper does not throw for ordinary missing or invalid data. It returns
`canCalculate: false`, numeric result fields set to safe zero values where
appropriate, and one or more warnings.

Invalid calculation conditions:

- `currentPrice` is null or undefined.
- `currentPrice` is non-finite, zero, or negative.
- `dividendAmountPerShare` is null or undefined.
- `dividendAmountPerShare` is non-finite, zero, or negative.
- `investmentAmountUsd` is non-finite, zero, or negative.
- `expectedShares <= 0`.
- Optional rate overrides must be non-negative finite numbers.

Rounding:

- `expectedShares` uses `Math.floor`.
- `expectedDividendUsd` and `taxSavingUsd` remain numbers.
- The pure function does not format strings; UI formatting remains outside this
  helper.

## 6. Test Cases

Added `scripts/check-tax-saving-calculator.mjs` and package script:

```json
"check:tax-saving": "node scripts/check-tax-saving-calculator.mjs"
```

Regression cases:

1. Explicit constants:
   - `investmentAmountUsd = 10000`
   - `currentPrice = 100`
   - `dividendAmountPerShare = 1`
   - `taxRetentionRate = 0.85`
   - `dividendTaxRate = 0.22`
   - expected: 100 shares, dividend 100, tax saving 18.7, calculable.
2. Defaults:
   - `currentPrice = 33`
   - `dividendAmountPerShare = 0.5`
   - expected: 303 shares, dividend 151.5, tax saving
     `151.5 * 0.85 * 0.22`, calculable.
3. Missing price:
   - `currentPrice = null`
   - expected: not calculable, warning, tax saving 0.
4. Missing dividend:
   - `dividendAmountPerShare = null`
   - expected: not calculable, warning, tax saving 0.
5. Zero/negative values:
   - zero/negative price, zero/negative dividend, zero/negative investment,
     and zero expected shares all return not calculable with warnings.

The script uses the same lightweight Node + local TypeScript transpile pattern
as `scripts/check-calendar-provider.mjs`; no Jest or Vitest dependency was
added.

## 7. Why UI Was Not Connected Yet

This step intentionally leaves visible `/watchlist` behavior unchanged.

Unchanged:

- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx` row building
- `buildTaxSavingRows(monthEvents)`
- calendar provider/cache fallback order
- `CalendarEvent` shape
- quote-last API usage

The current table still displays `event.taxSavingUsd`, and real provider events
still set that field to `0`. Connecting current prices and event dividend
amounts is reserved for the next step.

## 8. Verification Results

Commands run after confirming no active `next dev` process:

| Command | Result |
| --- | --- |
| `npm.cmd run check:tax-saving` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run lint` | Passed, no ESLint warnings or errors |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run check:calendar-provider` | Passed |
| `npm.cmd run check:portfolio-parser` | Passed |
| `npm.cmd run check:portfolio-parser:private` | Passed |

## 9. Next Step Recommendation

Recommended next step:

```txt
event dividend amount + fetchQuoteLast current price
  -> calculateExpectedDividendTaxSaving
  -> TaxSavingTable rows
```

Keep that next step separate so price fetching, fallback policy, loading state,
and unavailable-data rendering can be reviewed independently from this pure
calculation helper.
