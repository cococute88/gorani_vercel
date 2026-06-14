# DIVIDENDS-DATA-1 Holdings Alias And Dividend Data Policy

Date: 2026-06-14

## Purpose

Strengthen `/dividends` so it is honest about what can be derived from real `PortfolioSnapshot.holdings` data, while improving parser recognition for quantity, average price, current price, market value, principal, currency, account, and ticker/code headers.

No external API, Firebase/OAuth flow, server sync, or new dependency was added.

## Current `/dividends` Data Source

- Page entry: `app/dividends/page.tsx`.
- Main route component: `components/dividend/DividendPage.tsx`.
- Snapshot source: `usePortfolioSnapshots()` from `lib/portfolio-store.ts`, latest snapshot by `latestOf()`.
- Holding classification: `lib/dividend-holdings-from-portfolio.ts`.
- Table row formatting and monthly composition helpers still live in `lib/mock-dividend-data.ts`, but dividend holding rows no longer use `DIVIDEND_YIELDS` to create real-looking expected dividends.

## Mock/Static/Sample Findings

- `lib/mock-dividend-data.ts`
  - `DIVIDEND_YIELDS` and `PAYMENT_MONTHS` remain static helper data for legacy/watchlist-style helpers.
  - `/dividends` holding rows now set dividend data as `unavailable` instead of using `DIVIDEND_YIELDS`.
  - `DIVIDEND_PERFORMANCE_SERIES` remains a sample performance series.
- `components/dividend/DividendPerformanceSection.tsx`
  - Now displays a visible `샘플 데이터` badge.
- `components/dividend/DividendPage.tsx`
  - Removed `MOCK_SHARE_PRICE_KRW` from target progress. Target progress now uses real parsed `holding.quantity` only.

## Actually Replaceable From Holdings

The following can be displayed from snapshot holdings when parser/source data provides it:

- `ticker`
- `productName`
- `cleanName`
- `quantity`
- `averagePrice`
- `currentPrice`
- `valueKRW`
- `principalKRW`
- `currency`
- `accountName`
- `accountGroup`
- `broker`
- `assetType`
- `tag`
- `purposeGroup`

## Not Replaceable From Current Schema/Data Alone

- Dividend yield.
- Per-share dividend amount.
- Dividend payment months.
- Annual/monthly expected dividend.
- Target share progress when `quantity` is absent.

These are now unavailable instead of being filled with mock values.

## Parser Alias Expansion

`lib/banksalad-parser.ts` now uses priority-based header matching with exclude guards so broad aliases such as `price`, `value`, and `amount` do not steal average-price, cost-basis, or return-rate columns.

Expanded areas:

- Quantity: `수량`, `보유수량`, `잔고수량`, `보유 주수`, `보유주수`, `주수`, `quantity`, `qty`, `shares`, `share quantity`, `holding quantity`.
- Average price: `평균단가`, `평균매입가`, `매입평균가`, `평단`, `매입단가`, `취득단가`, `평균취득가`, `average price`, `avg price`, `average cost`, `avg cost`.
- Current price: `현재가`, `현재가격`, `시장가`, `현재단가`, `평가단가`, `current price`, `market price`, `last price`, `price`.
- Market value: `평가금액`, `잔고평가금액`, `평가액`, `평가 총액`, `market value`, `valuation`, `current value`, `value`, with guarded fallback to `금액`/`amount`.
- Principal/cost: `투자원금`, `매입금액`, `매수금액`, `취득금액`, `원금`, `principal`, `cost basis`, `purchase amount`, `book cost`.
- Currency: `통화`, `거래통화`, `결제통화`, `화폐`, `currency`, `ccy`.
- Account: `계좌명`, `계좌구분`, `계좌 유형`, `account name`, `account type`, `account`.
- Ticker/code: `티커`, `종목코드`, `주식코드`, `단축코드`, `symbol`, `ticker`.

`Holding.averagePrice` was added to the shared type and is populated by the parser when a real average-price column exists.

## TICKER-4 Mapping

`/dividends` now runs holdings through `normalizeDividendHoldingInput()`, which applies `applyKrxTickerMappingsToHoldings()` at display/calculation time.

Policy:

- Existing `holding.ticker` wins.
- Empty ticker can be filled from normalized product-name mapping.
- Source holdings are not mutated.
- KRX quote tickers are warned as potentially unsupported for dividend quote data.
- No mock dividend amount is inserted for mapped KRX tickers.

## Field Coverage Result

Private parser check:

```txt
holdings: 33
financeAssets: 50
ticker: 31 / 33
quantity: 0 / 33
averagePrice: 0 / 33
currentPrice: 0 / 33
currency: 0 / 33
accountName: 0 / 33
valueOriginalCurrency: 0 / 33
quoteEligible: 31
canRevalue: 0
```

The private workbook header still contains only:

```txt
투자상품종류 / 금융사 / 상품명 / 투자원금 / 평가금액 / 수익률 / 가입일자 / 만기일자
```

So quantity, average price, current price, currency, and account name cannot be recovered without source columns. No reverse calculation was added.

## Unavailable Policy

- Missing quantity displays `—`; target progress displays `수량 정보 없음`.
- Missing average price/current price displays `—`.
- Missing dividend data displays `데이터 없음` / `배당 데이터 없음`.
- Monthly dividend chart shows an empty state when no real dividend rows are available.
- Summary cards show `데이터 없음` for annual/monthly expected dividends.
- Mock yields are not used for `/dividends` holding expected dividends.

## Tests

Run:

```txt
npm.cmd run check:dividend-holdings
npm.cmd run check:dividends-data
npm.cmd run check:portfolio-parser
npm.cmd run check:portfolio-parser:private
npm.cmd run check:krx-ticker-name-map
npm.cmd run lint
npm.cmd run typecheck
```

Coverage added:

- TICKER-4 mapping applies only to empty tickers.
- Existing ticker is not overwritten.
- Source holdings are not mutated.
- `quantity`, `averagePrice`, `currentPrice`, `valueKRW`, `principalKRW`, `currency`, `accountName`, and ticker aliases parse in generated fixtures.
- Malformed quantity/current-price values stay unavailable.
- Dividend unavailable state does not use mock expected dividends.
- Coverage helper counts relevant fields.

## Remaining Limitations

- `/dividends` still does not fetch or cache real dividend history in this step.
- `DIVIDEND_PERFORMANCE_SERIES` remains sample and is now labeled.
- The private Banksalad export has no quantity/average/current-price source columns.
- KRX dividend support depends on existing quote/dividend provider behavior and was not expanded here.
- `PAYMENT_MONTHS` and `DIVIDEND_YIELDS` still exist for other legacy helpers and should be split or retired in a later dividend data step.
