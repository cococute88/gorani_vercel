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
