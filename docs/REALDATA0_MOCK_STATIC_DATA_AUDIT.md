# REALDATA-0 Mock/Static Data Audit

Audit date: 2026-06-14

Scope: Next.js app under `C:\gv\gorani_vercel`. `original/` was not modified and no `target/` folder was created.

## 1. Executive Summary

The app is now a mixed real-data application, not a pure mock dashboard. The strongest real-data foundation is the portfolio snapshot pipeline: `/portfolio-manager` parses user-uploaded Banksalad Excel files, saves `PortfolioSnapshot[]` to localStorage and optionally Firestore, and several downstream pages consume the latest snapshot. The second real-data foundation is the quote API route set under `app/api/quote/*`, which can return Yahoo/Stooq/Fx data but intentionally falls back to deterministic sample data when requests fail. The third real-data foundation is the watchlist calendar provider/cache/custom-event stack.

The most misleading remaining mock/static areas are:

1. `/performance`: KPI cards, main performance chart, QLD valuation/Fx chart, and holdings rank table are still from `lib/mockData.ts` and `lib/qldDashboardData.ts`. The page is labeled `샘플 데이터`, but it is the most prominent route whose core purpose is still static.
2. `/market`: most internal market indicators come from `lib/mock-market-data.ts` through `lib/market-data.ts`; there is no real market API route yet. The Google Sheet iframe and TradingView heatmap are external references, but the app-owned cards/charts are mock.
3. `/portfolio`: current snapshot summary and allocation can be real, but top pin tickers, several summary fields inherited from mock defaults, and the dividend/growth treemap are still static.
4. `/dividends`: holding tables are now snapshot-derived, but yield assumptions, payment month schedule, target-share price, and dividend performance series are static helper/mock data.
5. Asset map look-through is partly real from holdings but relies on local ETF top-holdings fixtures, not a current constituent provider.

Safest next implementation step: `PERF-DATA-1`. `/performance` is the clearest high-impact mock area and should be rebuilt from snapshot history first. It can reuse existing `PortfolioSnapshot[]` without touching parser schema, dividend classification, quote APIs, theme, or layouts.

## 2. Route-by-route Table

