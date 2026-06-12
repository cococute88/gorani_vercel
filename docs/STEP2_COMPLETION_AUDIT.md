# Step 2 Completion Audit

Audit date: 2026-06-12

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/`
- No `target/` folder exists or was created.
- This audit freezes the current Step 2A quote API and Step 2B storage/repository baseline. No new product feature was implemented in this step.

## Files Checked

All requested Step 2A/2B target files were present:

- `app/api/quote/history/route.ts`
- `app/api/quote/dividends/route.ts`
- `app/api/quote/last/route.ts`
- `app/api/quote/fx/route.ts`
- `lib/server/quote-fetchers.ts`
- `lib/quote-types.ts`
- `lib/quote-client.ts`
- `lib/calculator-data-provider.ts`
- `lib/storage-keys.ts`
- `lib/firebase/firestore-repositories.ts`
- `lib/portfolio-store.ts`
- `components/calculator/CalculatorPresetControls.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/common/StorageModeBadge.tsx`

Original reference files checked and left unmodified:

- `original/core/sync.py`
- `original/core/firebase.py`
- `original/pages_app/7_mdd_calculator.py`
- `original/pages_app/3_dividend_sim.py`
- `original/pages_app/4_conversion_analysis.py`
- `original/modules/dividend_calendar.py`

## Actual Step 2A / 2B File Changes

Step 2A quote API foundation is implemented in:

- `app/api/quote/history/route.ts`
- `app/api/quote/dividends/route.ts`
- `app/api/quote/last/route.ts`
- `app/api/quote/fx/route.ts`
- `lib/server/quote-fetchers.ts`
- `lib/quote-types.ts`
- `lib/calculator-data-provider.ts`
- `components/calculator/PreviewNotice.tsx`
- `docs/STEP2A_QUOTE_API.md`

Step 2B storage/repository and client-boundary foundation is implemented in:

- `docs/STEP2B_STORAGE_REPOSITORY.md`
- `lib/storage-keys.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/calculator-data-provider.ts`
- `lib/firebase/firestore-repositories.ts`
- `lib/portfolio-store.ts`
- `lib/mock-asset-simulator-data.ts`
- `components/calculator/CalculatorPresetControls.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `components/watchlist/DividendCalendarPage.tsx`

Related Step 0/1 files are still present in the working tree, including navigation/auth badge changes and package/lint baseline changes.

## Quote API Routes

