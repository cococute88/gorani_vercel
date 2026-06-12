# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gorani Finance** is a Next.js 14 (App Router) portfolio dashboard application for Korean-language financial tracking and analysis. It is being migrated from an original Streamlit/Python codebase (`original/` directory) to Next.js/TypeScript/Tailwind CSS.

- **Framework**: Next.js 14.2.5 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: lucide-react
- **Backend**: Firebase (client-only: Auth with Google popup, Firestore for persistence)
- **Data sources**: Free quote APIs for live market data; mock data fallbacks throughout

## Commands

```bash
# Development
npm run dev              # Start dev server on http://localhost:3000

# Build and production
npm run build            # Next.js production build
npm start                # Start production server

# Code quality
npm run lint             # ESLint check
npm run typecheck        # TypeScript type check (tsc --noEmit)
```

All commands use `npm.cmd` on Windows due to PowerShell execution policy restrictions.

## Architecture

### Path Aliases
- `@/*` maps to project root (configured in `tsconfig.json`)

### Directory Structure

**`original/`**: Read-only reference Streamlit/Python source. Contains the original calculator logic (`logic/`), page implementations (`pages_app/`), and core modules (`core/`). Never modify these files.

**`app/`**: Next.js App Router pages
- Each route folder contains a `page.tsx` (e.g., `app/calculator/page.tsx`)
- Root redirect: `/` → `/portfolio`
- Some routes redirect: `/asset-map` → `/market`, `/qld-dashboard` → `/portfolio`
- API routes under `app/api/quote/`: history, dividends, last, fx

**`components/`**: React components organized by feature
- Top-level: shared components (`TopNav.tsx`, `MetricCard.tsx`, charts, tables)
- Feature folders: `calculator/`, `portfolio/`, `market/`, `dividend/`, `watchlist/`, `auth/`, `common/`, etc.

**`lib/`**: Business logic and utilities
- Calculators: `mdd-calculator.ts`, `conversion-calculator.ts`, `dividend-capture-calculator.ts`
- Calculator types: `calculator-types.ts` (shared type definitions for all calculators)
- Quote API: `quote-client.ts` (client-side), `quote-types.ts`, `server/quote-fetchers.ts` (server-side)
- Portfolio: `portfolio-store.ts`, `portfolio-aggregate.ts`, `portfolio-tags.ts`, `banksalad-parser.ts`
- Mock data: `mockData.ts`, `mock-*-data.ts` files for each feature area
- Firebase: `firebase/client.ts`, `firebase/auth.ts`, `firebase/firestore-repositories.ts`

**`docs/`**: Project documentation
- `AUDIT.md`: comprehensive project status and structure audit
- `STEP*.md`: step-by-step migration documentation from Streamlit to Next.js
- `firebase-setup.md`: Firebase configuration guide

### Calculator Architecture

The three calculators (MDD, Conversion, Dividend Capture) follow a consistent pattern:

1. **Input types** (`lib/calculator-types.ts`): strict TypeScript input schemas
2. **Calculator functions** (`lib/*-calculator.ts`): pure calculation logic
   - Support both mock fallback and live data paths
   - Accept optional `{ prices, dividends }` data and `meta` (source, warnings, updatedAt)
3. **Data provider** (`lib/calculator-data-provider.ts`): fetches live data via quote API
4. **Components** (`components/calculator/*.tsx`): React UI with form inputs and result display
5. **Quote API** (`app/api/quote/*`): Next.js API routes that fetch from free quote services

Live data connection status (as of Step 4C):
- **MDD Calculator**: connected (Step 4A)
- **Conversion Calculator**: connected (Step 4B)  
- **Dividend Capture Simulator**: connected (Step 4C)

### Quote API System

The quote API provides free market data without paid services:

- **Server routes** (`app/api/quote/`):
  - `history/route.ts`: OHLC price history
  - `dividends/route.ts`: historical dividend events
  - `last/route.ts`: latest quote
  - `fx/route.ts`: currency conversion rates

- **Client library** (`lib/quote-client.ts`):
  - `quoteHistoryPath()`, `quoteDividendsPath()`, `quoteLastPath()`, `quoteFxPath()`: build API URLs
  - `fetchQuoteHistory()`, `fetchQuoteDividends()`, etc.: fetch with fallback to sample data on error

