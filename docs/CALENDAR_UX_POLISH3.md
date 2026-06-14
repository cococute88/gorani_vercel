# CALENDAR-UX-POLISH-3

Follow-up to `CALENDAR-UX-POLISH-2`. Fixes the dividend calendar ticker/memo
source, prevents mock/imported event mixing, stabilizes the custom/economic
date-line alignment, trims redundant legends, and fades non-declared events.

## Problem (observed on screen)

- The "기본 포트폴리오 관리" modal and the lower 티커 관리 grid showed `/portfolio`
  holdings (MSFT, SPY, `360200.KS`, …) instead of the legacy dividend-calendar
  ticker universe (OTF, FEPI, BCSF, NMFC, UWMC, …).
- Because the displayed tickers were portfolio holdings, **legacy memos never
  matched** — clicking a ticker opened an empty memo dialog.
- Mock/preview events (SPY/QQQ/MSFT 배당락 등) could mix into an imported calendar.
- Custom/economic date-line text shifted the date row; cell date heights varied.
- Redundant legend captions cluttered the grid.
- Estimated (non-declared) events were not visually distinct enough.

### Root cause

`components/watchlist/WatchlistPage.tsx` derived the calendar ticker list from
`usePortfolioSnapshots()` (the `/portfolio` snapshot holdings). The calendar's
"기본 포트폴리오" is **not** the portfolio holdings — it is the legacy dividend
calendar universe. Every downstream symptom (#2, #3, #6, #7 in the brief)
followed from this single wrong source.

## Calendar ticker source priority

New resolver: `lib/calendar-ticker-source.ts` → `resolveCalendarTickerSource()`.

Priority (first non-empty wins), implemented for the **derived default**:

1. Legacy portfolios — `users/{uid}/legacyDividendCalendarMeta/portfolios.items`
   (`{ name: ticker[] }`, flattened + deduped).
2. Imported calendar events — tickers extracted from
   `users/{uid}/calendarEvents` (custom events excluded).
3. Legacy memo keys — `users/{uid}/legacyDividendCalendarMeta/memos.items` keys.
4. Mock fallback — `DEFAULT_WATCHLIST_TICKERS` (only when nothing legacy exists).

On top of the derived default, an **explicitly managed list** (the
`calendarTickers` collection / localStorage, edited via the manage modal) takes
precedence when non-empty. The first add/remove "promotes" the derived list to
an explicit one.

`/portfolio` snapshot holdings, portfolio-manager holdings, and asset holdings
are **never** a calendar ticker source. `usePortfolioSnapshots` /
`applyKrxTickerMappingsToHoldings` were removed from `WatchlistPage`.

The manage modal and the lower ticker manager render the **same** `tickers`
value, so they are always consistent.

## mock/fallback data mixing prevention

New helper: `selectCalendarDividendEvents({ providerEvents, importedEvents })`
in `lib/calendar-event-provider.ts`.

Policy:

1. **Imported calendar events present** → use imported events **only** (plus
   custom events). The mock/real provider events are not mixed in. The header
   badge reads `IMPORTED`.
2. **No imported events** → fall back to the provider/mock events. (Local
   `Firebase 미설정` preview always lands here — see limitations.)

`DividendCalendarPage` gates on `legacyImportedEvents.length > 0` and suppresses
provider warnings while imported events are in use. The 전체 배당 일정 table is
driven by the same gated `events`, so it never mixes mock + imported rows.

### Deployed vs local

- **Firebase-connected (Vercel / configured local):** imported Firestore data
  is loaded and wins. Legacy tickers + memos + events appear; no mock mixing.
- **Local `Firebase 미설정`:** no user → no Firestore reads → the resolver returns
  the **mock fallback** ticker list and the provider (real/mock) supplies events.
  This is expected; do not treat the local preview as the deployed state.

## Legacy memo matching

`lib/calendar-memo-matching.ts` (unchanged matching rules) + correct ticker
source make memos resolve. Memos load from
`users/{uid}/legacyDividendCalendarMeta/memos` (the `items` field), keyed by the
canonical uppercase ticker, merged as legacy-base ⊕ local-override.

Lookup order: exact → uppercase → canonical (trim+upper) → suffix-stripped base
(`.KS`/`.KQ` → base). Single-letter `F` and `360200.KS`/`360200` both resolve.
Saving writes back under the canonical key; reload merges and resolves the same
key (roundtrip tested).

## custom/economic date-line top alignment

`components/watchlist/CalendarGrid.tsx` day cell:

- **Top line** is a fixed-height flex row (`flex h-5 items-center … sm:h-6`):
  the date number + the custom/economic inline text live on the same row, flush
  at the top. `leading-none` + `truncate` + `min-w-0` keep the text on one line.
- The height is constant whether or not custom text exists, so the date row
  never shifts between cells (verified: all 42 cells = 20px top line).
- Custom/economic events render as date-line text **only** — they never consume
  a dividend chip slot. The yellow `사용자` chip stays removed.
- Dividend chips render below the top line.

## non-declared opacity policy

`lib/event-visuals.ts` → `eventStateClasses()` (single opacity utility, never
stacked):

- declared/confirmed & upcoming → `opacity-100`
- declared/confirmed & past → `opacity-60` (light muted veil)
- estimated (non-declared), any date → `opacity-40` (strongest fade, still
  legible)

Past/outside events keep their full event-type color (no desaturation) — only a
muted opacity veil. Estimated events also keep `border-dashed`.

## Removed legend captions

Deleted from the calendar grid legend:

- `사용자/경제 일정 = 날짜 옆 텍스트`
- `점선 = 추정`

Kept: the four dividend-type chips (배당락 / 매수마감 / 지급 / 실적).

## UI copy fixes

- `PortfolioSelectorMock`: "저장/동기화 없이 미리보기 데이터만 사용합니다." →
  "배당캘린더 티커 목록(legacy 기준)을 관리합니다."
- `PortfolioManageModal` subtitle: "배당캘린더 티커(legacy 기준)를 추가/삭제합니다."
- `TickerManager`: removed "포트폴리오 보유종목 연동됨" → neutral
  "배당캘린더 티커 · legacy 메모 연동".

## Changed files

- `lib/calendar-ticker-source.ts` (new)
- `lib/firebase/firestore-repositories.ts` (`loadLegacyDividendCalendarPortfolios`)
- `lib/calendar-event-provider.ts` (`selectCalendarDividendEvents`)
- `lib/event-visuals.ts` (estimated opacity)
- `components/watchlist/WatchlistPage.tsx` (ticker source)
- `components/watchlist/DividendCalendarPage.tsx` (imported gating, badge)
- `components/watchlist/CalendarGrid.tsx` (top-line height, legend)
- `components/watchlist/TickerManager.tsx` (badge/prop)
- `components/watchlist/PortfolioSelectorMock.tsx` (copy)
- `components/watchlist/PortfolioManageModal.tsx` (copy)
- Tests: `scripts/check-calendar-provider.mjs`,
  `scripts/check-calendar-memo-matching.mjs`,
  `scripts/check-calendar-ux-rules.mjs`

## Test commands

```bash
npm.cmd run check:calendar-ux-rules
npm.cmd run check:calendar-memo-matching
npm.cmd run check:calendar-provider
npm.cmd run check:legacy-calendar-import
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

New assertions:

- `check:calendar-provider`: ticker source priority (portfolios → events →
  memos → fallback), `/portfolio` never a source, imported-events gate mock.
- `check:calendar-memo-matching`: `F` / `.KS` lookup, save→reload roundtrip,
  missing memo → empty.
- `check:calendar-ux-rules`: fixed-height top line, removed legend captions,
  estimated `opacity-40`, removed portfolio badge, page no longer uses
  `usePortfolioSnapshots`.

## Remaining limitations

- Local `Firebase 미설정` preview cannot show imported legacy data; it always
  uses the mock fallback ticker list + provider events. The imported-data path
  (OTF/FEPI tickers, legacy memos, IMPORTED badge, no-mock-mixing) is covered by
  unit tests and must be visually confirmed on a Firebase-connected build.
- The real dividend provider still runs for fallback tickers even when imported
  events later take over; its events are discarded by the gate (no UI impact,
  minor redundant fetch).
