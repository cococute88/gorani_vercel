# PORTFOLIO-DATA-1 Real Data Integration

Date: 2026-06-14

## Purpose

`/portfolio` still had sections that could look like real portfolio output while being backed by static/mock/sample data. This step connects the current portfolio dashboard sections to the latest `PortfolioSnapshot` and removes silent mock fallbacks from portfolio summary, allocation charts, account cards, and the treemap.

Scope stayed limited to `/portfolio` display data. No external API, Firebase sync, OAuth, server sync, new dependency, or localStorage clearing was added.

## Pre-Change Mock/Static/Sample Findings

- `app/portfolio/page.tsx`
  - Imported `ACCOUNT_ALLOCATION`, `STOCK_ALLOCATION`, and `TAG_ALLOCATION_DARK` from `lib/mockData.ts` when no live snapshot existed.
  - Rendered `TreemapMock` with `TREEMAP_DATA` and a `SampleBadge`.
  - Displayed a hardcoded no-snapshot timestamp and mock FX line.
  - Still uses static `PIN_TICKERS` from `lib/mockData.ts`; now explicitly labeled `시장 지표 샘플`.
- `components/PortfolioSummary.tsx`
  - Dark mode mixed `usePortfolioView()` with mock-only summary fields such as annual income and SCHD target.
  - Light mode used `PORTFOLIO_SUMMARY` directly.
- `components/AssetAccountCards.tsx`
  - Fell back to `ACCOUNT_CARDS` from `lib/mockData.ts`.
- `components/TreemapMock.tsx`
  - Rendered `TREEMAP_DATA` from `lib/mockData.ts`.
- `lib/portfolio-aggregate.ts`
  - Existing helper used mock summary/card shapes as its fallback model. `/portfolio` no longer routes through it after this step.

## Real-Data Replacements

- Added `lib/portfolio-from-snapshots.ts`.
- `usePortfolioView()` now builds a `PortfolioPageModel` from the latest saved snapshot.
- Summary cards use:
  - `investmentValueKRW` first, then `totalAssetKRW`, then valid holdings sum.
  - `investmentPrincipalKRW` or valid holdings principal sum.
  - return amount and return percent only when inputs are valid.
  - holding count from filtered holdings.
  - account count from the real account grouping result.
- Account allocation and account cards use:
  - `financeAssets.amountKRW` grouped by `accountGroup/accountName/broker/institutionName/groupName/productName` when available.
  - holdings fallback grouped by `accountGroup/accountName/broker/assetType` when finance asset grouping is unavailable.
  - a visible source note when holdings fallback is used.
- Stock allocation and rankings use valid `holdings.valueKRW`.
- Treemap uses holdings only:
  - name: `cleanName` first, then `productName`, then ticker.
  - ticker: existing ticker first, otherwise TICKER-4 mapping may fill empty tickers.
  - value: valid positive `valueKRW`.
  - return percent: calculated from grouped principal when available.
- Asset composition uses:
  - holdings by `assetType`.
  - non-debt finance assets by `category/statusGroup/groupName`.
  - investment finance assets are skipped when holdings exist to reduce double counting.
- Purpose/tag allocation is produced by the helper when `purposeGroup` or `tag` exists, but the current `/portfolio` UI displays the more reliable asset composition chart.

## Schema Limits

These fields cannot be safely derived from the current snapshot schema and are no longer filled with real-looking mock values:

- Annual dividend income.
- Monthly dividend income.
- SCHD goal target/achievement.
- Sector allocation.
- ETF vs individual stock classification beyond explicit existing fields.
- Currency allocation unless future UI chooses to surface `holding.currency`.
- Daily profit and intraday market movement.
- FX trend values.

The code does not infer sectors from product names.

## TICKER-4 Mapping

`buildPortfolioPageFromSnapshot()` calls `applyKrxTickerMappingsToHoldings()` after `filterAggregateHoldings()`.

Policy:

- Empty ticker holdings can receive a saved normalized product-name mapping.
- Existing ticker holdings are not overwritten.
- The original snapshot and holding arrays are not mutated.
- A `ticker_name_map_applied` info warning is included when mappings are applied.

## Empty/Warning Policy

- No snapshot: show empty state and no sample fallback.
- No holdings: omit stock allocation and treemap; show warning.
- Holdings with invalid/missing `valueKRW`: exclude from treemap/ranking and warn.
- No usable account amount fields: show account empty state.
- Missing `financeAssets`: use holdings fallback when possible and show an info warning.
- Missing purpose/tag fields: do not fake tag composition; helper records an info warning.
- Static market ticker strip remains visible only with an explicit sample badge.

## Tests

Added:

- `scripts/check-portfolio-realdata.mjs`
- `npm.cmd run check:portfolio-realdata`

Covered cases:

- snapshot 없음
- holdings 없음
- financeAssets 없음 with holdings fallback
- holdings `valueKRW` treemap
- invalid `valueKRW` exclusion and warning
- financeAssets account graph
- invalid/NaN/null defense
- TICKER-4 mapping applied to empty ticker only
- existing ticker not overwritten
- source snapshot immutability
- latest snapshot selection
- no sample fallback flags

## Changed Files

- `app/portfolio/page.tsx`
- `components/PortfolioSummary.tsx`
- `components/AssetAccountCards.tsx`
- `components/DonutChartCard.tsx`
- `components/PortfolioTreemap.tsx`
- `lib/portfolio-from-snapshots.ts`
- `lib/use-portfolio-view.ts`
- `scripts/check-portfolio-realdata.mjs`
- `package.json`
- `docs/AUDIT.md`
- `docs/PORTFOLIO_DATA1_REALDATA.md`

## Verification Command

```powershell
npm.cmd run check:portfolio-realdata
```

## Remaining Limitations

- The top market ticker strip is still static sample data, now labeled. Replacing it needs a separate market quote integration step.
- `components/TreemapMock.tsx` and portfolio constants in `lib/mockData.ts` remain for historical compatibility/other routes, but `/portfolio` no longer uses them for the portfolio data sections.
- Sector, dividend forecast, SCHD target, and FX trend require additional source data before they can be shown as real.
