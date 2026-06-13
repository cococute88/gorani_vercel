# Mobile UI Overflow Audit (Step M0)

Audit date: 2026-06-13

**This is an audit and planning document only.** No UI behavior was changed.
The only code-adjacent change is a one-line index link added to `docs/AUDIT.md`.

---

## 1. Audit scope

Goal: find every mobile overflow, right-edge clipping, useless horizontal
scroll, one-character Korean wrapping, and input/table width bug across the
app, then propose a phased fix plan.

Method: static source review of every navigation route's page component and
the cards / tables / inputs / charts they render. No live device emulation was
performed in this step; findings are derived from layout class analysis
(container padding, `min-w-*`, `overflow-x-*`, grid columns, fixed widths,
Korean wrapping classes). Widths are reasoned about from the Tailwind classes,
not screenshot-measured. Visual confirmation at the listed widths is deferred
to the verification checklist (section 14).

What this audit does **not** do: it does not change layout code, redesign
pages, or fix issues. It records them.

---

## 2. Tested routes

All routes in `NAV_ITEMS` (`lib/mockData.ts`) plus redirect-only routes.

| Route | Component | In nav? | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` | no | redirect → `/portfolio` |
| `/portfolio` | `app/portfolio/page.tsx` | yes (전체 종목) | "포트폴리오 현황" dashboard. **Mobile-safe container.** |
| `/dividends` | `components/dividend/DividendPage.tsx` | yes (배당) | `px-8` fixed container. |
| `/performance` | `app/performance/page.tsx` | yes (투자 성과) | `px-8` fixed container. |
| `/watchlist` | `components/watchlist/WatchlistPage.tsx` | yes (배당캘린더) | Responsive container; recently hardened. |
| `/market` | `components/market/MarketPage.tsx` | yes (시장 현황) | `px-8` fixed container. |
| `/calculator` | `components/calculator/CalculatorPage.tsx` | yes (계산기) | **Mobile-safe container.** |
| `/asset-simulator` | `components/asset-simulator/AssetSimulatorPage.tsx` | yes (자산 시뮬레이터) | **Mobile-safe container**, but year-plan table forces scroll. |
| `/portfolio-manager` | `components/portfolio/PortfolioPage.tsx` | yes (포트폴리오 관리) | `px-8` fixed container. |
| `/asset-map` | `app/asset-map/page.tsx` | no | redirect → `/market` |
| `/qld-dashboard` | `app/qld-dashboard/page.tsx` | no | redirect → `/portfolio` |
| `/login`, `/settings`, `/legacy` | — | no | not implemented (no page file) |

Two distinct "portfolio" pages exist and must not be confused:
- `/portfolio` → `app/portfolio/page.tsx` (the live "현황" dashboard, already mobile-hardened).
- `/portfolio-manager` → `components/portfolio/PortfolioPage.tsx` (the "관리" / upload page, **not** hardened).

---

## 3. Tested viewport widths

```
320px   (P0/P1 critical — smallest common Android)
360px
390px   (P0/P1 critical — common iPhone logical width)
430px
768px   (tablet / sm→md boundary)
desktop reference (≥1280px)
```

Most layout breakpoints in the app are `sm` (640px), `md` (768px),
`lg` (1024px), `xl` (1280px). **Crucially, every viewport from 320–430px and
most up to 639px sits below the first `sm` breakpoint**, so the "base"
(unprefixed) Tailwind classes are what mobile users actually get. Many
problems below are base-class problems that the `sm:`/`xl:` overrides never
reach on a phone.

---

## 4. Global recurring root causes

These patterns repeat across many pages. Fixing them centrally (batch M1)
resolves a large share of per-route findings.

### R1 — Fixed `px-8` page container, no responsive padding, no overflow guard (P1, very common)

Older page shells use:

```tsx
<main className="mx-auto max-w-[1640px] px-8 py-6">
```

`px-8` = 32px each side = **64px of horizontal padding**. At 320px that leaves
only **256px** of usable content width; at 390px, 326px. There is no
`overflow-x-hidden` on the wrapper, so any child that does overflow produces a
full-page horizontal scroll. Affected: `/dividends`, `/performance`,
`/market`, `/portfolio-manager`.

Contrast the already-correct pattern used by `/portfolio`, `/calculator`,
`/asset-simulator`:

```tsx
<div className="min-h-screen overflow-x-hidden ...">
  <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
