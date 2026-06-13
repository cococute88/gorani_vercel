# Step 5B-3 Historical Tax-Saving Metric Audit

Audit date: 2026-06-13

This step is documentation only. It audits the original Streamlit five-year
historical tax-saving helper and decides whether it should be implemented later.
It does not implement the historical metric, change the `/watchlist`
TaxSavingTable behavior, change quote/provider/cache logic, change Firestore, or
modify `original/`.

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
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`

Missing required documents: none.

Current Next.js files read:

- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `lib/tax-saving-calculator.ts`
- `lib/calendar-event-provider.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-data-provider.ts`
- `lib/mock-calendar-data.ts`
- `lib/server/quote-fetchers.ts`
- `app/api/quote/dividends/route.ts`
- `app/api/quote/history/route.ts`
- `app/api/quote/last/route.ts`
- `scripts/check-tax-saving-calculator.mjs`
- `scripts/check-calendar-provider.mjs`

Original reference files searched/read without modification:

- `original/modules/dividend_calendar.py`
- `original/pages_app/3_dividend_sim.py`
- `original/pages_app/pages_app/3_dividend_sim.py`
- Search terms: `get_historical_tax_saving`, `historical_tax`,
  `tax_saving`, `절세`, `배당락`, `ex_div`, `buy`, `sell`

## 2. Original Historical Function Location

Primary historical calendar helper:

- Function: `get_historical_tax_saving(ticker: str) -> float`
- File: `original/modules/dividend_calendar.py`
- Lines observed: 1018-1044
- Cache: `@st.cache_data(ttl=86400, show_spinner=False)`, so results are cached
  for 24 hours.

Original event-dialog usage:

- File: `original/modules/dividend_calendar.py`
- Lines observed: 1218-1228
- Dialog label: `1회 절세 예상(과거5년)`
- It appears next to the current-event `Est. Tax Savings($10k)` value.

Related but separate simulator logic:

- `original/pages_app/3_dividend_sim.py`
- `original/pages_app/pages_app/3_dividend_sim.py`
- These files implement configurable dividend-capture backtests and also render
  a `1회 절세예상액` metric, but they are not the calendar event-dialog helper.

## 3. Original Formula And Assumptions

Original helper body:

```py
tk = yf.Ticker(ticker)
df = tk.history(period="5y", auto_adjust=False)
divs = df[df['Dividends'] > 0]['Dividends']

for ex_date, div_amount in divs.items():
    idx = df.index.get_loc(ex_date)
    buy_price = df.iloc[idx-1]['Close']
    after_tax_div = div_amount * TAX_RETENTION_RATE
    bep = buy_price - after_tax_div
    max_high = df.iloc[idx]['High']
    if max_high >= bep:
        profit_pct = (after_tax_div / buy_price) * 100
        success_profits.append(profit_pct)

