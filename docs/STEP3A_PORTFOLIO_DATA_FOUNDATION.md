# Step 3A Portfolio Data Foundation

Update date: 2026-06-12

## Files Read

Original reference, read only:

- `original/pages_app/2_asset_tracker.py`
- `original/logic/tracker.py`
- `original/logic/tracker_performance.py`

Current Next.js files:

- `app/portfolio/page.tsx`
- `app/portfolio-manager/page.tsx`
- `components/portfolio/*`
- `lib/portfolio-store.ts`
- `lib/portfolio-aggregate.ts`
- `lib/use-portfolio-view.ts`
- `lib/banksalad-parser.ts`
- `lib/ticker-mapper.ts`
- `lib/portfolio-tags.ts`
- `lib/mock-portfolio-data.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/storage-keys.ts`
- `lib/firebase/firestore-repositories.ts`

No `target/` directory was present or created. Files under `original/` were not modified.

## Original Asset Tracker Logic

The Streamlit tracker stores monthly snapshots as a month-keyed valuation map:

- Snapshot unit: `YYYY-MM`
- Stored value shape: `{ tag: amountKRW }`
- Small items below the tracker threshold are grouped into 기타.
- Asset-type grouping is inferred from tags and product names: cash, dollar, leverage, nasdaq, spy, dividend, and other.
- Super-group sorting drives chart/order behavior.
- Monthly trend charts are generated from the stored monthly tag values.
- `tracker_performance.py` maps the latest snapshot tags to tickers, fetches price history, and infers virtual quantities from the latest KRW valuation. This is a backtest convenience, not exact transaction accounting.

## Current Data Model Audit

Current `PortfolioSnapshot` is a dated snapshot, not a transaction ledger.

- Snapshot unit: `snapshotDate` in `YYYY-MM-DD`.
- Holding row type: `Holding`.
- Asset row type: `FinanceAsset`.
- Parsed rows come from the Banksalad workbook sections `3.재무현황` and `5.투자현황`.
- Ticker field: `Holding.ticker?` exists and is inferred by `guessTicker(...)` or edited by the user.
- Quantity field: `Holding.quantity?` exists in the type but the current Banksalad parser does not populate it.
- Current valuation fields: `Holding.valueKRW`, `PortfolioSnapshot.investmentValueKRW`, `PortfolioSnapshot.totalAssetKRW`.
- Principal fields: `Holding.principalKRW`, `PortfolioSnapshot.investmentPrincipalKRW`.
- Currency field: `Holding.currency?` exists but is not reliably populated by the parser.
- Account/category/tag fields exist through broker, assetType, parsed tags, symbol/account/purpose/status groups, and FinanceAsset category.
- KRW/USD separation is partial. USD exposure can be inferred from US tickers, but row-level currency is not stable enough for portfolio revaluation.

Conclusion: the current model is sufficient for reference latest-price lookup by eligible ticker. It is not sufficient for exact live portfolio valuation because uploaded rows usually lack quantity, currency, and reliable price basis.

## Live Quote Decision

Implemented quote lookup as reference-only metadata.

- Eligible holdings are extracted by ticker.
- Duplicate tickers are de-duplicated.
- `/api/quote/last` is called through the existing `fetchQuoteLast(...)` wrapper.
- Returned price, source, updated timestamp, and warnings are kept separate from snapshot valuation.
- Snapshot totals, holding `valueKRW`, and investment totals are not recalculated.
- If quote lookup fails, the existing quote client sample fallback warning is surfaced and the portfolio screen remains usable.

`canRevalue` is returned per ticker, but it remains false when quantity is missing. Current app behavior does not use quote prices to mutate stored values.

## Ticker Mapping Status

Existing mapping already handled the main US tickers:

- `QQQ`
- `TQQQ`
- `QLD`
- `SCHD`
- `SPY`
- `VOO`

Step 3A added `SPYM` to known ticker/keyword matching.

Quote lookup target rules:

- Eligible: normalized US-style ticker in `Holding.ticker`.
- Not eligible: `CASH_LIKE`, cash buckets, deposits, pensions, money market/cash-like funds, Korean six-digit tickers or `.KS/.KQ`, BTC/crypto, and unmapped rows.
- `SGOV`, `BIL`, and similar cash-like treasury/money-market rows remain excluded from portfolio quote revaluation behavior even if they have market prices.

## Added Or Modified Functions

Modified `lib/ticker-mapper.ts`:

- `classifyPortfolioAsset(...)`
- `getQuoteTickerForHolding(...)`
- `isQuoteEligibleHolding(...)`

Added `lib/portfolio-live-quotes.ts`:

- `extractQuoteEligibleHoldings(...)`
- `getUniqueQuoteTickers(...)`
- `fetchPortfolioQuoteStatuses(...)`
- Types: `PortfolioQuoteStatus`, `PortfolioQuoteSummary`, `PortfolioQuoteSkippedHolding`

Added `components/portfolio/PortfolioQuoteStatusPanel.tsx`:

- Fetches quote statuses for eligible holdings.
- Shows source/price/warning count as small reference-only metadata.
- Explicitly states that snapshot valuation is preserved when quantity may be missing.

## Screen Connection

Minimal screen connection was added:

- `/portfolio`: shows a compact quote status strip when a stored snapshot exists.
- `/portfolio-manager`: shows the same compact quote status strip for parsed/mock holdings before registration.

No card, chart, table layout redesign was performed. No portfolio totals were changed by quote data.

## Monthly Trend And Classification Check

Current Next.js coverage:

- Monthly/date snapshot history: present through `PortfolioSnapshot[]` and `SnapshotHistory`.
- Portfolio value trend: present through `PortfolioPerformanceChart`.
- Asset classification: present through parser category and tag grouping, now supplemented by `classifyPortfolioAsset(...)`.
- Super-group sorting: original-style explicit super-group sorting is not fully ported; current UI uses group aggregation and descending totals.
- Other/small item handling: parser excludes `#소액` and rows below the minimum threshold; original 200,000 KRW 기타 grouping is not exactly replicated.
- Month/snapshot delete: snapshot delete exists.
- Excel upload to page reflection: upload, parse, preview, select, register, localStorage/Firestore load are connected.

## Still Mock Or Sample

- `/portfolio` still falls back to mock allocation/ticker widgets when no registered snapshot exists.
- `PIN_TICKERS`, QLD widgets, treemap, and some dashboard cards still use static/mock data.
- Quote API may return sample fallback on request failure.
- Quantity, currency, and exact live valuation remain unavailable for most uploaded holdings.

## UI Issues For A Later Design Step

- Korean text encoding appears garbled in several files when viewed from PowerShell and should be visually checked in-browser.
- The quote status strip is intentionally plain; a later design step can integrate it more elegantly into existing table/card headers.
- Original super-group ordering and 기타 treatment may need product decisions before visual polish.

## Recommended Next Steps

1. Decide whether future uploads must capture quantity and currency. Without those fields, exact live valuation should stay disabled.
2. Add tests or sample workbook fixtures for ticker eligibility and parser behavior.
3. Replace static `PIN_TICKERS` with the same quote-status foundation only after deciding cache ownership.
4. Port original 기타 threshold/super-group ordering only if it is still desired for the Next.js workflow.
5. Keep dividend calendar, market temperature, asset-map, and QLD work as separate later steps.
