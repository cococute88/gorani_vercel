# Gorani Finance Step 0 Audit

Audit date: 2026-06-12

Path update date: 2026-06-12

Step 1 navigation audit date: 2026-06-12 (`docs/STEP1_NAVIGATION_AUDIT.md`)

Step 2A quote API foundation date: 2026-06-12 (`docs/STEP2A_QUOTE_API.md`)

Step 2 completion audit date: 2026-06-12 (`docs/STEP2_COMPLETION_AUDIT.md`)

Step 3A portfolio data foundation date: 2026-06-12 (`docs/STEP3A_PORTFOLIO_DATA_FOUNDATION.md`)

Step 3B portfolio parser fields date: 2026-06-12 (`docs/STEP3B_PORTFOLIO_PARSER_FIELDS.md`)

Step 3C portfolio parser fixtures date: 2026-06-12 (`docs/STEP3C_PORTFOLIO_PARSER_FIXTURES.md`)

Step 3D portfolio real sample validation date: 2026-06-12 (`docs/STEP3D_PORTFOLIO_REAL_SAMPLE_VALIDATION.md`)

Step 4A MDD live data date: 2026-06-12 (`docs/STEP4A_MDD_LIVE_DATA.md`)

Step 4B conversion live data date: 2026-06-12 (`docs/STEP4B_CONVERSION_LIVE_DATA.md`)

Step 4C dividend capture live data date: 2026-06-12 (`docs/STEP4C_DIVIDEND_CAPTURE_LIVE_DATA.md`)

Step 4D calculator UI polish date: 2026-06-12 (`docs/STEP4D_CALCULATOR_UI_POLISH.md`)

Step 5A-0 calendar event ID/cache schema date: 2026-06-12 (`docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`)

Step 5A-1 calendar canonical ID apply date: 2026-06-13 (`docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`)

Step 5A-2 calendar cache/provider boundary date: 2026-06-13 (`docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`)

Step 5A-3 calendar real dividend provider date: 2026-06-13 (`docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`)

Step 5A-4 calendar provider regression date: 2026-06-13 (`docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`)

Step 5A-5 calendar UI polish date: 2026-06-13 (`docs/STEP5A5_CALENDAR_UI_POLISH.md`)

Step 5A-6-0 calendar custom event foundation date: 2026-06-13 (`docs/STEP5A6_CUSTOM_EVENT_FOUNDATION.md`)

Step 5A-6-1 calendar custom event UI date: 2026-06-13 (`docs/STEP5A6_CUSTOM_EVENT_UI.md`)

Step M0 app-wide mobile UI overflow audit date: 2026-06-13 (`docs/MOBILE_UI_OVERFLOW_AUDIT.md`)

Step M1 app-wide mobile P0/P1 overflow fix date: 2026-06-13 (`docs/MOBILE_UI_M1_OVERFLOW_FIX.md`)

Step M2 responsive mobile table/card fix date: 2026-06-13 (`docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`)

Step 5B-0 TaxSavingTable calculation spec audit date: 2026-06-13 (`docs/STEP5B0_TAX_SAVING_CALC_AUDIT.md`)

Step 5B-1 TaxSavingTable pure calculation function date: 2026-06-13 (`docs/STEP5B1_TAX_SAVING_PURE_FUNCTION.md`)

Step 5B-2 TaxSavingTable quote-last calculation connection date: 2026-06-13 (`docs/STEP5B2_TAX_SAVING_TABLE_CONNECT.md`)

Step 5B-3 historical tax-saving metric audit date: 2026-06-13 (`docs/STEP5B3_HISTORICAL_TAX_SAVING_AUDIT.md`)

Step 5B-4 historical tax-saving pure helper date: 2026-06-13 (`docs/STEP5B4_HISTORICAL_TAX_SAVING_HELPER.md`)

Step 5B-5 historical tax-saving service/composition date: 2026-06-13 (`docs/STEP5B5_HISTORICAL_TAX_SAVING_SERVICE.md`)

ASSET-MAP-ETF-DECOMPOSITION-FIX-1 date: 2026-06-15 (`docs/ASSET_MAP_ETF_DECOMPOSITION_FIX1.md`)

## Project Root Decision

- Actual working directory: `C:\gv\gorani_vercel`
- Decision: this repository root is the Next.js target project. The newly added `original/` folder is read-only reference source.
- Evidence: root contains `app/`, `components/`, `lib/`, `public/`, `package.json`, `next.config.mjs`, `tsconfig.json`, and `package-lock.json`.
- `target/` folder: not present. Treat repository root as `target`.
- `original/` folder: present. Treat `original/` as the original Streamlit/Python project for reference only.
- Confirmed original paths:
  - `original/app.py`: present
  - `original/core/`: present
  - `original/logic/`: present
  - `original/pages_app/`: present
- Root zip files were left untouched:
  - `cococute88-opt-gorani-finance-v2-main.zip`
  - `qld2.zip`

## Root Files And Folders

Top-level project items observed:

- `.git/`
- `original/`
- `app/`
- `components/`
- `docs/`
- `lib/`
- `public/`
- `.env.example`
- `.gitignore`
- `.next-dev-3100.err.log`
- `.next-dev-3100.out.log`
- `.next-dev-3101.err.log`
- `.next-dev-3101.out.log`
- `cococute88-opt-gorani-finance-v2-main.zip`
- `firestore.rules`
- `gorani_finance_fable_codex_master_plan.md`
- `MERGE_NOTE.md`
- `next.config.mjs`
- `package-lock.json`
- `package.json`
- `postcss.config.mjs`
- `qld2.zip`
- `README.md`
- `tailwind.config.ts`
- `tsconfig.json`

## Original Reference Project

`original/` is now present and is the reference-only Streamlit/Python source tree. It was not moved, extracted from zip, or modified in this path update.

Observed `original/` top-level structure:

- `.devcontainer/`
- `.github/`
- `.streamlit/`
- `core/`
- `data/`
- `docs/`
- `logic/`
- `modules/`
- `pages_app/`
- `scripts/`
- `ui/`
- `app.py`
- `bear.ico`
- `README.md`
- `requirements.txt`

## Config Summary

- `package.json`
  - App name: `pftool-dashboard`
  - Framework/runtime: Next.js `14.2.5`, React `18.3.1`
  - Key dependencies: `recharts`, `lucide-react`, `xlsx`, `firebase`
  - Scripts after this step: `dev`, `build`, `start`, `lint`, `typecheck`
