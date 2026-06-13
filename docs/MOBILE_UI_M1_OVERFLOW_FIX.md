# Mobile UI M1 — App-wide P0/P1 Overflow Fix

Implementation date: 2026-06-13

Implements the fixes planned in [`docs/MOBILE_UI_OVERFLOW_AUDIT.md`](MOBILE_UI_OVERFLOW_AUDIT.md)
(Step M0). This step actually fixes the P0/P1 mobile overflow / clipping /
Korean-wrapping / chart / table issues; it is **not** a redesign.

---

## 1. Read files / docs

- `docs/MOBILE_UI_OVERFLOW_AUDIT.md` (M0 audit — root causes R1–R7, per-route plan).
- Page shells: `app/performance/page.tsx`, `app/portfolio/page.tsx`,
  `components/dividend/DividendPage.tsx`, `components/market/MarketPage.tsx`,
  `components/portfolio/PortfolioPage.tsx`, `components/calculator/CalculatorPage.tsx`,
  `components/asset-simulator/AssetSimulatorPage.tsx`,
  `components/watchlist/WatchlistPage.tsx`.
- Shared/cards/charts: `components/MetricCard.tsx`, `components/PortfolioSummary.tsx`,
  `components/PerformanceChart.tsx`, `lib/chart-style.ts`, `lib/format.ts`,
  `components/dividend/DividendSummaryCards.tsx`,
  `components/asset-simulator/YearPlanTable.tsx`,
  `components/market/MarketTemperatureSection.tsx`,
  `components/qld/QldAssetSummaryCard.tsx`, `components/qld/QldValueFxChart.tsx`,
  `components/qld/QldHoldingsRankTable.tsx`, `app/globals.css`.
- Watchlist (regression check only): `CalendarGrid`, `TaxSavingTable`,
  `DividendSchedulePreview`, `TickerManager`, `CustomEventDialog`.

---

## 2. Changed files

UI / style:
1. `app/globals.css` — global Korean `word-break: keep-all`.
2. `components/MetricCard.tsx` — responsive value font, `min-w-0`, `break-keep`, mobile padding.
3. `components/dividend/DividendPage.tsx` — standard responsive container (R1).
4. `app/performance/page.tsx` — standard responsive container (R1).
5. `components/market/MarketPage.tsx` — standard responsive container (R1).
6. `components/portfolio/PortfolioPage.tsx` (`/portfolio-manager`) — standard container (R1).
7. `components/dividend/DividendSummaryCards.tsx` — KPI responsive font + `min-w-0` + padding.
8. `components/asset-simulator/YearPlanTable.tsx` — **mobile card layout** + short mobile checkbox labels.
9. `components/market/MarketTemperatureSection.tsx` — band labels `break-keep` + responsive font/padding.
10. `components/PerformanceChart.tsx` — `minTickGap` + bottom margin (mobile axis).
11. `components/qld/QldAssetSummaryCard.tsx` — responsive big total value.
12. `components/PortfolioSummary.tsx` — `break-keep` + `min-w-0` on summary grid/values.
13. `components/qld/QldValueFxChart.tsx` — summary stat cards responsive font + `min-w-0` + padding.

Infra / docs:
14. `.claude/launch.json` — dev-server config for the preview tool (new).
15. `docs/MOBILE_UI_M1_OVERFLOW_FIX.md` — this report (new).
16. `docs/AUDIT.md` — one-line index entry.

No new dependencies, no provider/parser/calendar/quote/Firestore/formula changes.

---

## 3. Global mobile fixes

- **R3 — Korean one-character wrapping (global):** added `word-break: keep-all`
  to `html, body` in `app/globals.css`. `keep-all` only affects CJK (Latin/numbers
  behave as `normal`), so Korean words no longer break mid-word into one character
  per line. Verified live: `getComputedStyle(document.body).wordBreak === "keep-all"`.
