# THEME-2 — Real Light Mode Polish Hotfix

THEME-1 introduced the theme system (ThemeProvider, tokens, toggle, login
restoration) but light mode still rendered as **dark components floating on a
white page**: the header stayed navy, and most cards / tables / charts / forms
stayed black because they hardcoded dark surfaces. THEME-2 makes light mode a
genuinely light app while leaving dark mode untouched, and simplifies the theme
selector to two options.

## 1. Files read

- `components/theme/ThemeProvider.tsx`, `components/theme/ThemeToggle.tsx`
- `components/TopNav.tsx`, `components/auth/LoginButton.tsx`,
  `components/common/StorageModeBadge.tsx`
- `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`
- `app/portfolio/page.tsx`, `app/performance/page.tsx`
- `components/MetricCard.tsx`, `components/dividend/MonthlyDividendChart.tsx`
- `lib/chart-style.ts`
- `components/calculator/PreviewNotice.tsx`,
  `components/calculator/CalculatorWarningPanel.tsx`,
  `components/asset-simulator/{AssetSimulatorPage,SimulatorPreviewNotice}.tsx`
- Audit sweeps across all `components/**/*.tsx` + `app/**/*.tsx` for hardcoded
  dark utilities (`bg-[#191f20]`, `border-[#2a3336]`, `text-white`,
  `text-slate-100/200/300`, tint texts, etc.) — ~126 matches across 64 files.

## 2. Root cause

Page-root wrappers were already converted to light/dark pairs
(`bg-[#f8fafc] … dark:bg-[#111516]`), but **child components used bare dark
arbitrary utilities with no `dark:` prefix** (e.g. `bg-[#191f20]`,
`border-[#2a3336]`, `text-white`). A bare utility applies in *both* themes, so
every card, table, chart panel and form stayed dark in light mode. The header
additionally used a navy `bg-[#0f1729]` for its "light" branch, so it was never
actually light. Recharts grid/axis/tooltip colors come from JS constants in
`lib/chart-style.ts` (dark), so charts could not adapt via class swaps alone.

## 3. Header light-mode fix (`components/TopNav.tsx`)

- Light branch bar `bg-[#0f1729]` (navy) → `bg-white`; border
  `border-[#1e293b]` → `border-slate-200`.
- Logo text → `text-slate-900` in light, `text-white` in dark.
- Inactive nav items → `text-slate-600 hover:bg-slate-100 hover:text-slate-900`
  in light; dark unchanged. Active nav stays `bg-blue-600 text-white`.
- "더보기" button light variant → `bg-blue-50 text-blue-700` (blue accent kept).
- "더보기" dropdown panel → white surface + `border-slate-200` in light
  (was `bg-[#101719]` in both).
- `LoginButton` is now theme-aware: light = bordered white button
  (`border-slate-300 bg-white text-slate-700`), dark = existing `bg-white/10`.
  The button is always rendered (Google login never hidden).
- `StorageModeBadge` tones gained light variants (amber/emerald/slate `-50/100`
  surfaces with `-700/600` text) so the badge is readable on the white header.

## 4. ThemeToggle simplification (`components/theme/ThemeToggle.tsx`)

- Removed the `Monitor`/`system` option from the UI — the selector is now a
  two-option **라이트 / 다크** segmented control (sun / moon icons, aria-labels).
- Control styling is theme-aware so it reads on both white and dark headers.
- `ThemeProvider` still understands a stored `"system"` value for backward
  compatibility (resolved to light/dark, and the active pill highlights the
  resolved theme), but as soon as the user clicks, only `"light"` or `"dark"`
  is persisted. No provider data-logic changes were needed.

## 5. Light surface fixes by page (scoped `.light` layer in `app/globals.css`)

Converting 60+ files by hand was error-prone, so light mode remaps the **bare**
dark utilities centrally. The layer is appended after the Tailwind directives.

Why this is safe (not the forbidden "dangerous global remap"):

- Scoped to `.light` only — **dark mode is never touched**.
- Targets the exact dark hex classes used as surfaces/borders. Already-converted
  components use the `dark:`-prefixed class (a *different* class name), so they
  are never matched and keep their own light values.
- Buttons / active nav keep solid accents (`bg-blue-600`, `bg-white/10`, …) —
  none of those classes are remapped, and white button text is explicitly
  re-asserted on solid accent backgrounds.

Mappings added:

