# Step 2B Storage And Repository Boundary

Update date: 2026-06-12

## Scope

Step 2B keeps the current feature screens mostly unchanged and clarifies storage, repository, and quote-client boundaries for later calculator, dividend calendar, dividend ledger, and market wiring.

Reference-only original files checked:

- `original/core/sync.py`: present. It loads/saves Streamlit session data through Firebase Realtime Database paths such as `tracker`, `tracker_config`, `sim_config`, and `dividend_calendar`.
- `original/core/firebase.py`: present. It uses Firebase Admin Realtime Database `users/{safe_uid}/{path}` with generic `save_data` and `load_data`.

No files under `original/` were modified.

## Current Storage Structure

| Domain | localStorage key | Firestore path | Related type | Related repository / store function | Used by screen now | Mock/sample now | Incomplete save/restore notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `portfolioSnapshots` | `qld2.portfolio.snapshots.v1` via `STORAGE_KEYS.portfolioSnapshots` | `users/{uid}/portfolioSnapshots/{snapshotId}` | `PortfolioSnapshot` | local `saveSnapshot`, `deleteSnapshot`, `replaceSnapshots`, `usePortfolioSnapshots`; Firestore `savePortfolioSnapshot`, `loadPortfolioSnapshots`, `deletePortfolioSnapshot` | Yes, portfolio manager and shared portfolio-derived screens | Uses `MOCK_LATEST_SNAPSHOT` only when user loads mock data | Local-first store remains the primary live screen state; Firestore load replaces local cache when logged in |
| `assetSimulatorConfigs` | `gorani.asset-simulator.preview` via `STORAGE_KEYS.assetSimulatorConfigs` | `users/{uid}/assetSimulatorConfigs/default` | `StoredSimulatorPreview` | `saveAssetSimulatorConfig`, `loadAssetSimulatorConfig`, `deleteAssetSimulatorConfig` | Yes, asset simulator | Default inputs/year plans are sample defaults | Persisted config contains inputs/year plans only, not calculated result history |
| `calendarTickers` | `gorani.dividend-calendar.tickers.v1` via `STORAGE_KEYS.calendarTickers` | `users/{uid}/calendarTickers/{TICKER}` | `CalendarTickerData` | `saveCalendarTicker`, `loadCalendarTickers`, `deleteCalendarTicker` | Yes, watchlist ticker manager | Calendar events are still mock-generated from tickers | Removing a ticker deletes that ticker doc, but bulk save does not mark absent old tickers disabled |
| `calendarEvents` event meta | `gorani.dividend-calendar.event-meta.v1` via `STORAGE_KEYS.calendarEventMeta` | `users/{uid}/calendarEvents/{eventId}` | `CalendarEventMeta` | `saveCalendarEventMeta`, `loadCalendarEventMetas` | Yes, event star/heart/memo metadata | Underlying events are mock calendar events | No delete function yet because UI only overwrites meta; event IDs are tied to current mock event shape |
| `calendarSettings` | Reserved `gorani.dividend-calendar.settings.v1`; not used by UI | `users/{uid}/calendarSettings/default` | `Record<string, unknown>` | `saveCalendarSettings`, `loadCalendarSettings` | No | N/A | Repository exists, screen settings are not wired yet |
| `calculatorPresets` | `gorani.calculator.presets.v1` via `STORAGE_KEYS.calculatorPresets` | `users/{uid}/calculatorPresets/{presetId}` | `CalculatorPreset` | `saveCalculatorPreset`, `loadCalculatorPresets`, `deleteCalculatorPreset` | Yes, calculator preset controls | Calculators still use synchronous sample data | Delete repository exists but current preset UI does not expose delete |
| `dividendLedger` transactions/settings/targets | Reserved `gorani.dividend-ledger.v1`; not used by UI | `users/{uid}/dividendLedgerTransactions/{id}`, `users/{uid}/dividendLedgerSettings/default`, `users/{uid}/dividendLedgerTargets/{id}` | `DividendLedgerTransaction`, `DividendLedgerSettings`, `DividendLedgerTarget` | Added `save/load/deleteDividendLedgerTransaction`, `save/loadDividendLedgerSettings`, `save/load/deleteDividendLedgerTarget` | No | Dividend page still uses mock portfolio/dividend data | Repository foundation only; no ledger UI or migration from original data yet |
| `favoriteLinks` | Reserved `gorani.favorite-links.v1`; not used by UI | `users/{uid}/favoriteLinks/{id}` | `FavoriteLink` | Added `saveFavoriteLink`, `loadFavoriteLinks`, `deleteFavoriteLink` | No | N/A | Original favorite-link sidebar has no Next.js UI equivalent yet |
| `calendarCache` | Reserved `gorani.dividend-calendar.cache.v1`; not used by UI | `users/{uid}/calendarCache/{entryId}` | `CalendarCacheEntry` | Added `saveCalendarCacheEntry`, `loadCalendarCacheEntries`, `deleteCalendarCacheEntry` | No | Calendar events still come from `buildMockCalendarEvents` | Repository foundation only; real dividend event cache is intentionally not wired |
| `uiPreferences` | Reserved `gorani.ui-preferences.v1`; not used by UI | `users/{uid}/uiPreferences/default` | `UiPreferences` | Added `saveUiPreferences`, `loadUiPreferences` | No | N/A | Foundation only |
| `trackerConfig` | Reserved `gorani.tracker-config.v1`; not used by UI | `users/{uid}/trackerConfig/{configId}` | `TrackerConfig` | Added `saveTrackerConfig`, `loadTrackerConfig` | No | N/A | Maps conceptually to original `tracker_config`, but no migration is implemented |
| quote cache / market cache | Reserved `gorani.quote.cache.v1`, `gorani.market.cache.v1`; not used by UI | None | `DataResult<T>` and quote response types | None | No | Quote API has live fetch with deterministic sample fallback | No client-side cache is active; Step 2A route-level `fetch` uses `next.revalidate` only |

