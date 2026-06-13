# Step 5B-7 Historical Tax-Saving Dialog Cache And Source Badge

Implementation date: 2026-06-13

This step stabilizes the existing event-dialog historical tax-saving auxiliary
metric (connected in Step 5B-6). It adds a small in-memory session cache with
in-flight request deduplication so reopening the same ticker does not refetch,
and surfaces the metric `source` as a small muted line inside the existing
metric card. It does not redesign the dialog, change `TaxSavingTable`, change
the current tax-saving table formula, or touch quote API routes, the calendar
provider/cache, canonical event ids, custom event storage, or Firestore.

## 1. Read Docs And Files

Repository structure was confirmed:

- Working root: `C:\gv\gorani_vercel`
- `original/` exists and remains read-only reference.
- `target/` does not exist and was not created.

Required documents read as UTF-8:

- `docs/AUDIT.md`
- `docs/STEP5B4_HISTORICAL_TAX_SAVING_HELPER.md`
- `docs/STEP5B5_HISTORICAL_TAX_SAVING_SERVICE.md`
- `docs/STEP5B6_HISTORICAL_TAX_SAVING_DIALOG_UI.md`
- `docs/MOBILE_UI_M1_OVERFLOW_FIX.md`
- `docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`

Missing required documents: none.

Code read:

- `components/watchlist/CalendarEventDialog.tsx`
- `lib/historical-tax-saving-service.ts`
- `lib/historical-tax-saving-calculator.ts`
- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `scripts/check-tax-saving-calculator.mjs`
- `scripts/check-calendar-provider.mjs`
- `package.json` (scripts)

## 2. Changed Files

- `lib/historical-tax-saving-session-cache.ts` (new) — in-memory session cache
  + in-flight deduplication wrapper around
  `loadHistoricalTaxSavingMetricForTicker`.
- `components/watchlist/CalendarEventDialog.tsx` — load through the cached
  wrapper; add a small muted `출처: <source>` line inside the existing metric
  card.
- `scripts/check-tax-saving-calculator.mjs` — added four cache regression cases.
- `docs/STEP5B7_HISTORICAL_TAX_SAVING_DIALOG_CACHE.md` (this file).
- `docs/AUDIT.md` (one line appended).

No other files were changed. The service, calculator, `TaxSavingTable`,
`DividendCalendarPage`, calendar provider, and quote API routes were not
modified.

## 3. Cache Design

A module-scoped `Map` in `lib/historical-tax-saving-session-cache.ts` stores one
entry per normalized ticker. Each entry is either:

- `{ status: "pending"; promise }` — an in-flight request, or
- `{ status: "resolved"; result; storedAt }` — a completed result with a
  timestamp.

Public API:

```ts
loadHistoricalTaxSavingMetricCached(ticker, options?) // resolves to a result
clearHistoricalTaxSavingMetricCache()                  // test/maintenance reset
HISTORICAL_TAX_SAVING_CACHE_TTL_MS                     // 30 minutes
```

`options` (used by tests; defaults are used in production) allows overriding the
`loader`, `now()` clock, `ttlMs`, and the underlying `loaderOptions`.

Lookup order on each call:

1. Normalize the ticker to the cache key.
2. If a `pending` entry exists, return its shared promise (deduplication).
3. If a fresh `resolved` entry exists (`now() - storedAt < ttlMs`), return it
   immediately via `Promise.resolve`.
4. Otherwise invoke the loader, store a `pending` entry synchronously, and on
   settle store a `resolved` entry stamped with `now()`.

The cache is in-memory only. It uses no `localStorage`, `sessionStorage`,
Firestore, IndexedDB, persistent schema, or new dependency. A page reload clears
it.

## 4. TTL And Cache Key

- TTL: `30 minutes` (`HISTORICAL_TAX_SAVING_CACHE_TTL_MS = 30 * 60 * 1000`).
- Cache key: `ticker.trim().toUpperCase()` (normalized uppercase). This matches
  the normalization the service already applies, so `"schd"` and `"SCHD"` share
  one entry.