```

`px-4 sm:px-6 lg:px-8` (16 → 24 → 32px) plus `overflow-x-hidden` + `min-w-0`
is the target standard. R1 is "bring the four laggard pages up to this
standard."

### R2 — Wide-table cards with large `min-w-[…]` inside cards (P1, common)

Data tables are wrapped in `overflow-x-auto` with a large `min-width`:

| Table | min-width | File |
|---|---|---|
| Holdings (관리) | `min-w-[860px]` | `components/portfolio/HoldingsTable.tsx` |
| Dividend holdings | `min-w-[760px]` | `components/dividend/DividendHoldingsTable.tsx` |
| QLD rank | `min-w-[820px]` | `components/qld/QldHoldingsRankTable.tsx` |
| Year plan | `min-w-[760px]` | `components/asset-simulator/YearPlanTable.tsx` |

`overflow-x-auto` correctly *scopes* the scroll to the card (so it does not
break the whole page), but on a 320–390px screen the user sees a tiny window
onto a 760–860px table and must scroll horizontally for almost every column.
That is the "useless horizontal scroll" symptom. Strategy per table is in
section 9 (hide low-priority columns at base width, and/or convert to a
stacked card list on mobile). Note: this is **acceptable as a stopgap** because
the scroll is contained — it is a P1 usability issue, not a P0 page-break.

### R3 — No global Korean line-break strategy (`word-break: keep-all`) (P1)

`app/globals.css` defines `.num`, scrollbar helpers, and font, but there is
**no global `word-break: keep-all`** and Tailwind's `break-keep` utility is
not used anywhere (grep: 0 hits). When a Korean label is squeezed into a
narrow flex/grid cell, the browser may break between syllables, producing the
"한 글자씩 줄바꿈" (one-character-per-line) effect, especially on long labels
like `합산 명목 잔고(절세+배당위탁)` in metric cards. Applying
`word-break: keep-all` at the body level (or `break-keep` on label spans) is
the central fix.

### R4 — Two-column metric grids that never collapse to one column at the smallest widths (P2→P1)

Several KPI grids go `grid-cols-2` at base and only expand upward
(`md:grid-cols-3`, `xl:grid-cols-6`). They never drop to **one** column, so at
320px each card is ~120px wide and must hold a large KRW value. Examples:
`/performance` KPIs (`grid-cols-2 md:grid-cols-3 xl:grid-cols-6`),
`/dividends` summary (`grid-cols-2 lg:grid-cols-4`),
`MarketBriefingCards` (`grid-cols-2 sm:grid-cols-4`),
`AssetAccountCards` (`grid-cols-2 sm:grid-cols-3`). Whether these need a
1-column fallback depends on the longest value each must hold (see R5).

### R5 — Large KRW / 만원 values in narrow cards with no overflow handling (P1)

Metric values render as `num text-[20px]–text-[22px] font-extrabold` with no
`truncate`, `break-keep`, or responsive font shrink. A value like
`1,234,567,890원` or `12,345만원` inside a ~120px half-width card at 320px will
either overflow the card or wrap awkwardly (and combined with R3 may break the
trailing `원`/`만원`/`%` onto its own line). Affected components:
`MetricCard.tsx`, `DividendSummaryCards.tsx` (`Kpi`), `PortfolioSummary.tsx`
(DarkSummary `text-[22px]`), `MarketTemperatureTable.tsx`,
`SimulatorMetricCards.tsx`.

### R6 — Recharts charts: per-component margins/ticks, no mobile axis tuning (P2)

Two conventions coexist: a shared `lib/chart-style.ts` (used by
`MonthlyDividendChart`) and ad-hoc inline margins (`PerformanceChart.tsx`).
None adjust tick density, font size, or Y-axis `width` by viewport. At 320px,
`XAxis interval={5}` plus dual `YAxis width={42}` on `PerformanceChart` leaves
little plot width and risks overlapping/crowded x labels. Charts sit in
`overflow-x-hidden` cards so they will not break the page, but labels can
become unreadable. This is polish-level (P2) in most cases.

### R7 — Native-styled controls inheriting default appearance (P2→P3)

`<select>` (e.g. `TickerManager.tsx`, light theme variants) and date/number
inputs are styled with Tailwind but rely on platform rendering for the
dropdown arrow / spinner; on mobile these are generally fine but can look
inconsistent with the dark theme. Low priority. `CustomEventDialog` correctly
adds `[color-scheme:dark]` to its date input — a good pattern to propagate.

---

## 5. P0 / P1 issue list (must-fix)

P0 (page unusable / severe clipping) — **none confirmed as true page-breaking.**
The most severe items are contained-scroll or awkward-wrap, classified P1. If
live testing reveals a `px-8` page child that overflows the viewport (causing
whole-page horizontal scroll), promote that specific case to P0.

P1 (major readability / interaction):

1. **R1** `/dividends`, `/performance`, `/market`, `/portfolio-manager` use
   fixed `px-8` with no `overflow-x-hidden`; usable width at 320px ≈ 256px and
   any overflowing child scrolls the whole page.
2. **R2 / `/asset-simulator`** 연도별 투자 계획표 (`YearPlanTable`,
   `min-w-[760px]`): the known clipped/scroll issue. Year + 만원 input + three
   ISA/pension checkboxes do not fit; the table footnote even concedes
   "모바일에서는 표 영역 내부만 가로 스크롤됩니다." Needs column hiding or a
   mobile stacked-row layout.
3. **R2** `/portfolio-manager` HoldingsTable (`min-w-[860px]`) and
   `/dividends` DividendHoldingsTable (`min-w-[760px]`): widest tables; heavy
   horizontal scrolling on phones.
4. **R5 + R3** `/performance` KPI cards: 6 values in a `grid-cols-2` base grid;
   large numbers wrap and Korean sub-labels can split per syllable.
5. **R5 + R3** `/dividends` summary cards and `SimulatorMetricCards`: long
   labels (`연간 예상 배당 (세후)`, `합산 명목 잔고(절세+배당위탁)`) wrap badly
   at 320–390px without `break-keep`.
6. **R2** `/performance` QldHoldingsRankTable (`min-w-[820px]`).

---

## 6. P2 / P3 issue list (polish)

P2 (noticeable polish):

- **R4** Metric grids never collapse to a single column at the smallest
  widths (`/performance`, `/dividends`, market briefing, account cards).
- **R6** Chart axis crowding at 320px (`PerformanceChart`, `RsiDrawdownChart`,
  `VixChart`, `MonthlyDividendChart`).
- `/market` `MarketTemperatureTable` cards: `grid-cols-1 sm:grid-cols-2
  lg:grid-cols-5` — fine, but card internal `flex justify-between` rows with
  long Korean labels (`52주 고점대비`) plus a value could crowd at 320px.
- Calculator tab bar (`CalculatorPage`) uses `overflow-x-auto` + `shrink-0`
  chips — acceptable scoped scroll, verify it does not look like a broken
  layout at 320px.

P3 (minor):

- `.num` tabular figures are good; verify they do not force values slightly
  wider than proportional digits in the tightest cards.
- `TopNav` mobile "더보기" panel grid `grid-cols-2` with `truncate` labels —
  looks safe; verify long labels (자산 시뮬레이터, 포트폴리오 관리) truncate
  cleanly rather than wrapping.

---

## 7. Per-route findings

### /portfolio

#### Status
P2 (mostly hardened; minor chart/number polish).

#### Observed issues
- Container is already mobile-correct: `overflow-x-hidden` on both wrapper and
  `main`, `min-w-0`, `px-4 sm:px-6 lg:px-8`.
- Pin-ticker strip uses a deliberate `-mx-4 … overflow-x-auto` edge-to-edge
  scroll with fixed `w-[210px]` cards — intentional, acceptable.
- `PortfolioSummary` (DarkSummary) packs 4 sub-panels; `text-[22px]` total
  value (R5) and many small Korean labels (R3) in a `grid-cols-1 sm:grid-cols-2`
  layout — verify the big number does not overflow at 320px.
- `AssetAccountCards` `grid-cols-2` at base (R4); each card holds 평가/수익/수익률
  KRW values at `text-[11.5–12.5px]` — tight but uses `truncate` on the name.
- Donut/treemap/bar charts in `min-w-0 overflow-x-hidden` grids — safe.

#### Likely files/components
- `app/portfolio/page.tsx`, `components/PortfolioSummary.tsx`,
  `components/AssetAccountCards.tsx`, `components/DonutChartCard.tsx`,
  `components/TreemapMock.tsx`, `components/qld/QldAccountBarChart.tsx`,
  `components/qld/QldValueFxChart.tsx`.

#### Suspected root cause
- R5 (large value in summary), R4 (2-col account cards), R3 (Korean labels).

#### Recommended fix
- Apply global R3 `break-keep`; add `truncate`/responsive font to the
  `text-[22px]` total in `DarkSummary`; verify account-card 2-col holds values.

#### Tool recommendation
Codex-safe for verification; **Claude Code Opus+** if `PortfolioSummary`
internal layout needs restructuring (it is dense and conditional).

---

### /dividends

#### Status
P1.

#### Observed issues
- R1: `<main className="mx-auto max-w-[1640px] px-8 py-6">` — fixed 32px
  padding, no `overflow-x-hidden`.
- R5+R3: `DividendSummaryCards` `grid-cols-2 lg:grid-cols-4`, each `Kpi` value
  `text-[20px] font-extrabold` with long labels (`연간 예상 배당 (세후)`).
- R2: `DividendHoldingsTable` `min-w-[760px]` inside a card → heavy horizontal
  scroll (8 columns: 티커/종목명/평가/연배당/배당률/내배당률/태그/관리).
- 목표 설정 카드: `grid-cols-1 sm:grid-cols-3` inputs — base 1-col is fine; the
  third "현재 달성률" panel holds `text-[18px]` value, ok.
- `MonthlyDividendChart` 300px-high bar chart (R6) — axis at 320px is tight.

#### Likely files/components
- `components/dividend/DividendPage.tsx`,
  `components/dividend/DividendSummaryCards.tsx`,
  `components/dividend/DividendHoldingsTable.tsx`,
  `components/dividend/MonthlyDividendChart.tsx`.

#### Suspected root cause
- R1, R2, R5, R3, R6.

#### Recommended fix
- Adopt the standard responsive container (R1).
- For `DividendHoldingsTable`: hide 태그 + one yield column at base width, or
  convert to stacked card rows below `sm`.
- `break-keep` + value-truncate on summary KPI cards.

#### Tool recommendation
**Claude Code Opus+** (table→card conversion + multi-component layout).

---

### /performance

#### Status
P1.

#### Observed issues
- R1: `px-8` fixed container, no `overflow-x-hidden`.
- R5+R4+R3: KPI grid `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`, six
  `MetricCard`s; `MetricCard` value is `text-[22px] font-extrabold` with no
  `truncate`/`break-keep` — large numbers wrap, Korean sub-labels split.
- R2: `QldHoldingsRankTable` `min-w-[820px]` (7 columns) → horizontal scroll.
- R6: `PerformanceChart` 400px tall, dual Y-axis `width={42}`,
  `XAxis interval={5}` — crowded plot/labels at 320px.
- `QldAssetSummaryCard` + `QldValueFxChart` in an `xl:` 2-col grid; base is
  1-col — verify the summary card's big totals (R5).

#### Likely files/components
- `app/performance/page.tsx`, `components/MetricCard.tsx`,
  `components/PerformanceChart.tsx`,
  `components/qld/QldHoldingsRankTable.tsx`,
  `components/qld/QldAssetSummaryCard.tsx`,
  `components/qld/QldValueFxChart.tsx`.

#### Suspected root cause
- R1, R5 (MetricCard has no overflow handling), R4, R2, R6.

#### Recommended fix
- Standard container (R1).
- `MetricCard`: add `break-keep` to label, `min-w-0` + responsive value font
  (e.g. `text-[18px] sm:text-[22px]`) or `truncate` with tooltip.
- Consider `grid-cols-1` fallback or smaller value font for the 6-up KPI row.
- Hide low-priority rank columns or stack on mobile (R2).

#### Tool recommendation
**Claude Code Opus+** (shared `MetricCard` change affects multiple pages;
chart mobile tuning).

---

### /watchlist

#### Status
P2 (recovered; the previous severe table/Korean-wrapping regression is no
longer present in source).

#### Observed issues
- Container is responsive: `px-3 py-4 sm:px-5 sm:py-6 lg:px-8`,
  `max-w-[1280px]`. Good.
- `CalendarGrid`: 7-col grid with `min-h-[72px] sm:min-h-[100px]` cells, event
  chips use `truncate min-w-0`, `+N` overflow badge — well-handled for mobile.
- `TaxSavingTable`: `table-fixed` + `<colgroup>` percentage widths + responsive
  font — no `min-width`, no horizontal scroll. Good pattern.
- `DividendSchedulePreview`: hides 4 columns below `sm` (`hidden sm:table-cell`)
  and keeps `overflow-x-auto` as a safety net — good.
- `TickerManager`: input row uses `min-w-0 flex-1` + `shrink-0` button (correct
  protrusion guard); chips `flex-wrap`; `<select>` full-width (R7 cosmetic).
- `CustomEventDialog`: `w-full max-w-md`, `max-h-[90vh] overflow-y-auto`, padded
  backdrop — mobile-correct.
- `DividendCalendarPage` filter/main grids are `grid-cols-1 xl:grid-cols-[…]` —
  base single column, safe.

#### Likely files/components
- `components/watchlist/WatchlistPage.tsx`, `DividendCalendarPage.tsx`,
  `CalendarGrid.tsx`, `TaxSavingTable.tsx`, `DividendSchedulePreview.tsx`,
  `TickerManager.tsx`, `CustomEventDialog.tsx`.

#### Suspected root cause
- Residual only: R3 (apply global `break-keep`), R7 (`<select>` styling).

#### Recommended fix
- Keep as the **reference implementation** for other pages' tables/dialogs.
- Minor: confirm calendar day-cell chips at exactly 320px (7 columns ≈ 40px
  each minus padding) still render at least one readable chip.

#### Tool recommendation
Codex (verification) / **Claude Code Opus+** only for any residual calendar
cell tuning.

---

### /market

#### Status
P1 (container) / P2 (content).

#### Observed issues
- R1: `px-8` fixed container, no `overflow-x-hidden`.
- `MarketBriefingCards`: `grid-cols-2 sm:grid-cols-4`, value `text-[18px]`
  (R4/R5) — tight at 320px but values are short.
- `MarketTemperatureTable`: card grid `grid-cols-1 sm:grid-cols-2
  lg:grid-cols-5` (base 1-col, safe); internal `justify-between` rows with
  `52주 고점대비` label (R3).
- `RsiDrawdownChart`, `VixChart`, `TradingViewTreemap`, `FearGreedCard`,
  `AssetMapSection`: charts/embeds (R6) — verify they fit the card and the
  TradingView embed does not force min-width.

#### Likely files/components
- `components/market/MarketPage.tsx`, `MarketBriefingCards.tsx`,
  `MarketTemperatureTable.tsx`, `RsiDrawdownChart.tsx`, `VixChart.tsx`,
  `TradingViewTreemap.tsx`, `AssetMapSection.tsx`, `FearGreedCard.tsx`.

#### Suspected root cause
- R1, R6, R3; possible third-party embed width (TradingView) — verify.

#### Recommended fix
- Standard container (R1); `break-keep` on labels; verify embeds are
  `w-full`/responsive and do not overflow.

#### Tool recommendation
**Claude Code Opus+** (third-party embed width is subtle); Codex for the
container swap.

---

### /calculator

#### Status
P2 (container hardened; verify forms/tables/charts at 320px).

#### Observed issues
- Container correct: `overflow-x-hidden`, `px-4 sm:px-6 lg:px-8`, `w-full`.
- Tab bar: `overflow-x-auto no-scrollbar` + `shrink-0` chips — scoped scroll,
  acceptable; confirm it does not read as broken at 320px.
- Calculator forms/result tables (`DividendCaptureSimulator`,
  `ConversionCalculator`, `MddCalculator`, `CalculatorInputField`,
  `CalculatorPresetControls`) were not deep-read in this pass — flagged for
  320px verification (input width, result table min-width, any chart).

#### Likely files/components
- `components/calculator/CalculatorPage.tsx` and the three calculators +
  `CalculatorInputField.tsx`, `CalculatorPresetControls.tsx`,
  `CalculatorWarningPanel.tsx`, `CalculatorDataStatus.tsx`.

#### Suspected root cause
- Likely minor; container already safe. Possible R2 in any result table.

#### Recommended fix
- Verify-first; fix only confirmed 320px issues. Reuse watchlist table pattern
  if a result table has `min-w-*`.

#### Tool recommendation
Codex for verification; **Claude Code Opus+** if a calculator result table
needs the table→card treatment.

---

### /asset-simulator

#### Status
P1 (known clipped table) / container otherwise safe.

#### Observed issues
- Container correct: `overflow-x-hidden`, `px-4 sm:px-6 lg:px-8`.
- **R2 (known):** `YearPlanTable` `min-w-[760px]` — year + 월적립액(만원) number
  input (`w-28` = 112px) + three checkbox columns (ISA적립 / 연금저축적립 /
  ISA연금이전). On a phone almost everything is off-screen behind the card's
  internal horizontal scroll. This is the reported "오른쪽이 잘린다" symptom.
- `SimulatorInputPanel`: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, each input
  uses `min-w-0 flex-1` + a `w-12` suffix — correctly guarded; base 1-col is
  safe.
- `SimulatorMetricCards`: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` with
  `MetricCard`; very long labels (`합산 명목 잔고(절세+배당위탁)`) (R3/R5).