| Route | File path | Query parameters | Return type | Yahoo | Stooq fallback | Sample fallback | Warnings | Failure containment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/quote/history` | `app/api/quote/history/route.ts` | `ticker`, `range`, `start`, `end` | `QuoteHistoryResponse` | Yes | Yes, plain US tickers only | Yes | Yes | Returns sample response if Yahoo/Stooq fail |
| `/api/quote/dividends` | `app/api/quote/dividends/route.ts` | `ticker`, `range`, `start`, `end` | `QuoteDividendsResponse` | Yes | No | Yes | Yes | Returns sample dividends if Yahoo fails |
| `/api/quote/last` | `app/api/quote/last/route.ts` | `ticker` | `QuoteLastResponse` | Yes, via history | Yes, via history | Yes | Yes | Returns latest sample close if live lookups fail |
| `/api/quote/fx` | `app/api/quote/fx/route.ts` | `pair` optional, defaults to `USDKRW` | `QuoteFxResponse` | Yes, `KRW=X` then `USDKRW=X` | Indirectly not used for FX symbols because Stooq rejects `=` symbols | Yes | Yes | Returns deterministic USD/KRW sample rate if live lookups fail |

All four route files set `dynamic = "force-dynamic"` and return `NextResponse.json(...)`.

## Quote Smoke Test

Smoke test ran against a local Next dev server on port `3103`.

| URL | HTTP | Source | Data count | Representative value | Warnings |
| --- | --- | --- | --- | --- | --- |
| `/api/quote/history?ticker=SPY&range=1y` | 200 | `yahoo` | 252 prices | latest close `737.76001` on `2026-06-11` | 0 |
| `/api/quote/history?ticker=QQQ&range=6m` | 200 | `yahoo` | 125 prices | latest close `717.119995` on `2026-06-11` | 0 |
| `/api/quote/dividends?ticker=SCHD&range=5y` | 200 | `yahoo` | 20 dividends | latest dividend `0.257` on `2026-03-25` | 0 |
| `/api/quote/last?ticker=SCHD` | 200 | `yahoo` | 1 latest quote | price `32.529999` on `2026-06-11` | 0 |
| `/api/quote/fx` | 200 | `yahoo` | 1 FX rate | rate `1521.180054` on `2026-06-12` | 0 |

These values are a point-in-time smoke baseline and may change with market data availability.

## Quote Client And Calculator Provider

`lib/server/quote-fetchers.ts` is server-only and owns:

- Yahoo chart fetch
- Stooq daily CSV fallback
- deterministic sample history/dividends/FX fallback
- quote response construction with `source`, `warnings`, and `updatedAt`

`lib/quote-client.ts` is client-safe and owns:

- route path construction for `/api/quote/*`
- client-side fetch wrapper
- fallback warning augmentation when route fetch fails

`lib/calculator-data-provider.ts` currently has two roles:

- Existing synchronous sample provider functions used by the current calculators:
  - `getTickerHistory`
  - `getTickerOhlcHistory`
  - `getTickerDividends`
  - `getLatestPrice`
- Async wrappers prepared for later wiring:
  - `fetchQuoteHistory`
  - `fetchQuoteDividends`
  - `fetchQuoteLast`
  - `fetchUsdKrw`

The calculator implementations still import the synchronous sample functions. Live quote data is not wired into the three calculators yet.

## Server / Client Boundary

Search results confirmed:

- `@/lib/server/quote-fetchers` is imported only by `app/api/quote/*/route.ts`.
- `lib/server/quote-fetchers.ts` includes `import "server-only"`.
- No client component imports `lib/server/quote-fetchers.ts`.
- `lib/calculator-data-provider.ts` imports only the client-safe `lib/quote-client.ts` for async wrappers.
- Existing calculator logic still calls synchronous sample provider functions, so sample fallback remains intact.
- Build validation did not report a server-only module imported from a client bundle.

## Storage Repository Audit

| Domain | localStorage key | Firestore path | Type | Save | Load | Delete | Screen connection |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Portfolio snapshots | `qld2.portfolio.snapshots.v1` | `users/{uid}/portfolioSnapshots/{snapshotId}` | `PortfolioSnapshot` | Yes | Yes | Yes | Connected in portfolio manager and shared portfolio store |
| Calculator presets | `gorani.calculator.presets.v1` | `users/{uid}/calculatorPresets/{presetId}` | `CalculatorPreset` | Yes | Yes | Yes | Save/load connected; delete function exists but UI delete is not exposed |
| Asset simulator config | `gorani.asset-simulator.preview` | `users/{uid}/assetSimulatorConfigs/default` | `StoredSimulatorPreview` | Yes | Yes | Yes | Connected in asset simulator |
| Calendar tickers | `gorani.dividend-calendar.tickers.v1` | `users/{uid}/calendarTickers/{TICKER}` | `CalendarTickerData` | Yes | Yes | Yes | Connected in watchlist ticker manager |
| Calendar settings | `gorani.dividend-calendar.settings.v1` reserved | `users/{uid}/calendarSettings/default` | `Record<string, unknown>` | Yes | Yes | No | Unconnected |
| Calendar event meta | `gorani.dividend-calendar.event-meta.v1` | `users/{uid}/calendarEvents/{eventId}` | `CalendarEventMeta` | Yes | Yes | No | Connected for event star/heart/memo over mock events |
| Dividend ledger transactions | `gorani.dividend-ledger.v1` reserved | `users/{uid}/dividendLedgerTransactions/{id}` | `DividendLedgerTransaction` | Yes | Yes | Yes | Unconnected |
| Dividend ledger settings | `gorani.dividend-ledger.v1` reserved | `users/{uid}/dividendLedgerSettings/default` | `DividendLedgerSettings` | Yes | Yes | No | Unconnected |
| Dividend ledger targets | `gorani.dividend-ledger.v1` reserved | `users/{uid}/dividendLedgerTargets/{id}` | `DividendLedgerTarget` | Yes | Yes | Yes | Unconnected |
| Favorite links | `gorani.favorite-links.v1` reserved | `users/{uid}/favoriteLinks/{id}` | `FavoriteLink` | Yes | Yes | Yes | Unconnected |
| Calendar cache | `gorani.dividend-calendar.cache.v1` reserved | `users/{uid}/calendarCache/{entryId}` | `CalendarCacheEntry` | Yes | Yes | Yes | Unconnected |
| UI preferences | `gorani.ui-preferences.v1` reserved | `users/{uid}/uiPreferences/default` | `UiPreferences` | Yes | Yes | No | Unconnected |
| Tracker config | `gorani.tracker-config.v1` reserved | `users/{uid}/trackerConfig/{configId}` | `TrackerConfig` | Yes | Yes | No | Unconnected |
| Quote cache | `gorani.quote.cache.v1` reserved | None | none beyond quote response types | No | No | No | Unconnected |
| Market cache | `gorani.market.cache.v1` reserved | None | none | No | No | No | Unconnected |

## Connected Vs Unconnected

Currently connected to screens:

- Portfolio snapshot localStorage and optional Firestore sync
- Asset simulator config localStorage and optional Firestore sync
- Calculator preset save/load localStorage and optional Firestore sync
- Watchlist calendar tickers localStorage and optional Firestore sync
- Watchlist calendar event metadata localStorage and optional Firestore sync
- Quote API notice and async wrapper exports, but not calculator live-data execution

Currently unconnected foundations:

- Calendar settings
- Dividend ledger transactions/settings/targets
- Favorite links
- Calendar cache
- UI preferences
- Tracker config
- Quote cache
- Market cache

## Still Sample Or Mock

- The three calculator implementations still use deterministic synchronous sample data.
- Watchlist/dividend calendar events still come from `buildMockCalendarEvents`.
- Dividend page still uses mock portfolio/dividend data.
- Market page and market temperature modules still use mock market data.
- QLD dashboard data remains mock/static and was not changed.

## Original Reference Notes

- `original/core/sync.py` and `original/core/firebase.py` use Firebase Realtime Database paths such as `tracker`, `tracker_config`, `sim_config`, and `dividend_calendar`.
- Original MDD and conversion pages use yfinance first and Stooq CSV fallback for history.
- Original dividend simulator uses yfinance for price/dividend history.
- Original dividend calendar includes API-key paths for Polygon/Finnhub and a local/Firebase cache concept, but these were not ported into the Next.js UI in Step 2.

## Verification

Final validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run build` | Passed | Build included all four `/api/quote/*` dynamic routes. |
| `npm.cmd run lint` | Passed | No ESLint warnings or errors. |
| `npm.cmd run typecheck` | Passed | `tsc --noEmit` completed successfully. |

## Recommended Next Order

1. Keep this Step 2 baseline fixed before broad UI wiring.
2. Define stable dividend event IDs before connecting real calendar events or `calendarCache`.
3. Wire one calculator at a time to async quote data, starting with the lowest-risk read-only path.
4. Decide cache ownership for quote/market data before persisting market payloads.
5. Only after cache and ID rules are stable, implement dividend ledger UI or favorite-links UI.
