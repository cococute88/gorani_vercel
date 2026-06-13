# Mobile UI M2 — Responsive Table Card Fix

Completion date: 2026-06-13

This step finalizes the remaining wide mobile table work after M1. It converts
the highest-impact mobile table surfaces to stacked card/list layouts while
preserving the existing desktop tables at `lg+`. It does not redesign pages,
change data providers, alter parser logic, modify formulas, touch Firestore, or
add dependencies.

---

## 1. Read docs / files

- `docs/MOBILE_UI_OVERFLOW_AUDIT.md` — original mobile overflow audit and table
  strategy.
- `docs/MOBILE_UI_M1_OVERFLOW_FIX.md` — prior app-wide P0/P1 mobile overflow
  fix and verification baseline.
- `components/portfolio/HoldingsTable.tsx`
- `components/dividend/DividendHoldingsTable.tsx`
- `components/qld/QldHoldingsRankTable.tsx`
- `docs/AUDIT.md`

Repository structure was re-confirmed:

- Working root: `C:\gv\gorani_vercel`
- `original/` exists and remains reference-only.
- `target/` does not exist and was not created.

---

## 2. Changed files

1. `components/portfolio/HoldingsTable.tsx`
2. `components/dividend/DividendHoldingsTable.tsx`
3. `components/qld/QldHoldingsRankTable.tsx`
4. `docs/MOBILE_UI_M2_TABLE_RESPONSIVE_FIX.md`
5. `docs/AUDIT.md`

No changes were made under `original/`.

---

## 3. Portfolio-manager holdings table

`components/portfolio/HoldingsTable.tsx` now renders a mobile-only card list
below `lg`:

- each holding becomes a rounded card;
- selection checkbox remains available;
- product name, broker, asset type, review status, grouping tags, ticker input,
  principal, value, and return percentage remain visible;
- long labels and numeric values are constrained with `min-w-0`, `truncate`,
  and compact mobile text sizing where needed.

The previous wide table remains available at `lg+` using the original
`min-w-[860px]` table inside a scoped `overflow-x-auto` wrapper.

---

## 4. Dividends holdings table

`components/dividend/DividendHoldingsTable.tsx` now renders a mobile-only card
list below `lg`:

- ticker, name, optional tag, edit/delete actions, evaluated value, expected
  annual dividend, expected yield, and personal yield are shown in each card;
- empty state remains available;
- numeric dividend fields are laid out in a compact two-column card grid.

The desktop table is preserved at `lg+` with the existing `min-w-[760px]` table
inside scoped horizontal scroll.

---

## 5. Market / QLD rank table

`components/qld/QldHoldingsRankTable.tsx` now renders mobile ranking cards below
`lg`:

- rank, ticker color marker, ticker/name, weight, evaluated value, average buy
  price, day profit, and cumulative profit are shown without requiring page
  horizontal scroll;
- positive/negative tone styling continues to use the existing helpers.

The existing desktop ranking table remains at `lg+` with its original
`min-w-[820px]` table in an internal scroll container.

---

## 6. Calculator table decision

Calculator result tables were intentionally left as internal horizontal scroll.
This is a documented exception for dense calculation outputs and avoids
changing formulas, result schemas, or calculator interaction behavior during
M2.

---

## 7. Desktop preservation

Desktop table behavior is preserved by rendering the original table markup only
at `lg+`:

- portfolio holdings table: `hidden overflow-x-auto lg:block`
- dividend holdings table: `hidden overflow-x-auto lg:block`
- QLD rank table: `hidden overflow-x-auto lg:block`

M2 therefore changes phone/tablet-base presentation without removing the
desktop table affordance.

---

## 8. Mobile card/list behavior

The mobile behavior follows the same pattern across the three changed tables:

- render cards below `lg`;
- keep row-level actions and important fields reachable;
- avoid whole-page horizontal overflow;
- constrain long numeric/text cells inside the card;
- keep scoped table scroll only for the desktop table presentation and the
  intentionally unchanged calculator result tables.

---

## 9. Visual verification completed

Claude's interrupted session had already completed partial visual checks:

| Route | Widths checked | Notes |
|---|---:|---|
| `/performance` | 320px | QLD rank table mobile card path checked. |
| `/dividends` | 320px | dividend holdings mobile card path checked. |
| `/portfolio-manager` | 320px, 390px | holdings mobile card path checked. |

Full route-by-route visual verification was not repeated to avoid excessive
token/time usage. Modified and highest-risk routes were checked.

Routes not fully visually checked because the Claude session hit token limit:

- full `/calculator` visual pass after the M2 decision;
- full `/market` route-by-route pass beyond the QLD rank table usage context;
- all non-modified routes at every width from the M0 checklist.

---

## 10. Verification command results

Verification was re-run by Codex on 2026-06-13 after stopping the active
`next dev` process first:

| Command | Result |
|---|---|
| `npm.cmd run build` | Passed |
| `npm.cmd run lint` | Passed, no ESLint warnings or errors |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run check:calendar-provider` | Passed |
| `npm.cmd run check:portfolio-parser` | Passed |
| `npm.cmd run check:portfolio-parser:private` | Passed |

---

## 11. Remaining issues

- Calculator result tables intentionally remain internal horizontal scroll.
- Full route-by-route visual verification was not repeated in this finalization
  pass.
- Any remaining P2/P3 mobile polish from M0/M1, such as chart annotation
  crowding or native select styling, remains outside M2 scope.

No build, lint, typecheck, calendar provider, or portfolio parser failures are
known after this step.

---

## 12. Next recommended batch

Recommended next batch: a small P2/P3 mobile polish pass focused on remaining
non-table items from the audit, especially chart annotation crowding,
third-party/embed width verification, and native form control styling. Keep it
separate from M2 so table-card behavior stays easy to review.