- `SimulatorResultTabs` / `SimulatorBalanceChart` / `SimulatorCashflowChart`
  not deep-read — flag charts for R6 verification.

#### Likely files/components
- `components/asset-simulator/YearPlanTable.tsx` (primary),
  `SimulatorInputPanel.tsx`, `SimulatorMetricCards.tsx`,
  `SimulatorResultTabs.tsx`, `SimulatorBalanceChart.tsx`,
  `SimulatorCashflowChart.tsx`, `components/MetricCard.tsx`.

#### Suspected root cause
- R2 (760px min-width table with an inline 112px input + 3 checkbox columns);
  R3/R5 on metric cards.

#### Recommended fix
- `YearPlanTable`: below `sm`, convert each year to a stacked card/row
  (year heading + labeled input + a horizontal checkbox group), eliminating the
  `min-w-[760px]`. Keep the table only at `sm+`. Alternatively shrink the
  number input and the checkbox column padding and drop the `min-width`.
- `MetricCard` + `break-keep` fix (shared with /performance).

#### Tool recommendation
**Claude Code Opus+** (table→mobile-card conversion is the headline M2 task).

---

### /portfolio-manager

#### Status
P1.

#### Observed issues
- R1: `px-8` fixed container, no `overflow-x-hidden`.
- R2: `HoldingsTable` `min-w-[860px]` — the widest table in the app (9 columns,
  including an editable `w-[88px]` ticker input and a multi-tag cell). Heavy
  horizontal scroll on phones.
