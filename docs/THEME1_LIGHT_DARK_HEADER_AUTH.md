# THEME-1 / HEADER-1 / AUTH-1 — Light/Dark Theme, Header Cleanup, Google Login Restore

Date: 2026-06-14

Scope: app-wide light/dark theme support, top-header cleanup (remove bell, add
theme selector), and restoring the Google login control. No page redesigns; no
changes to dividend classification, Korean ETF ticker normalization, portfolio
parser, snapshot schema, calendar provider/cache, tax/calculator formulas, or
market data providers.

---

## 1. Files read

- `app/layout.tsx`, `app/globals.css`
- `components/TopNav.tsx`
- `components/auth/LoginButton.tsx`, `components/auth/AuthStatus.tsx`
- `components/common/StorageModeBadge.tsx`
- `lib/firebase/auth.ts`, `lib/firebase/client.ts`
- `lib/mockData.ts` (`NAV_ITEMS`)
- `tailwind.config.ts`, `next.config.mjs`, `package.json`
- Page wrappers: `app/portfolio/page.tsx`, `app/performance/page.tsx`,
  `components/portfolio/PortfolioPage.tsx`, `components/dividend/DividendPage.tsx`,
  `components/calculator/CalculatorPage.tsx`, `components/market/MarketPage.tsx`,
  `components/asset-simulator/AssetSimulatorPage.tsx`,
  `components/watchlist/WatchlistPage.tsx`, `components/qld/QldDashboardPage.tsx`
- Theme-aware components: `components/PortfolioSummary.tsx`,
  `components/MiniTickerCard.tsx`, `components/DonutChartCard.tsx`,
  `components/AssetAccountCards.tsx`, `components/MetricCard.tsx`,
  `components/dividend/DividendSummaryCards.tsx`,
  `components/asset-map/AssetMapSection.tsx`
- Light-mode visual references:
  `docs/reference/etfshopping_portfolio_light_reference.htm`,
  `docs/reference/etfshopping_calendar_light_reference.htm`

## 2. Current theme/auth/header findings (before)

- **No theme system existed.** No `next-themes` (not a dependency), no
  `ThemeProvider`, no `darkMode` in Tailwind. `app/globals.css` hardcoded
  `color-scheme: dark`. There were **no shared design tokens**.
- **Theme was a hardcoded prop.** Pages passed `theme="dark"` literally to
  `TopNav` and to components that already branch internally on a
  `theme?: "dark" | "light"` prop (`PortfolioSummary`, `MiniTickerCard`,
  `DonutChartCard`, `AssetAccountCards`, `WatchlistRow`, `MonthlyIncomeChart`).
  Each page wrapper also hardcoded its own dark background
  (`bg-[#111516]`, `bg-[#181c1d]`, `bg-[#06070b]`) and `text-slate-200`.
  Light variants existed in components but were never activated.
- **Bell icon** in `TopNav` was decorative only — a static red dot with no
  handler, no notifications, no state. No real functionality.
- **Google login was already coded** (`LoginButton` rendered in `TopNav`,
  `useFirebaseAuth` → Google popup). The regression: when Firebase env vars are
  missing, `LoginButton` returned **only** a "Firebase 미설정 · 로컬" badge and
  hid the login button entirely, so the "Google 로그인" affordance disappeared.

## 3. Theme implementation approach

Lightweight, dependency-free system (no `next-themes` added):

- **`components/theme/ThemeProvider.tsx`** — React context holding
  `preference` (`light | dark | system`) + resolved `theme` (`light | dark`).
  Persists preference to `localStorage["gorani-theme"]`, toggles the
  `dark`/`light` class and `color-scheme` on `<html>`, and listens to
  `prefers-color-scheme` while on `system`. Hooks: `useTheme()`,
  `useResolvedTheme()`.
- **No-flicker inline script** in `app/layout.tsx` `<head>` applies the stored
  theme class to `<html>` before first paint. `<html className="dark"
  suppressHydrationWarning>` is the SSR default.
- **Tailwind `darkMode: "class"`** + CSS-variable-backed color tokens
  (`background`, `foreground`, `card`, `card-foreground`, `border`, `muted`,
  `muted-foreground`, `accent`, `accent-foreground`, `success`, `danger`,
  `warning`) wired through `rgb(var(--token) / <alpha-value>)`.
- **`app/globals.css`** defines the token values for `:root` (light) and
  `.dark`, sets `color-scheme`, and themes `body` background/foreground.
- **Pages** call `useResolvedTheme()` and pass `theme={theme}` to themed
  components; wrappers use flash-free Tailwind `dark:` variants
  (`bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200`).
- **Default = dark** (least disruptive, matches the current app); light/system
  are opt-in. SSR + first client render are both dark, so there is **no
  hydration mismatch** (verified: console shows no mismatch warnings).