- **Types** (`lib/quote-types.ts`):
  - `QuoteSource`: "live" | "sample"
  - Response types include `source`, `warnings`, `updatedAt` metadata

All calculator components check `result.source === "sample"` to display warning badges when live data is unavailable.

### Firebase Integration

Firebase is client-only and environment-dependent:

- **Setup**: requires `NEXT_PUBLIC_FIREBASE_*` env variables (see `.env.example`)
- **Auth**: Google popup sign-in via `lib/firebase/auth.ts` (`useFirebaseAuth` hook)
- **Firestore**: repositories in `lib/firebase/firestore-repositories.ts` for portfolio snapshots, calendar data, simulator config, calculator presets
- **Components**: `components/auth/LoginButton.tsx`, `components/auth/AuthStatus.tsx`
- **Rules**: `firestore.rules` (must be deployed manually)

When Firebase env vars are not configured, `isFirebaseConfigured` returns false and the app functions with mock data only.

### Navigation

Navigation items are defined in `lib/mockData.ts` as `NAV_ITEMS`. Current routes in navigation:
- `/portfolio`, `/dividends`, `/performance`, `/watchlist`, `/market`, `/calculator`, `/asset-simulator`, `/portfolio-manager`

Routes not in navigation (redirect-only or absent):
- `/` (redirects to `/portfolio`)
- `/asset-map` (redirects to `/market`)
- `/qld-dashboard` (redirects to `/portfolio`)
- `/login`, `/settings`, `/legacy` (not yet implemented)

## Working with Calculators

When modifying calculator logic:

1. **Reference the original**: read corresponding Python file in `original/pages_app/` (e.g., `3_dividend_sim.py` for dividend capture)
2. **Preserve dual paths**: calculators must work with both mock fallback and live API data
3. **Type safety**: update `lib/calculator-types.ts` when adding fields to inputs or results
4. **Error handling**: invalid/missing price data should be cleaned or excluded, not crash the calculation
5. **Metadata**: always include `source`, `warnings`, `updatedAt` in results
6. **UI feedback**: components should display warning badges when `source === "sample"`

## Mock Data Pattern

Most features still use mock data with planned gradual replacement:

- Mock files: `lib/mockData.ts`, `lib/mock-*-data.ts` for specific features
- Live data is being introduced module-by-module (calculators first, market/portfolio/dividends next)
- Always provide fallback to mock data when live API fails (see `quote-client.ts` `fetchQuoteApi()` pattern)

## Migration Notes

This project is mid-migration from Streamlit to Next.js:

- **Original source**: `original/` directory (Python/Streamlit) is read-only reference
- **Target**: repository root is the working Next.js project
- **Migration docs**: `docs/STEP*.md` files track progress step-by-step
- **Audit reference**: `docs/AUDIT.md` for current project state

When porting features from original:
1. Read the original Python logic in `original/logic/` or `original/pages_app/`
2. Translate to TypeScript in `lib/` (pure functions)
3. Create types in `lib/*-types.ts`
4. Build React components in `components/`
5. Add route in `app/` if needed
6. Document in `docs/` with a STEP*.md file

## Known Issues and Constraints

1. **Dependency warnings**: npm audit reports vulnerabilities; `next@14.2.5` has security deprecation warnings. Upgrades deferred to avoid scope creep.
2. **Recharts deprecation**: `recharts@2.12.7` 1.x/2.x branch is inactive but still in use.
3. **Korean text encoding**: some Korean labels may display as mojibake in terminal; verify UI rendering visually.
4. **Windows PowerShell**: use `npm.cmd` instead of `npm` due to execution policy restrictions.
5. **No server-side Firebase**: only client SDK is used; no Admin SDK, server API routes, or Cloud Functions.

## Code Style

- Strict TypeScript: all type errors must be resolved
- Prefer `type` over `interface` for calculator types
- Use descriptive variable names in Korean context (e.g., `exDate`, `buyType`)
- Format currency/percentages via `lib/format.ts` utilities
- Default to English comments in code; Korean for user-facing text/labels
