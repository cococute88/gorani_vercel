# DIVIDENDS-DATA-2 Quote/Dividend Estimate Connection

Date: 2026-06-14

## Purpose

Connect `/dividends` to the existing quote, dividend, and FX API routes so the page can estimate current price, share quantity, average cost, TTM dividends, annual expected dividend, personal yield, and monthly composition without reintroducing mock dividend yields.

No new external API, dependency, or parser-only recovery was added.

## Current Source Flow

- Route entry: `app/dividends/page.tsx`.
- Client page: `components/dividend/DividendPage.tsx`.
- Snapshot source: `usePortfolioSnapshots()` from `lib/portfolio-store.ts`, with `latestOf()` selecting the latest `PortfolioSnapshot`.
- Holding grouping: `buildDividendHoldingGroupsFromSnapshot()` in `lib/dividend-holdings-from-portfolio.ts`.
- Grouping result:
  - 위탁: strict taxable dividend rows.
  - 절세: pension/ISA/IRP/tax-saving signal rows.
- Table rows: `DividendHoldingRow` from `lib/mock-dividend-data.ts`.
- Table component: `components/dividend/DividendHoldingsTable.tsx`.
- Summary cards: `components/dividend/DividendSummaryCards.tsx`.
- Monthly chart: `components/dividend/MonthlyDividendChart.tsx`.

## Why Parser Aliases Cannot Restore These Fields

The private export header is:

```txt
투자상품종류 / 금융사 / 상품명 / 투자원금 / 평가금액 / 수익률 / 가입일자 / 만기일자
```

Coverage reconfirmed from the previous parser audit:

```txt
holdings: 33
ticker: 31
quantity: 0
averagePrice: 0
currentPrice: 0
currency: 0
accountName: 0
valueOriginalCurrency: 0
canRevalue: 0
```

Because the export does not contain actual quantity, average price, current price, or currency columns, alias expansion cannot recover those values. DIVIDENDS-DATA-2 therefore treats quantity and average cost as estimates.

## Quote/Fx Policy

- Existing browser-callable routes are used:
  - `/api/quote/last`
  - `/api/quote/dividends`
  - `/api/quote/fx`
- `DividendPage` deduplicates tickers before calling the APIs.
- Same ticker in 위탁 and 절세 is requested once.
- API failures are stored as per-ticker warnings and do not break the page.
- Responses with `source: "sample"` are not used for estimates.
- USD rows need USD/KRW from `/api/quote/fx`; if FX is missing or sample, USD quantity/dividend estimates stay unavailable.

## Estimated Quantity Policy

Helper: `estimateQuantityFromValue()` in `lib/dividend-estimates.ts`.

```txt
estimatedQuantity = valueKRW / currentPriceKRW
```

- USD current price is converted with USD/KRW.
- KRX/KRW current price is used directly.
- UI displays `≈` and labels the column `수량(추정)`.
- This is not the actual export quantity.

## Estimated Average Cost Policy

Helper: `estimateAverageCostFromPrincipal()` in `lib/dividend-estimates.ts`.

```txt
avgCostKRW = principalKRW / estimatedQuantity
avgCostUSD = avgCostKRW / USDKRW
```

- Uses `principalKRW` only when present and positive.
- UI displays `≈` and labels the column `평균단가(추정)`.
- This is not the actual average purchase price.

## TTM Dividend Policy

Helper: `getTtmDividendPerShare()` in `lib/dividend-estimates.ts`.

- Uses actual dividend history returned by `/api/quote/dividends`.
- Sums events in the last 365 days from the calculation date.
- No `DIVIDEND_YIELDS`, static yield table, or static payment month schedule is used for `/dividends` estimates.
- If dividend history is missing, sample, or empty, the row shows `배당 데이터 없음`.

## Annual Dividend And Personal Yield

Helper: `buildDividendEstimateForHolding()` in `lib/dividend-estimates.ts`.

```txt
annualDividendKRW = estimatedQuantity * ttmDividendPerShare * currencyConversion
```

If the 세후 toggle is active, annual dividend applies the existing 15.4% dividend tax factor.

Personal yield policy:

1. `principalKRW > 0`: `annualDividendKRW / principalKRW`
2. Otherwise `valueKRW > 0`: `annualDividendKRW / valueKRW`, marked as 평가 기준 in row metadata
3. Otherwise unavailable

## Monthly Chart Policy

- Monthly composition now uses `row.dividendMonths`.
- Each recent dividend event is allocated to its dividend date month.
- The current quote route exposes a single `date` for dividend events; this is treated as dividend event date.
- No static `PAYMENT_MONTHS` schedule is used for `/dividends` monthly composition.
- Rows without usable dividend dates keep the monthly chart empty.

## UI Result

- Top notice says quantity is estimated from holding value and current price.
- Table fills current price, estimated quantity, estimated average cost, personal yield, and expected annual dividend when quote/fx/dividend data are usable.
- Row-level unavailable states remain explicit:
  - `현재가 없음`
  - `환율 없음`
  - `배당 데이터 없음`
- Summary annual/monthly expected dividend cards show estimated values only when at least one row has a real dividend-history-based estimate.
- Target progress uses estimated row quantities instead of mock share prices.

## Tests

Added:

```txt
npm.cmd run check:dividend-estimates
```

Coverage:

- `valueKRW + USD quote + FX` estimates quantity.
- `valueKRW + KRW quote` estimates quantity.
- `principalKRW + estimatedQuantity` estimates average cost.
- TTM dividend history is summed.
- Empty dividend history remains unavailable.
- Quote failure blocks current price and quantity.
- FX sample/failure blocks USD estimates.
- Same ticker dedupe helper.
- Source input is not mutated.
- `DIVIDEND_YIELDS` is not used by the estimate helper.

Existing relevant checks remain:

```txt
npm.cmd run check:dividend-holdings
npm.cmd run check:dividends-data
npm.cmd run check:portfolio-parser
npm.cmd run check:portfolio-parser:private
```

## Remaining Limitations

- Actual share quantity and actual average cost are still unavailable unless future exports include those fields.
- The quote API may still internally return `sample`; `/dividends` ignores those values for estimates.
- Dividend route currently exposes a dividend event `date`, not separate payment date and ex-date fields, so the monthly chart uses that event date.
- KRX dividend history depends on existing quote provider support; no new KRX dividend provider was added.
- `DIVIDEND_YIELDS` and `PAYMENT_MONTHS` still exist for legacy/watchlist helpers, but `/dividends` estimate flow does not use them.
