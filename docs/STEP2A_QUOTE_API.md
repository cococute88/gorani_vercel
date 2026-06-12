# Step 2A Quote API

Update date: 2026-06-12

## Scope

Step 2A adds a free quote API foundation for later calculator, market, and dividend-calendar data wiring. It does not redesign calculator logic, implement dividend calendar diversions, add Firestore collections, or change `lib/stores/`.

## Added API Routes

| Route | Purpose |
| --- | --- |
| `/api/quote/history` | Daily OHLCV history for one ticker |
| `/api/quote/dividends` | Dividend event history for one ticker |
| `/api/quote/last` | Latest available daily close for one ticker |
| `/api/quote/fx` | Latest USD/KRW rate |

## Query Parameters

`/api/quote/history`

- `ticker`: required by normal callers. Empty values fall back to a sample SPY-shaped response.
- `range`: optional. Supported values are `1m`, `6m`, `1y`, `3y`, `5y`, and `max`.
- `start`: optional `YYYY-MM-DD`. Overrides `range` when valid.
- `end`: optional `YYYY-MM-DD`. Defaults to the current date.

`/api/quote/dividends`

- `ticker`: required by normal callers. Empty values fall back to a sample SCHD-shaped response if Yahoo fails.
- `range`: optional. Supported values are `1m`, `6m`, `1y`, `3y`, `5y`, and `max`; default behavior is `5y`.
- `start`: optional `YYYY-MM-DD`. Overrides `range` when valid.
- `end`: optional `YYYY-MM-DD`. Defaults to the current date.

`/api/quote/last`

- `ticker`: required by normal callers. Empty values fall back to a sample SPY-shaped response.

`/api/quote/fx`

- `pair`: optional. `USDKRW` is the supported pair and default.

## Response Summary

History responses include:

- `ticker`
- `normalizedTicker`
- `source`: `yahoo`, `stooq`, or `sample`
- `updatedAt`
- `warnings`
- `prices`: ascending `date`, `open`, `high`, `low`, `close`, and `volume`

Dividend responses include:

- `ticker`
- `normalizedTicker`
- `source`: `yahoo` or `sample`
- `updatedAt`
- `warnings`
- `dividends`: ascending `date` and positive `amount`

Latest-price responses include:

- `ticker`
- `normalizedTicker`
- `source`: `yahoo`, `stooq`, or `sample`
- `updatedAt`
- `warnings`
- `price`
- `date`

FX responses include:

- `pair`: `USDKRW`
- `source`: `yahoo` or `sample`
- `updatedAt`
- `warnings`
- `rate`
- `date`

## Fallback Order

History route:

1. Yahoo chart API: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`
2. Stooq CSV for plain US tickers: `https://stooq.com/q/d/l/?s={ticker}.us&i=d`
3. Deterministic sample history

Dividend route:

1. Yahoo chart API with dividend events
2. Deterministic sample dividends if Yahoo lookup fails

Latest-price route:

1. Same history path as `/api/quote/history` with a recent range
2. Last valid close from the returned history

FX route:

1. Yahoo chart lookup for `KRW=X`
2. Yahoo chart lookup for `USDKRW=X`
3. Deterministic USD/KRW sample rate

## Sample Fallback Conditions

Sample fallback is returned when:

- Yahoo chart lookup fails, times out, returns an API error, or returns no usable close values.
- Stooq fallback fails, returns no CSV rows, has missing required columns, or is not suitable for the ticker symbol.
- Dividend Yahoo lookup fails before usable dividend event parsing.
- USD/KRW returns no rate or an abnormal value outside `700..3000`.
- Client-side provider wrappers cannot reach the API route.

Every sample fallback includes `source: "sample"` and at least one warning.

## Current UI Wiring

The calculator page now mentions the quote API foundation in `PreviewNotice`, but the three calculator implementations still use the existing synchronous sample provider. This keeps the Step 2A blast radius small and avoids a broad async UI conversion.

The new async provider functions in `lib/calculator-data-provider.ts` are ready for later UI/data wiring:

- `fetchQuoteHistory`
- `fetchQuoteDividends`
- `fetchQuoteLast`
- `fetchUsdKrw`

## Deferred UI Connections

These areas are not fully connected to live quote data yet:

- Dividend capture simulator calculation inputs and backtest history
- Conversion calculator sell/buy history comparison
- MDD calculator price series and USD/KRW conversion
- Market temperature and market overview modules
- Dividend calendar event repository
- Dividend performance and ledger workflows

## Next Step 2B Store/Repository Work

Step 2B should define data ownership and repository boundaries before adding persistence. Expected decisions:

- Which quote responses are cached locally, if any
- Whether market quote cache belongs in an API-only server layer or a client-accessible repository
- How dividend calendar ticker/event metadata will map to current Firebase repositories
- Whether favorites and calendar cache need separate documents or can share existing watchlist settings

No Firestore collections were added in Step 2A.

## Step 4 Reusable Functions

Step 4 calculator data wiring can reuse:

- `fetchQuoteHistory` for MDD close series and conversion sell/buy histories
- `fetchQuoteDividends` for dividend capture ex-dividend events
- `fetchQuoteLast` for current ticker price defaults
- `fetchUsdKrw` for KRW MDD conversion
- `normalizeTicker`, `toIsoDate`, and `createWarning` in server-only API code
