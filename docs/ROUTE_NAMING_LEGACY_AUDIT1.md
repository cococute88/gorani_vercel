# ROUTE-NAMING-LEGACY-AUDIT-1

## 발견된 legacy route/name 목록

- 사용자 노출 배당캘린더 route가 `app/watchlist/page.tsx`만 존재해 `/watchlist`로 렌더링되고 있었습니다.
- 상단 navbar 데이터(`lib/mockData.ts`)의 `배당캘린더` 항목 href가 `/watchlist`였습니다.
- `TopNav` active tab 판정은 href/pathname 직접 비교 방식이라 `/calendar` canonical route를 추가하면 legacy `/watchlist`와 같은 탭으로 인식할 별도 처리가 필요했습니다.
- `components/watchlist/*`와 다수 calendar regression script는 내부 구현/테스트 경로로 `watchlist` 이름을 사용합니다.
- `docs/AUDIT.md`에는 과거 작업 이력상 `/watchlist` 문구가 남아 있습니다.
- `components/WatchlistRow.tsx`, `lib/mockData.ts`의 `WATCHLIST`, market watchlist 상수는 관심종목/감시 티커 의미로, 배당캘린더 route legacy와는 별개입니다.

## `/watchlist`가 남아 있던 원인

초기 배당캘린더 화면이 watchlist 명칭의 페이지/컴포넌트 구조 위에 구현되었고, 이후 화면 라벨은 `배당캘린더`로 바뀌었지만 App Router 경로와 navbar href는 `/watchlist`에 남아 있었습니다.

## canonical route 정책

- 배당캘린더 canonical route는 `/calendar`입니다.
- 사용자가 navbar에서 배당캘린더를 누르면 `/calendar`로 이동합니다.
- `/calendar` page metadata title은 `배당캘린더`입니다.
- `/calendar` canonical metadata를 명시합니다.

## redirect/alias 정책

- `/watchlist`는 북마크/기존 내부 링크 보호용 legacy route로 유지합니다.
- `app/watchlist/page.tsx`는 UI를 직접 렌더하지 않고 `redirect("/calendar")`를 호출합니다.
- active nav 판정은 `/calendar`와 legacy `/watchlist`를 모두 배당캘린더 탭으로 인식하도록 pathname normalization을 둡니다.

## 수정한 nav/metadata/test 목록

- `lib/mockData.ts`: 배당캘린더 nav href를 `/calendar`로 변경.
- `components/TopNav.tsx`: `/watchlist` pathname을 `/calendar`로 normalize해 active state를 유지.
- `app/calendar/page.tsx`: canonical 배당캘린더 page와 metadata 추가.
- `app/watchlist/page.tsx`: legacy route redirect 처리.
- `scripts/check-route-naming-legacy-audit.mjs`: route/name regression check 추가.
- `package.json`: `check:route-naming-legacy-audit` script 추가.

## 내부 legacy folder 유지 이유

`components/watchlist/DividendCalendarPage.tsx` 등 내부 컴포넌트 폴더는 넓은 calendar 기능과 기존 regression scripts가 참조하고 있습니다. 이번 작업의 우선순위는 사용자 노출 route/nav/metadata 정리이며, 내부 폴더 rename은 import 변경 범위가 커 conflict 위험이 있으므로 유지했습니다. 새 사용자 노출 route와 새 테스트명은 `calendar`/`route-naming` 기준으로 작성했습니다.

## 테스트 명령어

- `npm run check:route-naming-legacy-audit`
- `npm run check:calendar-provider`
- `npm run check:calendar-priority-tax-style`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run check:portfolio-realdata`
- `npm run check:market-data-real`
- `npm run check:dividend-estimates`
- `npm run check:dividends-data`

## 남은 한계

- 로컬 dev server/브라우저 수동 확인은 현재 작업 환경에서 지속 실행 중인 서버가 없어 정적 regression과 production build 중심으로 검증했습니다.
- 과거 감사 문서와 내부 컴포넌트 경로에는 history/context 목적의 `watchlist` 문자열이 남아 있습니다.
- `components/WatchlistRow.tsx`와 market watchlist 상수는 실제 관심종목/감시목록 의미라 route legacy cleanup 대상에서 제외했습니다.
