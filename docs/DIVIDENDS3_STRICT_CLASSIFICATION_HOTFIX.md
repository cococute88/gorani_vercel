# DIVIDENDS-3 Strict Classification Hotfix

Date: 2026-06-13

## 1. Read Files

- `lib/dividend-holdings-from-portfolio.ts`
- `scripts/check-dividend-holdings-groups.mjs`
- `components/dividend/DividendPage.tsx`
- `components/dividend/DividendHoldingsTable.tsx`
- `components/dividend/DividendSummaryCards.tsx`
- `components/dividend/MonthlyDividendChart.tsx`
- `components/portfolio/PortfolioPage.tsx`
- `components/portfolio/SnapshotHistory.tsx`
- `docs/DIVIDENDS2_CLASSIFICATION_AND_SNAPSHOT_PREVIEW_FIX.md`
- `docs/AUDIT.md`

## 2. Root Cause

The taxable check accepted holdings when `②` account text merely contained `위탁`, and it did not block rows with pension/ISA/tax-advantaged signals elsewhere in the row. As a result, products such as `미래연금RISE미국S&P500 ①SPY ②위탁 ...` could leak into `보유 배당(위탁)`.

## 3. Strict Taxable Rules

Taxable holdings now require every condition:

- `valueKRW > 200,000`
- no `소액` / `#소액`
- primary `①` bucket is `SCHD`, `SPY`, or `MSFT`
- `②` marker is exactly `위탁`
- no tax-advantaged signal anywhere in searchable text
- not `CASH_LIKE`

Internal classification separates `primaryBucket`, `accountMarker2`, `taxAdvantagedSignal`, `taxableEligibility`, `taxAdvantagedEligibility`, `displayTicker`, and reason fields.

## 4. Broad Tax-Advantaged Rules

Tax-advantaged holdings now require only:

- `valueKRW > 0`
- any searchable text contains `미래연금`, `연금`, `ISA`, `IRP`, `퇴직연금`, `연금저축`, or `절세`

The 200,000 KRW threshold and dividend bucket restrictions are not applied to `보유 배당(절세)`.

## 5. SPY/S&P500 Display Fallback

Display ticker is derived from the primary `①` bucket first. If no `①` bucket exists and the product name clearly contains S&P500 variants, display ticker falls back to `SPY`. Otherwise display ticker is `—`; missing ticker does not exclude a tax-advantaged row.

## 6. Tests Added

Extended `scripts/check-dividend-holdings-groups.mjs` with strict cases for:

- strict taxable include
- QQQ taxable exclusion
- pension/tax signal exclusion from taxable even with `②위탁`
- `②연금` tax-advantaged inclusion
- `④ISA` tax-advantaged inclusion
- S&P500 fallback to `SPY`
- 200,000 KRW taxable exclusion
- `#소액` taxable exclusion
- pension MMF/cash-like inclusion in tax-advantaged
- strict mixed totals

## 7. Visual Verification

Visual verification should confirm `/dividends` uses only strict taxable rows for `보유 배당(위탁)` and includes all pension/ISA rows in `보유 배당(절세)`, with title totals, summary mode, and chart checkboxes using the same filtered groups.

## 8. Remaining Limitations

- Dividend yield and payment-month data still come from existing local mappings.
- `미래연금` is intentionally treated as tax-advantaged; `미래에셋증권` alone is not.
- Rows without a safe bucket display `—`, though they may still be included in the tax-advantaged table.

## 9. Next Recommended Step

Add a stable UI integration fixture or scripted browser test that seeds a realistic snapshot and verifies visible taxable/tax-advantaged table rows and totals end to end.