- `tsconfig.json`
  - Strict TypeScript enabled.
  - `allowJs` enabled.
  - `noEmit` enabled.
  - App Router generated types included via `.next/types/**/*.ts`.
  - Path alias: `@/*` maps to project root.
- `next.config.mjs`
  - `reactStrictMode: true`
- `.gitignore`
  - Existing ignores include `node_modules`, `.next`, build output, `.env*.local`, `.vercel`, and TypeScript build info.
  - Added in this step: `.next-dev-*.log`, `*.zip`.

## Main Folder Structure

### `app/`

- Uses Next.js App Router.
- Root files: `layout.tsx`, `globals.css`, `page.tsx`.
- Route folders with `page.tsx`:
  - `asset-map`
  - `asset-simulator`
  - `calculator`
  - `dividends`
  - `market`
  - `performance`
  - `portfolio`
  - `portfolio-manager`
  - `qld-dashboard`
  - `watchlist`

### `components/`

- Shared top-level components: navigation, metric cards, portfolio summary, charts, tables, treemap mock, watchlist row.
- Feature folders:
  - `asset-simulator/`
  - `auth/`
  - `calculator/`
  - `common/`
  - `dividend/`
  - `market/`
  - `portfolio/`
  - `qld/`
  - `watchlist/`

### `lib/`

- Finance/domain helpers:
  - asset simulator, calculator, dividend capture, MDD calculator, conversion calculator
  - market data wrapper
  - portfolio aggregation/store/tags/types
  - Banksalad parser and ticker mapper
- Mock/data files:
  - `mockData.ts`
  - `mock-asset-simulator-data.ts`
  - `mock-calculator-data.ts`
  - `mock-calendar-data.ts`
  - `mock-dividend-data.ts`
  - `mock-market-data.ts`
  - `mock-portfolio-data.ts`
  - `qldDashboardData.ts`
- Firebase folder:
  - `firebase/client.ts`
  - `firebase/auth.ts`
  - `firebase/firestore-repositories.ts`

### `public/`

- `gorani-logo.png`

### `docs/`

- Existing document before this audit:
  - `firebase-setup.md`
- Added/updated by this step:
  - `AUDIT.md`
  - `STEP0_PATH_UPDATE.md`

## Route Status

Build evidence: `npm.cmd run build` generated static pages successfully for 14 app entries including `/_not-found`.

| Requested route | Route file present | Current behavior | Build/render status |
| --- | --- | --- | --- |
| `/` | Yes, `app/page.tsx` | Redirects to `/portfolio` | Renderable redirect; build success |
| `/portfolio` | Yes, `app/portfolio/page.tsx` | Portfolio dashboard page | Renderable; build success |
| `/dividends` | Yes, `app/dividends/page.tsx` | Dividend page component | Renderable; build success |
| `/performance` | Yes, `app/performance/page.tsx` | Performance page | Renderable; build success |
| `/watchlist` | Yes, `app/watchlist/page.tsx` | Watchlist/dividend calendar page | Renderable; build success |
| `/market` | Yes, `app/market/page.tsx` | Market page component | Renderable; build success |
| `/calculator` | Yes, `app/calculator/page.tsx` | Calculator page component | Renderable; build success |
| `/asset-simulator` | Yes, `app/asset-simulator/page.tsx` | Asset simulator page component | Renderable; build success |
| `/portfolio-manager` | Yes, `app/portfolio-manager/page.tsx` | Portfolio manager page component | Renderable; build success |
| `/asset-map` | Yes, `app/asset-map/page.tsx` | Redirects to `/market` | Renderable redirect; build success |
| `/qld-dashboard` | Yes, `app/qld-dashboard/page.tsx` | Redirects to `/portfolio` | Renderable redirect; build success |
| `/login` | No | Current route absent | Currently absent; not created |
| `/settings` | No | Current route absent | Currently absent; not created |
| `/legacy` | No | Current route absent | Currently absent; not created |

## NAV_ITEMS

`lib/mockData.ts` exists and exports `NAV_ITEMS`. Current navigation hrefs:

- `/portfolio`
- `/dividends`
- `/performance`
- `/watchlist`
- `/market`
- `/calculator`
- `/asset-simulator`
- `/portfolio-manager`

Notes:

- `NAV_ITEMS` does not include `/asset-map`, `/qld-dashboard`, `/login`, `/settings`, or `/legacy`.
- The file contains Korean display text and emoji-like icons. Content was not changed in this step.

## Suspected Mock Data Usage

Primary mock/data source files:

- `lib/mockData.ts`
- `lib/mock-asset-simulator-data.ts`
- `lib/mock-calculator-data.ts`
- `lib/mock-calendar-data.ts`
- `lib/mock-dividend-data.ts`
- `lib/mock-market-data.ts`
- `lib/mock-portfolio-data.ts`
- `lib/qldDashboardData.ts`

Important import/use sites:

- `components/TopNav.tsx` imports `NAV_ITEMS` from `lib/mockData.ts`.
- `app/portfolio/page.tsx` imports portfolio/ticker/allocation mock data from `lib/mockData.ts`.
- `app/performance/page.tsx` imports `PERFORMANCE_KPIS` from `lib/mockData.ts`.
- `components/PortfolioSummary.tsx`, `components/AssetAccountCards.tsx`, `components/PerformanceChart.tsx`, `components/TreemapMock.tsx`, and `components/HoldingsTable.tsx` use `lib/mockData.ts`.
- `components/market/MarketPage.tsx` and related market components use `lib/mock-market-data.ts`.
- `components/dividend/DividendPage.tsx` uses `lib/mock-portfolio-data.ts` and `lib/mock-dividend-data.ts`.
- `components/watchlist/DividendCalendarPage.tsx` and watchlist calendar components use `lib/mock-calendar-data.ts` and `lib/mock-dividend-data.ts`.
- `components/asset-simulator/AssetSimulatorPage.tsx` and `lib/asset-simulator.ts` use `lib/mock-asset-simulator-data.ts`.
- `components/portfolio/PortfolioPage.tsx` uses `MOCK_LATEST_SNAPSHOT` from `lib/mock-portfolio-data.ts`.
- `components/qld/QldDashboardPage.tsx` uses QLD mock/dashboard data through `lib/qldDashboardData.ts`.

## Firebase/Auth/Firestore Presence

Firebase/Auth/Firestore files exist:

- `lib/firebase/client.ts`
  - Initializes Firebase client SDK when `NEXT_PUBLIC_FIREBASE_*` env values are configured.
  - Exports `firebaseApp`, `firebaseAuth`, `firestoreDb`, and `isFirebaseConfigured`.
