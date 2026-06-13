# PORTFOLIO-TICKER-1 Korean ETF Registry

Date: 2026-06-14

## 1. Read Files

- `lib/portfolio-tags.ts`
- `lib/portfolio-types.ts`
- `lib/portfolio-store.ts`
- `lib/portfolio-aggregate.ts`
- `lib/dividend-holdings-from-portfolio.ts`
- `lib/asset-map-exposure.ts`
- `lib/asset-map-etf-constituents.ts`
- `lib/ticker-mapper.ts`
- `lib/banksalad-parser.ts`
- `components/portfolio/HoldingsTable.tsx`
- `components/portfolio/PortfolioPage.tsx`
- `components/dividend/DividendPage.tsx`
- `components/dividend/DividendHoldingsTable.tsx`
- `components/asset-map/AssetMapSection.tsx`
- `scripts/check-dividend-holdings-groups.mjs`
- `scripts/check-asset-map-exposure.mjs`
- `scripts/check-portfolio-parser.mjs`
- `docs/AUDIT.md`

## 2. Root Cause

The app had one overloaded `ticker` value. In practice, it was used as:

- the real quote lookup ticker,
- the dividend calculation bucket,
- and the asset-map ETF look-through key.

That made Korean-listed ETFs unsafe: a Korean product such as `ACE미국S&P500` needs `360200.KS` for quote lookup, but `SPY` for dividend bucket and asset-map exposure proxy.

## 3. Identifier Separation

- `quoteTicker`: real market quote lookup ticker, for example `MSFT`, `QQQ`, `360200.KS`.
- `dividendBucket`: dividend yield/month bucket, for example `SPY`, `QQQ`, `SCHD`.
- `exposureProxy`: ETF look-through proxy, for example `SPY`, `QQQ`, `SCHD`.

The portfolio manager ticker input is allowed to show `quoteTicker` when known. Dividend and asset-map calculations should not treat that quote ticker as the bucket/proxy.

## 4. Korean ETF Registry Design

Added `lib/korean-etf-registry.ts` with:

- `KoreanEtfMapping`
- `KoreanEtfMatch`
- `findKoreanEtfMapping(text)`
- `inferKoreanEtfFallbackBucket(text)`

Added `lib/holding-ticker-normalizer.ts` with `NormalizedHoldingTickerInfo` and helpers that preserve manual ticker values while still deriving bucket/proxy data.

## 5. Initial Mappings

Initial verified mapping:

- Display name: `ACE 미국S&P500`
- KRX code: `360200`
- Quote ticker: `360200.KS`
- Dividend bucket: `SPY`
- Exposure proxy: `SPY`
- Aliases include `ACE미국S&P500`, spaced ACE variants, and `KINDEX미국S&P500` variants.

## 6. Fallback Rules

Fallback bucket/proxy inference is allowed only when the KRX code is unknown:

- `미국S&P500`, `S&P500`, `SNP500`, `에스앤피500`, `에센피500`, `스탠더드앤푸어스500` -> `SPY`
- `미국나스닥100`, `나스닥100`, `NASDAQ100` -> `QQQ`

Fallbacks set `dividendBucket` and `exposureProxy`, but leave `quoteTicker` undefined and add `missing_krx_code_mapping`.

## 7. Portfolio Manager Behavior

`/portfolio-manager` now applies the known quote ticker only when the existing holding ticker is blank. Manual ticker values are preserved. Exact `ACE미국S&P500` / `KINDEX미국S&P500` style rows can display `360200.KS`; unknown Korean S&P500/Nasdaq100 ETFs do not get `SPY` written into the quote ticker field.

## 8. Dividends Behavior

`/dividends` uses `dividendBucket` for dividend yield/month logic. Korean S&P500 rows use `SPY`; Korean Nasdaq100 rows use `QQQ` when a safe fallback is available.

Visible dividend holding rows are preserved per original holding instead of being aggregated by bucket. KRW/MMF/cash-like rows are excluded from dividend holdings.

## 9. Asset Map Behavior

Asset-map ticker normalization checks `exposureProxy` before using the raw quote ticker. Therefore `360200.KS` with an ACE S&P500 product name decomposes through the `SPY` fixture, and Korean Nasdaq100 fallback products decompose through `QQQ`.

## 10. Regression Tests

Added:

- `scripts/check-korean-etf-registry.mjs`
- `npm.cmd run check:korean-etf`

Extended:

- `scripts/check-dividend-holdings-groups.mjs`
- `scripts/check-asset-map-exposure.mjs`
- `scripts/check-portfolio-parser.mjs`

Covered cases include ACE exact mapping, KINDEX alias, S&P500 fallback without KRX code, Nasdaq100 fallback, 미래에셋증권 vs 미래연금 distinction, manual ticker preservation, portfolio-manager fill behavior, dividend row preservation, cash-like exclusion, and asset-map look-through.

## 11. Remaining Limitations

- Only one verified KRX mapping is registered: `ACE 미국S&P500` / `360200.KS`.
- Unknown Korean ETF KRX codes are intentionally not inferred.
- Fallback bucket/proxy rules are heuristic and limited to S&P500 and Nasdaq100 naming.
- Existing snapshots are not schema-migrated; normalization is derived at read/use time or applied when parsing/loading into the portfolio manager.

## 12. Next Recommendation

Add more KRX mappings only from verified sources, keeping each mapping explicit in the registry and adding one regression case per new Korean ETF family.
