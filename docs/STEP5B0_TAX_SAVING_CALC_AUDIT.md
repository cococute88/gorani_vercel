# Step 5B-0 TaxSavingTable Calculation Spec Audit

Audit date: 2026-06-13

This step is an audit/spec document only. It does not implement a tax-saving
calculation, change the `/watchlist` UI, change calendar provider/cache logic,
change quote APIs, change Firestore, or add dependencies.

## 1. Read Documents And Files

Required documents read as UTF-8:

- `docs/AUDIT.md`
- `docs/MOBILE_UI_OVERFLOW_AUDIT.md`
- `docs/MOBILE_UI_M1_OVERFLOW_FIX.md`
- `docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
- `docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`
- `docs/STEP5A5_CALENDAR_UI_POLISH.md`
- `docs/STEP5A6_CUSTOM_EVENT_FOUNDATION.md`
- `docs/STEP5A6_CUSTOM_EVENT_UI.md`

Missing required documents: none.

Current Next.js files read:

- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `components/watchlist/CalendarEventDialog.tsx`
- `lib/mock-calendar-data.ts`
- `lib/calendar-event-provider.ts`
- `lib/calendar-cache.ts`
- `lib/calendar-event-identity.ts`
- `lib/event-visuals.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-data-provider.ts`
- `lib/calculator-types.ts`
- `lib/dividend-capture-calculator.ts`
- `package.json`

Original reference files read, without modification:

- `original/modules/dividend_calendar.py`
- `original/pages_app/5_dividend_calendar.py`
- `original/pages_app/3_dividend_sim.py`
- `original/pages_app/pages_app/3_dividend_sim.py`
- `original/logic/dividend_ledger.py`
- `original/logic/dividend_performance.py`
- `original/logic/market.py`
- `original/logic/simulator.py`
- `original/logic/tracker.py`
- `original/logic/tracker_performance.py`

Search terms used:

- Korean: `절세`, `세금`, `배당`, `배당락`, `매수`
- English/code: `tax`, `saving`, `dividend`, `ex_div`, `buy`, `capture`

## 2. Current TaxSavingTable Structure

`TaxSavingTable` receives exactly one prop:

```ts
rows: TaxSavingRow[]
```

`TaxSavingRow` is defined in `lib/mock-calendar-data.ts`:

```ts
{
  ticker: string;
  taxSavingUsd: number;
  shouldBuyThisMonth: boolean;
}
```

The table renders:

- title: `종목별 예상 절세액`
- static caption: `투자금 $10,000 기준 1회 절세 예상`
- columns: ticker, `taxSavingUsd.toFixed(1)`, and a Buy badge

The caption is hardcoded in `components/watchlist/TaxSavingTable.tsx`; no
investment amount prop is passed to the component.

Rows are created in `components/watchlist/DividendCalendarPage.tsx`:

```ts
const monthEvents = events.filter(event => event.date >= monthStartIso && event.date <= monthEndIso)
const taxRows = buildTaxSavingRows(monthEvents)
```

Important current behavior:

- The displayed ticker list comes from generated/custom-merged calendar events
  that fall inside the visible month, not directly from the full `tickers` prop.
- Custom events are excluded by `buildTaxSavingRows`.
- `shouldBuyThisMonth` is true when the current month event set contains a
  `buy_by` event for that ticker.
- The table does not calculate expected shares.
- The table does not read quote last price.
- The table does not calculate from `dividendAmount`, `buyDeadline`, or
  `exDivDate`; it only copies an existing event field named `taxSavingUsd`.

## 3. Why 0.0 Is Displayed Now

`buildTaxSavingRows(events)` copies `event.taxSavingUsd` into each row:

```ts
taxSavingUsd: event.taxSavingUsd
```

Mock events created in `lib/mock-calendar-data.ts` have non-zero fixture values
from `TICKER_PROFILE.tax`.

Real provider events created in `lib/calendar-event-provider.ts` are built by
`makeDividendEvent(...)`, which currently sets:

```ts
annualYield: 0,
taxSavingUsd: 0,
```

After Step 5A-3, `/watchlist` loads events through
`getCalendarEventsForTickersWithProvider({ provider: "real" })`. Therefore,
when the real provider, sample quote fallback, or cache path supplies events,
their `taxSavingUsd` is `0`, and `TaxSavingTable` renders `0.0`.

This is not a table formatting bug. It is a data/calculation gap: the real
calendar event provider does not populate the tax-saving field, and the row
builder does not compute it.

## 4. Original Streamlit Similar Logic

The original Streamlit calendar has a direct per-event formula in
`original/modules/dividend_calendar.py`.

Constants:

```py
TAX_RETENTION_RATE = 0.85
DIVIDEND_TAX_RATE = 0.22
INVESTMENT_BUDGET = 10_000
```

Event title formula:

```py
shares = int(INVESTMENT_BUDGET / self.current_price) if self.current_price > 0 else 0
tax_savings = shares * self.dividend_amount * TAX_RETENTION_RATE * DIVIDEND_TAX_RATE
```

Reusable function:

```py
def calc_tax_savings(current_price: float, dividend_amount: float) -> Tuple[int, float]:
    if current_price <= 0: return 0, 0.0
    shares = int(INVESTMENT_BUDGET / current_price)
    savings = shares * dividend_amount * TAX_RETENTION_RATE * DIVIDEND_TAX_RATE
    return shares, savings
