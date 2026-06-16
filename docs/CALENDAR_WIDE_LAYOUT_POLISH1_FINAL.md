# CALENDAR-DESIGN-FINAL-POLISH-1

Final UI/design polish for the `/watchlist` (사용자 화면 기준 **배당캘린더**) page.
Scope is **UI only** — no provider/API/cache/Firestore/live-update logic was
touched. Builds on `CALENDAR-LAYOUT-WIDE-STREAMLIT-POLISH-1`
(`docs/CALENDAR_WIDE_LAYOUT_POLISH1.md`).

> Note: the internal route is still `/watchlist`; route/name cleanup is a
> follow-up Codex task and is intentionally **not** done here.

## 0. Pre-work layout structure findings

1. **Calendar container width** — `components/watchlist/WatchlistPage.tsx`
   `<main className="… max-w-[1640px] …">` (wide container, same as `/portfolio`).
   Kept unchanged.
2. **Day-cell height** — `components/watchlist/CalendarGrid.tsx`, the day
   `<button>` `min-h-[…] sm:min-h-[…] lg:min-h-[…]`.
3. **Chip font/height/padding** — `CalendarGrid.tsx`, the chip `<span>` plus the
   day-number / custom-text / `+N` pill spans.
4. **절세액 panel width/height** — width from `DividendCalendarPage.tsx` grid
   `xl:grid-cols-[minmax(0,1fr)_280px]`; height from `TaxSavingTable.tsx`.
5. **상단 IMPORTED / 일정 최신화 / 클라우드 저장 buttons** —
   `DividendCalendarPage.tsx` page-header action row. The duplicate
   `클라우드 동기화` badge came from `WatchlistPage.tsx`
   `headerAccessory={<StorageModeBadge />}`. The global `클라우드 동기화` badge in
   `components/TopNav.tsx` is separate and was left untouched.
6. **Bottom filter toggles + `+ 일정 추가`** — `CalendarGrid.tsx` bottom toolbar.
7. **티커 관리 / 포트폴리오 관리** — `DividendCalendarPage.tsx` 티커 관리 section,
   `포트폴리오 관리` button (`onManagePortfolio`).

## Changes

### Chip readability (item 3)
- Calendar chip text bumped one step: `text-[9px]/sm:text-[10px]` →
  `text-[10px]/sm:text-[11px]`. Day-number, custom inline text and the `+N` pill
  were nudged up the same amount. Mobile stays at the smaller size. Chip
  padding/height unchanged, so the 5-line target still holds.

### Day-cell height for 5 chips, tighter bottom (item 4)
- Visible chip cap 4 → 5 (`dayEvents.slice(0, 5)`); the rest still collapse into
  the `+N` pill.
- Cell min-height sized for `date line + 5 chips + minimal padding`:
  `min-h-[88px]/sm:min-h-[140px]/lg:min-h-[152px]` →
  `min-h-[100px]/sm:min-h-[148px]/lg:min-h-[160px]`. A full (5-chip) cell now has
  almost no trailing whitespace; lighter cells keep the same grid height.

### 절세액 panel height tracks the calendar card (item 6)
- The calendar card and the 절세액 rail share a single **stretched** grid row
  (`items-stretch`); `SelectedDateList` moved to a full-width block below.
- The rail is absolutely filled on desktop (`<aside class="relative">` +
  `<div class="xl:absolute xl:inset-0">`) so it always matches the calendar card
  height instead of dictating the row height. `TaxSavingTable` became
  `flex h-full flex-col` with a `min-h-0 flex-1 overflow-y-auto … xl:max-h-none`
  scroll body — internal scroll preserved, width unchanged (280px). On mobile it
  falls back to natural height with a `max-h-[420px]` cap and stacks below.

### Remove IMPORTED badge + duplicate 클라우드 동기화 (item 7)
- Removed the `IMPORTED`/`LOADING`/source badge (`sourceLabel`/`sourceColor`)
  from the page action row, plus the now-unused `isProviderLoading` state.
- Removed `headerAccessory={<StorageModeBadge />}` from `WatchlistPage.tsx` (and
  the `headerAccessory` prop), eliminating the duplicate in-page `클라우드 동기화`
  badge. The global TopNav `클라우드 동기화` badge is untouched.
- `일정 최신화` and `클라우드 저장` buttons kept.

### Estimated chip legibility (item 8)
- Estimated chip opacity raised `opacity-40` → `opacity-75` so the text stays
  clearly readable; the dashed border remains the primary 추정 cue. Confirmed
  events keep full opacity + solid border; past confirmed keep their `opacity-60`
  muted veil.

### Kept as-is
- Bottom filter toggles, `+ 일정 추가`, 티커 관리 + 포트폴리오 관리 merge, heart/star
  priority sort, tax-saving column sort, estimated schedule-row gray background,
  chip tax-saving amounts, custom events, ticker memos, live refresh + cloud save.

## Verification
- `npm run check:calendar-wide-layout-polish` ✅ (extended with the new checks)
- `npm run check:calendar-priority-tax-style` ✅
- `npm run check:calendar-dividend-live-update` ✅
- `npm run check:calendar-provider` ✅
- `npm run lint` ✅  `npm run typecheck` ✅  `npm run build` ✅
- Regression: `check:portfolio-realdata`, `check:market-data-real`,
  `check:dividend-estimates`, `check:dividends-data`,
  `check:calendar-selected-date-cards` ✅

## Remaining limitations
- `npm run check:calendar-ux-rules` still fails, but this is **pre-existing on
  `main`** — that script asserts the superseded pre-wide-layout spec (`slice(0,3)`,
  `min-h-[72px]`, narrow rail). Out of scope for this UI-only pass.
- Chip tax-saving amounts stay desktop/tablet-only (cell-width protection), same
  as the prior step.
- Route/name cleanup (`/watchlist` → 배당캘린더) is deferred to the follow-up
  Codex task.
