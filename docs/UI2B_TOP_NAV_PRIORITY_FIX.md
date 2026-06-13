# Step UI-2B: Properly Fix Responsive TopNav Priority/Collapse Behavior

Date: 2026-06-13

## 1. Read files

- `components/TopNav.tsx`
- `components/auth/LoginButton.tsx`
- `lib/mockData.ts` (`NAV_ITEMS`)
- `app/layout.tsx`
- `docs/UI2_TOP_NAV_RESPONSIVE_FIX.md`
- `docs/AUDIT.md`
- `.claude/launch.json`

## 2. Changed files

- `components/TopNav.tsx` (rewrite to a single unified measured priority nav)
- `docs/UI2B_TOP_NAV_PRIORITY_FIX.md` (this file)
- `docs/AUDIT.md` (one line appended)
- `.claude/launch.json` (added `"autoPort": true` so preview verification can start while another dev server already occupies port 3000 — no app behavior change)

## 3. Root cause

The previous TopNav (Step UI-2) had **two independent nav systems split at the `md` breakpoint (768px)**:

- **Mobile (`< md`)**: a hardcoded layout that always showed exactly `MOBILE_PRIMARY_COUNT = 2` items plus `더보기`, regardless of available width. This caused **Problem A** — at 350–750px the nav collapsed to only `전체 종목 / 배당 / 더보기` even when there was room for 5–6 items.
- **Desktop (`>= md`)**: a measured priority nav. But its `더보기` button followed immediately after the last visible item inside a `flex-1` nav area with no right alignment, so it sat in the middle with a large empty gap before the right controls. This caused **Problem B** — at ~780px `더보기` floated mid-row instead of hugging the right edge.

Because the measurement logic lived inside a `hidden md:flex` element, it was `display:none` (and therefore `offsetWidth === 0`, measurement skipped) at all mobile widths — so the priority logic never ran below 768px. The hard breakpoint split is what produced the discontinuity and the under-filled mobile nav.

## 4. Responsive strategy used

**Preferred Option — single measured priority nav for all widths.**

One `<nav>` element is always rendered (never `display:none`), so the `ResizeObserver` + width measurement runs at every width:

1. A hidden, absolutely-positioned measurement row renders all `NAV_ITEMS` plus the `더보기` button with identical classes, so per-item and more-button widths are measured accurately.
2. On every resize, the largest prefix of items whose total width (+ gaps, + reserved `더보기` width when items remain) fits `nav.clientWidth` is computed and stored as `visibleCount`.
3. Visible items render inline; the rest go into the `더보기` dropdown.

**Layout (flex-wrap container):**

- `< lg` → **two rows**: Row 1 = logo (`order-1`) + right controls (`order-2 ml-auto`); the nav (`order-3 w-full`) wraps to Row 2 at full viewport width.
- `lg+` → **single row**: logo (`order-1`) | nav (`lg:order-2 lg:flex-1`) | right controls (`lg:order-3`).

Because the nav width is driven by the container (`w-full` on small, `flex-1` on `lg`) and not by its own content, changing `visibleCount` never changes `nav.clientWidth` — no measurement feedback loop.

**Layout safety classes:** header `w-full overflow-x-hidden`; inner container `min-w-0 max-w-[1640px] flex-wrap`; logo/right-controls `shrink-0`; nav `min-w-0 overflow-hidden`; nav item links `shrink-0 whitespace-nowrap`; `더보기` `shrink-0`.

Measured visible item counts (route `/portfolio`):

| Width | Layout | Visible inline | 더보기 |
| --- | --- | --- | --- |
| 320 | two-row | 전체 종목, 배당 | visible |
| 350 | two-row | 전체 종목, 배당 (3rd if it fits) | visible |
| 390 | two-row | 전체 종목, 배당, 투자 성과 | visible |
| 480 | two-row | + 배당캘린더 (4) | visible |
| 640 | two-row | + 시장 현황 (5) | visible |
| 700 | two-row | + 계산기 (6) | visible |
| 750 | two-row | 6 items | visible |
| 780 | two-row | 6 items | visible, right-pinned |
| 900 | two-row | all 8 items | hidden |
| 1024 | single-row | 6 items | visible, right-pinned |
| 1280 | single-row | all 8 items | hidden |
| 1440 | single-row | all 8 items | hidden |

## 5. More menu behavior

- `더보기` is rendered only when `hiddenItems.length > 0`; hidden when all items fit (verified at 900/1280/1440).
- When visible, it is pinned to the far right of the nav area via `ml-auto` (measured `navRight - buttonRight === 0` at every tested width), eliminating Problem B's mid-row gap.
- Clicking toggles a single dark dropdown panel containing exactly the hidden items (verified at 780px: panel showed `자산 시뮬레이터`, `포트폴리오 관리`). Clicking a panel item navigates and closes the menu; the menu also closes on route change.
- Active-route highlight: when the active route is an inline item it gets the blue pill; when the active route is hidden, the `더보기` button itself carries the active styling (verified on `/watchlist` at 390px, where `배당캘린더` is hidden and `더보기` showed active).
- Dark theme panel styling (`bg-[#101719]`, `border-[#22303a]`) preserved; no native dropdown styling.

## 6. Right control behavior

- Right controls (`LoginButton` + bell) are a single `shrink-0` group with `ml-auto` below `lg` (pinned to Row 1 right) and `lg:ml-2` inline at `lg+`.
- They remain visible at all widths and never overlap or clip the nav.
- The Firebase badge already shortens itself: full `Firebase 미설정 · 로컬 저장` at `sm+`, collapsed to `로컬` below `sm` (verified visible at 320px). No badge/status behavior changed.

## 7. Widths tested

320, 350, 390, 480, 640, 700, 750, 780, 900, 1024, 1280, 1440 (desktop wide).

## 8. Visual verification result

For every width above, on `/portfolio`:

```js
document.documentElement.scrollWidth > document.documentElement.clientWidth
// → false at all tested widths
```

Additional checks per width: no nav clipping, `더보기` visible iff items hidden, `더보기` right-pinned gap `=== 0` when visible, right controls visible, dark theme intact, active-route highlight correct.

Routes spot-checked (no page-level horizontal overflow at 390px, except where noted all `false`): `/portfolio`, `/market`, `/watchlist`, `/calculator`.

Screenshots captured during verification:
- 320px — two-row mobile: Row 1 logo + `로컬` + bell, Row 2 `전체 종목`(active) / `배당` / `더보기`(far right).
- 780px (menu open) — two-row, 6 items, `더보기` far right, dropdown showing the 2 hidden items.
- 1280px — single row, all 8 items, full Firebase badge, no `더보기`.

## 9. Remaining issues

None found in the TopNav/Header scope. The single-row threshold is `lg` (1024px); at 1024 the nav shows 6 items + `더보기` (clean, right-pinned), which is acceptable per the spec. Route-body mobile layout items tracked in `docs/MOBILE_UI_OVERFLOW_AUDIT.md` remain separate future work and were intentionally not touched.

## 10. Next step recommendation

Proceed with the next scoped item from `docs/MOBILE_UI_OVERFLOW_AUDIT.md` (route body containers/tables). No further header/nav work is needed.