- `ExcelUploadCard` + `PortfolioParsePreview` in `grid-cols-1 xl:grid-cols-2`
  (base 1-col, safe); verify upload drop-zone and parse preview table widths.
- `AssetTable` (finance assets) — not deep-read; likely another `min-w-*`
  table (R2). Flag for verification.
- `SnapshotHistory`, `PortfolioPerformanceChart`,
  `PortfolioQuoteStatusPanel` — verify (R6 for chart).
- "이 스냅샷 등록" button row is `flex justify-end` — safe.

#### Likely files/components
- `components/portfolio/PortfolioPage.tsx`, `HoldingsTable.tsx`,
  `AssetTable.tsx`, `PortfolioParsePreview.tsx`, `ExcelUploadCard.tsx`,
  `SnapshotHistory.tsx`, `PortfolioPerformanceChart.tsx`,
  `PortfolioQuoteStatusPanel.tsx`.

#### Suspected root cause
- R1, R2 (860px table + inline input), and preview/asset tables.

#### Recommended fix
- Standard container (R1).
- `HoldingsTable`: this table genuinely has many columns; prefer **mobile
  stacked card rows** (it is an editing surface, not just display) or hide
  금융사/종류/원금 at base width. Keep `overflow-x-auto` as the worst-case
  fallback (Strategy D) since it is a power-user editing table.

