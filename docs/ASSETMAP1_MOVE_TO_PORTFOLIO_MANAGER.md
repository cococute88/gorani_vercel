# ASSETMAP-1 Move Asset Map To Portfolio Manager

Date: 2026-06-13

## 1. Read Files

- `components/market/AssetMapSection.tsx` (moved to `components/asset-map/AssetMapSection.tsx`)
- `components/market/MarketPage.tsx`
- `components/portfolio/PortfolioPage.tsx`
- `components/HoldingsTable.tsx`
- `components/DonutChartCard.tsx`
- `app/portfolio-manager/page.tsx`
- `app/asset-map/page.tsx`
- `lib/mockData.ts`
- `lib/portfolio-store.ts`
- `lib/portfolio-types.ts`
- `lib/portfolio-aggregate.ts`
- `lib/portfolio-summary-row.ts`
- `lib/mock-portfolio-data.ts`
- `components/portfolio/HoldingsTable.tsx`
- `components/market/MarketTemperatureSection.tsx`
- `package.json`

## 2. Current Asset-Map Component/Data Source

- Renderer before this step: `components/market/AssetMapSection.tsx`, imported by `components/market/MarketPage.tsx`.
- Renderer after this step: `components/asset-map/AssetMapSection.tsx`, imported by `components/portfolio/PortfolioPage.tsx`.
- Chart data source: `SECTOR_ALLOCATION` from `lib/mockData.ts`.
- TOP 100 table source: `TOP_HOLDINGS` and `SECTOR_FILTERS` from `lib/mockData.ts`, rendered by `components/HoldingsTable.tsx`.
- Header values before this step: hardcoded `보유 ETF 35개 · 커버리지 91%`.
- Mock-only status: yes. The current chart and TOP 100 rows are not derived from user portfolio holdings.

## 3. Portfolio-Manager Data Shape

- Storage: `lib/portfolio-store.ts`.
- Persistence: localStorage key from `STORAGE_KEYS.portfolioSnapshots`; Firestore load/save is conditionally used by `components/portfolio/PortfolioPage.tsx` when a Firebase user exists.
- React source: `usePortfolioSnapshots()`.
- Latest snapshot helper: `latestOf(snapshots)`.
- Holdings shape: `lib/portfolio-types.ts` `Holding`.
- Holding fields include ticker (`ticker?`), quantity (`quantity?`), market value KRW (`valueKRW`), principal KRW (`principalKRW`), asset type (`assetType`), broker/account fields (`broker`, `accountName?`, tag groups), currency/current price fields, and ticker confidence.
- ETF-vs-stock classification: no reliable normalized field exists. `assetType` can say things like domestic/overseas stock or fund, but it is not a constituent-ready ETF classifier.
- Current value can be derived from `valueKRW`; total investment value is the sum of filtered holdings.

## 4. Move Result

- Removed `AssetMapSection` from `/market`.
- Added `AssetMapSection` to the bottom of `/portfolio-manager`, after the existing portfolio management content and performance chart.
- Updated `/asset-map` redirect from `/market` to `/portfolio-manager` so the preserved asset-map entry point lands on the new owner page.
- Updated one stale market-temperature helper sentence that referred to a following asset map.

## 5. ETF Constituent Dataset Availability

- No ETF constituent/look-through dataset was found in `app/`, `components/`, or `lib/`.
- The existing `SECTOR_ALLOCATION` and `TOP_HOLDINGS` arrays are static mock outputs, not a reusable ETF constituent table.
- No source was found that maps a portfolio ETF ticker to underlying constituents and constituent weights.

## 6. Connection Feasibility Classification

Classification: D. Need user decision or new dataset.

Reason:

- Portfolio holdings are available and include tickers/value KRW.
- A reliable ETF/stock classifier is not available.
- ETF constituent weights are not available.
- Sector classifications for portfolio holdings are not available.
- Therefore a real look-through calculation would require new data rather than a safe adapter over existing data.

## 7. Implemented Adapter/Changes

- The moved `AssetMapSection` now subscribes to `usePortfolioSnapshots()`.
- It detects whether a latest portfolio snapshot with holdings exists.
- It does not use those holdings to calculate exposure because the ETF constituent dataset is missing.
- The UI now shows a small explicit status message:
  - no snapshot: `저장된 스냅샷이 없어 목업 데이터로 표시합니다.`
  - snapshot exists: latest snapshot date and holding count are detected, but mock ETF look-through remains because constituent data is missing.

## 8. Calculation Rules

Not implemented in this step.

Required future rules remain:

- portfolio holding weight = holding value / total portfolio value
- ETF constituent effective weight = ETF portfolio weight * constituent weight inside ETF
- direct stock effective weight = direct holding weight
- sector weight = sum effective weights by sector
- coverage ratio = covered ETF value / total ETF value

## 9. Fallback Behavior

- With no saved portfolio snapshot, the section clearly states that mock data is displayed.
- With a saved snapshot, the section confirms the snapshot connection but keeps the existing mock ETF look-through chart/table until constituent data exists.
- Existing dark card/chart/table layout is preserved.

## 10. Remaining Blockers

- Need an ETF constituent dataset keyed by ticker, with constituent ticker/name/sector/weight.
- Need a conservative ETF-vs-direct-stock classifier or explicit portfolio holding classification.
- Need sector mapping for direct stock holdings.
- Need a calculation helper that can aggregate covered ETFs, uncovered ETFs, direct holdings, sector weights, and TOP 100 effective holdings.

## 11. Verification Results

Commands:

- `npm.cmd run check:tax-saving` - passed.
- `npm.cmd run build` - passed. The running dev server was stopped before this command.
- `npm.cmd run lint` - passed.
- `npm.cmd run typecheck` - passed.
- `npm.cmd run check:calendar-provider` - passed.
- `npm.cmd run check:portfolio-parser` - passed.
- `npm.cmd run check:portfolio-parser:private` - passed.

Visual/browser check:

- Dev server restarted with `npm.cmd run dev`.
- `/market` checked at desktop, 390px, and 320px.
  - Asset-map section no longer appears.
  - Market page still contains top briefing, RSI, MDD, VIX, market temperature reference sheet, and sector treemap.
  - No page-level horizontal overflow detected.
- `/portfolio-manager` checked at desktop, 390px, and 320px.
  - Asset-map section appears after the existing portfolio-manager content.
  - Dark theme remains intact.
  - No page-level horizontal overflow detected.
  - Existing upload/edit/snapshot UI remains present before the moved section.
  - Mock/portfolio-detected fallback status is visible.

## 12. Next Recommended Step

Add a small, versioned ETF look-through data module and a pure calculation helper with fixtures. Once that exists, wire `AssetMapSection` to calculated portfolio exposures and keep mock data only as the no-snapshot fallback.

## 13. Future Separate `/performance` Cleanup Note

Do not include performance-page changes in ASSETMAP-1. The separate future cleanup remains: remove `임대소득` from the graph, keep only `배당금`, `누적투자원금`, `평가액`, remove unused tab UI if applicable, and revisit graph/data connection logic.
