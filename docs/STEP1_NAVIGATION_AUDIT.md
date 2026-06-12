# Step 1 Navigation Audit

Audit date: 2026-06-12

## Scope

- Target project: repository root `C:\gv\gorani_vercel`
- Read-only original reference: `original/`
- No `target/` folder exists or was created.
- This step only aligned navigation, auth status visibility, and storage-mode indicators. It did not add routes, storage models, Firestore collections, market APIs, or calculator/dividend logic.

## Files Checked Before Work

All requested files were present:

- `original/app.py`
- `original/docs/NAVIGATION_MAP.md`
- `docs/AUDIT.md`
- `docs/STEP0_PATH_UPDATE.md`
- `package.json`
- `app/layout.tsx`
- `app/page.tsx`
- `lib/mockData.ts`
- `components/TopNav.tsx`
- `components/common/StorageModeBadge.tsx`
- `components/auth/AuthStatus.tsx`
- `components/auth/LoginButton.tsx`

Note: `original/docs/NAVIGATION_MAP.md` exists, but PowerShell displayed parts of it with mojibake. `original/app.py` was still usable for the authoritative `st.Page(...)` menu flow.

## Original Menu Summary

`original/app.py` uses Streamlit navigation with these core pages:

- 자산시뮬
- 자산트래커
- 양도세치기
- 매도전환계산
- 배당캘린더
- 시장온도
- MDD계산
- SCHD매력도
- 배당금가계부

Original sidebar intent:

- show logged-in user email
- provide logout
- show automatic save status
- manage favorite links

The Next.js app keeps its existing dark theme, card layout, and `TopNav`; the Streamlit sidebar UI was not copied.

## Current NAV_ITEMS

`lib/mockData.ts` currently exports:

| Label | Href | Route status |
| --- | --- | --- |
| 전체 종목 | `/portfolio` | Exists |
| 배당 | `/dividends` | Exists |
| 투자 성과 | `/performance` | Exists |
| 배당캘린더 | `/watchlist` | Exists |
| 시장 현황 | `/market` | Exists |
| 계산기 | `/calculator` | Exists |
| 자산 시뮬레이터 | `/asset-simulator` | Exists |
| 포트폴리오 관리 | `/portfolio-manager` | Exists |

No menu items were deleted. QLD components, asset-map components, calculator presets, and Excel parser features were left in place.

## Menu And Route Alignment

All current `NAV_ITEMS` point to existing, non-redirect page routes.

Step 1 code change:

- `TopNav` active-route matching now uses exact route or child-route boundaries.
- This prevents `/portfolio-manager` from also activating the `/portfolio` menu item.
- `NAV_ITEMS` hrefs were not changed because none pointed to absent routes or redirect-only routes.

Routes that exist but are intentionally not primary `NAV_ITEMS`:

- `/asset-map`
- `/qld-dashboard`
- `/`

Absent routes confirmed from Step 0 and not created:

- `/login`
- `/settings`
- `/legacy`

## Redirect-Only Routes

| Route | Destination | Step 1 handling |
| --- | --- | --- |
| `/` | `/portfolio` | Kept as-is |
| `/asset-map` | `/market` | Kept as-is |
| `/qld-dashboard` | `/portfolio` | Kept as-is |

No redirect-only route is currently used by `NAV_ITEMS`, so no NAV href adjustment was needed.

## Auth Display Position

Auth state is displayed through the global `TopNav`, which appears on the main pages checked in this step.

Step 1 code changes:

- `LoginButton` is now visible on mobile as well as desktop.
- Firebase-unconfigured mode now shows a compact local-save badge instead of disappearing on mobile.
- Logged-out mode exposes a visible Google login control.
- Logged-in mode shows the account name on wider screens and a compact account/logout control on smaller screens.
- The inactive lock icon in `TopNav` was removed to avoid implying a separate auth action.
- `AuthStatus` text was aligned with the same local/cloud storage wording.

Firebase-unconfigured and logged-out states still degrade safely; auth logic itself was not reworked.

## StorageModeBadge Placement

Storage-related pages checked:

| Route | Storage found | Badge result |
| --- | --- | --- |
| `/portfolio-manager` | Portfolio snapshots via localStorage and optional Firestore | Already in page header; kept |
| `/asset-simulator` | Simulator config via localStorage and optional Firestore | Already in page header; kept |
| `/watchlist` | Calendar tickers and event meta via localStorage and optional Firestore | Moved into the page title row for consistency |
| `/dividends` | Reads portfolio snapshots; no page-level save action found | No badge added |
| `/calculator` | Presets via localStorage and optional Firestore | Already in page header; kept |

`StorageModeBadge` labels were clarified:

- Firebase not configured: `Firebase 미설정 · 로컬 저장`
- Logged out: `비로그인 · 로컬 저장`
- Logged in: `클라우드 동기화`

No new save logic, Firestore collections, or repository changes were added.

## Files Modified In Step 1

- `components/TopNav.tsx`
- `components/auth/LoginButton.tsx`
- `components/auth/AuthStatus.tsx`
- `components/common/StorageModeBadge.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/WatchlistPage.tsx`
- `docs/STEP1_NAVIGATION_AUDIT.md`
- `docs/AUDIT.md`

## Remaining Navigation And Storage Issues

1. Original-to-Next menu mapping is still approximate.
   - 양도세치기, 매도전환계산, and MDD계산 are grouped under `/calculator`.
   - 시장온도 and asset-map content are grouped under `/market`.
   - QLD dashboard content is partly embedded in `/portfolio` and `/performance`, while `/qld-dashboard` redirects to `/portfolio`.

2. `/dividends` has editable goal inputs but no persistence.
   - No badge was added because there is no save action yet.
   - If goal settings become persistent later, add `StorageModeBadge` there with the same header placement.

3. `/login`, `/settings`, and `/legacy` remain absent.
   - They should only be created in a later step if a concrete flow requires them.

4. The original favorite-links sidebar has no Next.js equivalent yet.
   - This is intentionally deferred because it would require product and storage decisions.

5. `asset-map` and `qld-dashboard` redirect-only routes should remain documented.
   - If a future step changes their destination, update both NAV and this audit trail together.

