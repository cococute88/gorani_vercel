# CALENDAR-UX-POLISH-4

Urgent follow-up to `CALENDAR-UX-POLISH-3`. After verifying local + Vercel, two
requirements were still broken:

1. The 기본 포트폴리오 관리 modal and 하단 티커 관리 still showed wrong tickers
   (QQQ / SPY / MSFT / `360200.KS`) instead of the imported legacy dividend
   calendar universe (OTF, FEPI, BCSF, NMFC, UWMC, …).
2. The custom/economic date-line still floated mid-cell (15 had too much top
   padding; 19/26 text sat in the middle) instead of being pinned to the top.

## 1. Stale `calendarTickers` override — root cause

POLISH-3 introduced a correct source priority, but its "explicit managed
`calendarTickers` overrides everything" rule was **too strong**: it accepted any
previously stored value. Older builds had persisted a bare ticker array
(localStorage `gorani.dividend-calendar.tickers.v1`) and per-ticker docs in the
Firestore `calendarTickers` collection — seeded back when `/portfolio` holdings
were (wrongly) the source. Those **metadata-less** values kept winning over the
imported legacy universe, so the modal/ticker-manager showed holdings even
though the grid + 절세액 panel (which read imported events directly) showed legacy
tickers. That divergence is exactly why memo matching also failed there.

- Where the wrong QQQ/SPY/MSFT/`360200.KS` list came from: a stale array-only
  `calendarTickers` value (localStorage + the old `calendarTickers` Firestore
  collection) left over from earlier builds.
- Why modal/manager diverged from the grid: the grid/tax panel resolve from
  imported `calendarEvents`, but modal/manager read the stale explicit list.
- How stale override is handled: only a **metadata-tagged** list overrides; old
  array/collection values are ignored and the stale localStorage key is removed
  on read.

## 2. Ticker source priority (re-fixed)

`lib/calendar-ticker-source.ts` — `resolveCalendarTickerSource()` now resolves:

0. **Valid manual override** — a list with `source: "manual-calendar-tickers"`
   and `version >= 2` (`isValidManualCalendarTickerList`). Only this shape wins.
1. Legacy portfolios (`legacyDividendCalendarMeta/portfolios.items`)
2. Imported `calendarEvents` tickers
3. Legacy memo keys (`legacyDividendCalendarMeta/memos.items`)
4. Mock fallback (`DEFAULT_WATCHLIST_TICKERS`)

A **bare `string[]`** (the old shape) is rejected by `isValidManualCalendarTickerList`,
so it never reaches override status — imported legacy data takes over.
`/portfolio` snapshot holdings remain entirely absent as a source.

### Valid manual override metadata

```ts
{ source: "manual-calendar-tickers", version: 2, updatedAt, tickers: string[] }
```

`createManualCalendarTickerList(tickers)` stamps this. The first add/remove in
the modal promotes the currently displayed (legacy-derived) list into a tagged
manual override; from then on the user's list is honored.

### Storage

- localStorage `gorani.dividend-calendar.tickers.v1` now holds the tagged object.
  On load it is validated; a stale array is dropped (key removed).
- Firestore: a single doc `users/{uid}/calendarSettings/manualTickers`
  (`loadManualCalendarTickers` / `saveManualCalendarTickers`). The old
  `calendarTickers` collection is no longer read for the override (functions
  kept for back-compat; schema untouched).

## 3. Same resolved source everywhere

`WatchlistPage` computes a single `tickers` via `resolveCalendarTickers(...)` and
passes it to: the manage modal, the lower ticker manager, the memo dialog key,
and `DividendCalendarPage` (filters / tax table / grid). Verified in-browser that
the modal sample === ticker-manager sample.

## 4. Legacy memo matching (re-verified)

Matching rules unchanged (`lib/calendar-memo-matching.ts`): exact → uppercase →
canonical (trim+upper) → suffix-stripped base. With the source fixed, imported
memos for `F`, `FEPI`, `BCSF`, `OTF`, `360200.KS`/`360200` resolve. Memos load
from `users/{uid}/legacyDividendCalendarMeta/memos` (`items` field), shown as the
memo dialog initial value, persisted under the canonical key (save→reload kept).

## 5. custom/economic absolute top-line

`components/watchlist/CalendarGrid.tsx` — the POLISH-3 fixed-height row was still
in normal flow, so it could be pushed by content. Now the top line is an
**absolute layer** pinned to the cell top:

```
button: relative min-h-[72px]
  top line:  absolute inset-x-1 top-1 z-10 flex h-5 items-center … sm:h-6   (date # + inline custom text)
  chips:     flex flex-col … pt-7 sm:pt-8                                    (cleared below the top line)
```

The date number now sits at the **identical y-position in every cell** (measured:
all 42 cells = 5px top offset, at 320/390/desktop), the custom/economic text
shares that line, and the event-chip flow can never push it down. Custom events
still render as date-line text only (no yellow 사용자 chip), truncated, with
`+N` overflow. Verified: day 15 "소매판매(21:30)" and day 26 "PCE(21:30)" sit
flush at the top on the date line.

## 6. non-declared opacity (unchanged, retained)

`lib/event-visuals.ts` `eventStateClasses`: estimated → `opacity-40`, declared
past → `opacity-60`, upcoming → full; type color preserved (no grayscale);
estimated stays dashed. `점선 = 추정` / `사용자/경제 일정 = …` legend captions
remain removed.

## 7. mock/imported mixing (re-verified)

`selectCalendarDividendEvents` still gates: imported events present → imported
only (badge `IMPORTED`); otherwise provider/mock fallback. The modal/manager now
share the imported-derived ticker source, closing the last place mock/holdings
leaked in. Covered by `check:calendar-ticker-source` with importedEvents +
staleOverride fixtures.

## Changed files

- `lib/calendar-ticker-source.ts` (manual-override metadata + resolver)
- `lib/firebase/firestore-repositories.ts` (`load/saveManualCalendarTickers`)
- `components/watchlist/WatchlistPage.tsx` (manual override wiring; drop stale collection)
- `components/watchlist/CalendarGrid.tsx` (absolute top line + chip `pt`)
- `scripts/check-calendar-ticker-source.mjs` (new), `package.json` script
- `scripts/check-calendar-ux-rules.mjs`, `scripts/check-calendar-memo-matching.mjs` (extended)

## Test commands

```bash
npm.cmd run check:calendar-ticker-source
npm.cmd run check:calendar-ux-rules
npm.cmd run check:calendar-memo-matching
npm.cmd run check:calendar-provider
npm.cmd run check:legacy-calendar-import
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Key new assertions: stale array does not override imported legacy; only
metadata-tagged override wins; imported source excludes portfolio/mock tickers;
`F`/`FEPI`/`BCSF` memo lookup; top line is `absolute … top-1` and chips start at
`pt-7/pt-8`; legend captions stay removed; estimated `opacity-40` retained.

## Remaining limitations

- Local `Firebase 미설정` preview still uses the mock fallback ticker list (no
  Firestore reads). The imported path (OTF/FEPI/BCSF, IMPORTED badge, memos) is
  covered by unit tests; final ticker/memo visual confirmation must be done on a
  Firebase-connected build. The stale-override fix WAS reproduced locally by
  seeding a stale array and confirming it is ignored + the key cleaned up.
- The legacy `calendarTickers` collection docs are left in place (not read);
  a future cleanup pass could delete them.
