# ASSETMAP-2 Real Portfolio Exposure

Date: 2026-06-13

## 1. Read files

- `components/asset-map/AssetMapSection.tsx`
- `components/HoldingsTable.tsx`
- `components/portfolio/PortfolioPage.tsx`
- `components/DonutChartCard.tsx`
- `lib/mockData.ts`
- `lib/mock-portfolio-data.ts`
- `lib/portfolio-store.ts`
- `lib/portfolio-types.ts`
- `lib/format.ts`
- `package.json`
- `docs/AUDIT.md`

## 2. Added fixture/helper files

- `lib/asset-map-etf-constituents.ts`
  - Versioned local deterministic ETF top-holdings fixture.
- `lib/asset-map-sector-map.ts`
  - Local ticker-to-sector/name map for direct holdings and safe Korean name aliases.
- `lib/asset-map-exposure.ts`
  - Pure calculation helper for ticker normalization, ETF look-through, direct holdings, sector aggregation, top holdings, and warnings.
- `scripts/check-asset-map-exposure.mjs`
  - Lightweight regression script, exposed as `npm run check:asset-map`.

## 3. ETF constituent coverage

Initial covered ETF tickers:

- `QQQ`
- `QLD` using `QQQ` as `underlyingProxy`
- `TQQQ` using `QQQ` as `underlyingProxy`
- `SPY`
- `VOO` using the same S&P 500 fixture as `SPY`
- `SCHD`

Important limitation: these fixtures contain deterministic top holdings, not full ETF holdings. For leveraged ETFs (`QLD`, `TQQQ`), the default asset-map exposure is based on the position market value and is not multiplied by 2x/3x.

## 4. Direct stock sector mapping

The direct sector map includes common current/sample tickers:

- `MSFT`, `AAPL`, `GOOGL`, `GOOG`, `NVDA`, `TSLA`, `NFLX`
- `AMZN`, `META`, `AVGO`, `COST`
- `JEPI`, `SCHD`, `QQQ`, `SPY`, `VOO`, `QLD`, `TQQQ`
- `005930.KS`, `000660.KS`

Unknown direct holdings are kept with sector `기타`.

## 5. Ticker normalization rules

Rules implemented in `normalizeAssetMapTicker(...)`:

- Prefer explicit `holding.ticker`.
- Remove leading symbols such as `①`, whitespace, and `#`.
- Preserve Korean stock codes already formatted as `.KS`.
- If ticker is missing, inspect the holding name for known tickers.
- Safely map known Korean names:
  - `삼성전자` -> `005930.KS`
  - `SK하이닉스` -> `000660.KS`
- Do not invent a ticker when no safe match exists.

## 6. Calculation rules

Input flow:

```txt
latest portfolio-manager snapshot holdings
-> normalize ticker
-> direct holdings included directly
-> covered ETFs decomposed into fixture constituents
-> effective holdings aggregated by ticker
-> sector allocation aggregated from effective holdings
```

Direct holdings:

- `effective amountKRW = holding.valueKRW`
- sector = sector map entry or `기타`

Covered ETFs:

- `constituent amountKRW = ETF valueKRW * constituent.weightPct / 100`
- `QLD` and `TQQQ` use QQQ constituents without leverage multiplication.

Uncovered ETFs:

- excluded from analyzed effective holdings
- added to `uncoveredEtfValueKRW`
- warning emitted

Overlap:

- If the same ticker appears directly and inside ETFs, amounts are summed into one effective holding.
- `sources` includes `direct` and ETF ticker names.

Sector denominator:

- `sector weightPct = sector amountKRW / analyzedValueKRW * 100`
- `analyzedValueKRW` is the sum of effective direct holdings plus looked-through fixture constituent amounts.

ETF coverage:

- `coveragePct` uses looked-through ETF constituent amount divided by total ETF market value.
- This intentionally avoids showing 100% when the fixture only contains top holdings.
- If there are no ETF holdings, ETF coverage is `0%` because the section is ETF-look-through focused.

## 7. UI integration behavior

`AssetMapSection` still renders at the bottom of `/portfolio-manager`.

When a latest snapshot has analyzable holdings:

- `섹터 비중` receives portfolio-derived sector allocation.
- `실질 보유 TOP 100` receives portfolio-derived effective holdings.
- Snapshot date and holding count remain visible.
- The existing ETF coverage/status strip is reused.
- Warnings are appended to the existing amber status box.

`components/HoldingsTable.tsx` now accepts optional `holdings` and `sectorFilters` props, but defaults to existing mock data for compatibility.

## 8. Fallback behavior

Fallback mock data remains when:

- no saved snapshot exists
- snapshot holdings are empty
- holdings exist but no valid ticker/value can be analyzed
- holdings contain only uncovered ETFs with no direct analyzable holdings

Fallback message:

```txt
저장된 스냅샷이 없어 목업 데이터로 표시합니다.
```

For a snapshot with holdings but no analyzable exposure, the message identifies that a snapshot was detected and that mock data is being shown.

## 9. Regression tests

Added `npm run check:asset-map` with cases:

- direct stock only
- covered ETF
- direct + ETF overlap
- uncovered ETF
- ticker extraction for `①QQQ`, `①SPY`, `①TQQQ`, Korean stock names, and explicit circled tickers

## 10. Remaining limitations

- ETF fixtures are manually maintained and partial.
- No external ETF holdings API or scraper is used.
- No region/country, style/size, overlap analysis, or leverage-adjusted toggle is implemented.
- Sector mapping is intentionally small; unknown direct holdings fall into `기타`.
- UI still uses the existing compact table columns, so `sources` and `amountKRW` are calculated but not displayed in a new column.

## 11. Next recommended step

Expand the ETF fixture in a versioned way and add a small coverage note or tooltip that distinguishes ticker coverage from constituent-weight coverage before adding any new analysis views.