| Route | Section | Component | Current data source | Status | User-visible label currently present? | Risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/portfolio` | Header 기준일 and totals | `app/portfolio/page.tsx`, `usePortfolioView`, `PortfolioSummary` | Latest snapshot via `lib/portfolio-store.ts` and `lib/portfolio-aggregate.ts`; fallback `PORTFOLIO_SUMMARY_DARK` | mixed | Yes. Real/mock banner present when snapshot missing; quote panel says reference-only | P1 | Keep snapshot summary, remove inherited mock-only summary fields or mark them as unavailable until real formulas exist |
| `/portfolio` | Pinned ticker strip | `MiniTickerCard` | `PIN_TICKERS` from `lib/mockData.ts` | mock | No direct badge on each card | P1 | Replace with quote-last/reference data or hide behind sample badge |
| `/portfolio` | Donut allocations | `DonutChartCard` | Snapshot allocations from `buildPortfolioViewModel`; fallback `ACCOUNT_ALLOCATION`, `STOCK_ALLOCATION`, `TAG_ALLOCATION_DARK` | mixed | Page-level real/mock banner | P2 | Keep fallback only when no snapshot; consider explicit per-chart empty state instead of mock |
| `/portfolio` | Quote status | `PortfolioQuoteStatusPanel`, `portfolio-live-quotes.ts` | `fetchQuoteLast` through `/api/quote/last`; snapshot valuation preserved | live quote/reference | Yes. "reference-only" copy present | P2 | Later use quantities to revalue only rows that are eligible and complete |
| `/portfolio` | Account cards | `AssetAccountCards` | Snapshot account cards from `portfolio-aggregate.ts`; fallback `ACCOUNT_CARDS` | mixed | Page-level banner | P2 | Replace fallback cards with empty state after snapshot onboarding is stable |
| `/portfolio` | Dividend/growth treemap | `TreemapMock` | `TREEMAP_DATA` from `lib/mockData.ts` | mock | Yes. `SampleBadge` present | P1 | Convert after PERF-DATA-1 or replace with real holdings grouped by dividend/growth tags |
| `/performance` | KPI cards | `app/performance/page.tsx`, `MetricCard` | `PERFORMANCE_KPIS` from `lib/mockData.ts` | mock/sample | Yes. `SampleBadge` and explanatory copy | P1 | `PERF-DATA-1`: compute from `PortfolioSnapshot[]` history |
| `/performance` | Main performance chart | `PerformanceChart` | `PERFORMANCE_SERIES` from `lib/mockData.ts` | mock/sample | Yes. Page copy says sample graph | P1 | Replace with snapshot history: principal, investment value, returnPct, optional dividend once real dividend cashflow exists |
| `/performance` | Evaluation/Fx trend | `QldAssetSummaryCard`, `QldValueFxChart` | `QLD_SUMMARY`, `QLD_VALUE_FX_SERIES`, `QLD_HOLDINGS` from `lib/qldDashboardData.ts` | mock/sample | Yes. `SampleBadge` on section | P1 | Replace QLD legacy mock with snapshot-history chart and remove QLD-specific static dependency |
| `/performance` | Holdings rank | `QldHoldingsRankTable` | `QLD_RANK_ROWS` from `lib/qldDashboardData.ts` | mock/sample | Covered by section sample label | P1 | Build rank from latest or selected snapshots |
| `/dividends` | Summary cards and holdings tables | `DividendPage`, `DividendSummaryCards`, `DividendHoldingsTable` | Latest snapshot via `usePortfolioSnapshots`; classification in `dividend-holdings-from-portfolio.ts`; rows built by `buildDividendHoldingRows` | mixed | Missing-snapshot banner present | P1 | Replace static yield/payment assumptions with quote dividends or explicit estimated-source labels |
| `/dividends` | Monthly dividend chart | `MonthlyDividendChart` | Snapshot-derived rows, but monthly allocation uses `PAYMENT_MONTHS` and `DIVIDEND_YIELDS` from `mock-dividend-data.ts` | mixed | No specific mock badge | P1 | `DIVIDENDS-DATA-1`: source dividend schedules/yields from quote dividends API, retain estimate labels |
| `/dividends` | Goal progress | `DividendPage` | Snapshot holding values plus `MOCK_SHARE_PRICE_KRW` | mixed | No | P2 | Use quote-last/reference price for target ticker or show value-based goal only |
| `/dividends` | Dividend performance | `DividendPerformanceSection` | `DIVIDEND_PERFORMANCE_SERIES` from `mock-dividend-data.ts` | mock | No visible sample badge in this section | P1 | Replace with snapshot-history dividend estimates or hide until real history exists |
| `/portfolio-manager` | Upload and parse | `ExcelUploadCard`, `parseBanksaladFile` | User-selected Excel, `banksalad-parser.ts` | real user snapshot | Yes. Storage mode badge | P2 | Keep. Do not change parser/schema in this step |
| `/portfolio-manager` | Load mock button | `handleLoadMock`, `MOCK_LATEST_SNAPSHOT` | `lib/mock-portfolio-data.ts` | sample | Preview warnings say mock | P2 | Keep for demo/dev, but label button as sample and avoid auto-loading |
| `/portfolio-manager` | Preview/tables/history | `PortfolioParsePreview`, `HoldingsTable`, `AssetTable`, `SnapshotHistory` | Parsed result, localStorage, Firestore repositories | real/mixed | Storage mode badge | P2 | Keep. Add source badges only if user confusion appears |
| `/portfolio-manager` | Snapshot performance chart | `PortfolioPerformanceChart` | `PortfolioSnapshot[]` history | real user snapshot | Empty state when no snapshots | P2 | Reuse this logic for `/performance` |
| `/portfolio-manager` | Asset map | `AssetMapSection`, `asset-map-exposure.ts` | Latest snapshot holdings plus local ETF fixtures; fallback `SECTOR_ALLOCATION` and default `HoldingsTable` mock rows | mixed | Yes. Status text says real or mock | P1 | Replace fallback table with empty state; later connect ETF constituent provider |
| `/market` | Market briefing/Fear & Greed | `MarketPage`, `MarketTopBriefing` | `fetchMarketBriefing`, `fetchFearGreed` return `MOCK_BRIEFING`, `MOCK_FEAR_GREED` | mock | No sample badge | P1 | `MARKET-DATA-1`: create real or cached market provider, or label all internal cards as sample |
| `/market` | RSI/MDD/VIX | `MarketRsiSection`, `MarketMddSection`, `VixChart` | `buildRsiSeries`, `buildDrawdownSeries`, `buildVixSeries` from `mock-market-data.ts` | mock | No | P1 | Prefer quote-history based RSI/drawdown for QQQ/SCHD/SPY and real VIX quote if supported |
| `/market` | Market temperature sheet | `MarketTemperatureSheet` | Published Google Sheet iframe | live/reference external | Yes. Opens sheet link | P3 | Leave as reference unless replacing with owned data |
| `/market` | Sector heatmap | `TradingViewTreemap` | TradingView external widget, placeholder on script failure | live/reference external | Placeholder only on failure | P3 | Leave as external reference; document dependency |
| `/calculator` | Dividend capture | `DividendCaptureSimulator` | User input plus `fetchQuoteHistory` and `fetchQuoteDividends`; sample fallback | live quote/mixed | Yes. `CalculatorDataStatus` and warning panel | P2 | Keep; later improve fallback visibility and default inputs |
| `/calculator` | Conversion | `ConversionCalculator` | User input plus quote history; sample fallback | live quote/mixed | Yes. source badge and warnings | P2 | Keep; no real-data rewrite first |
| `/calculator` | MDD | `MddCalculator` | User input plus quote history; sample fallback | live quote/mixed | Yes. source badge and warnings | P2 | Keep; KRW note says USD close only |
| `/asset-simulator` | Inputs/config | `AssetSimulatorPage` | User-entered state saved to localStorage/Firestore; defaults from `mock-asset-simulator-data.ts` | real user input/mixed | Storage mode badge | P3 | Rename defaults away from mock later; no external data needed |
| `/asset-simulator` | Projection result | `asset-simulator.ts` | Deterministic formulas from user/default inputs | real user input or default sample | Preview notice present | P3 | Keep; integrate portfolio starting values later only if desired |
| `/watchlist` | Ticker list | `WatchlistPage`, `TickerManager` | Latest snapshot tickers if present; localStorage/Firestore; fallback `DEFAULT_WATCHLIST_TICKERS` | mixed | `fromPortfolio` shown in manager; storage badge | P2 | Keep fallback but label initial defaults as sample |
| `/watchlist` | Dividend calendar | `DividendCalendarPage`, `calendar-event-provider.ts` | Real quote dividends provider, local cache, custom events; initial/mock fallback | mixed/live quote | Yes. source badge: LOADING/YAHOO/CACHE/SAMPLE/MOCK | P2 | Keep; reduce initial mock flash if practical |
| `/watchlist` | Tax-saving table/dialog metric | `TaxSavingTable`, `CalendarEventDialog`, `historical-tax-saving-service.ts` | Calendar events plus quote-last/history/dividends; sample fallback possible | mixed/live quote | Source/warnings shown in page/header/dialog | P2 | Keep; later separate types out of `mock-calendar-data.ts` |
| `/watchlist` | Portfolio selector | `PortfolioSelectorMock` | Static UI placeholder | mock/static | Component name says mock, UI does not fully explain | P2 | Replace with real saved watchlist/portfolio selector or remove |
| `/asset-map` | Route entry | `app/asset-map/page.tsx` | Redirects to `/portfolio-manager` | real redirect | Not applicable | P3 | Keep redirect; docs should stop saying it redirects to `/market` |
| `/qld-dashboard` | Route entry | `app/qld-dashboard/page.tsx` | Redirects to `/portfolio` | legacy redirect | Not applicable | P3 | Keep redirect until QLD components are deleted after replacements |

## 3. Component-level Findings

| Component/file | Data source | Real? | Honest display? | Conversion plan |
| --- | --- | --- | --- | --- |
| `app/portfolio/page.tsx` | `usePortfolioView`, `mockData` fallbacks, `PIN_TICKERS` | mixed | Mostly honest via banner and treemap badge; pin cards are not labeled | Add quote-backed pin cards or sample badge; replace fallback allocations with empty states |
| `components/PortfolioSummary.tsx` | `usePortfolioView` for dark mode; `PORTFOLIO_SUMMARY` for light mode; mock defaults for some fields | mixed | Partial | Make both themes use the same view model; avoid annual dividend/SCHD goal if not real |
| `components/AssetAccountCards.tsx` | Snapshot account cards or `ACCOUNT_CARDS` fallback | mixed | Page-level only | Use empty state if no snapshot |
| `components/MiniTickerCard.tsx` | Props from `PIN_TICKERS` | mock | No | Feed from `/api/quote/last` or remove from current snapshot page |
| `components/TreemapMock.tsx` | `TREEMAP_DATA` | mock | Yes, when rendered in `/portfolio` with `SampleBadge` | Replace with real tag/strategy grouping |
| `app/performance/page.tsx` | `PERFORMANCE_KPIS`, `PerformanceChart`, QLD mock components | mock | Yes, page/section labels present | Replace whole data layer with snapshot-history adapter |
| `components/PerformanceChart.tsx` | `PERFORMANCE_SERIES` | mock | Parent page says sample | Accept data prop from snapshot-history series |
| `components/qld/*` | `qldDashboardData.ts` | mock | Only `/performance` section labeled; legacy component itself not labeled | Decommission or keep only behind sample/storybook-like route |
| `components/dividend/DividendPage.tsx` | Latest snapshot plus `mock-dividend-data.ts` helpers and `MOCK_SHARE_PRICE_KRW` | mixed | Missing-snapshot banner only | Replace yields/schedules/target price/performance series with quote-backed or snapshot-backed data |
| `lib/dividend-holdings-from-portfolio.ts` | Snapshot holdings plus dividend helper rows | mixed | Not UI | Keep classification, but separate estimated dividend constants from type/helper module |
| `components/portfolio/PortfolioPage.tsx` | Parser, local store, Firestore, `MOCK_LATEST_SNAPSHOT` button | real/mixed | Mock preview warning exists | Keep mock load as explicit sample only |
| `components/portfolio/PortfolioPerformanceChart.tsx` | `PortfolioSnapshot[]` | real | Yes, empty state if none | Reuse for `/performance` |
| `components/portfolio/PortfolioQuoteStatusPanel.tsx` | `portfolio-live-quotes.ts`, quote-last API | live quote/reference | Yes, says reference-only | Later revalue only complete rows with quantity and currency |
| `components/asset-map/AssetMapSection.tsx` | Latest snapshot, ETF fixtures, mock fallback | mixed | Yes, status text says real/mock | Replace fallback table and build provider boundary for constituents |
| `components/market/MarketPage.tsx` | `market-data.ts` adapter backed by mocks, plus external widgets | mock/mixed | Not enough for internal mock cards | Add page-level sample badge or real provider |
| `lib/market-data.ts` | Async wrapper over `mock-market-data.ts` | mock | Comments only | Implement real provider or rename as mock adapter |
| `components/calculator/*` | User inputs plus quote API, sample fallback | live quote/mixed | Yes, source badges/warnings | Keep, maybe persist calculator input history as user data |
| `components/asset-simulator/AssetSimulatorPage.tsx` | User/default inputs, localStorage/Firestore | real user input/mixed | Preview/storage notice present | Rename default data module later |
| `components/watchlist/WatchlistPage.tsx` | Snapshot tickers, localStorage/Firestore, default tickers | mixed | Mostly | Label default ticker set as sample |
| `components/watchlist/DividendCalendarPage.tsx` | Real dividend provider/cache/custom events, initial mock fallback | mixed/live quote | Yes, source badge and warnings | Keep; reduce mock flash and split types from mock module |
| `components/watchlist/PortfolioSelectorMock.tsx` | Static placeholder | mock | No | Replace with real portfolio/watchlist selector |
| `components/watchlist/EconomicCalendarMini.tsx` | `MOCK_ECONOMIC_EVENTS` | mock | Shows `mock`, but not currently mounted in main page | Leave unused or replace with provider when mounted |

## 4. Source-of-truth Inventory

| Source | File path | Data shape | Reliability | Limitations |
| --- | --- | --- | --- | --- |
| Latest portfolio snapshot | `lib/portfolio-store.ts`, `lib/portfolio-types.ts` | `PortfolioSnapshot`, `Holding[]`, `FinanceAsset[]` | High for user-uploaded saved data | Browser-local unless Firestore configured; snapshot valuation is preserved and may not have quantity |
| Portfolio snapshot history | `usePortfolioSnapshots`, `getSnapshots`, `SnapshotHistory`, `PortfolioPerformanceChart` | sorted `PortfolioSnapshot[]` | High for registered snapshots | Only exists after multiple uploads; no daily interpolation |
| Portfolio holdings | `Holding` in `portfolio-types.ts` | broker, product, ticker, principal/value, quantity/currency optional, parsed tags | Medium-high | Ticker/quantity/currentPrice depend on parser/source file quality |
| Portfolio assets | `FinanceAsset` in `portfolio-types.ts` | product, amountKRW, category, tags, debt flag | Medium-high | Asset category inference can be broad; not market-updated |
| Quote history API | `app/api/quote/history/route.ts`, `lib/server/quote-fetchers.ts`, `lib/calculator-data-provider.ts` | `QuoteHistoryResponse` with OHLCV points and source | Medium | Yahoo/Stooq can fail or lack symbols; sample fallback is deterministic |
| Quote last API | `app/api/quote/last/route.ts`, `portfolio-live-quotes.ts` | latest price/date/source | Medium | Derived from 1m history; not used for portfolio valuation yet |
| Quote dividends API | `app/api/quote/dividends/route.ts`, `calendar-event-provider.ts` | dividend date/amount rows | Medium | Yahoo may miss events; future events are projected estimates |
| FX API | `app/api/quote/fx/route.ts`, `getQuoteFx`, `fetchUsdKrw` | USDKRW rate/date/source | Medium | Uses Yahoo symbols then sample 1375 fallback; not broadly integrated into portfolio page |
| Calendar provider/cache | `lib/calendar-event-provider.ts`, `lib/calendar-cache.ts`, `calendar-event-identity.ts` | generated dividend events, cache entries with source and expiry | Medium | Initial mock fallback exists; cache is localStorage |
| Custom events | `lib/calendar-custom-events.ts`, Firestore repository helpers | user-created calendar events | High for user-entered state | Local/Firestore only, no external validation |
| Tax-saving service | `lib/historical-tax-saving-service.ts`, `historical-tax-saving-session-cache.ts` | calculated 5y metric per ticker | Medium | Depends on quote history/dividends quality and sample fallback |
| Korean ETF registry | `lib/korean-etf-registry.ts`, `holding-ticker-normalizer.ts` | alias to KRX quote ticker, dividend bucket, exposure proxy | Medium-high for listed aliases | Partial registry; fallback bucket may lack quoteTicker |
| Firestore repositories | `lib/firebase/firestore-repositories.ts` | portfolio snapshots, calendar tickers/metas/custom events, simulator configs, presets | Medium-high when configured | Client-only SDK and env-dependent |

## 5. Mock/static Source Inventory

| Source file/export | Imported by | UI fed | Replace, label, or delete later |
| --- | --- | --- | --- |
| `lib/mockData.ts` `NAV_ITEMS` | `TopNav` | navigation labels | Keep but rename/move to non-mock config |
| `PIN_TICKERS` | `app/portfolio/page.tsx`, `MiniTickerCard` | `/portfolio` top ticker strip | Replace with quote API or label |
| `PORTFOLIO_SUMMARY`, `PORTFOLIO_SUMMARY_DARK` | `PortfolioSummary`, `portfolio-aggregate.ts` | summary fallback and shape defaults | Replace fallback values with empty/derived values |
| `ACCOUNT_ALLOCATION`, `STOCK_ALLOCATION`, `TAG_ALLOCATION_DARK` | `app/portfolio/page.tsx` | donut fallback | Replace with empty states |
| `PERFORMANCE_KPIS` | `app/performance/page.tsx` | `/performance` KPI cards | Replace in `PERF-DATA-1` |
| `PERFORMANCE_SERIES` | `PerformanceChart` | `/performance` main chart | Replace in `PERF-DATA-1` |
| `TREEMAP_DATA` | `TreemapMock` | `/portfolio` dividend/growth treemap | Replace or keep labeled until strategy grouping exists |
| `SECTOR_ALLOCATION`, `SECTOR_FILTERS`, `TOP_HOLDINGS` | `AssetMapSection`, shared `HoldingsTable` | asset-map fallback donut/table | Replace with empty state or real provider |
| `WATCHLIST`, `MONTHLY_INCOME_*` | `WatchlistRow`, `MonthlyIncomeChart` | currently legacy/shared components | Delete only after confirming unused routes |
| `lib/mock-portfolio-data.ts` `MOCK_LATEST_SNAPSHOT` | `/portfolio-manager` load mock | sample parser preview | Keep as explicit demo fixture, not production fallback |
| `lib/mock-dividend-data.ts` `DIVIDEND_YIELDS`, `PAYMENT_MONTHS` | dividend row/month builders | `/dividends` estimates | Replace with quote dividends API estimates |
| `DIVIDEND_PERFORMANCE_SERIES` | `DividendPerformanceSection` | `/dividends` performance chart | Replace or hide |
| `DEFAULT_WATCHLIST_TICKERS` | `WatchlistPage` | fallback watchlist | Keep labeled default seed |
| `MOCK_ECONOMIC_EVENTS` | `EconomicCalendarMini` | economic mini section if mounted | Replace with scheduled JSON/provider |
| `EVENT_META`, old event types | old calendar components | legacy/unused event UI | Delete after dependency check |
| `lib/mock-market-data.ts` `MOCK_BRIEFING`, `MOCK_FEAR_GREED`, `MOCK_ETF_TEMPERATURE`, series builders | `MarketPage`, `market-data.ts` | `/market` internal indicators | Replace in `MARKET-DATA-1` or label |
| `MARKET_TEMPERATURE_SUMMARY`, `MARKET_RISK_CARDS`, `MARKET_RSI_TREND` | legacy market components | possibly unused market sections | Delete only after unused-component audit |
| `lib/mock-asset-simulator-data.ts` defaults | `AssetSimulatorPage`, `asset-simulator.ts` | simulator initial/default values | Rename to defaults; keep user-editable |
| `lib/mock-calculator-data.ts` | no current app imports found | old calculator mock fixtures | Candidate for deletion after final QA |
| `lib/mock-calendar-data.ts` types, filters, mock event builder, `buildTaxSavingRows` | watchlist provider and UI types | calendar events, tax-saving rows, initial fallback | Split types/helpers from mock builder; keep fallback explicit |
| `lib/qldDashboardData.ts` `QLD_*` | `components/qld/*`, `/performance` | QLD valuation, ranks, account/dividend charts | Replace with snapshot-history data, then delete legacy dependency |
| `lib/asset-map-etf-constituents.ts` fixtures | `asset-map-exposure.ts` | ETF look-through | Keep labeled as fixture until real constituent provider exists |
| `lib/server/quote-fetchers.ts` sample builders | quote API fallback | calculator/calendar/quote panels when providers fail | Keep, but all consuming UI should surface `source: sample` |

## 6. Recommended Implementation Batches

| Batch | Goal | Files likely touched | Risk | Recommended agent | Expected verification |
| --- | --- | --- | --- | --- | --- |
| `PERF-DATA-1` | Replace `/performance` mock KPIs/charts with snapshot-history data | `app/performance/page.tsx`, `components/PerformanceChart.tsx`, new or existing `lib/portfolio-aggregate.ts`, possibly `PortfolioPerformanceChart` reuse | P1 | Codex | `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run check:portfolio-parser`, `npm.cmd run check:portfolio-parser:private` |
| `PORTFOLIO-DATA-1` | Remove misleading `/portfolio` pin ticker and mock summary leftovers or make quote-backed | `app/portfolio/page.tsx`, `PortfolioSummary`, `MiniTickerCard`, `portfolio-live-quotes.ts` | P1 | Codex | build/lint/typecheck plus `check:korean-etf`, `check:portfolio-parser` |
| `DIVIDENDS-DATA-1` | Replace dividend yield/payment mock assumptions with quote-dividends based estimates while preserving row classification | `mock-dividend-data.ts`, `dividend-holdings-from-portfolio.ts`, `DividendPage`, `MonthlyDividendChart` | P1 | Codex | build/lint/typecheck, `check:dividend-holdings`, `check:korean-etf` |
| `TICKER-4` | Expand real quote eligibility and valuation readiness for Korean ETFs and holdings with quantity/currency | `ticker-mapper.ts`, `holding-ticker-normalizer.ts`, `portfolio-live-quotes.ts`, parser checks | P2 | Codex | `check:korean-etf`, `check:portfolio-parser`, `check:portfolio-parser:private` |
| `MARKET-DATA-1` | Replace or clearly label `/market` internal mock indicators | `lib/market-data.ts`, `lib/mock-market-data.ts`, `components/market/*`, possibly new API routes | P1 | Codex for implementation, Claude useful for source/provider spec review | build/lint/typecheck; add market provider check if new provider is introduced |
| `WATCHLIST-DATA-1` | Split calendar types/helpers from `mock-calendar-data.ts`, reduce initial mock flash, clarify default tickers | `mock-calendar-data.ts`, `calendar-event-provider.ts`, `DividendCalendarPage`, `WatchlistPage` | P2 | Codex | `check:calendar-provider`, `check:tax-saving`, build/lint/typecheck |
| `ASSETMAP-DATA-1` | Replace fallback mock asset-map table with empty state and provider boundary for ETF constituents | `AssetMapSection`, `asset-map-exposure.ts`, `asset-map-etf-constituents.ts` | P2 | Codex | `check:asset-map`, `check:korean-etf`, build/lint/typecheck |
| `FINAL-QA` | Remove unused mock components/files only after replacements land | broad `rg` cleanup under `components`, `lib`, `app` | P2 | Codex | full requested check suite and visual smoke if UI changed |

## 7. Immediate Next Recommendation

Best next implementation prompt: `PERF-DATA-1`.

Reason: `/performance` is the most visibly mock/static route, and it already has a real source-of-truth available: `PortfolioSnapshot[]` history. This batch can produce a clear user win without touching parser schema, dividend classification, calendar provider/cache, calculator formulas, tax formulas, Korean ETF normalization, or theme/layout systems.

Suggested next prompt:

```txt
PERF-DATA-1: Replace /performance mock KPIs and charts with portfolio snapshot history.

Use latest saved PortfolioSnapshot[] from lib/portfolio-store.ts.
Do not change parser/schema/theme/layout.
Remove PERFORMANCE_KPIS and PERFORMANCE_SERIES usage from /performance.
Rework PerformanceChart to accept data props derived from snapshots.
Replace QLD mock valuation/rank section with snapshot-derived evaluation trend and holdings rank, or show an empty state when fewer than 2 snapshots exist.
Keep clear source/empty-state labels.
Run build/lint/typecheck and relevant parser checks.
```

## 8. Remaining Limitations

- This is a static code audit, not a runtime visual audit. It did not open pages in a browser.
- Some legacy components are not currently mounted but still import mock files. They are inventoried because deleting them safely requires a later unused-component pass.
- Quote APIs are real integration points, but network/provider failures intentionally return sample data. Any page using quote APIs must continue to display `source`.
- ETF constituent data is local fixture data. Asset-map exposure is real with respect to user holding weights, but not real with respect to full/current ETF constituents.
- Firestore reliability depends on Firebase environment configuration and client auth state.
