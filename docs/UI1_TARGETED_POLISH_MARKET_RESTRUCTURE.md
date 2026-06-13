# Step UI-1 — Targeted UI Polish and Market Page Restructure

Date: 2026-06-13

A display-only / layout-only polish pass plus a structural restructure of the
`/market` page to mirror the original Streamlit 시장온도 page in the current dark
theme. No calculation, tax, parser, quote-API, calendar-provider, or Firestore
logic was changed.

## 1. Read docs / files

- `CLAUDE.md` (project conventions)
- `docs/reference/6_market_temperature_streamlit_reference.py` (read as UTF-8, layout reference only — not executed/imported/modified)
- `components/calculator/DividendCaptureSimulator.tsx`, `lib/dividend-capture-calculator.ts`
- `app/portfolio/page.tsx`, `components/PortfolioSummary.tsx`, `components/DonutChartCard.tsx`
- `lib/portfolio-aggregate.ts`, `lib/use-portfolio-view.ts`, `lib/mockData.ts`, `lib/format.ts`
- `components/market/*` (MarketPage, FearGreedCard, MarketBriefingCards, MarketTemperatureSection, MarketTemperatureTable, MarketRiskCards, MarketRsiChart, RsiDrawdownChart, VixChart, TradingViewTreemap, AssetMapSection)
- `lib/market-data.ts`, `lib/mock-market-data.ts`, `lib/chart-style.ts`
- `components/watchlist/CalendarEventDialog.tsx`
- `docs/AUDIT.md`, `docs/STEP5C0_WATCHLIST_FINAL_QA.md`

## 2. Reference file path used

`docs/reference/6_market_temperature_streamlit_reference.py`

Used only as a layout/content/structure reference (top briefing with a large
공포 & 탐욕 card + index/macro cards, then RSI cards+chart, drawdown cards+chart,
VIX graph, 시장온도 참고 시트, TradingView sector treemap). It was not executed,
imported, copied literally, or modified.

## 3. Changed files

New components:
- `components/market/MarketTopBriefing.tsx` — large 공포 & 탐욕 card (score, rating, gradient gauge + marker, history line) on the left + S&P 500 / Dow Jones / Nasdaq / USD/KRW / WTI / Gold / VIX cards on the right.
- `components/market/MarketRsiSection.tsx` — current RSI cards (QQQ/SCHD/SPY) + RSI 14 trend chart.
- `components/market/MarketMddSection.tsx` — current drawdown cards (QQQ/SCHD/SPY) + drawdown trend chart.
- `components/market/MarketTemperatureSheet.tsx` — 시장온도 참고 시트 (published Google Sheet iframe + "새 탭에서 열기" fallback link), recreated from the reference.

Edited:
- `components/calculator/DividendCaptureSimulator.tsx` — compact 판정 column + tooltip; table min-width 900→820px.
- `components/PortfolioSummary.tsx` — SCHD progress block right padding.
- `components/DonutChartCard.tsx` — legend shows compact KRW + percent when `amountKRW` is present.
- `lib/format.ts` — added `formatCompactKrw`.
- `lib/mockData.ts` — `Slice` gains optional `amountKRW`; `withMockAmounts` helper assigns display amounts to ACCOUNT/STOCK/TAG_DARK allocations.
- `lib/portfolio-aggregate.ts` — live `groupSlices` now also emits `amountKRW` (raw KRW) alongside the unchanged percent.
- `components/market/MarketPage.tsx` — new section ordering and imports.
- `components/watchlist/CalendarEventDialog.tsx` — static zero Info cells render `—`.
- `docs/AUDIT.md` — one summary line.

Now unused (left in place, no longer imported by `MarketPage`): `FearGreedCard.tsx`,
`MarketBriefingCards.tsx`, `MarketTemperatureSection.tsx`, `MarketTemperatureTable.tsx`,
`MarketRiskCards.tsx`, `MarketRsiChart.tsx`, `RsiDrawdownChart.tsx`.

## 4. Dividend capture result text fix (Issue 1)

The far-right 판정 column previously rendered the full sentence
(`매도허용기간 안에 손익분기점을 회복` / `허용기간 내 손익분기점 미회복`), creating
horizontal pressure. It now renders a compact status only:

- `성공` (green) when the round succeeded
- `회복불가` (amber) when the price never recovered the breakeven
- `실패` (red) otherwise

The full sentence is preserved as the cell `title` tooltip. Success/failure
판정 logic in `lib/dividend-capture-calculator.ts` is unchanged — only the cell
rendering changed. Table min-width was reduced 900→820px to ease horizontal
scrolling. Verified: `결과`/`판정` show `성공` with tooltip
`매도허용기간 안에 손익분기점을 회복`.

## 5. Portfolio progress label fix (Issue 2)

In `PortfolioSummary` (dark), the SCHD 달성률 progress block wrapper gained
`pr-[3px]`, shifting the `76.3%` label ~3px left and shortening the orange track
by the same amount so it no longer touches the right edge. The percentage
calculation (`schdRate`) is unchanged. Verified: label now sits 3px from the
wrapper's right edge.

## 6. Market page restructure summary (Issue 3)

`/market` now renders, in order:

1. 상단 시장 브리핑 — `MarketTopBriefing` (big 공포 & 탐욕 card + 7 index/macro cards)
2. RSI — `MarketRsiSection` (QQQ/SCHD/SPY RSI cards + RSI 14 chart)
3. MDD/하락률 — `MarketMddSection` (QQQ/SCHD/SPY drawdown cards + drawdown chart)
4. VIX 참고 그래프 — `VixChart`
5. 시장온도 참고 시트 — `MarketTemperatureSheet`
6. 섹터 트리맵 — `TradingViewTreemap`
7. 자산 맵 — `AssetMapSection` (bottom content preserved as-is)

