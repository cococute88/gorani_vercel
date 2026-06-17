# CALENDAR-PORTFOLIO-PROFILE-NAMESPACE-1

## 사용자 표시명

상단 로그인 컨트롤은 `users/{uid}/profile/display` 문서의 `displayName`을 먼저 읽고 표시한다. 저장 payload는 `{ displayName, updatedAt }`이며 Firestore 저장 전 `sanitizeFirestorePayload`로 `undefined` 필드를 제거한다.

표시 fallback 순서는 Firestore custom `displayName` → Firebase `displayName` → email 앞부분이다. 사용자가 custom 이름을 저장하면 이후 헤더는 Google 실명보다 custom 이름을 우선한다.

## 캘린더 포트폴리오 Firestore schema

- `users/{uid}/calendarSettings/default`: `{ activePortfolioId, updatedAt }`
- `users/{uid}/calendarPortfolios/{portfolioId}`: `{ id, name, createdAt, updatedAt }`
- `users/{uid}/calendarPortfolios/{portfolioId}/settings/tickers`: `{ tickers, source, version, updatedAt }`
- `users/{uid}/calendarPortfolios/{portfolioId}/calendarCache/{ticker}`: generated dividend provider cache
- `users/{uid}/calendarPortfolios/{portfolioId}/calendarCustomEvents/{eventId}`: custom events
- `users/{uid}/calendarPortfolios/{portfolioId}/calendarEventMetas/{eventId}`: star/heart/memo event meta

## default backward compatibility

`default` 포트폴리오에서만 기존 legacy/global localStorage 및 Firestore calendar data fallback을 허용한다. `portfolioId !== "default"`인 새 포트폴리오는 legacy portfolios/imported events/memo keys/mock fallback을 ticker universe로 쓰지 않으므로 빈 상태에서 시작한다.

## active ticker universe 정책

캘린더 표시, 절세액 테이블, live refresh 대상은 active portfolio의 `tickers` 배열을 기준으로 한다. cache 또는 legacy imported events에 FEPI 같은 과거 ticker가 남아 있어도 active tickers에 없으면 calendar events, tax table, refresh target에서 제외한다.

## localStorage namespace

- `calendar:tickerList:${portfolioId}`
- `calendar:cache:${portfolioId}`
- `calendar:customEvents:${portfolioId}`
- `calendar:eventMetas:${portfolioId}`
- `calendar:activePortfolio`

기존 `gorani.dividend-calendar.*` keys는 default 포트폴리오에서만 fallback으로 읽는다.

## UI 변경

티커 카드 라벨은 `현재 포트폴리오: {name}`으로 변경했다. 기존 ticker add/remove 모달 버튼은 `종목 관리`로 바꾸고, 왼쪽에 새 `포트폴리오 관리` 버튼과 `캘린더 포트폴리오 관리` 모달을 추가했다.

## 테스트 명령

- `npm run check:calendar-portfolio-namespace`
- `npm run check:calendar-provider`
- `npm run check:calendar-priority-tax-style`
- `npm run check:calendar-dividend-live-update`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

브라우저에서 실제 Google 로그인과 Firestore rules를 통과하는 저장/새로고침 흐름은 배포 Firebase 환경에서 수동 확인해야 한다. 로컬 Firebase 미설정 환경에서는 UI와 namespace 로직만 검증 가능하다.
