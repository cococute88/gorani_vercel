# CALENDAR-UX-POLISH-6

Final `/watchlist` 배당캘린더 UI polish, following POLISH-1…5. Scope is **UI
only** — the legacy ticker source, stale-override policy, IMPORTED gate, memo
source/matching, Firestore schema, and import tooling are all untouched.

User-reported problems (verified on Vercel):

1. Only ~2 event chips were visible per day cell; at least 3 are wanted.
2. In light mode the selected-date cards turned black / very dark on
   hover/click/focus (should be a faint sky blue).
3. The selected-date cards' default light background was gray (should be white).
4. The cards should show more info: date + 만달러당 절세예상액(현시세) + 확정/예상,
   plus a ticker memo (desktop: right of the ticker; mobile: below it).
5. Custom/ticker memos still don't load reliably — that is a logic problem and is
   split out as a follow-up Codex TODO; this pass only prepares the UI.

## 0. Pre-work structure findings

- **Day-cell visible chip cap**: `components/watchlist/CalendarGrid.tsx` —
  `const shown = dayEvents.slice(0, 2)` capped chips at two; `extra` drives the
  `+N` pill. The chip container is already a top-anchored
  (`mt-0.5 flex … flex-col justify-start gap-0.5 overflow-hidden`) block beneath
  the date/custom line.
- **Selected-date card component**: `SelectedDateList` →
  `components/watchlist/CalendarEventList.tsx` (the latter is used **only** by the
  former, so it could be enhanced freely).
- **Card hover/active/focus style**: previously on the `<button>` in
  `CalendarEventList.tsx` as `bg-[#141a1b] hover:bg-[#1d2527]`. The global light
  remap (`app/globals.css`) maps the **base** `bg-[#141a1b]` to gray `--muted`
  (the gray base), but does **not** match the `hover:`/`focus:` variants
  (different generated class names), so the raw dark `#1d2527` showed through on
  hover → near-black flash in light mode.
- **Tax-saving field**: the per-$10k estimate (현시세 기준) is **not** a static
  field on `CalendarEvent` (`event.taxSavingUsd` is only a mock profile constant).
  The real value comes from `buildTaxSavingRows(...).taxSavingUsd`
  (`lib/mock-calendar-data.ts` → `lib/tax-saving-calculator.ts`,
  `DEFAULT_TAX_SAVING_INVESTMENT_USD = 10000`, current price from
  `fetchQuoteLast`), the same source the right-rail 절세액 table uses.
- **Memo reaching the card**: previously **no**. `memos` lived in `WatchlistPage`
  and was passed only to `TickerManager` / `TickerMemoDialog`, never down to
  `DividendCalendarPage` / `SelectedDateList`. `event.note` (per-event meta memo)
  did reach the events but is a different field from the shared 종목 메모.
- **Memo handling this pass**: UI wired (cards accept `tickerMemos`, resolve via
  the existing read-only `lookupTickerMemo`, and `WatchlistPage` now passes its
  already-loaded `memos` down). The deeper source/matching fix is **not** done —
  see the Codex TODO below.

## 1. Day cell: up to three event chips (top-stacked)

`components/watchlist/CalendarGrid.tsx`:

```ts
// was: dayEvents.slice(0, 2)
const shown = dayEvents.slice(0, 3);
const extra = dayEvents.length - shown.length;
```

- The date number + custom/economic inline text stay on the top line; the chip
  block stacks **directly beneath** it (`justify-start`, `gap-0.5`, no vertical
  centering — the POLISH-5 top-anchoring is preserved).
- Cell `min-h` is **unchanged** (`min-h-[72px]` / `sm:min-h-[100px]`); a min-h is
  a floor, so only busy days (e.g. 29/30) grow a little to fit the third chip,
  matching "don't blow up the cell height".
- Chips keep `truncate` + `min-w-0`, so 320px has no horizontal overflow; >3
  events still collapse into the existing `+N` pill.
- Verified dates 15/16/18/22/29/30: busy days show 3 chips + `+N`.

## 2. Selected-date card light-mode style

`components/watchlist/CalendarEventList.tsx` — the card `<button>` no longer uses
a bare dark hex (which the light remap turned gray / let hover flash black):

```
border-slate-200 bg-white
hover:border-sky-200 hover:bg-sky-50
focus:outline-none focus-visible:border-sky-300 focus-visible:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-200
dark:border-[#263134] dark:bg-[#141a1b] dark:hover:bg-[#1d2527] dark:focus-visible:bg-[#1d2527] dark:focus-visible:ring-sky-500/30
```

- Light base = **white**; hover/focus = faint **sky** tint; no black/dark-gray
  hover.
- Dark mode keeps the existing dark card tones (gated behind `dark:`).
- Text uses readable slate (`text-slate-700`/`text-slate-500` in light).

## 3. Card info: date · tax · status

Date line now renders `{event.date} · {taxLabel} · {statusLabel}`:

