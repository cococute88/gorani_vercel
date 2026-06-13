# DIVIDENDS-1 Snapshot Holding Groups

Date: 2026-06-13

## 1. Read Files

- `components/dividend/DividendPage.tsx`
- `components/dividend/DividendHoldingsTable.tsx`
- `components/dividend/DividendSummaryCards.tsx`
- `components/dividend/MonthlyDividendChart.tsx`
- `lib/mock-dividend-data.ts`
- `lib/portfolio-types.ts`
- `lib/portfolio-store.ts`
- `lib/portfolio-tags.ts`
- `components/asset-map/AssetMapSection.tsx`
- `package.json`
- `docs/AUDIT.md`

## 2. Current Dividend Holdings Problem

The previous `/dividends` holding table fed all current holdings into the mock dividend calculation. It did not align with latest `/portfolio-manager` snapshot categories, mixed taxable and tax-advantaged holdings, and displayed edit/delete buttons that were only visual controls.

## 3. Asset-Map Fake Control Cleanup Result

`자산지도` / `ETF 투시` only changed local tab state and did not switch rendered content. `펼치기` did not control collapsed content. These fake controls were removed. The asset-map section, sector allocation, effective holdings TOP list, and exposure calculation were kept unchanged.

## 4. New Classification Rules

Added `lib/dividend-holdings-from-portfolio.ts` with a pure grouping helper.

Taxable holdings require:

- `valueKRW > 200,000`
- no `소액` / `#소액`
- account marker `②위탁`
- primary marker `①SCHD`, `①SPY`, or `①MSFT`
- ticker is not `CASH_LIKE`

Tax-advantaged holdings require a positive value and an account/category marker containing:

- `연금`
- `ISA`
- `연금저축`
- `IRP`
- `퇴직연금`
- `절세`

## 5. Snapshot Data Source

`/dividends` now uses `latestOf(usePortfolioSnapshots())`, the same local snapshot source used by portfolio-manager-derived views. If no latest snapshot exists, the derived dividend groups are empty instead of pretending mock holdings are snapshot data.

## 6. Filtering Rules

The helper prefers structured `parsedTags`, `symbolGroup`, and `accountGroup`, and falls back to parsing `productName` with `parsePortfolioTags`. Tax-advantaged inclusion also checks account-like structured fields such as `accountName` and `category`.

## 7. Summary Toggle Behavior

The existing `세전 / 세후` toggle is unchanged. A new `위탁만 / 절세합산` toggle controls summary card aggregation only.

- `위탁만`: uses taxable rows only.
- `절세합산`: uses taxable + tax-advantaged rows.

## 8. Chart Checkbox Behavior

The monthly expected dividend chart now has `위탁` and `절세` checkboxes. Default is `위탁` checked and `절세` unchecked. The chart can show taxable-only, tax-advantaged-only, or combined rows. At least one checkbox remains checked.

## 9. Edit/Delete Button Decision

The two holding tables are derived from the latest portfolio snapshot. Edit/delete buttons and the `관리` column were removed from those derived tables. Portfolio-manager editing/import behavior was not changed.

## 10. Regression Tests

Added `scripts/check-dividend-holdings-groups.mjs` and package script:

```json
"check:dividend-holdings": "node scripts/check-dividend-holdings-groups.mjs"
```

The script covers taxable include, taxable exclusions by small amount, `#소액`, and symbol group, tax-advantaged inclusion, and mixed totals.

## 11. Visual Verification

Visual verification should cover `/dividends` and `/portfolio-manager` at desktop, 390px, and 320px. Confirm no page-level horizontal overflow, both dividend tables render, chart controls fit, summary toggles fit, and asset-map still renders without fake controls.

## 12. Remaining Limitations

- Dividend yields and payment months still come from existing mock mapping in `lib/mock-dividend-data.ts`.
- No external dividend API was added.
- If a snapshot lacks reliable account/category markers, the helper does not force tax-advantaged inclusion.
- The target-achievement card still estimates shares from a static mock price map.

## 13. Next Recommended Step

Add a small portfolio snapshot fixture that mirrors the real imported marker format and use it for broader `/dividends` integration checks, including annual dividend outputs for both tax modes.