- **R5 — Shared metric card (`MetricCard`):** value font is now `text-[18px]
  sm:text-[22px]`, with `min-w-0` + `break-keep` on the card and `break-keep` on
  label/value/sub, plus `px-4 sm:px-5`. This card is used by `/performance` KPIs
  and `/asset-simulator` result cards, so the fix is shared.
- **R1 — Page container standard:** the four laggard pages now use the same shell
  as `/portfolio`/`/calculator`:
  `min-h-screen overflow-x-hidden` wrapper +
  `mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8`.
  This removes the old fixed `px-8` (which left only ~256px at 320px) and adds a
  real page-level horizontal-overflow guard, so any wide child (e.g. a data table)
  is contained instead of scrolling the whole page.

---

## 4. Route-by-route fixes

### `/dividends`
- Container → R1 standard (was fixed `px-8`, no overflow guard).
- `DividendSummaryCards` KPI value `text-[16px] sm:text-[20px]`, `min-w-0`,
  `break-keep`, card padding `p-4 sm:p-5`.
- **Result:** `평가금액 ₩ 506,282,000` (and the other three KPIs) now display in
  full at 320/390px — previously clipped to `₩ 506,282,00…`.

### `/performance`
- Container → R1 standard.
- Shared `MetricCard` hardening fixes the 6 KPI cards: `9억 8,011만원`,
  `+3억 5,566만원`, `+8.97%/년` now wrap intentionally (word-level) or fit on one
  line; units no longer split awkwardly.
- `PerformanceChart`: added `minTickGap={24}` (lets recharts thin X-axis labels on
  narrow widths) and bottom margin `4` so axis labels don't collide/clip.
- `QldValueFxChart` summary stat cards: value font `text-[12px] sm:text-[14px]`,
  `min-w-0`, `break-keep`, tighter mobile padding — large won values (e.g.
  `1,076,911,793원`) no longer clip in the 2-column mobile grid.
- `QldHoldingsRankTable` (`min-w-[820px]`) keeps a **real internal horizontal
  scroll** inside its `overflow-x-auto` card; verified it does **not** overflow the
  page (see §13).

### `/portfolio` and `/portfolio-manager`
- `/portfolio` shell was already mobile-safe; hardened `PortfolioSummary`
  (DarkSummary) with `break-keep` on big values and `min-w-0` on the summary grid /
  first panel so the total value and composition rows can't push width.
- `/portfolio-manager` container → R1 standard. Its wide `HoldingsTable`
  (`min-w-[860px]`) keeps a real internal scroll inside `overflow-x-auto` and is
  fully contained (no page overflow).

### `/asset-simulator`
- **Headline fix:** `YearPlanTable` now renders a **mobile card list** below `sm`
  (`sm:hidden`) and the original table only at `sm+` (`hidden sm:block`). Each
  mobile card shows: year, 월적립(만원) input, and the three checkboxes
  (ISA / 연금저축 / 연금이전) with short labels in a `grid-cols-3` layout — all
  inside the card, no horizontal clipping, no fake scrollbar.
- The `sm+` table’s `min-width` was reduced `760px → 640px` (it no longer needs to
  accommodate phones).
- Verified at 320px: 30+ year cards render, the wide table is hidden
  (`offsetParent === null`), page does not overflow, all checkboxes visible.

### `/market`
- Container → R1 standard.
- `MarketTemperatureSection` band buttons: `break-keep`, `text-[10px]
  sm:text-[11.5px]`, `px-1 sm:px-2`, centered flex. `매우 차가움` / `매우 뜨거움`
  now wrap as words (`매우` / `차가움`) instead of one character per line.

### `/calculator`
- No container change needed (already mobile-safe). Verified its result table
  (`min-w-[900px]`) is contained as real internal scroll; no page overflow at 320px.
  No other changes — previous calculator polish preserved.

### `/watchlist`
- No code changes (already the reference mobile implementation). Verified no
  regression: calendar grid, schedule preview, tax-saving table, ticker manager,
  custom-event dialog all render with no page overflow at 320px.

---

## 5. Before issue summary (from screenshots / M0 audit)

