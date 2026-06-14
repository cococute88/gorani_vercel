# PERF-DATA-2 QLD Dashboard Real Data

Date: 2026-06-14

## Purpose

Replace the lower `/performance` QLD/sample dashboard area with data derived from saved `PortfolioSnapshot[]` history and latest snapshot holdings.

PERF-DATA-1 already connected the upper KPI cards and main chart to snapshot history. This step only changes the lower evaluation amount, FX, and holdings ranking area.

## Previous Mock/Sample Sources

- `lib/qldDashboardData.ts`
  - `QLD_SUMMARY`: static total value, day change, high/low, MDD, current/high-low ratios.
  - `QLD_HOLDINGS`: static QLD-style holdings composition.
  - `QLD_VALUE_FX_SERIES`: deterministic static value and USD/KRW FX series.
  - `QLD_CHART_ANNOTATIONS`: static chart annotation indexes.
  - `QLD_PERIOD_BUTTONS`: static period labels.
  - `QLD_RANK_ROWS`: static Top 8 rank rows including average price, day profit, cumulative profit.

The remaining QLD-only components for account and monthly dividend charts still use `qldDashboardData.ts` outside the `/performance` lower area.

## Real Data Mapping

- Latest evaluation amount:
  - Primary: latest snapshot `investmentValueKRW`.
  - Fallback: latest snapshot `totalAssetKRW`, visibly noted as a fallback source.
  - Invalid, zero, missing, or NaN values render as `—`.
- Principal:
  - Latest snapshot `investmentPrincipalKRW`.
- Profit:
  - `evaluationKRW - principalKRW` only when both values are valid.
- Return percent:
  - `profitKRW / principalKRW * 100` only when principal is valid and positive.
- Value trend:
  - Sorted valid snapshot dates.
  - Each point uses `investmentValueKRW`, then `totalAssetKRW` fallback.
  - High, low, previous-snapshot change, current/high, current/low, and snapshot-based MDD are derived from the valid value series.
- Ranking rows:
  - Latest snapshot `holdings`.
  - Aggregate rows are filtered via `filterAggregateHoldings`.
  - Holdings are grouped by ticker when available, otherwise by product/clean name.
  - Value ranking uses valid positive `holding.valueKRW`.
  - Profit and return use grouped `valueKRW` and grouped positive `principalKRW`.

## Schema Limits

Cannot be replaced with real data under the current schema:

- FX history and latest FX rate.
- Intraday/day-change values.
- Day profit and day profit rate.
- True average purchase price in original currency.
- Dividend series or cumulative dividend values.
- Exact money-weighted or time-weighted CAGR.

The UI now states that FX history is unavailable instead of drawing the former sample FX line.

## Warning And Empty State Policy

- No snapshots: show empty evaluation/chart/ranking states and no sample fallback.
- No latest valid evaluation: render `—` and show an evaluation warning badge.
- No holdings: show holdings/ranking empty state.
- Holdings without valid value: disable value ranking and show empty state.
- Holdings without valid principal: keep value ranking but show `—` for profit/return and warn that profit ranking is unavailable.
- Sample fallback is not used and is exposed in the helper as `usesSampleData: false` and `sampleFallbackUsed: false`.

## Implementation

- Added pure helper:
  - `lib/performance-qld-from-snapshots.ts`
  - `buildPerformanceQldFromSnapshots()`
- Updated `/performance` lower area to pass helper output into:
  - `QldAssetSummaryCard`
  - `QldValueFxChart`
  - `QldHoldingsRankTable`
- Converted those three components away from direct `qldDashboardData.ts` imports for the `/performance` lower area.

## Regression Test

Added:

```bash
npm run check:performance-qld-snapshots
```

Covered cases:

- Snapshot 없음.
- Snapshot 1개.
- Snapshot 2개 이상 날짜 정렬.
- Holdings 없음.
- Holdings는 있으나 평가금액 계산 불가.
- 평가금액 랭킹 가능.
- 손익/수익률 랭킹 불가능 warning.
- Invalid number, NaN, null 방어.
- Sample fallback이 실데이터로 오인되지 않음.

## Remaining Limitations

- FX cannot be shown until snapshot or market-history schema stores trustworthy FX values.
- Day profit/rate cannot be shown without previous-close or intraday quote history.
- Current average-cost display is intentionally removed from the ranking table because `Holding` does not store original purchase price reliably.
- Account-level QLD dashboard and monthly dividend QLD components still use static sample data outside this step.