#### Tool recommendation
**Claude Code Opus+** (editable table → mobile layout is non-trivial).

---

### / , /asset-map , /qld-dashboard (redirects)

#### Status
N/A — `redirect()` server components, no UI.

#### Notes
`/` → `/portfolio`, `/asset-map` → `/market`, `/qld-dashboard` → `/portfolio`.
No mobile surface. `/login`, `/settings`, `/legacy` have no page files.

---

### TopNav / header (global)

#### Status
P3 (looks hardened).

#### Observed issues
- Header has `overflow-x-hidden`; bar is `flex-wrap … md:flex-nowrap`.
- Mobile shows logo + 2 primary chips (`no-scrollbar overflow-x-auto`) +
  "☰ 더보기" (`shrink-0`) + login/bell on the right, in a
  `grid-cols-[minmax(0,1fr)_auto]` — width-safe.
- "더보기" panel: `grid-cols-2` with `truncate` labels — safe.
- `LoginButton` / `StorageModeBadge` not deep-read — verify the
  local/Firebase badge text does not overflow the right cluster at 320px.

#### Likely files/components
- `components/TopNav.tsx`, `components/auth/LoginButton.tsx`,
  `components/common/StorageModeBadge.tsx`.

#### Suspected root cause
- Minor: badge text length (R3 applies to badge labels too).