## 5. In-Flight Deduplication Behavior

When a request for a ticker is already pending, concurrent calls for the same
normalized ticker receive the same promise instead of starting a second load.
The pending entry is replaced with a resolved entry once the load settles, so
later calls become fresh cache hits until the TTL expires.

## 6. Source Badge Behavior

A small, muted line is rendered inside the existing metric card, below the
explanatory caption, only once a metric result is available (not during
loading):

```txt
출처: quote-api
```

Label mapping:

- `source === "quote-api"` → `quote-api`
- `source === "injected"` → `injected`
- otherwise → `source unknown`

In production the service always reports `quote-api`. The badge uses
`text-[10px] text-slate-500` so it does not crowd the main value. No new source
value was invented; existing warning-tooltip behavior is unchanged.

## 7. UI States Preserved

All Step 5B-6 states remain intact and readable:

| State | Value | Detail |
| --- | --- | --- |
| Loading | `계산 중...` | caption only (no source line) |
| Failed/unavailable (metric null) | `—` | `계산 불가` |
| `canCalculate === false` | `—` | `계산 불가` (first warning tooltip) |
| Success (`successCount > 0`) | `$<taxSavingUsd>` | `성공 N/T · 평균 회복여유 P.PP%` + `출처:` |
| Valid zero (`successCount === 0`) | `$0.0` | `성공 사례 없음 · 0/T` + `출처:` |

The valid-zero state remains distinct from the unavailable state. A loader
failure now resolves to a cached unavailable result rather than throwing, so the
dialog never crashes; the component's defensive `catch` is retained.

## 8. TaxSavingTable Unchanged Confirmation

`components/watchlist/TaxSavingTable.tsx`, `buildTaxSavingRows`, the current
quote-last current-price formula, and the displayed `종목별 예상 절세액` values
are unchanged. The historical metric remains event-dialog-only.

## 9. Verification Results

| Command | Result |
| --- | --- |
| `npm.cmd run check:tax-saving` | Passed (incl. 4 new cache cases) |
| `npm.cmd run build` | Passed |
| `npm.cmd run lint` | Passed (no ESLint warnings or errors) |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run check:calendar-provider` | Passed |
| `npm.cmd run check:portfolio-parser` | Passed |
| `npm.cmd run check:portfolio-parser:private` | Passed |

New cache regression cases:

1. Uppercase normalization shares one entry; fresh hit avoids a second loader
   call (loader called once for `schd` + `SCHD`).
2. In-flight deduplication: concurrent calls share one promise; loader called
   once.
3. Expired cache (`now()` advanced past TTL) triggers a new loader call.
4. Loader failure resolves to a safe unavailable result, is cached for the TTL,
   and does not crash.

Manual visual verification on a fresh dev server (`/watchlist`, dark scheme):

- Desktop: first open loads and renders `$13.3 · 성공 46/60 · 평균 회복여유
  0.61% · 출처: quote-api` for JEPI.
- Reopening the same JEPI event did not refetch (`/api/quote/dividends` and
  `/api/quote/history` request counts unchanged) and re-displayed the cached
  value.
- 390px and 320px: no page-level horizontal overflow, no metric-card overflow,
  no Korean one-character wrapping; source line stays compact and muted.
- No new console errors (only pre-existing Recharts `defaultProps` warnings).

## 10. Remaining Issues

- The cache is per-session and in-memory only; a page reload clears it (by
  design for this step).
- `source` is always `quote-api` in production today, so the `injected` /
  `source unknown` labels are exercised only by tests.
- Custom events still route to `CustomEventDialog` and economic/earnings events
  remain ineligible; this eligibility logic is unchanged from Step 5B-6.

## 11. Next Step Recommendation

1. If product wants cross-reload persistence, consider a small TTL-bounded
   persistent cache only after reviewing privacy/staleness trade-offs.
2. Consider surfacing the actual quote `source` (live vs sample) end-to-end if
   the quote layer begins distinguishing fallback data for these tickers.
3. Continue replacing remaining calendar mock paths module by module.