## Added Or Clarified Types

- `DataSource`
- `DataResult<T>`
- `DataResultMeta<S>`
- `QuoteSource` now derives from `DataSource`
- Existing quote response types now share `DataResultMeta` while preserving their public JSON shapes
- `StorageKeyName`
- `DividendLedgerTransactionType`
- `DividendLedgerTransaction`
- `DividendLedgerSettings`
- `DividendLedgerTarget`
- `FavoriteLink`
- `CalendarCacheEntry`
- `UiPreferences`
- `TrackerConfig`

## Added Or Clarified Repository Functions

- `loadCalendarSettings`
- `saveDividendLedgerTransaction`
- `loadDividendLedgerTransactions`
- `deleteDividendLedgerTransaction`
- `saveDividendLedgerSettings`
- `loadDividendLedgerSettings`
- `saveDividendLedgerTarget`
- `loadDividendLedgerTargets`
- `deleteDividendLedgerTarget`
- `saveFavoriteLink`
- `loadFavoriteLinks`
- `deleteFavoriteLink`
- `saveCalendarCacheEntry`
- `loadCalendarCacheEntries`
- `deleteCalendarCacheEntry`
- `saveUiPreferences`
- `loadUiPreferences`
- `saveTrackerConfig`
- `loadTrackerConfig`

Existing repository function names and current behavior were kept.

## Quote Client Boundary

`lib/quote-client.ts` now owns reusable client-side quote API route paths and request wrappers:

- `quoteHistoryPath`
- `quoteDividendsPath`
- `quoteLastPath`
- `quoteFxPath`
- `requestQuoteHistory`
- `requestQuoteDividends`
- `requestQuoteLast`
- `requestQuoteFx`

`lib/calculator-data-provider.ts` still exports the existing synchronous sample functions:

- `getTickerHistory`
- `getTickerOhlcHistory`
- `getTickerDividends`
- `getLatestPrice`

It also still exports the Step 2A async wrappers:

- `fetchQuoteHistory`
- `fetchQuoteDividends`
- `fetchQuoteLast`
- `fetchUsdKrw`

Those async wrappers now delegate `/api/quote/*` calls to `lib/quote-client.ts` and keep local deterministic sample fallback plus warning propagation.

## Not Connected To Screens Yet

- Calculator live data is not fully wired into the three calculators.
- Dividend calendar still uses mock event generation and does not use `calendarCache`.
- Dividend ledger UI and transaction entry flows were not implemented.
- Favorite links UI was not implemented.
- Market temperature, SCHD attractiveness, and broader market cache flows were not implemented.
- QLD dashboard, asset-map route behavior, and navigation items were not changed.

## Migration Notes

- Existing localStorage keys were not renamed, so no migration function is required for current data.
- New keys in `STORAGE_KEYS` are reserved for future features and should not be treated as active persisted schemas until their screens are wired.
- `portfolioSnapshots` still uses the legacy `qld2.portfolio.snapshots.v1` key to avoid breaking existing local users.
- Original Streamlit Firebase data used Realtime Database paths and sanitized UIDs; this Next.js app uses Firestore `users/{uid}/...`. Any later migration must explicitly map `tracker`, `tracker_config`, `sim_config`, and `dividend_calendar` to the Firestore collections/documents above.
- `calendarEvents` metadata IDs currently depend on mock event IDs; real calendar events should define stable provider-independent event IDs before migration.
- `favoriteLinks`, `dividendLedger`, `calendarCache`, `uiPreferences`, and `trackerConfig` repositories are schema foundations only. Adding UI should include read/write conflict rules and backfill decisions.

## Recommended Next Steps

1. Add narrow tests or smoke checks for repository path helpers once a Firebase emulator or mocked Firestore layer exists.
2. Define stable dividend calendar event IDs before wiring live calendar data.
3. Add delete/update UI for calculator presets only after deciding local and Firestore conflict behavior.
4. Wire one calculator at a time to async quote data, preserving synchronous sample fallback as the offline path.
5. Decide whether quote/market cache belongs in Firestore, localStorage, or server-side route caching before writing any large market payloads.