- `/dividends`: summary KRW values clipped (`₩ 506,282,00…`).
- `/performance`: KPI values wrapped awkwardly (`9억 8,011 만원`, `+8.97%/년`);
  chart label crowding; secondary stat cards clipped large values.
- `/portfolio`: needed audit for big-value / composition overflow.
- `/asset-simulator`: 연도별 투자 계획표 clipped on the right; inputs + ISA
  checkbox column cut off; horizontal overflow.
- `/market`: temperature labels rendered vertically one character per line
  (`매 우 차 가 움`).
- Recurring: fixed `px-8` containers, no Korean break guard, no responsive metric
  fonts.

---

## 6. After verification summary

Live verification on a fresh dev server (Next dev), viewport 320px and 390px,
dark scheme. Page-level horizontal overflow measured with
`document.documentElement.scrollWidth > clientWidth`, and an ancestor-aware walk to
separate genuine page overflow from legitimate internal table scroll.

| Route | 320px page overflow | Uncontained overflow | Notes |
|---|---|---|---|
| `/dividends` | false | none | KRW values full, not clipped |
| `/performance` | false | none | KPIs clean; rank table = internal scroll |
| `/portfolio` | false | none | already safe; hardened |
| `/portfolio-manager` | false | none | holdings table = internal scroll |
| `/asset-simulator` | false | none | mobile year cards; table hidden |
| `/market` | false | none | temperature labels read horizontally |
| `/watchlist` | false | none | no regression |
| `/calculator` | false | none | result table = internal scroll |

Text-clipping scan (`.num` / extrabold, `scrollWidth > clientWidth`) at 320 & 390:
only an intentionally `truncate`d timestamp sub-label remains; no metric value clips.

Acceptance criteria (all met):
1. No page-level horizontal scroll at 320px on key routes ✅
2. No right-side clipping of inputs/cards/tables ✅
3. No Korean one-character-per-line wrapping ✅
4. Large KRW values readable, not clipped ✅
5. `/asset-simulator` annual plan usable at 320px ✅
6. `/market` temperature labels not vertical ✅
7. `/performance` KPIs no ugly random wrapping ✅
8. `/watchlist` no regression ✅
9. Dark theme intact ✅
10. build / lint / typecheck pass ✅ (see §14)

---

## 7. Remaining issues (non-blocking, P2/P3)

- **Internal table scroll** remains for genuinely wide tables
  (`QldHoldingsRankTable` 820px, `HoldingsTable` 860px, calculator result 900px,
  `DividendHoldingsTable` 760px). These are **contained** (no page overflow) and
  documented as acceptable real horizontal scroll. Converting them to mobile card
  lists is a future polish item (M4-style), out of M1 scope.
- Chart annotation labels in `QldValueFxChart` (MDD 시작 / 저점 / 고점) can still
  crowd on very narrow widths; the value/FX axes are tuned but in-SVG annotation
  collision is a P2 polish item.
- `<select>` controls still use platform-default arrow styling (R7, P3).

---

## 8. Next recommended batch

- **M2 (optional polish):** convert the remaining wide data tables
  (`HoldingsTable`, `DividendHoldingsTable`, `QldHoldingsRankTable`, calculator
  result tables) to mobile card lists / hidden-column layouts so they don't rely on
  internal horizontal scroll. Use the watchlist `table-fixed` + `hidden
  sm:table-cell` pattern as the reference.
- Chart annotation de-collision pass for `QldValueFxChart` on mobile.
- `<select>`/native control theming (R7).

---

## Appendix — verification method note

A pre-existing dev preview server on port 3000 was serving stale CSS after a
`next build` ran against the same `.next` directory (build and dev clobber each
other in Next.js). Early measurements against that server were invalid (Tailwind
utilities computed to `visible`, padding `0`). The server was stopped, `.next`
removed, and a fresh dev server started; all results in §6 are from that clean
server (confirmed `main` padding `16px`, `overflow-x: hidden` active, dark theme
applied). Lesson recorded: do not run `npm run build` while the dev server is live.