avg_profit = sum(success_profits) / len(success_profits)
tax_saving = (avg_profit / 100) * INVESTMENT_BUDGET * DIVIDEND_TAX_RATE
```

Constants from the same file:

- `INVESTMENT_BUDGET = 10_000`
- `TAX_RETENTION_RATE = 0.85`
- `DIVIDEND_TAX_RATE = 0.22`

Input parameters:

- `ticker: str`

Output shape:

- A single `float` dollar estimate.
- Returns `0.0` for missing data, no dividends, no successful rows, or any
  exception.

Date range:

- Exactly `period="5y"` from yfinance.

Success/failure criteria:

- For every dividend row in the five-year history, the helper uses the previous
  trading row close as the buy price.
- It computes a break-even price as `buy_price - after_tax_div`.
- It checks only the ex-dividend day's `High`.
- A row is successful when `ex_div_day_high >= break_even_price`.
- Failed rows are excluded from the average; they do not contribute zero profit.
- If no rows succeed, the helper returns `0.0`.

Buy/sell assumptions:

- Buy assumption: buy at the previous trading day's close.
- Sell/recovery assumption: the position can recover on the ex-dividend day if
  that day's high reaches the after-tax break-even price.
- There is no explicit sell price output and no configurable sell window in this
  calendar helper.

Price movement and dividend usage:

- Uses realized historical price movement only through previous close and
  ex-dividend day high.
- Uses historical dividend amount from yfinance `Dividends`.
- Uses `auto_adjust=False`, so OHLC and dividend amount are read from the raw
  yfinance history output.

Tax/current-price assumptions:

- Includes the same 0.85 dividend retention assumption.
- Applies the 0.22 tax rate at the final estimate stage.
- Does not use current price.
- Does not use current calendar event dividend amount.

Important formula implication:

- `profit_pct` for successful rows is `after_tax_div / buy_price * 100`.
- The final estimate is effectively:

```txt
average_success_after_tax_dividend_yield * 10000 * 0.22
```

Because failed recoveries are excluded from the average instead of included as
zero, this is a success-only estimate rather than an expected-value backtest.

## 4. Difference From Current Sidebar Formula

Current Next.js sidebar formula from Step 5B-1/5B-2:

```txt
shares = floor(10000 / current_price)
expected_dividend = shares * current_event_dividend_amount
tax_savings = expected_dividend * 0.85 * 0.22
```

Current sidebar traits:

- Uses current quote-last price.
- Uses the visible month calendar event dividend amount.
- Produces one row per visible-month ticker candidate.
- Does not inspect historical OHLC.
- Does not inspect historical recovery/success.
- Does not require five-year data.
- This behavior must remain unchanged by this audit.

Original historical metric traits:

- Uses five years of historical OHLC plus dividend rows.
- Uses previous close before each historical ex-dividend date.
- Uses ex-dividend day high to decide success.
- Uses historical dividend amounts.
- Does not use quote-last current price.
- Does not use the selected current event's dividend amount.
- Produces one auxiliary value for a ticker, displayed in the original event
  dialog.

These are different product metrics. The historical helper is not a replacement
for the current sidebar table formula.

## 5. Required Inputs

To reproduce the original calendar helper exactly enough in Next.js:

- `ticker`
- Five-year dividend history with ex-dividend date and dividend amount.
- Five-year daily OHLC history with at least `close` and `high`.
- A way to align dividend dates to daily history rows.
- Constants:
  - `investmentAmountUsd = 10000`
  - `taxRetentionRate = 0.85`
  - `dividendTaxRate = 0.22`

Not required by the original historical helper:

- quote-last current price
- current selected event dividend amount
- payment date
- annual yield
- FX rate
- user portfolio position size

## 6. Current Next.js Data Availability

Available now:

- Dividend history:
  - `/api/quote/dividends`
  - client wrapper: `fetchQuoteDividends`
  - type: `QuoteDividendsResponse`
  - default calendar provider range: `5y`
  - rows include `{ date, amount }`
- Historical OHLC:
  - `/api/quote/history`
  - client wrapper: `fetchQuoteHistory`
  - type: `QuoteHistoryResponse`
  - rows include `date`, `open`, `high`, `low`, `close`, `volume`
  - server route can source Yahoo, Stooq fallback, or sample fallback.
- Quote-last current price:
  - `/api/quote/last`
  - client wrapper: `fetchQuoteLast`
  - already used by current TaxSavingTable row construction.
- Calendar events with dividend amount:
  - `CalendarEvent.dividendAmount`
  - real provider builds `buy_by` and `ex_div` events from dividend history.
- Current selected ticker/month context:
  - `/watchlist` receives active tickers.
  - `DividendCalendarPage` tracks visible month and selected event.

Missing or not yet modeled for the historical metric:

- No pure historical tax-saving helper exists in `lib/`.
- No client/server composition currently fetches both dividends and history for
  this metric.
- No memoized/cache policy exists for the computed historical metric, beyond the
  quote API route revalidation and calendar dividend cache.
- No decision exists on whether to reproduce the original success-only average
  exactly or adjust it to expected value.
- No display target has been chosen for Next.js.
- No status shape exists for partial alignment failures, sample fallback, or
  insufficient successful rows.

## 7. Feasibility Classification

Classification: **C. Needs user decision on assumptions**

Reason:

- The required raw data is broadly available from existing quote APIs, so a pure
  helper can probably be implemented without a new provider route.
- However, the original helper's semantics are opinionated: D-1 close buy,
  ex-dividend day high recovery, success-only averaging, fixed five-year
  lookback, raw `auto_adjust=False` yfinance history, and silent `0.0` fallback.
- Those assumptions are product decisions, not just engineering details.

Secondary note:

- If the implementation must be cached and fetched as a single reusable metric,
  a small provider/helper layer may be worthwhile, but the current API surface
  does not obviously require a new public quote API.

## 8. User Decisions Needed

Before implementation, decide:

1. Should Next.js reproduce the original helper exactly, including success-only
   averaging and `0.0` fallback?
2. Should the lookback stay fixed at five years or become configurable?
3. Should buy price be D-1 close, D-1 open, D-2 close, or the calendar
   `buy_by` date's close?
4. Should recovery/sell check only ex-dividend day high, or support D+1/D+2/N
   trading-day windows?
5. Should failed captures be excluded like the original, included as zero, or
   included with realized negative return?
6. Should the metric use raw OHLC/close or adjusted prices?
7. Should sample fallback data be allowed in the displayed metric, or marked
   unavailable?
8. Should missing historical price/dividend alignment return `0.0`, `—`, or a
   warning state?
9. Display target: event dialog only, sidebar row detail, or a separate detail
   panel?
10. Should the result expose diagnostics such as successful count, total
    dividend rows, average successful yield, and warnings?

## 9. Recommended Implementation Plan

Recommended future step:

1. Add a pure helper, for example
   `calculateHistoricalTaxSaving(input)` in a new or existing tax-saving domain
   module.
2. Keep the helper independent of React and network calls.
3. Suggested input shape:

```ts
type HistoricalTaxSavingInput = {
  prices: Array<{ date: string; close: number; high: number | null }>;
  dividends: Array<{ date: string; amount: number }>;
  investmentAmountUsd?: number;
  taxRetentionRate?: number;
  dividendTaxRate?: number;
};
```

4. Suggested output shape:

```ts
type HistoricalTaxSavingResult = {
  canCalculate: boolean;
  taxSavingUsd: number;
  averageSuccessfulProfitPct: number;
  successCount: number;
  dividendCount: number;
  warnings: string[];
};
```

5. Add regression checks with synthetic OHLC/dividend rows:
   - no history
   - no dividends
   - dividend date missing from price rows
   - first-row dividend with no previous trading day
   - successful recovery
   - failed recovery
   - multiple rows with original success-only averaging
6. Add a separate data-loading step that fetches `fetchQuoteHistory({ range:
   "5y" })` and `fetchQuoteDividends({ range: "5y" })` for the selected ticker.
7. Only after the pure helper and assumptions are approved, connect it to the
   chosen UI surface.

## 10. What Was Not Changed

- No historical metric implementation.
- No `TaxSavingTable` UI or behavior change.
- No `DividendCalendarPage` behavior change.
- No quote API changes.
- No calendar provider/cache changes.
- No calculator formula changes.
- No portfolio parser changes.
- No Firestore schema changes.
- No dependency changes.
- No `original/` modifications.
- No `target/` folder creation.