- `lib/firebase/auth.ts`
  - Provides `useFirebaseAuth`.
  - Uses Google popup auth, `onAuthStateChanged`, and `signOut`.
  - Calls `ensureUserProfile`.
- `lib/firebase/firestore-repositories.ts`
  - Contains Firestore persistence helpers for portfolio snapshots, calendar tickers/events/settings, asset simulator config, and calculator presets.
- `components/auth/LoginButton.tsx`
- `components/auth/AuthStatus.tsx`
- `components/common/StorageModeBadge.tsx`
- `firestore.rules`
- `docs/firebase-setup.md`
- `.env.example`

No Firebase Admin SDK, server API routes, or Cloud Functions were observed in this audit.

## Verification Results

Commands requested and results:

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | Passed via `npm.cmd install` | Direct `npm install` in PowerShell was blocked by local execution policy for `npm.ps1`; `npm.cmd` completed successfully. |
| `npm run build` | Passed via `npm.cmd run build` | Next.js compiled, linted, type-checked, and generated static pages successfully. |
| `npm run lint` | Passed via `npm.cmd run lint` | Initially prompted for ESLint config because none existed. Added minimal Next ESLint baseline, then passed with no warnings/errors. |
| `npm run typecheck` | Passed via `npm.cmd run typecheck` | `tsc --noEmit` passed. A parallel run during `next build` hit a transient `.next/types` race; sequential final run passed. |

