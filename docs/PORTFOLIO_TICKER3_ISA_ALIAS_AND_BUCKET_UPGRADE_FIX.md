# PORTFOLIO-TICKER-3 ISA Alias And Bucket Upgrade Fix

Date: 2026-06-14

## 1. Read Files

- `lib/korean-etf-registry.ts`
- `lib/holding-ticker-normalizer.ts`
- `lib/dividend-holdings-from-portfolio.ts`
- `lib/asset-map-exposure.ts`
- `lib/ticker-mapper.ts`
- `lib/banksalad-parser.ts`
- `components/portfolio/PortfolioPage.tsx`
- `components/portfolio/HoldingsTable.tsx`
- `scripts/check-korean-etf-registry.mjs`
- `scripts/check-dividend-holdings-groups.mjs`
- `scripts/check-asset-map-exposure.mjs`
- `docs/PORTFOLIO_TICKER2_KOREAN_ETF_REGISTRY_EXPANSION.md`
- `docs/AUDIT.md`

## 2. Root Cause

The registry aliases already included no-space ISA variants, but the normalizer treated any existing non-empty ticker as a manual quote ticker. When parser or earlier inference had written `SPY` or `QQQ` into a Korean-listed ETF row, `/portfolio-manager` preserved that bucket value and never upgraded it to the Korean ETF quote ticker.

## 3. ISA/No-Space Alias Matching Fix

Registry matching continues to normalize whitespace and uppercase English text. For matching only, it can compare after removing leading account prefixes:

- `미래연금`
- `KBISA`
- `ISA`

No issuer/product names such as `ACE`, `RISE`, `KBSTAR`, `TIGER`, `KODEX`, or `SOL` are removed.

The regression suite now explicitly covers:

- `KBISAACE미국S&P500`
- `KBISAACE미국나스닥100`
- `KBISARISE미국나스닥100`
- `ISATIGER미국S&P500`

## 4. Bucket-Ticker Upgrade Rule

When a holding matches a known Korean ETF registry entry and its current ticker is bucket-like (`SPY`, `QQQ`, `SCHD`, `QLD`, `TQQQ`), the normalizer upgrades `quoteTicker` to the registry quote ticker and adds `upgraded_bucket_ticker_to_korean_quote_ticker`.

True KRX/Yahoo tickers are preserved. Six-digit KRX codes that match the registry code are normalized to the `.KS` convention.

Unknown Korean ETF fallback rows with bucket-like tickers do not keep `SPY`/`QQQ` as quote tickers; portfolio-manager cleanup blanks that mistaken ticker.

## 5. Identifier Examples

`KBISAACE미국S&P500` with current ticker `SPY`:

- `quoteTicker = 360200.KS`
- `dividendBucket = SPY`
- `exposureProxy = SPY`

`KBISAACE미국나스닥100` with current ticker `QQQ`:

- `quoteTicker = 367380.KS`
- `dividendBucket = QQQ`
- `exposureProxy = QQQ`

`KBISARISE미국나스닥100` with current ticker `QQQ`:

- `quoteTicker = 368590.KS`
- `dividendBucket = QQQ`
- `exposureProxy = QQQ`

`ISATIGER미국S&P500` with current ticker `SPY`:

- `quoteTicker = 360750.KS`
- `dividendBucket = SPY`
- `exposureProxy = SPY`

## 6. Portfolio-Manager Visual Result

The portfolio-manager normalization path now uses `applyKnownQuoteTickerToHolding` to upgrade known Korean ETF bucket mistakes. Unit regressions confirm the specific rows above become `360200.KS`, `367380.KS`, `368590.KS`, and `360750.KS`.

## 7. Dividends/Asset-Map Regression Result

Dividend logic still reads `dividendBucket`, so Korean S&P500 rows use `SPY` and Korean Nasdaq100 rows use `QQQ`. Asset-map still reads `exposureProxy`, so Korean ETFs decompose through the existing `SPY`/`QQQ` fixtures.

## 8. Tests Added

Extended `scripts/check-korean-etf-registry.mjs` with:

- bucket-ticker upgrade cases for no-space ISA aliases,
- true KRX ticker preservation,
- six-digit KRX normalization to `.KS`,
- unknown Korean ETF with bucket ticker cleanup,
- quote helper rejection for unknown fallback bucket tickers.

## 9. Remaining Limitations

- Only explicitly registered Korean ETF KRX codes are upgraded.
- Unknown Korean ETF rows still get safe bucket/proxy fallback only; quoteTicker remains blank unless a true manual ticker is present.
- Visual fixture injection through Browser was blocked by the local browser security policy, so the exact screenshot rows are covered by regression tests rather than injected into browser storage.

## 10. Next Recommendation

If more rows appear with bucket-like tickers in `/portfolio-manager`, add their Korean ETF identities to the registry only after verifying the actual KRX code, then add a matching bucket-upgrade regression case.