- Dark card hexes (`#191f20`, `#1e2324`, `#202627`, …) → `rgb(var(--card))`.
- Deeper / nested / input hexes (`#11181a`, `#0c1011`, `#121819`, …) →
  `rgb(var(--muted))` (subtle hierarchy).
- `bg-[#2a3336]` dividers → `rgb(var(--border))`.
- ~20 dark border hexes → `rgb(var(--border))`.

This fixes all eight target routes at once: `/portfolio`, `/dividends`,
`/performance`, `/portfolio-manager`, `/market`, `/calculator`,
`/asset-simulator`, `/watchlist`.

## 6. Chart / table / form light-mode fixes

**Charts (recharts).** CSS `stroke`/`fill` override the dark values recharts
sets as SVG presentation attributes, so under `.light`:

- `.recharts-cartesian-grid line` → soft `--border` grid.
- axis line / ticks → `#cbd5e1` lines, `#64748b` tick text.
- `.recharts-default-tooltip` → white background, `--border` border, slate text
  (`!important` to beat the inline `contentStyle`).
- tooltip cursor / legend text → readable slate.

No chart data, formulas, or series colors were changed.

**Tables & forms** are covered by the same surface/border remap (table cards,
header rows, input backgrounds and borders all go light), plus text fixes below.

**Text contrast.** Light-on-dark text is darkened only in light mode:

- `.text-white` → slate-900, **but re-whitened on `bg-{blue,emerald,green,
  teal,rose,red,amber,orange,violet,…}-*`** so buttons/tabs/badges stay white.
- `text-slate-100/200` → slate-800, `text-slate-300` → slate-700.
- Tint banner texts (`text-emerald/amber/blue/red-100/200`) → `-700/800`.
- Three small info/warning components
  (`PreviewNotice`, `SimulatorPreviewNotice`, `CalculatorWarningPanel`) had
  opacity-suffixed tint text (`text-amber-100/90`, …) that CSS class selectors
  can't easily target, so they were given explicit `light → dark:` text pairs
  (and the warning/error banners got light `-50` backgrounds).

## 7. Dark-mode regression check

Dark mode is unchanged. All new CSS is scoped under `.light`; component edits
gate every new color behind `isLight`/`dark:` and leave the dark branch as-is.
Verified visually: `/portfolio` (and others) in dark mode still show the dark
header, dark cards, dark charts and white text exactly as before THEME-1/UI-2B.

## 8. Responsive TopNav check

The measured priority-nav behavior from UI-2B / THEME-1 is unchanged (only
colors were touched). Verified no horizontal page overflow
(`scrollWidth === clientWidth`) at **320 / 390 / 780 px** and desktop; the
2-row narrow layout (logo + controls / nav + 더보기) and 1-row desktop layout
both work in light mode.

## 9. Verification commands

```cmd
npm.cmd run check:korean-etf            # passed
npm.cmd run check:dividend-holdings     # passed
npm.cmd run check:asset-map             # passed (exit 0)
npm.cmd run check:tax-saving            # passed (exit 0)
npm.cmd run check:calendar-provider     # passed
npm.cmd run check:portfolio-parser      # passed
npm.cmd run check:portfolio-parser:private  # passed (exit 0)
npm.cmd run typecheck                   # clean
npm.cmd run lint                        # no warnings/errors
npm.cmd run build                       # compiled successfully, 14/14 pages
```

Console at runtime shows only the pre-existing Recharts `defaultProps`
deprecation warning (documented known issue) — no hydration or theme errors.

## 10. Remaining limitations

- A few inline tint texts on colored gauges/pills (e.g. market temperature
  label, calendar amber pill) rely on the base-class remap; opacity-suffixed
  variants elsewhere are handled per-component, not globally.
- Colored accent borders that aren't neutral dark grays (e.g. MiniTickerCard's
  amber `#5a4a22`) are intentionally left as accents in light mode.
- The central `.light` remap lists explicit dark hex values; brand-new dark hex
  surfaces added later must either use `dark:` pairs or be added to the list.
- Recharts deprecation/audit warnings are unchanged (out of scope).

## 11. Next recommendation

Migrate the remaining bare dark utilities to the design tokens
(`bg-card`, `bg-muted`, `border-border`, `text-foreground`,
`text-muted-foreground`) so the central `.light` override list can shrink and
new components theme automatically. Optionally make `lib/chart-style.ts`
theme-derived (CSS variables / a `useResolvedTheme` hook) to remove the CSS
`!important` tooltip overrides.