## 4. Dark mode preservation notes

- Each page keeps its exact original dark background via the `dark:` half of the
  variant (`dark:bg-[#111516]`, `dark:bg-[#181c1d]`, `dark:bg-[#06070b]`, …).
- Themed components already had dark branches; only the prop source changed
  (hardcoded `"dark"` → resolved theme, which is `dark` by default).
- Newly themed cards (`MetricCard`, `DividendSummaryCards`) keep their original
  dark hex values under `dark:` and only add light values for `.light`.
- Verified in-browser: in dark mode the dividend KPI card background is
  `rgb(25,31,32)` = `#191f20`, identical to before.

## 5. Light mode design token notes (ETF쇼핑 tone)

- Page background `#f8fafc` (near-white), cards `#ffffff`, borders
  `#e5e7eb`-like (`slate-200`), text slate-800/900, muted text slate-500,
  accent teal-600, success green-600, warning amber-600, danger rose-600.
- Header bar intentionally stays dark navy in both themes (common finance
  dashboard pattern; matches the existing `TopNav` light branch).

## 6. Header changes (HEADER-1)

- Removed the non-functional **bell icon** (and the unused `Bell` import).
- Added **`components/theme/ThemeToggle.tsx`** — a compact icon-only segmented
  control (`라이트` Sun / `다크` Moon / `시스템` Monitor) styled for the dark bar,
  narrow enough for mobile, with `role="radiogroup"`/`radio` + aria labels.
- Kept the storage-mode status visible but subtle: `StorageModeBadge` shows on
  `xl` and up only (`hidden xl:inline-flex`) so it never crowds mobile.
- Right-control order is now `[StorageModeBadge (xl+)] [ThemeToggle] [LoginButton]`.

## 7. Google login restoration result (AUTH-1)

- `LoginButton` now **always renders** the auth button. When Firebase is
  configured: `Google 로그인` ↔ `로그아웃` plus the signed-in name on `lg+`.
  When **not configured**: the button is shown **disabled** with a tooltip
  ("Firebase 미설정 · 로컬 저장 모드 (로그인 불가)") instead of disappearing.
- Uses the existing `useFirebaseAuth` / Firebase client; no schema changes, no
  secrets exposed, no fake login.
- **Required env vars** for real Google login (client-only):
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
- **Verification limitation:** the actual Google popup sign-in could not be
  exercised because these env vars are not set in this environment
  (`isFirebaseConfigured === false`). The full UI/code path is restored; with
  env vars present the existing popup flow runs unchanged.

## 8. Visual verification

Verified on the running dev server (Next 14.2.5):

- Default load → `<html class="dark">`, `color-scheme: dark`,
  `body` bg `rgb(17,21,22)`, no stored preference. Bell absent, toggle present
  (`라이트/다크/시스템`), `Google 로그인` visible.
- Toggle `라이트` → `<html class="light">`, body bg `rgb(248,250,252)`,
  `localStorage["gorani-theme"] = "light"`, persists across navigation.
- `/portfolio` light: near-white page, white ticker/summary cards, dark
  readable headings — matches the ETF쇼핑 tone.
- `/dividends` light: title + KPI cards + segmented toggles render light
  (`h1` color `rgb(15,23,42)`); dark mode KPI card returns to `#191f20`.
- **320px**: no horizontal overflow (`scrollWidth == clientWidth == 320`),
  two-row header preserved (logo + toggle + login on row 1, nav + 더보기 on
  row 2), login + 3-way toggle both visible.
- Console: no hydration mismatch warnings. Only pre-existing recharts
  `defaultProps` deprecation warnings (unrelated; see CLAUDE.md known issues).

## 9. Remaining limitations

- **Feature sub-components still render dark surfaces in light mode** because
  they hardcode dark hex utilities without `dark:` variants and are out of the
  themed set. Known examples: `MonthlyDividendChart`, `DividendHoldingsTable`,
  `HoldingsTable`, `AssetTable`, the `/market` sub-sections, calculator panels,
  `PerformanceChart`, and the Qld chart cards. They remain readable (light text
  on dark cards) but are not yet ETF쇼핑-light. A global CSS class-remap was
  rejected as unsafe (it would also flip colored-button and dark-header text).
- Recharts surfaces (axes/grid) are not theme-recolored.
- Google login not end-to-end verified due to missing Firebase env vars.

## 10. Next recommended step

Per-component `dark:`-variant pass over the remaining feature cards/tables/
charts (start with `/dividends` chart + holdings table, `/performance` charts,
then `/market` sub-sections), and theme Recharts axis/grid/tooltip colors from
the resolved theme. Optionally migrate the most-reused dark hex surfaces to the
new `bg-card` / `border-border` tokens so they theme automatically.