#### Recommended fix
- Verify badge + login + bell cluster at 320px; truncate badge if needed.

#### Tool recommendation
Codex (verification).

---

## 8. Severity scale used

```
P0: Mobile page unusable / content severely clipped / whole-page horizontal overflow.
P1: Major readability or interaction problem (contained scroll forcing per-column scrolling, large numbers wrapping, awkward Korean wrap).
P2: Noticeable polish (cramped spacing, chart label crowding, grid that could collapse further).
P3: Minor visual cleanup.
```

---

## 9. Recommended fix strategy per recurring issue

| ID | Issue | Strategy |
|---|---|---|
| R1 | Fixed `px-8` containers | Replace with `overflow-x-hidden` wrapper + `mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8` (the `/portfolio` standard). Mechanical, low-risk. |
| R2 | Wide `min-w-*` tables | Per table pick: **A** remove `min-width` (only if columns truly fit), **B** hide low-priority columns below `sm` (`hidden sm:table-cell`, as `DividendSchedulePreview` already does), **C** convert to a stacked mobile card list (best for editing tables: YearPlan, HoldingsTable), **D** keep real horizontal scroll only where unavoidable (power-user editing tables). |
| R3 | Korean one-char wrap | Add `word-break: keep-all` to `body` in `globals.css` (global), and/or `break-keep` on dense label spans. |
| R4 | Grids never reach 1 column | Audit each grid's longest value; where it overflows at 320px, add a `grid-cols-1` base (cards expand at `sm+`). Otherwise leave 2-col. |
| R5 | Large KRW values clip/wrap | `MetricCard`/KPI: `min-w-0` + `break-keep`, and responsive value font (`text-[18px] sm:text-[22px]`) or `truncate`. Keep `.num` tabular alignment. |
| R6 | Chart axis crowding | Centralize mobile-aware tick density/font/`YAxis width` in `lib/chart-style.ts`; reduce `interval` and Y-axis width below `sm`; migrate `PerformanceChart` to the shared style. |
| R7 | Native control styling | Add `[color-scheme:dark]` / custom arrow to `<select>` and number/date inputs for theme consistency. Low priority. |

