# Step 3C Portfolio Parser Fixtures

Update date: 2026-06-12

## Files Read

- `docs/AUDIT.md`
- `docs/STEP3A_PORTFOLIO_DATA_FOUNDATION.md`
- `docs/STEP3B_PORTFOLIO_PARSER_FIELDS.md`
- `package.json`
- `tsconfig.json`
- `lib/banksalad-parser.ts`
- `lib/portfolio-types.ts`
- `lib/ticker-mapper.ts`
- `lib/portfolio-live-quotes.ts`
- `components/portfolio/PortfolioParsePreview.tsx`
- `components/portfolio/ExcelUploadCard.tsx`
- `components/portfolio/SnapshotHistory.tsx`
- `original/pages_app/2_asset_tracker.py`
- `original/logic/tracker.py`

No `target/` directory was present or created. Files under `original/` were not modified.

## Test Environment Check

`package.json` has no Jest, Vitest, Playwright, or Cypress test runner.

To avoid adding heavy test infrastructure, Step 3C adds a lightweight Node regression script:

- `scripts/check-portfolio-parser.mjs`
- `package.json` script: `check:portfolio-parser`

The script uses the existing `typescript` and `xlsx` dependencies already present in the project. It registers a local TypeScript require hook so it can call the real parser and quote utility functions without adding `tsx`, `ts-node`, Jest, or Vitest.

## Added Fixture Coverage

The script generates in-memory XLSX workbooks with this shape:

- `3.재무현황`
- `5.투자현황`
- Finance rows with product and amount columns
- Investment rows with required product/principal/value fields
- Optional quantity/currency/ticker/current price fields
- Aggregate rows after `total`
- One below-minimum finance row
- One explicit small investment row

No real Banksalad export was available, so no personal data or real account values were committed.

Fixture documentation was added at:

- `docs/fixtures/portfolio-parser/README.md`

## Header Alias Verification

Verified alias groups:

| Field | Aliases covered |
| --- | --- |
| Quantity | `수량`, `보유수량`, `qty`, `shares` |
| Currency | `통화`, `currency`, `ccy` |
| Ticker | `티커`, `종목코드`, `symbol`, `ticker` |
| Current price | `현재가`, `평가단가`, `current price`, `price` |
| Value | `평가금액`, `금액`, `market value`, `value` |

## Parser Result Fields Verified

- Existing fields: `valueKRW`, `principalKRW`, `broker`, `assetType`, `productName`, finance `amountKRW`
- Optional fields: `quantity`, `currency`, `ticker`, `currentPrice`, `valueOriginalCurrency`
- Exclusion counters: `excludedSmallCount`, `excludedBelowMinimumCount`
- Summary exclusion: `total` and rows after the investment summary block do not become holdings

Example checked result:

- QQQ quantity: `3`
- QQQ currency: `USD`
- QQQ ticker: `QQQ`
- QQQ current price: `400`
- QQQ original-currency value: `1200`
- QQQ KRW value remains the uploaded `valueKRW`

## Quote Eligibility Verification

The script verifies these functions:

- `getQuoteTickerForHolding`
- `isQuoteEligibleHolding`
- `canRevalueHoldingWithQuote`
- `extractQuoteEligibleHoldings`
- `getUniqueQuoteTickers`

Verified quote-eligible tickers:

- `QQQ`
- `SCHD`
- `TQQQ`
- `QLD`
- `SPY`
- `VOO`

Verified non-eligible rows:

- Cash-like rows
- Deposit/saving rows
- Pension/annuity rows
- Real-estate/unmapped rows
- Korean equity ticker rows
- Crypto/BTC rows

Revaluation rule verified:

- Ticker plus missing quantity: `canRevalueHoldingWithQuote` is `false`
- Quantity `0` or negative: `false`
- Positive quantity plus quote ticker: `true`

## Run Method

```powershell
npm.cmd run check:portfolio-parser
npm.cmd run build
npm.cmd run lint
npm.cmd run typecheck
```

## Current Limits

- The fixture is synthetic because no real Banksalad export sample exists in the repo.
- It verifies parser behavior through workbook objects, not through browser file upload.
- It does not recalculate portfolio totals from live quote prices.
- It does not infer quantity from uploaded value or current quote price.
- It does not change storage schema, Firestore layout, or existing snapshot values.

## If A Real Banksalad Export Arrives

Add a sanitized fixture or a fixture generator case that preserves only structural headers and anonymized numeric examples. Avoid committing account names, personal product names, account numbers, or exact real balances.

Recommended additions:

- Confirm exact Banksalad header spellings for quantity, currency, ticker/code, and current price.
- Add one fixture case with the real sheet name and section spacing.
- Add regression checks for any merged-cell or sparse-row behavior found in the export.

## Recommended Next Steps

1. Collect a sanitized real export to validate exact Banksalad headers and sheet layout.
2. Keep live revaluation disabled until quantity, currency, FX, and quote basis are reliable.
3. Add a proper unit test runner only if more parser formats or broader domain tests accumulate.