Path update verification on 2026-06-12:

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run build` | Passed | Next.js compiled and generated static pages successfully after `original/` was added. |
| `npm.cmd run lint` | Passed | No ESLint warnings or errors. |
| `npm.cmd run typecheck` | Passed | `tsc --noEmit` completed successfully. |

Dependency warnings observed:

- `npm install` reported vulnerabilities.
  - Before ESLint devDependency addition: 3 vulnerabilities.
  - After adding ESLint tooling: 9 vulnerabilities.
- `next@14.2.5` emitted a security vulnerability deprecation warning.
- `recharts@2.12.7` emitted a deprecation warning for the inactive 1.x/2.x branches.
- These warnings were not remediated in Step 0 to avoid dependency upgrade scope creep.

## Files Modified In This Step

- `package.json`
  - Added `typecheck`.
  - Added `eslint` and `eslint-config-next` devDependencies for non-interactive `next lint`.
- `package-lock.json`
  - Updated by `npm install`.
- `.gitignore`
  - Added `.next-dev-*.log`.
  - Added `*.zip`.
- `.eslintrc.json`
  - Added minimal Next.js ESLint baseline.
- `docs/AUDIT.md`
  - Added this audit document.
- `docs/AUDIT.md`
  - Updated after `original/` was added to record the current path layout.
- `docs/STEP0_PATH_UPDATE.md`
  - Added path update summary after `original/` was added.

## Risks And Next-Step Priorities

1. Original source is now present but must remain read-only reference input.
   - `original/` is present with `app.py`, `core/`, `logic/`, and `pages_app/`.
   - Future migration work should compare against `original/` deliberately, without moving Next.js files or creating a separate `target/` folder.

2. Some requested routes are absent.
   - `/login`, `/settings`, and `/legacy` do not currently exist.
   - They were not created in this step.

3. Some routes are redirect-only.
   - `/` redirects to `/portfolio`.
   - `/asset-map` redirects to `/market`.
   - `/qld-dashboard` redirects to `/portfolio`.
   - If later steps expect standalone pages, this should be handled intentionally without deleting existing feature components.

4. Mock data remains widely used.
   - Portfolio, dividends, market, watchlist/calendar, calculator, asset simulator, and QLD dashboard areas still depend on mock/data fixtures.
   - Next steps should replace mocks module by module with clear fallback behavior.

5. Dependency/security warnings exist.
   - Next.js `14.2.5` warning should be reviewed before production hardening.
   - npm audit reports vulnerabilities. Upgrades should be planned separately because they may affect Next, lint tooling, or chart behavior.

6. Encoding/display quality should be checked.
   - Several Korean labels in `lib/mockData.ts` display as mojibake when read in the terminal, though the app currently builds.
   - This may affect UI text quality and should be audited visually before user-facing release.

7. Firebase is client-only and environment-dependent.
   - Auth/Firestore code exists, but behavior depends on `NEXT_PUBLIC_FIREBASE_*` env values.
   - Firestore rules must be applied manually or through a later deployment workflow.

## 2026-06-13 Full Requirements Replay UTF-8 Audit

- See `docs/FULL_REQUIREMENTS_REPLAY_UTF8_AUDIT.md` for the full previous-requirements replay audit, mojibake scan, safety fixes, and verification results.

## 2026-06-13 Step 5B-6 Historical Tax-Saving Dialog UI

- Connected `loadHistoricalTaxSavingMetricForTicker` to `CalendarEventDialog` as a compact auxiliary metric for eligible generated dividend events only; `TaxSavingTable` formula unchanged. See `docs/STEP5B6_HISTORICAL_TAX_SAVING_DIALOG_UI.md`.

## 2026-06-13 Step 5B-7 Historical Tax-Saving Dialog Cache And Source Badge

- Added an in-memory session cache with in-flight deduplication (`lib/historical-tax-saving-session-cache.ts`, key = uppercase ticker, TTL 30m) so reopening an event dialog avoids refetching, plus a small muted `출처:` source line inside the existing metric card; `TaxSavingTable` unchanged. See `docs/STEP5B7_HISTORICAL_TAX_SAVING_DIALOG_CACHE.md`.

## 2026-06-13 Step 5C-0 Watchlist Final QA And Regression Audit

- Audit-only QA pass over `/watchlist` (no source changes): all checks/build/lint/typecheck pass; desktop/390/320 have no page-level overflow; TaxSavingTable shows live values; historical metric, custom event CRUD, and cache/provider sanitization verified. No P0/P1 found; one P2 (static `0.00%`/`$0.0` Info cells in `CalendarEventDialog`) recommended for an optional Step 5C-1. See `docs/STEP5C0_WATCHLIST_FINAL_QA.md`.

## 2026-06-13 Step UI-1 Targeted UI Polish And Market Restructure

- Display-only UI polish: compact dividend-capture 판정 column (long text moved to a `title` tooltip, table min-width 900→820px), portfolio SCHD progress label no longer crowds the right edge, portfolio donut legends now show compact KRW + percent via `formatCompactKrw`, and the resolved Step 5C-0 P2 (`CalendarEventDialog` static zero fields now render `—`). `/market` restructured to mirror the original Streamlit 시장온도 order (top briefing → RSI → MDD → VIX → 참고 시트 → 섹터 트리맵 → 자산 맵) in dark theme, removing the duplicate market-temperature / Fear&Greed sections. No calculation, tax, parser, quote-API, calendar-provider, or Firestore logic changed. See `docs/UI1_TARGETED_POLISH_MARKET_RESTRUCTURE.md`.

## 2026-06-13 Step UI-2 Top Nav Responsive Overflow Fix

- Replaced desktop top-nav horizontal scrolling with measured fit/collapse behavior: show the maximum fitting prefix of nav items, keep `더보기` visible for hidden items, hide it when all items fit, and preserve mobile two-shortcut behavior. See `docs/UI2_TOP_NAV_RESPONSIVE_FIX.md`.

## 2026-06-13 Step UI-2B Top Nav Priority/Collapse Proper Fix

- Unified the previously split mobile (hardcoded 2 items) and desktop (measured) nav into one measured priority nav for all widths: two-row layout below `lg` (logo + right controls on row 1, full-width nav on row 2), single row at `lg+`, with `더보기` pinned to the far right via `ml-auto` and hidden only when every item fits. Fixes too-aggressive collapse at 350–750px (now 3–8 items instead of 2) and the mid-floating `더보기` at ~780px. Header-only change; no page content, calculator, parser, quote-API, calendar-provider, or Firestore logic touched. See `docs/UI2B_TOP_NAV_PRIORITY_FIX.md`.

## 2026-06-13 Step ASSETMAP-1 Move Asset Map To Portfolio Manager

- Moved the asset-map / ETF look-through section from `/market` to the bottom of `/portfolio-manager`, changed `/asset-map` to redirect to `/portfolio-manager`, and added an explicit mock/portfolio-detected status because no ETF constituent dataset exists yet. See `docs/ASSETMAP1_MOVE_TO_PORTFOLIO_MANAGER.md`.

## 2026-06-13 Step ASSETMAP-2 Real Portfolio Exposure Calculation

- Replaced asset-map mock-only sector/TOP100 data with latest `/portfolio-manager` snapshot exposure calculation using local ETF top-holdings fixtures, direct ticker sector mapping, ticker normalization, uncovered ETF warnings, and `check:asset-map` regression coverage. See `docs/ASSETMAP2_REAL_PORTFOLIO_EXPOSURE.md`.

## 2026-06-13 Step DIVIDENDS-1 Snapshot Holding Groups

- Refactored `/dividends` to derive taxable and tax-advantaged dividend holding tables from the latest portfolio snapshot, removed derived-table edit/delete controls, added summary/chart group controls, and removed non-functional asset-map controls. See `docs/DIVIDENDS1_SNAPSHOT_HOLDING_GROUPS.md`.

## 2026-06-13 Step DIVIDENDS-2 Classification And Snapshot Preview Fix

- Fixed dividend bucket/ticker inference for S&P500 pension-style products, widened tax-advantaged marker scanning to `④` and other relevant fields, and added read-only snapshot history click-to-preview in `/portfolio-manager`. See `docs/DIVIDENDS2_CLASSIFICATION_AND_SNAPSHOT_PREVIEW_FIX.md`.

## 2026-06-13 Step DIVIDENDS-3 Strict Classification Hotfix

- Tightened `/dividends` taxable classification to strict `①SCHD/SPY/MSFT + ②위탁 + no tax-advantaged signal`, broadened tax-advantaged inclusion to any pension/ISA/IRP/tax-saving signal, and added strict regression coverage. See `docs/DIVIDENDS3_STRICT_CLASSIFICATION_HOTFIX.md`.

- 2026-06-14 Step PORTFOLIO-TICKER-1: Added a Korean ETF registry and quoteTicker/dividendBucket/exposureProxy normalization for ACE/KINDEX 미국S&P500 `360200.KS`, safe S&P500/Nasdaq100 bucket fallbacks, dividends, and asset-map behavior. See `docs/PORTFOLIO_TICKER1_KOREAN_ETF_REGISTRY.md`.
- 2026-06-14 Step PORTFOLIO-TICKER-2: Expanded Korean ETF aliases for ACE/RISE/KBSTAR/TIGER S&P500/Nasdaq100 mappings, added cash-like/MMF normalizer exclusion, and extended registry/dividend/asset-map regressions. See `docs/PORTFOLIO_TICKER2_KOREAN_ETF_REGISTRY_EXPANSION.md`.
- 2026-06-14 Step PORTFOLIO-TICKER-3: Fixed ISA/no-space Korean ETF rows that preserved bucket tickers by upgrading known `SPY`/`QQQ` bucket mistakes to registry KRX quote tickers while keeping dividendBucket/exposureProxy behavior. See `docs/PORTFOLIO_TICKER3_ISA_ALIAS_AND_BUCKET_UPGRADE_FIX.md`.
- 2026-06-14 Step DIVIDENDS-4: Rebuilt `/dividends` holding classification as a row-preserving snapshot view with common cash/small/unknown-bucket exclusions, strict taxable rules, tax-advantaged ISA/pension inclusion, and visible-total regressions. See `docs/DIVIDENDS4_ROW_PRESERVING_CLASSIFICATION_FIX.md`.
- 2026-06-14 Step DIVIDENDS-5: Reordered `/dividends` holding table columns, added real-only quantity/average-cost/current-price display plus per-table weight, audited parser availability, and extended dividend holding regressions. See `docs/DIVIDENDS5_TABLE_COLUMNS_AND_QUANTITY_AUDIT.md`.
- 2026-06-14 Step THEME-1/HEADER-1/AUTH-1: Added a dependency-free light/dark theme system (ThemeProvider + CSS-variable tokens + Tailwind `darkMode:"class"` + no-flicker script), removed the dead header bell for a `라이트/다크/시스템` selector, and always-show the Google login button (disabled when Firebase is unconfigured). Dark mode preserved; light mode follows the ETF쇼핑 tone. See `docs/THEME1_LIGHT_DARK_HEADER_AUTH.md`.
- 2026-06-14 Step THEME-2: Light-mode polish hotfix — replaced the navy "light" header with a true white header, made the theme selector a two-option 라이트/다크 control (monitor/system icon removed from UI), and added a scoped `.light` override layer in `app/globals.css` that remaps bare dark `bg-[#…]`/`border-[#…]`/light-text utilities and recharts grid/axis/tooltip surfaces to light values without touching dark mode or button/active-nav styling. See `docs/THEME2_LIGHT_MODE_POLISH_HOTFIX.md`.
- 2026-06-14 Step PORTFOLIO-PERF-UI-1: Reorganized `/portfolio` (current snapshot overview) vs `/performance` (time-series analysis) — split 계좌 현황 into 위탁/절세 groups via `lib/account-status-group.ts`, removed the mock QLD valuation charts + duplicate `QldValueFxChart` from `/portfolio`, removed `/performance`'s unused 시뮬레이션·목표 tab and the 임대소득 chart series (schema kept), made `PerformanceChart` theme-aware, and labeled remaining mock sections with a `샘플 데이터` badge. See `docs/PORTFOLIO_PERFORMANCE_UI1_RESTRUCTURE.md`.
- 2026-06-14 Step UI-3: Capped `/asset-simulator` 연도별 투자 계획표 to ~10 visible rows via an internal `max-h` vertical scroller with a sticky header (desktop table + mobile cards), and made `/portfolio` place 배당/성장 트리맵 left with 위탁/절세 계좌 현황 stacked compact (2-col) on the right at `min-[1300px]`, stacking cleanly below that breakpoint — layout-only, no data/classification/theme-architecture changes. See `docs/UI3_ASSET_SIMULATOR_AND_PORTFOLIO_LAYOUT_POLISH.md`.
- 2026-06-14 Step UI-3B: Restored compact `/portfolio` wide desktop treemap width by capping the 1300px+ left column at 560px and keeping 위탁/절세 계좌 현황 on the right; layout-only hotfix. See `docs/UI3B_PORTFOLIO_TREEMAP_WIDTH_HOTFIX.md`.
- 2026-06-14 Step REALDATA-0: Audited route/component-level mock/static/sample usage and produced a real-data integration roadmap. See `docs/REALDATA0_MOCK_STATIC_DATA_AUDIT.md`.
- 2026-06-14 Step PERF-DATA-1: Connected `/performance` top KPI cards and main performance chart to `PortfolioSnapshot[]` history via a pure helper, removed real-looking mock KPI/chart values, kept dividend/CAGR unavailable instead of faking them, and left the lower QLD dashboard clearly labeled as sample. See `docs/PERF_DATA1_SNAPSHOT_HISTORY_PERFORMANCE.md`.
- 2026-06-14 Step PERF-DATA-2: Connected `/performance` lower QLD evaluation/ranking area to latest portfolio snapshots and holdings, removed the sample FX line from that route, and added QLD snapshot regressions. See `docs/PERF_DATA2_QLD_DASHBOARD_REALDATA.md`.
- 2026-06-14 Step TICKER-4: Added localStorage-backed KRX ticker reuse by normalized product name, connected the `/portfolio-manager` ticker input, and added regression coverage. See `docs/TICKER4_KRX_TICKER_NAME_MAP.md`.
- 2026-06-14 Step PORTFOLIO-DATA-1: Replaced `/portfolio` summary/allocation/account/treemap mock fallbacks with latest `PortfolioSnapshot` holdings and financeAssets data, added TICKER-4 display-time mapping, explicit empty/warning states, and `check:portfolio-realdata`. See `docs/PORTFOLIO_DATA1_REALDATA.md`.
- 2026-06-14 Step PORTFOLIO-UX-POLISH-1: Polished `/portfolio` after the real-data switch — rewrote developer-jargon warning/empty copy into user-friendly Korean, split actionable warnings from info notices, fixed light-mode contrast (RatioRow bars, summary divider), moved the `시장 지표 샘플` badge onto the ticker strip, translated and de-emphasized the live quote panel, and verified 1280/390/320px with no horizontal overflow in light and dark. See `docs/PORTFOLIO_UX_POLISH1.md`.
- 2026-06-14 Step PORTFOLIO-CALCULATOR-UX-FIX-2: Hid sub-200k accounts from `/portfolio` account cards/allocation (KPIs unchanged), switched 자산 구성 도넛 to 성장/배당/현금, regrouped the 보유종목 트리맵 to 위탁/절세 only, fixed ₩-number line wrapping (NBSP in `formatWon` + `.num` nowrap + `MoneyText` clamp), made `/performance` 종목 랭킹 show all rows with internal scroll plus 위탁/연금/ISA filters, and simplified the 배당치기/매도전환/MDD calculators to the original Streamlit inputs (removed preset UI). Added `check:portfolio-ux-rules` and `check:performance-ranking-filters`. See `docs/PORTFOLIO_CALCULATOR_UX_FIX2.md`.
- 2026-06-14 Step DIVIDENDS-DATA-1: Reconfirmed `/dividends` holding field coverage from parser/private snapshot checks, expanded conservative parser aliases for quantity/average/current/value/principal/currency/account/ticker fields, applied TICKER-4 name mapping at dividend display time without mutating snapshots, and stopped using mock yields for expected dividend values. See `docs/DIVIDENDS_DATA1_HOLDINGS_ALIAS.md`.
- 2026-06-14 Step DIVIDENDS-DATA-2: Connected `/dividends` to existing quote/dividend/fx routes for evaluation-value-based estimated quantity, estimated average cost, TTM dividend, annual/monthly expected dividend, and personal yield calculations while ignoring sample/mock dividend yield fallbacks. See `docs/DIVIDENDS_DATA2_QUOTE_DIVIDEND_ESTIMATES.md`.
- 2026-06-14 Step PORTFOLIO-DIVIDEND-UX-FIX-3: Made `/portfolio` 투자/현금 비중 derive from the same classification as the 자산 구성 도넛 (투자 = 성장+배당, 현금 = 현금(원)+현금(달러)) via a shared `computeAssetPurposeTotals`, fixing the 99.7%/0.3% vs 22.3% contradiction; split the 자산 구성 cash bucket into 현금(원)/현금(달러) by currency signal (no 기타); added a 환산 예상 배당 (평가금액 × 3.5%, 세후 토글 reflected, scoped to the selected 위탁/절세 evaluation amount) card so `/dividends` 배당 요약 now shows 5 cards; toned the estimate notice down to a neutral info style. Added `check:dividend-summary-cards` and extended `check:portfolio-ux-rules`. See `docs/PORTFOLIO_DIVIDEND_UX_FIX3.md`.
- 2026-06-14 Step MARKET-UX-POLISH-1: Polished `/market` charts — removed the lone VIX briefing card (`MarketTopBriefing`), added a shared `formatChartMonthTick` (`YY/MM`) reused by RSI/MDD/VIX x-axes, switched mock series to ISO dates (values unchanged), made the MDD chart a 0%-baseline negative-drawdown structure with clean `0/-5/-10/-15/-20%` auto-ticks (fixes the missing top `0%` and phantom `-25%`), and gave the VIX chart `20/30` reference lines (`VIX_THRESHOLDS`) plus clean 5-step y-ticks. Google sheet + US treemap untouched. Added `check:market-chart-formatters`. See `docs/MARKET_UX_POLISH1.md`.
- 2026-06-14 Step CALENDAR-LEGACY-IMPORT-1: Added a dev-only legacy RTDB dividend calendar JSON importer with browser-side preview, deterministic Firestore merge writes, sentinel-date exclusion, custom event mirroring, legacy memo/portfolio metadata preservation, and regression coverage. See `docs/CALENDAR_LEGACY_IMPORT.md`.
- 2026-06-14 Step CALENDAR-UX-POLISH-1: Polished the `/watchlist` 배당캘린더 right panel and U.S. economic schedule — capped the `종목별 예상 절세액` panel with an internal vertical scroller (`max-h` + `overflow-y-auto`) and narrowed the right rail (340px→260px) so the calendar grid widens; removed the Buy button column (now 종목 + 절세액 only, `$xx.xx` right-aligned); sorted current-visible-month Buy tickers to the top with a light-blue (`bg-blue-500/10`) row highlight; replaced the dividend-event `이번 달 주요 일정` rail card with a full-width `주요 미국 경제 일정` section split into 이번주/다음주 tables (date/time/지표명/중요도) driven by a static snapshot of the original Streamlit `economic_calendar_us_high.json`, with equal-height cards so only the longer week scrolls internally. Added `lib/economic-calendar-data.ts`, `components/watchlist/EconomicCalendarSection.tsx`, and `check:calendar-ux-rules`. Import/custom/filter/Firestore behavior untouched. See `docs/CALENDAR_UX_POLISH1.md`.
- 2026-06-14 Step CALENDAR-UX-POLISH-2: Reworked `/watchlist` 배당캘린더 表/필터/티커/메모/라이트모드. Rebuilt `전체 배당 일정` into an all-events table (one row per event) with Korean columns 종목/타입/상태/배당금/매수마감일/배당락일/지급일, per-column asc/desc sort (default = current-visible-month-first), an event-type filter (배당락/매수마감/지급/실적, all on by default), a 12-row capped internal scroll + sticky header, and an earnings-row policy (ticker/type/status only, dividend/buy/payment as `—`, earnings date in the 배당락일 cell). Wired the `기본 포트폴리오` 관리 button to a `PortfolioManageModal` (add/remove tickers via the existing calendarTickers store) and turned the lower 티커 관리 into a memo-only ticker grid that opens a per-ticker `TickerMemoDialog`; added legacy memo matching (`lib/calendar-memo-matching.ts`) + `loadLegacyDividendCalendarMemos`/`saveLegacyDividendCalendarMemo` so imported `legacyDividendCalendarMeta/memos` resolve by exact/uppercase/suffix-stripped ticker. Light-mode readability: explicit light/dark pairs for the economic section, purple (실적) tag remap, faint sky day-hover (`hover:bg-sky-50`, dark hover gated behind `dark:`), past events keep type color with a muted opacity veil (no full grayscale), and custom/user events render as date-line text next to the day number (no yellow 사용자 chip). Added `check:calendar-memo-matching` and extended `check:calendar-ux-rules`. Import/dedupe/sentinel/Firestore behavior untouched. See `docs/CALENDAR_UX_POLISH2.md`.
- 2026-06-15 Step CALENDAR-UX-POLISH-3: Fixed the `/watchlist` 배당캘린더 ticker/memo source and event mixing. Root cause: `WatchlistPage` derived calendar tickers from `/portfolio` snapshot holdings, so the 기본 포트폴리오 관리 modal + 하단 티커 관리 showed holdings (MSFT/SPY/`360200.KS`) instead of the legacy dividend-calendar universe, which also broke legacy memo matching. Added `lib/calendar-ticker-source.ts` (`resolveCalendarTickerSource`: legacy portfolios → imported calendarEvents tickers → legacy memo keys → mock fallback; `/portfolio` holdings never a source) + `loadLegacyDividendCalendarPortfolios`, and removed `usePortfolioSnapshots` from the page (explicit `calendarTickers` edits still override). Added `selectCalendarDividendEvents` so imported Firestore/legacy events are the single source of truth (no mock/preview SPY/QQQ mixing; header badge `IMPORTED`); the 전체 배당 일정 table uses the same gated events. Stabilized the calendar day-cell top line to a fixed height (`h-5`/`h-6`) so the date number + custom/economic inline text sit flush at the top of every cell (uniform date rows, custom text never takes a chip slot); removed the `사용자/경제 일정 = …` and `점선 = 추정` legend captions; faded non-declared/estimated events to `opacity-40` (declared past = `opacity-60`, upcoming = full) while keeping type color (no grayscale); fixed misleading 포트폴리오 보유종목 연동됨 / preview copy. Extended `check:calendar-provider`, `check:calendar-memo-matching`, `check:calendar-ux-rules`. Import/dedupe/sentinel/memo-path/Firestore behavior untouched. Local Firebase-미설정 preview still uses mock fallback (imported path is unit-tested). See `docs/CALENDAR_UX_POLISH3.md`.
- 2026-06-15 Step CALENDAR-UX-POLISH-4: Fixed two POLISH-3 regressions found on local + Vercel. (1) Stale ticker override: an old array-only `calendarTickers` value (localStorage + the legacy `calendarTickers` Firestore collection, seeded back when `/portfolio` holdings were the source) kept shadowing the imported legacy universe, so the 관리 modal + 하단 티커 관리 still showed QQQ/SPY/MSFT/`360200.KS` while the grid/절세액 panel showed legacy tickers (and memos couldn't match). Reworked `resolveCalendarTickerSource` to only honor a metadata-tagged manual override (`source: "manual-calendar-tickers"`, `version >= 2` via `isValidManualCalendarTickerList`); bare arrays are treated as stale and ignored (and the stale localStorage key is removed on read). Manual overrides now persist to localStorage (tagged object) + a single Firestore doc `users/{uid}/calendarSettings/manualTickers` (`load/saveManualCalendarTickers`); `WatchlistPage` no longer reads the stale `calendarTickers` collection. The first modal add/remove promotes the legacy-derived list into a tagged override. Modal, ticker manager, memo key, and grid/tax/filter all consume the one resolved `tickers`. (2) Custom/economic date-line: the POLISH-3 fixed-height row was still in normal flow (15 had excess top padding, 19/26 floated mid-cell), so re-pinned it as an absolute top layer (`absolute inset-x-1 top-1 z-10 flex h-5 … sm:h-6`) with chips cleared below via `pt-7/sm:pt-8` — date number now sits at an identical y-position in every cell (verified 5px across all 42 cells at 320/390/desktop) with custom text on the same line. Added `lib/firebase` manual-override helpers, `scripts/check-calendar-ticker-source.mjs` + `check:calendar-ticker-source`, and extended `check:calendar-ux-rules`/`check:calendar-memo-matching` (stale-override ignored, valid override wins, FEPI/BCSF memo lookup, absolute top-line classes). `/portfolio` holdings still never a source; non-declared `opacity-40`, removed legends, import/dedupe/sentinel/memo-path/Firestore untouched. Local Firebase-미설정 preview still uses mock fallback; stale-override fix reproduced locally (seeded stale array → ignored + key cleaned). See `docs/CALENDAR_UX_POLISH4.md`.
- 2026-06-14 Step CALENDAR-UX-POLISH-6: Finished the `/watchlist` 배당캘린더 day-cell density + selected-date card UI. (1) Day cells now show up to THREE event chips beneath the date/custom-economic line (`dayEvents.slice(0, 2)` → `slice(0, 3)`); the chip block stays top-anchored (`justify-start`, no vertical centering) directly under the date line, the cell `min-h` is unchanged (cells only grow naturally for busy days like 29/30), overflow still collapses to `+N`, and chips keep `truncate`/`min-w-0` so 320px has no horizontal overflow. (2) Selected-date cards (`CalendarEventList`) light-mode style fixed: explicit `bg-white` base (was the gray `--muted` remap of a bare dark hex), faint `hover:bg-sky-50` / `focus-visible:bg-sky-50` + `ring-sky-200` tint (the dark `#1d2527` surface is now gated behind `dark:` so it can never flash near-black in light mode), readable slate text. (3) Each card date line shows `날짜 · 만달러당 절세예상액(현시세) · 확정/예상` (`eventStatusShortLabel` → 확정/예상, `formatTaxSavingPer10k`) reusing the same `buildTaxSavingRows` per-ticker estimate as the right-rail 절세액 table (`taxSavingByTicker` threaded page→list→card); missing/loading/non-computable → `—` (never fabricated). (4) Memo UI prepared: cards accept a `tickerMemos` prop (resolved via the existing `lookupTickerMemo`, read-only) and render the 종목 메모 to the right of the badge on desktop / below it on mobile (`line-clamp-2`), hidden cleanly when absent (no placeholder); `WatchlistPage` passes the already-loaded `memos` down. The deeper memo source/matching (legacy imported memos not yet surfacing on Firebase-connected env) is intentionally left as a follow-up Codex TODO **CALENDAR-MEMO-SOURCE-FIX-1** — no memo source/matching/Firestore/import logic changed. Added `scripts/check-calendar-selected-date-cards.mjs` + `check:calendar-selected-date-cards` and extended `check:calendar-ux-rules` (3-chip cap). Legacy ticker source, stale-override policy, IMPORTED gate, non-declared opacity, past/outside color, custom date-line top alignment, 전체 배당 일정 table, 미국 경제 일정, import tool, and `/dev/calendar-import` untouched. See `docs/CALENDAR_UX_POLISH6.md`.

- AUTH-FIRESTORE-PERSISTENCE-1: 모바일 Google Auth local persistence/redirect fallback, portfolio snapshot local+Firestore merge sync, loading empty-state guard, Logout label, and status badge policy documented in `docs/AUTH_FIRESTORE_PERSISTENCE1.md`.

- CALENDAR-MEMO-TAXSOURCE-FIX-1: Unified CalendarEventDialog ticker-level memo source with TickerMemoDialog/SelectedDateList and reused the TaxSavingTable per-$10k tax-saving map; clarified annual yield as annual dividend yield.

- ASSET-PORTFOLIO-UX-POLISH-1: `/asset-simulator` 입력폼을 desktop 4-column(`lg:grid-cols-4`, tablet 2 / mobile 1)으로 압축하고 초기화 왼쪽에 즉시 저장 `Save` 버튼(+`저장됨` 상태)을 추가; `/portfolio` 보유종목 트리맵 면적을 전역 `valueKRW` 비중에 비례시키고(2% 미만 종목은 트리맵 표시에서만 제외, 랭킹/요약 유지), 색상을 카테고리(나스닥=red / 현금=green / SPY·SCHD·MSFT=yellow / 기타=blue)로 분기하며 라이트모드는 연한 100~200 톤+slate-900 텍스트로 가독성 확보; 트리맵·종목별 비중 상위 도넛 라벨을 KRX 숫자 티커(`360200.KS` 등) 대신 한글 상품명으로 표시(`lib/holding-display-label.ts` 공유 helper); 라이트모드에서 `scroll-dark` 하드코딩 컴포넌트가 검게 보이던 스크롤바를 `.light .scroll-dark` 분기로 밝은 회색 복구. 시장현황 실데이터(공포탐욕/RSI/MDD/VIX)는 후속 Codex 작업으로 분리. Added `lib/treemap-color.ts` + `check:asset-portfolio-ux-polish`. See `docs/ASSET_PORTFOLIO_UX_POLISH1.md`.

- ASSET-ALLOCATION-DONUT-STREAMLIT-RESTORE-1: 기존 Streamlit 자산군 도넛 로직(`original/logic/tracker.py` / `original/pages_app/2_asset_tracker.py` 의 `get_asset_type`/`get_super_group`/`assign_colors`/`sort_tags_by_super_group`)을 `lib/asset-allocation-donut.ts` 로 복원하고, 공통 컴포넌트 `components/portfolio/AssetAllocationDonut.tsx` 로 `/portfolio`·`/portfolio-manager`·스냅샷 히스토리 상세 세 화면에서 재사용. `/portfolio` 의 단순 `종목별 비중 상위 15개` 도넛을 자산군(TQQQ/QLD/QQQ=나스닥성, SPY/SPYM/VOO/S&P=spy, SCHD=배당, 현금/달러/예적금/MMF/SGOV=현금성, 기타 개별주=other) 도넛으로 교체(슈퍼그룹 합계→타입 합계→금액 순 정렬로 유사 자산군 인접 배치, 토스 톤다운 팔레트 고정색, KRX 숫자 ticker→한글 상품명). `/portfolio-manager` 는 엑셀 업로드/자산군 도넛/파싱결과 요약을 한 줄 3-카드(`md:grid-cols-2 xl:grid-cols-3`)로 구성(파싱 preview 우선 → 없으면 최신 스냅샷 → 없으면 empty state), 스냅샷 히스토리 날짜 선택 시 해당 스냅샷 기준 도넛을 항목 리스트 위에 표시. 투자성 재무자산 이중집계 방지, invalid/0/NaN 방어, empty 안전 처리. ETF look-through TOP100 분해(`토스SPYM` wrapper 혼입)는 후속 Codex 작업 `ASSET-MAP-ETF-DECOMPOSITION-FIX-1` 로 분리. Added `check:asset-allocation-donut`. See `docs/ASSET_ALLOCATION_DONUT_STREAMLIT_RESTORE1.md`.
- 2026-06-15 Step ASSET-ALLOCATION-DONUT-FIX-2: Fixed the `자산군 비중` donut helper to aggregate by normalized asset category instead of raw holding display labels, so broker/product names such as `키움TQQQ1`, `키움QLD`, and `토스SPYM` now collapse into `나스닥 레버리지`, `S&P500`, `배당`, `현금/달러`, or `기타` category slices; added regression coverage for the exact complaint and Korean ETF wrapper names. See `docs/ASSET_ALLOCATION_DONUT_GROUPED_CATEGORY_FIX2.md`.

- PORTFOLIO-TOTALS-RECONCILE-1: 총 금융자산 headline 기준과 투자 평가금액/현금성 기타자산 reconciliation helper를 추가하고 `/portfolio` 총액 라벨을 정리했다.

- 2026-06-15 Step PERFORMANCE-DONUT-RANKING-1: `/performance`(투자 성과) 좌측 카드의 자산 구성 영역을 기존 stacked bar + Top 5 상품명 리스트에서 Streamlit 스타일 도넛 그래프로 교체했다. 도넛은 원본 상품명(`키움TQQQ1` 등)이 아니라 정규화 종목군 단위(`TQQQ`/`QLD`/`QQQ`/`SPY`/`SCHD`/`MSFT`/`달러`/`현금`/`예적금`/`기타`)로 합산하며, 하단 범례에 `종목군 / 비중 / 수익률 / 금액`(예: `TQQQ / 31.7% / (+182.2%) / 2.14억`)을 함께 표시한다. 그룹 수익률은 그룹 합산 평가금액/투자원금 기준(`(value-principal)/principal`)이며 원금이 없으면 `(-)` 처리. 색상 규칙(TQQQ 진빨강/QLD 빨강/QQQ 핑크/SPY 주황/MSFT 진노랑/SCHD 노랑/달러·현금·예적금 초록 계열/기타 하늘색) 적용. 같은 페이지 하단 `종목 랭킹` 표에 비중/평가금액/투자원금/누적 손익/누적 수익률 컬럼 헤더 클릭 정렬(오름/내림 토글, 화살표 표시, numeric sort, null/NaN 하단 고정)을 추가했고 계좌 필터(위탁/연금/ISA)와 공존(필터→정렬→렌더 순서)한다. 새 helper `lib/performance-asset-group.ts`, 컴포넌트 `components/performance/PerformanceAllocationDonut.tsx`, `check:performance-donut-ranking` 추가. `/market` 실데이터(공포탐욕/RSI/MDD)는 후속 Codex `MARKET-DATA-1` 로 분리. See `docs/PERFORMANCE_DONUT_RANKING1.md`.

- MARKET-DATA-1: /market mock/static market curves replaced with a server-backed CNN/Yahoo live data adapter and explicit unavailable states.
- 2026-06-15 Step PORTFOLIO-ACCOUNT-RETURNS-RECONCILE-1: Reconciled `/portfolio` account-status cards so account principal/profit/return rate are calculated when account-level holdings principal can be matched, while preserving financeAssets-first valuation, 200k visibility filtering, 위탁/절세/미확인 classification, and safe missing-principal warnings. See `docs/PORTFOLIO_ACCOUNT_RETURNS_RECONCILE1.md`.

- 2026-06-15 Step PORTFOLIO-TOTALS-RECONCILE-1-FINALIZE: Finalized `/portfolio` total financial asset headline semantics, clarified investment/cash-other supporting labels, added totals source metadata checks, and aligned `/performance` KPI wording with investment evaluation semantics. See `docs/PORTFOLIO_TOTALS_RECONCILE1.md`.
- MARKET-FEAR-GREED-CHART-LABELS-1: 공포탐욕 차트 x축 월 표기와 tooltip 날짜 표기 수정
- PORTFOLIO-OVERVIEW-CLEANUP-1: /portfolio 상단 sample market badge, verbose notices, 구성 요약, 비동작 계좌 추가 버튼 제거. See `docs/PORTFOLIO_OVERVIEW_CLEANUP1.md`.
- PORTFOLIO-OVERVIEW-CLEANUP-1-FOLLOWUP: /portfolio 상단 compact 시장지표 strip을 `/api/market` live briefing 기반으로 복구(mock/static·샘플 표시 없이 live/partial/unavailable 상태만 표기). `components/portfolio/PortfolioMarketIndicatorStrip.tsx` 추가.
- PORTFOLIO-OVERVIEW-CLEANUP-1-FOLLOWUP-2: 시장지표 카드 오른쪽에 live 미니 스파크라인 복구. `BriefingItem.sparkline`(실데이터 Yahoo 1개월 daily close)을 `lib/server/market-fetchers.ts`에서 함께 내려주고 strip이 SVG로 렌더(상승 빨강/하락 파랑, fake/random 미사용).

- PORTFOLIO-MARKET-INDICATORS-LIVE-VERIFY-1: /portfolio 시장지표 sample/static source 점검 및 /api/market live data 재사용 정리. See `docs/PORTFOLIO_MARKET_INDICATORS_LIVE1.md`.

- 2026-06-15 Step CALENDAR-PRIORITY-SORT-TAX-SORT-ESTIMATE-STYLE-1: 캘린더 하트/별 우선정렬, 절세액 정렬, 추정 일정 회색 row 스타일 추가. See `docs/CALENDAR_PRIORITY_TAX_STYLE1.md`.

- 2026-06-15 Step CALENDAR-LAYOUT-WIDE-STREAMLIT-POLISH-1: 배당캘린더 와이드 레이아웃, 하단 필터 toggle, 일정 chip 절세액 표시, 포트폴리오 관리/티커 관리 병합. See `docs/CALENDAR_WIDE_LAYOUT_POLISH1.md`.

- ASSET-SIMULATOR-PERSISTENCE-FIX-1: /asset-simulator Save 버튼의 local/cloud persistence 및 재접속 복원 오류 수정. See `docs/ASSET_SIMULATOR_PERSISTENCE_FIX1.md`.
