# Step UI-2: Top Nav Responsive Overflow Fix

Date: 2026-06-13

## 1. Read files

- `C:\Users\sdf15\.codex\attachments\9ba178c8-3efd-4a2a-ae1f-063295b37896\pasted-text.txt`
- `components/TopNav.tsx`
- `components/auth/LoginButton.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `lib/mockData.ts`
- `docs/AUDIT.md`
- `docs/MOBILE_UI_OVERFLOW_AUDIT.md`

## 2. Changed files

- `components/TopNav.tsx`
- `docs/UI2_TOP_NAV_RESPONSIVE_FIX.md`
- `docs/AUDIT.md`

## 3. Root cause

The desktop nav rendered every item in a horizontal overflow scroller and only
had a `더보기` panel for the mobile layout. At medium desktop widths, this let
the nav row clip or scroll hidden links while the user had no desktop `더보기`
access path. It also meant the right-side Firebase/local badge and notification
button competed with the nav without a deterministic collapse point.

## 4. Responsive nav strategy

`TopNav` now measures the available desktop nav width with `ResizeObserver`.
It renders the largest prefix of `NAV_ITEMS` that fits between the logo and the
right controls, then reserves space for a shrink-proof `더보기` button when
items remain hidden. Mobile keeps the existing two primary shortcuts plus
`더보기`.

Observed visible direct items:

| Width | Direct nav items |
| --- | --- |
| 320 | 전체 종목, 배당 |
| 390 | 전체 종목, 배당 |
| 768 | 전체 종목, 배당, 투자 성과 |
| 900 | 전체 종목, 배당, 투자 성과, 배당캘린더 |
| 1024 | 전체 종목, 배당, 투자 성과, 배당캘린더, 시장 현황, 계산기 |
| 1280 | all nav items |
| 1440 | all nav items |

## 5. More menu behavior

If any nav item is hidden, `더보기` is visible. On click, only the hidden items
are shown in the dark menu panel. Active route state remains visible either on
the direct nav item or on `더보기` when the active route is inside the menu.

## 6. Widths tested

- 320px
- 390px
- 768px
- 900px
- 1024px
- 1280px
- 1440px desktop wide

## 7. Visual verification result

Routes spot-checked at every width:

- `/market`
- `/portfolio`
- `/watchlist`
- `/calculator`

For each route and width, this expression returned `false`:

```js
document.documentElement.scrollWidth > document.documentElement.clientWidth
```

No visible header controls were outside the viewport. No nav label wrapped one
Korean character per line. `더보기` appeared whenever hidden items existed and
was hidden when all items were directly visible.

## 8. Remaining issues

No remaining TopNav/Header issue found in this UI-2 scope. Some route body
mobile-layout items from `docs/MOBILE_UI_OVERFLOW_AUDIT.md` remain separate
future work and were not changed here.

## 9. Next step recommendation

Continue with the next scoped mobile UI batch from `docs/MOBILE_UI_OVERFLOW_AUDIT.md`,
starting with route body containers/tables rather than revisiting the header.
