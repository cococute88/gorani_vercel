# DIVIDENDS-2 Classification And Snapshot Preview Fix

Date: 2026-06-13

## 1. Read Files

- `lib/dividend-holdings-from-portfolio.ts`
- `scripts/check-dividend-holdings-groups.mjs`
- `components/dividend/DividendPage.tsx`
- `components/dividend/DividendHoldingsTable.tsx`
- `components/dividend/DividendSummaryCards.tsx`
- `components/dividend/MonthlyDividendChart.tsx`
- `lib/portfolio-types.ts`
- `lib/portfolio-store.ts`
- `lib/portfolio-tags.ts`
- `components/portfolio/PortfolioPage.tsx`
- `components/portfolio/HoldingsTable.tsx`
- `components/portfolio/AssetTable.tsx`
- `components/portfolio/SnapshotHistory.tsx`
- `docs/DIVIDENDS1_SNAPSHOT_HOLDING_GROUPS.md`
- `docs/AUDIT.md`

## 2. Classification Bug Root Cause

DIVIDENDS-1 used structured `symbolGroup` / `accountGroup` for the main classification path. Pension S&P500 products often had no true ticker and could carry tax-advantaged markers in `④statusGroup`, product names, or other fields. Those rows were included too narrowly and, when included, could still display `—` because dividend row building grouped by the raw `holding.ticker`.

## 3. SPY/S&P500 Inference Rules

The dividend grouping helper now extracts a primary `①` marker for known dividend buckets:

- `SCHD`
- `SPY`
- `MSFT`
- `QQQ`
- `QLD`
- `TQQQ`

If no primary marker exists, clear S&P500 product names infer the `SPY` dividend bucket. Recognized forms include `S&P500`, `S&P 500`, Korean strings containing `미국S&P500`, `에스앤피500`, and `스탠더드앤푸어스500`.

Derived dividend rows use the inferred bucket as the displayed ticker before falling back to the raw ticker.

## 4. Tax-Advantaged Marker Rules

Tax-advantaged inclusion now scans all relevant text fields safely, including product/name fields, tags, broker/account-like fields, category/group/memo-like fields, marker fields, and parsed tag values. A positive-value holding is included when any field clearly contains:

- `연금`
- `ISA`
- `연금저축`
- `IRP`
- `퇴직연금`
- `절세`

This covers `②연금`, `②ISA`, `④연금`, `④ISA`, and `④절세`.

## 5. Snapshot Preview Behavior

`/portfolio-manager` snapshot history rows are now clickable. Selecting a row stores only the selected snapshot id in component state and displays that snapshot's holdings/assets in the existing `보유종목 리스트` and `자산 리스트` sections.

The preview is read-only:

- it does not overwrite upload/parse state
- it does not register a new snapshot
- it does not mutate historical data
- it can be cleared with `최신 스냅샷 보기`

The selected history row is visually highlighted.

## 6. Changed Files

- `lib/dividend-holdings-from-portfolio.ts`
- `scripts/check-dividend-holdings-groups.mjs`
- `components/portfolio/PortfolioPage.tsx`
- `components/portfolio/HoldingsTable.tsx`
- `components/portfolio/SnapshotHistory.tsx`
- `docs/DIVIDENDS2_CLASSIFICATION_AND_SNAPSHOT_PREVIEW_FIX.md`
- `docs/AUDIT.md`

## 7. Regression Tests

Extended `check:dividend-holdings` with:

- `①SPY` marker displays `SPY`
- `④연금` alone includes tax-advantaged holdings
- `④ISA` alone includes tax-advantaged holdings
- S&P500 fallback infers `SPY`
- taxable `①QQQ ②위탁` remains excluded
- taxable `①SPY ②위탁` remains included

## 8. Visual Verification

Visual verification should cover `/dividends` and `/portfolio-manager` at desktop and 390px. Confirm no page-level overflow, S&P500 pension-style rows display as `SPY`, tax-advantaged rows include `④연금` / `④ISA`, and history row selection populates holdings/assets without triggering delete.

## 9. Remaining Limitations

- Dividend yield and payment-month data still come from the existing local mapping.
- S&P500 inference is intentionally limited to clear S&P500 product-name patterns.
- Snapshot preview is local UI state only; it does not add schema fields or persistence metadata.

## 10. Next Recommended Step

Add an integration fixture with a realistic portfolio snapshot containing pension S&P500 rows, ISA rows, taxable QQQ, taxable SPY, and CASH_LIKE to verify the full `/dividends` screen against a stable saved snapshot.