- `statusLabel` = `eventStatusShortLabel(status)` → **확정** (confirmed/declared)
  / **예상** (estimated). New helper in `lib/event-visuals.ts`; the existing
  `eventStatusLabel` (확정/추정, used elsewhere) is left as-is.
- `taxLabel` = per-$10k 절세예상액(현시세) via `formatTaxSavingPer10k`
  (`$12` whole / `$8.4` one-decimal; `—` when not computable). Sourced from a new
  `taxSavingByTicker` map built in `DividendCalendarPage` from the same `taxRows`
  (`buildTaxSavingRows`) the right-rail table uses, threaded
  page → `SelectedDateList` → `CalendarEventList`.
- No fabrication: loading / non-computable / missing ticker → `—`.
- The right-end status badge also uses 확정/예상.

## 4. Memo UI (desktop / mobile)

`CalendarEventList` accepts an optional `tickerMemos: Record<string, string>` and
resolves a memo per row via the existing read-only `lookupTickerMemo`
(`event.note` is used as a secondary fallback). When a memo exists:

- **Desktop (`sm:`)**: shown in the empty space to the right of the
  badge/date-line block (`hidden … sm:block`, `line-clamp-2`), with the status
  badge still pinned to the right end.
- **Mobile**: shown below the badge/date line (`sm:hidden`, `line-clamp-2`).
- **Absent memo**: nothing is rendered (no "메모 없음"/placeholder spam).

`WatchlistPage` now passes its already-loaded `memos` into `DividendCalendarPage`
as `tickerMemos`, so any memo currently resolvable is displayed.

## 5. Memo source logic → Codex TODO (CALENDAR-MEMO-SOURCE-FIX-1)

The deeper "custom/ticker memos don't load reliably" issue is **not** solved here
(no memo source / matching / Firestore / import changes). Follow-up for Codex:

**TODO `CALENDAR-MEMO-SOURCE-FIX-1`**
- Connect legacy imported memos and the selected-date card / `TickerMemoDialog`
  to the **same** memo source.
- Confirm the Firestore `legacyDividendCalendarMeta/memos` path (`items` field)
  is loaded into the `memos` map that now flows to the cards.
- Re-verify ticker normalization (exact / uppercase / suffix-stripped) end-to-end.
- On a **Firebase-connected** (Vercel) build, confirm `F` / `FEPI` / `BCSF`
  memos appear on the selected-date cards and the memo dialog.

## Maintained (unchanged) behavior

Legacy imported ticker source + stale `calendarTickers` override-ignore policy,
관리 modal / ticker manager legacy tickers, mock/imported gate, non-declared
`opacity-40`, past/outside event color, custom/economic date-line top alignment,
removed legends, 전체 배당 일정 12-row table (sort/filter), 미국 경제 일정 two
tables, Firebase import tool, `/dev/calendar-import`.

## Changed files

- `components/watchlist/CalendarGrid.tsx` (2 → 3 visible chips)
- `components/watchlist/CalendarEventList.tsx` (light style, date·tax·status, memo UI)
- `components/watchlist/SelectedDateList.tsx` (forward new props)
- `components/watchlist/DividendCalendarPage.tsx` (`taxSavingByTicker` map, thread `tickerMemos`)
- `components/watchlist/WatchlistPage.tsx` (pass `memos` as `tickerMemos`)
- `lib/event-visuals.ts` (`eventStatusShortLabel`, `formatTaxSavingPer10k`)
- `scripts/check-calendar-selected-date-cards.mjs` (new) + `package.json` script
- `scripts/check-calendar-ux-rules.mjs` (3-chip assertions)
- `docs/CALENDAR_UX_POLISH6.md` (new), `docs/AUDIT.md`

## Test commands

```bash
npm run check:calendar-ux-rules
npm run check:calendar-selected-date-cards
npm run check:calendar-ticker-source
npm run check:calendar-memo-matching
npm run check:calendar-provider
npm run check:legacy-calendar-import
npm run lint
npm run typecheck
npm run build
# regressions
npm run check:portfolio-realdata
npm run check:dividend-estimates
npm run check:dividends-data
npm run check:performance-qld-snapshots
npm run check:krx-ticker-name-map
npm run check:market-chart-formatters
npm run check:tax-saving
```

All of the above pass.

## Remaining limitations

- **Memo source**: custom/ticker memos may still not appear until
  `CALENDAR-MEMO-SOURCE-FIX-1` is done; the card UI is ready and renders any memo
  that is actually resolved. On a local Firebase-미설정 preview, the memo map is
  empty (no Firestore reads), so the desktop/mobile memo blocks stay hidden by
  design — final memo visual confirmation must be on a Firebase-connected build.
- **Browser visual check**: structural source checks + a clean production build
  pass here; the pixel-level light/dark + 320/390px confirmation should be done on
  the Vercel preview (this container has no browser).