---

## 10. Proposed implementation batches

### M1 — Global mobile layout primitives
- Standardize page containers (R1) on the four laggard pages.
- Add global `word-break: keep-all` (R3) in `globals.css`.
- Harden the shared `MetricCard` (R5): `min-w-0`, `break-keep`, responsive
  value font.
- Establish a shared mobile-table convention (document the watchlist
  `table-fixed` + `hidden sm:table-cell` pattern as the standard).
- **Tool: Claude Code Opus+** (shared primitives ripple across pages).

### M2 — Asset simulator mobile fix
- `/asset-simulator` `YearPlanTable` → mobile stacked rows (kill `min-w-[760px]`).
- Verify `SimulatorInputPanel`, `SimulatorMetricCards`, result charts at 320px.
- **Tool: Claude Code Opus+.**

### M3 — Performance mobile cards/charts
- `/performance` container (R1, covered by M1), KPI grid value wrapping (R5),
  chart mobile margins/axis (R6), `QldHoldingsRankTable` (R2),
  `QldAssetSummaryCard` big numbers.
- **Tool: Claude Code Opus+.**

### M4 — Dividends & portfolio mobile cards
- `/dividends`: `DividendHoldingsTable` (R2), summary KPI (R5), chart (R6).
- `/portfolio`: verify `PortfolioSummary` big number, account-card 2-col.
- `/portfolio-manager`: `HoldingsTable` (R2, editing-table treatment),
  `AssetTable`, parse preview.