```

Sidebar table logic:

- `active_this_month` is the set of tickers with a `buy` event in the viewed
  month.
- For each ticker with non-earnings events, it chooses the current-month `buy`
  event when present, otherwise the latest available non-earnings event.
- It calls `calc_tax_savings(best_event.current_price, best_event.dividend_amount)`.
- It displays `예상 절세액`, sorted descending, formatted as dollars.

Original inputs for this formula:

- `current_price` from `fetch_ticker_bundle`, using `yf.Ticker(...).fast_info.last_price`
  with recent close fallback.
- `dividend_amount` from yfinance dividends, Finnhub, Polygon, Yahoo info
  fallback, or projected latest amount.
- fixed investment budget `$10,000`.
- fixed rates `0.85` and `0.22`.

The original also has a separate historical metric:

- `get_historical_tax_saving(ticker)`
- Uses five years of yfinance price/dividend history.
- Counts successful ex-dividend recoveries and computes an average-success
  based tax-saving estimate.
- This appears in the original event dialog as `1회 절세 예상(과거5년)`.
- It is not the sidebar `종목별 1회 예상 절세액` table formula.

The original `pages_app/3_dividend_sim.py` / duplicated
`pages_app/pages_app/3_dividend_sim.py` has dividend-capture backtest logic
and a `1회 절세예상액` metric:

```py
tax_saving = (avg_profit / 100) * invest_capital * 0.22
```

That simulator is related, but it is not the calendar sidebar table logic.

## 5. Inputs Needed For The Calendar Table Calculation

To port the original calendar sidebar formula exactly, a pure calculation needs:

- `ticker`
- `investmentAmountUSD`, original default `10000`
- `currentPrice`
- `dividendAmountPerShare`
- `taxRetentionRate`, original `0.85`
- `dividendTaxRate`, original `0.22`
- event selection rule: prefer current-month buy event, otherwise latest
  non-earnings event for the ticker
- buy-month highlight rule: ticker has buy/buy_by event in the viewed month

Derived outputs:

- `expectedShares = floor(investmentAmountUSD / currentPrice)`
- `taxSavingUsd = expectedShares * dividendAmountPerShare * taxRetentionRate * dividendTaxRate`
- `shouldBuyThisMonth`

Inputs that are candidates but are not required by the original sidebar table
formula:

- `estimatedPriceDrop`
- `sellDate`
- `sellWindow`
- `FX rate`
- `expectedDividend`
- `withholdingTaxRate` as a separate user-configurable rate

Those are relevant to dividend-capture/backtest or KRW reporting, not to the
original calendar sidebar table formula.

## 6. Values Already Available In Current Code

Available in current `/watchlist` event data:

- `ticker`
- `type` (`buy_by`, `ex_div`, `pay`, `earnings`, `custom`)
- `date`
- `status`
- `sourceKind`
- `dividendAmount` for generated dividend events
- `buyDeadline`
- `exDivDate`
- `paymentDate` only for mock events; real provider does not generate payment
  events because `/api/quote/dividends` does not provide payment dates.
- `taxSavingUsd` field exists structurally, but real provider events set it to
  `0`.

Available elsewhere in current code but not connected to `/watchlist`:

- `fetchQuoteLast({ ticker })` and `/api/quote/last` can provide latest price.
- `fetchQuoteDividends({ ticker })` and `/api/quote/dividends` provide dividend
  dates and amounts; the calendar provider already uses this for events.
- `dividend-capture-calculator.ts` can compute capture/backtest metrics from
  price and dividend history, but it is a different calculator surface.

Available only as hardcoded UI copy:

- `$10,000` investment amount in `TaxSavingTable`.

## 7. Values Missing From Current `/watchlist` Calculation Path

Missing or not yet modeled:

- `currentPrice` on `CalendarEvent`.
- a `/watchlist` quote-last loading/cache path for each displayed ticker.
- explicit `investmentAmountUSD` data input or config; only caption text exists.
- explicit rate inputs/config for `taxRetentionRate` and `dividendTaxRate`.
- `expectedShares` in `TaxSavingRow`.
- a calculation result status for missing price/dividend data.
- a choice between the original calendar one-time formula and the historical
  five-year backtest formula.
- a clear fallback policy when quote last price is unavailable or sample data is
  used.

## 8. Calculation Spec Certainty

Judgment: **A. Original calculation is clear enough to implement in a next step,
if the product decision is to port the original calendar sidebar formula.**

The original calendar table formula is explicit:

```txt
shares = floor(10000 / currentPrice)
taxSavingUsd = shares * dividendAmountPerShare * 0.85 * 0.22
```

However, the current Next.js data path lacks `currentPrice`, and there are two
nearby original metrics with similar Korean labels:

- calendar sidebar: current-price/dividend-amount one-time estimate
- event dialog historical metric: five-year recovery-success estimate

So the next implementation should first confirm that the desired `/watchlist`
card is the calendar sidebar formula, not the historical backtest metric.

## 9. User Decisions Needed Before Implementation

Confirm these before writing runtime code:

1. Should `/watchlist` port the original calendar sidebar formula exactly?
2. Should the constants remain `investmentAmountUSD = 10000`,
   `taxRetentionRate = 0.85`, and `dividendTaxRate = 0.22`?
3. Should the displayed value be one decimal as the current UI does, or match
   original `$:,.2f` formatting?
4. Should rows include all tickers with any provider event, or only tickers with
   events inside the viewed month as the current Next.js code does?
5. If a ticker has no current-month `buy_by` event, should Next.js use the latest
   non-earnings event for that ticker like the original?
6. Should latest prices come from `/api/quote/last`, the provider result, or a
   future calendar event price field?
7. What should render when `currentPrice` or `dividendAmount` is missing:
   `0.0`, dash, warning, or exclude the row?
8. Should sample quote fallback values be accepted for the table, or should the
   table mark them as unavailable?
9. Is the historical five-year tax-saving metric needed in the table, event
   dialog, or a separate future feature?

## 10. Proposed Next Implementation Step

If the user confirms the original calendar sidebar formula:

1. Add a pure function in a small domain helper, for example
   `lib/tax-saving-calculator.ts`.
2. Keep the helper independent of React and quote APIs.
3. Proposed input shape:

```ts
type TaxSavingCalculationInput = {
  investmentAmountUsd: number;
  currentPrice: number | null;
  dividendAmountPerShare: number | null;
  taxRetentionRate: number;
  dividendTaxRate: number;
};
```

4. Proposed output shape:

```ts
type TaxSavingCalculationResult = {
  expectedShares: number;
  taxSavingUsd: number;
  unavailableReason?: "missing_price" | "missing_dividend" | "invalid_input";
};
```

5. Wire current prices through a separate `/watchlist` data-loading step,
   preferably reusing `fetchQuoteLast`.
6. Update `buildTaxSavingRows` or introduce a new non-mock row builder that
   accepts event data plus price data.
7. Add regression coverage for zero/missing price, zero/missing dividend, and
   original fixture parity.

No implementation was performed in Step 5B-0.

## 11. Areas Not Changed In This Step

- No tax-saving calculation implementation.
- No `TaxSavingTable` layout or UI copy changes.
- No provider/cache fallback order changes.
- No quote API changes.
- No Firestore changes.
- No calendar custom event changes.
- No dividend-capture calculator formula changes.
- No portfolio parser changes.
- No dependency changes.
- No `original/` modifications.
- No `target/` folder creation.

