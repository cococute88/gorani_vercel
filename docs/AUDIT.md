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