- **Tool: Claude Code Opus+.**

### M5 — Watchlist residual cleanup + Market
- `/watchlist`: only residual `break-keep` / `<select>` polish (already strong).
- `/market`: container (R1), embed width verification (TradingView), chart
  tuning (R6), label `break-keep`.
- **Tool: Claude Code Opus+** for embeds; Codex for the container swap.

Suggested order: **M1 → M2 → M3 → M4 → M5** (M1 first because it removes the
largest share of issues and de-risks M3/M4).

---

## 11. Batches that require Claude Code Opus+

- **M1** (shared primitives touching every page — high blast radius).
- **M2** (table→mobile-card conversion with live inputs/checkboxes).
- **M3** (shared `MetricCard` + chart axis logic).
- **M4** (editable `HoldingsTable` mobile layout; dividend table conversion).
- **M5** third-party embed width handling.

---

## 12. Tasks that can use Codex

- Mechanical R1 container class swaps on the four pages (after M1 defines the
  exact target classes).
- Adding `[color-scheme:dark]` / arrow styling to `<select>`/inputs (R7).
- Regression scripts and non-visual tests
  (`check:calendar-provider`, `check:portfolio-parser`).
- Type cleanup and any data/provider logic.
- Verification screenshot capture / measurement scripting.

---

## 13. Do-not-touch areas

- `original/` (read-only Streamlit reference) — never modify.
- Do **not** create `target/`.
- No broad UI rewrites or page redesigns in M0 (this step is audit only).
- Do not add dependencies or UI libraries.
- Do not change: quote API, calculator formulas, portfolio parser logic,
  calendar provider/cache logic, Firestore schema, provider/cache rewrites,
  package dependencies.
- Do not commit private XLSX files.
- Do not infer requirements from mojibake — re-read prompts/files as UTF-8.

---

## 14. Future verification checklist

For each route, at **320px and 390px** (then 360/430/768/desktop):

- [ ] No whole-page horizontal scrollbar (only intentional, scoped scroll).
- [ ] No card/content clipped on the right edge.
- [ ] No input/select/button protruding outside its card.
- [ ] No Korean text breaking one character (or one syllable) per line.
- [ ] Large KRW / 만원 / % values fit or truncate gracefully (no awkward
      `원`/`%` orphan line).
- [ ] Tables either fit, hide low-priority columns, or become stacked cards —
      no 760–860px window forcing per-column scroll.
- [ ] Chart axis/tick labels readable and not overlapping; chart fits card.
- [ ] TopNav: chips, 더보기, login, bell, badge all fit without overflow.
- [ ] Third-party embeds (TradingView) are width-responsive.
- [ ] `npm.cmd run build`, `lint`, `typecheck` clean.

Recommended verification approach: run `npm run dev`, open each route in a
mobile-emulated viewport (or the Claude Preview / Chrome devtools device
toolbar) at 320px and 390px, and tick the list above per route. Capture
before/after screenshots for the M1–M5 PRs.

---

## Appendix — container standard reference

Target (already used by `/portfolio`, `/calculator`, `/asset-simulator`):

```tsx
<div className="min-h-screen overflow-x-hidden bg-[#111516] text-slate-200">
  <TopNav theme="dark" />
  <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
    {/* ... */}
  </main>
</div>
```

Laggard (to be migrated in M1): `/dividends`, `/performance`, `/market`,
`/portfolio-manager` currently use `mx-auto max-w-[1640px] px-8 py-6` with no
overflow guard.

Reference mobile-table pattern (from `TaxSavingTable` / `DividendSchedulePreview`):
`table-fixed` + `<colgroup>` widths, responsive font (`text-[11.5px]
sm:text-[12.5px]`), and `hidden sm:table-cell` to drop low-priority columns
below `sm` — no `min-width`, no forced horizontal scroll.
