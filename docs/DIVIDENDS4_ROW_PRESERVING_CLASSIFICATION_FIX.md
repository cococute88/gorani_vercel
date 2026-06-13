# DIVIDENDS-4 Row-Preserving Classification Fix

Date: 2026-06-14

## 1. Read Files

- `lib/korean-etf-registry.ts`
- `lib/holding-ticker-normalizer.ts`
- `lib/dividend-holdings-from-portfolio.ts`
- `lib/asset-map-exposure.ts`
- `lib/ticker-mapper.ts`
- `scripts/check-korean-etf-registry.mjs`
- `scripts/check-dividend-holdings-groups.mjs`
- `components/dividend/DividendPage.tsx`
- `components/dividend/DividendHoldingsTable.tsx`
- `components/dividend/MonthlyDividendChart.tsx`
- `docs/AUDIT.md`

## 2. Root Cause

The dividend helper mixed taxable-only exclusions with common row exclusions, and it did not expose consistent debug reasons for excluded rows. It also allowed cash-like and unknown-bucket rows to reach some paths while `/dividends` needed a stricter row-preserving snapshot view.

## 3. Final Taxable Rules

Taxable holdings must pass common exclusions, use a `SCHD`, `SPY`, or `MSFT` dividend bucket, have marker `②위탁`, and have no tax-advantaged signal anywhere in searchable holding text.

## 4. Final Tax-Advantaged Rules

Tax-advantaged holdings must pass common exclusions and contain a tax-advantaged signal such as `연금`, `미래연금`, `ISA`, `IRP`, `퇴직연금`, `연금저축`, or `절세`. They are not restricted to `SCHD`, `SPY`, or `MSFT`, so eligible `QQQ` ISA/pension rows are included.

## 5. Row-Preserving Decision

The helper keeps one output table row per original portfolio holding. It does not group visible table rows by ticker or bucket. Multiple original SPY-category rows remain multiple visible SPY rows.

## 6. Cash-Like Exclusion

Rows marked by the Korean ETF normalizer as cash-like, marker/bucket cash values, or cash/MMF/CMA-style text are excluded from both dividend tables. English `USD`, `KRW`, and `CASH` are treated as cash-like only when they appear as tokens, avoiding false matches such as `US Dividend`.

## 7. Ticker/Bucket Inference Priority

Dividend display/calculation uses:

1. `normalizeHoldingTickerInfo(...).dividendBucket`
2. explicit marker `①`
3. product-name fallback for S&P500, Nasdaq100, SCHD, and MSFT
4. exclusion with `unknown_bucket`

`quoteTicker` is not used as the dividend bucket.

## 8. Korean ETF Normalizer Integration

Korean ETF quote tickers such as `360200.KS` and `367380.KS` remain quote tickers. `/dividends` uses their normalized `dividendBucket`, for example `SPY` or `QQQ`, while preserving the original holding row.

## 9. Tests Added

`scripts/check-dividend-holdings-groups.mjs` now covers:

- row-preserving taxable SPY rows,
- QQQ/QLD/TQQQ taxable exclusion,
- pension SPY taxable exclusion and tax-advantaged inclusion,
- ISA QQQ tax-advantaged inclusion,
- KRW/MMF cash-like exclusion,
- `<= 200,000` exclusion for both tables,
- Korean ETF quoteTicker plus dividendBucket behavior,
- totals matching visible rows.

## 10. Visual Verification

The visual check confirmed `/dividends` and `/portfolio-manager` render without page-level horizontal overflow. The current local browser storage did not contain the user's exact snapshot rows, so exact row examples are covered by regression tests.

## 11. Remaining Limitations

Unknown products without a safe dividend bucket are excluded rather than guessed. The helper reports debug warnings but the UI does not currently surface those dividend-classification warnings.

## 12. Next Recommended Step

When the next real snapshot is available, add any newly observed product names to a fixture-style regression so classification stays anchored to the actual imported rows.