The duplicate "시장온도 score card" (`MarketTemperatureSection`) and the separate
Fear & Greed card were removed; the temperature/Fear&Greed concept now lives only
in the single top 공포 & 탐욕 card. Existing data hooks (`fetchMarketBriefing`,
`fetchFearGreed`, `fetchEtfTemperatures`, `fetchRsiDrawdownSeries`,
`fetchVixSeries`) and the range selector are unchanged. Dark theme is preserved
throughout (no white/light cards).

## 7. Original Streamlit reference 반영 내역

- Large 공포 & 탐욕 card on the left with score, rating label, gradient gauge with a
  current-score marker, 5 band labels (극단적 공포 … 극단적 탐욕), and a history line.
- Right-side index cards (S&P 500 / Dow Jones / Nasdaq) and macro cards
  (USD/KRW / WTI / Gold / VIX) — same set as `MARKET_BRIEFING_TICKERS`.
- RSI 14 cards + RSI chart and 고점 대비 하락률 cards + drawdown chart for the
  QQQ/SCHD/SPY watchlist, with the original ticker color mapping.
- VIX reference graph, 시장온도 참고 시트 (same published sheet URL), and the
  TradingView sector treemap, ordered as in the reference.
- Adapted to the app's dark card style (`bg-[#191f20]`, `border-[#2a3336]`,
  blue/green/red accents) instead of the original light cards.

## 8. Portfolio chart KRW amount display (Issue 4)

`DonutChartCard` legends (계좌별 비중 / 종목별 비중 상위 15개 / 목적별 비중) now show
the compact KRW amount before the percentage, e.g. `3.74억 · 38.2%`,
`9,604만 · 9.8%`, `3,822만 · 3.9%`.

- `formatCompactKrw(value)`: `>= 1억` → `억` (trailing zeros trimmed, e.g. `1.45억`),
  `>= 1만` → `만` with thousands separators (e.g. `6,000만`, `763만`), else 원 단위.
- Live data: `lib/portfolio-aggregate.ts` `groupSlices` now emits `amountKRW`
  (raw KRW total per slice) alongside the unchanged `value` percent.
- Mock fallback: `withMockAmounts` derives display amounts from a notional total
  so the feature is visible without a saved snapshot. Allocation percentages are
  unchanged; only `amountKRW` was added. When a slice has no `amountKRW` (e.g.
  the sector donut), the legend gracefully shows percent only.

## 9. Watchlist static-zero display fix (Issue 4 / Step 5C-0 P2)

In `CalendarEventDialog`, the `연간 수익률` and `절세액($10k)` Info cells render `—`
when their value is `0` (not actually calculated), avoiding a misleading
`0.00%` / `$0.0` next to the live historical metric. Tax formulas and the
historical metric are unchanged — display-only guard.

## 10. Desktop / mobile visual verification

Verified with the running dev server (Claude Preview):

- `/market`: section order confirmed via DOM headings (시장 브리핑 → 공포 & 탐욕 지수 →
  RSI (14) → RSI 14 추이 → 고점 대비 하락률 (MDD) → 추이 → VIX → 시장온도 참고 시트 →
  미국주식 섹터 트리맵 → 자산 맵). No page-level horizontal overflow at desktop, 390px, 320px.
- `/portfolio`: donut legends show `3.74억 · 38.2%` etc.; SCHD `76.3%` label sits
  3px from the right edge; no overflow at 320px.
- `/calculator`: 판정 column shows `성공` with the full sentence as `title`; no
  page-level overflow at 320px (the detail table scrolls internally by design).
- `/watchlist`: loads cleanly, no overflow at 320px.
- Console: only the pre-existing Recharts `defaultProps` deprecation warnings
  (documented in `CLAUDE.md`); no new React/hydration errors.

## 11. check / build / lint / typecheck results

All run with the dev server stopped for the build:

- `npm.cmd run check:tax-saving` → exit 0
- `npm.cmd run build` → ✓ Compiled successfully, 14/14 static pages
- `npm.cmd run lint` → ✔ No ESLint warnings or errors
- `npm.cmd run typecheck` → clean (tsc --noEmit)
- `npm.cmd run check:calendar-provider` → exit 0
- `npm.cmd run check:portfolio-parser` → exit 0
- `npm.cmd run check:portfolio-parser:private` → exit 0

## 12. Remaining issues

- The 시장온도 참고 시트 embeds an external published Google Sheet via iframe (same
  URL as the reference). It is view-only with a "새 탭에서 열기" fallback; if the
  sheet's publish settings change or the network blocks the iframe, only that
  card is affected. No new dependency was added.
- The RSI/MDD/VIX/briefing/Fear&Greed values are still mock-backed
  (`lib/mock-market-data.ts`); the `fetch*` adapters keep their `TODO(codex)`
  hooks for future live wiring.
- Seven older market components are now unused but left in place to keep this
  change minimal; they can be deleted in a later cleanup.

## 13. Next step recommendation

- Optional cleanup step to delete the now-unused market components.
- Wire the market `fetch*` adapters to real sources (CNN Fear & Greed, index/FX
  snapshots, yfinance/Stooq RSI/drawdown) behind the existing adapter boundary.
