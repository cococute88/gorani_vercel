# AUTH-MOBILE-LOGIN-AND-DIVCAP-AXIS-FIX-1

## 모바일 로그인 실패 원인

Firebase Auth redirect 복귀 시점에 `onAuthStateChanged()`가 먼저 `null` 상태를 통지할 수 있는데, UI loading이 바로 종료되면 모바일 Chrome에서 Google 계정 선택 후 돌아온 직후 로그인 상태 반영이 늦거나 누락된 것처럼 보일 수 있었다. 또한 팝업 로그인 성공 직후 user profile 보장 처리가 redirect 경로에만 있어, 로그인 직후 클라우드 동기화 계층이 사용자 문서를 기대하는 흐름과 타이밍 차이가 있었다.

## Auth 복구 내용

- `browserLocalPersistence` 설정을 유지해 새로고침 후에도 Firebase Auth 세션이 local persistence에 남도록 했다.
- 앱 mount 시 `getRedirectResult()` 처리를 계속 수행한다.
- 초기 loading 종료 조건을 `getRedirectResult()` 완료와 `onAuthStateChanged()` 최초 통지 완료 둘 다로 묶어 redirect 복귀 hydration race를 줄였다.
- popup 성공 경로에서도 `ensureUserProfile()`을 호출해 redirect/popup 모두 동일하게 사용자 프로필을 준비한다.
- 최종 로그인 상태 source of truth는 계속 `onAuthStateChanged()` listener다.

## redirect/popup fallback 정책

- 모바일 브라우저는 `signInWithRedirect()`를 우선 사용한다.
- 데스크톱은 `signInWithPopup()`을 유지한다.
- popup blocked/unsupported/cancelled 계열 오류는 redirect fallback을 사용한다.
- 실패 메시지는 사용자에게는 친화적인 문구로 표시하고 raw error는 console warning으로만 남긴다.

## 배당치기 그래프 x축 순서 오류 원인

차트 행은 `exDate` 오름차순으로 정렬되어 있었지만, Recharts `ScatterChart`의 x축이 문자열 category 축(`dataKey="exDate"`)이었다. 성공/실패를 별도 scatter series로 나누면 각 series의 category 집합이 따로 해석되어, 전체 시간축 오른쪽에 과거 category가 다시 붙는 것처럼 보일 수 있었다.

## chart data sort/timestamp axis 정책

- 계산 결과 row 자체와 parity 산식은 변경하지 않는다.
- chart 전용 rows는 `exDate` 오름차순으로 정렬한 뒤 `exDateMs` UTC timestamp를 추가한다.
- XAxis는 `type="number"`, `scale="time"`, `dataKey="exDateMs"`, `domain={["dataMin", "dataMax"]}`를 사용한다.
- tick은 timestamp를 `YY.MM` label로만 포맷한다.
- tooltip은 실제 `exDate` 문자열을 표시한다.
- 성공은 파란색, 실패는 하늘색을 유지한다.

## 테스트 명령어

- `npm run check:auth-mobile-login-persistence`
- `npm run check:auth-firestore-persistence`
- `npm run check:dividend-capture-chart-axis-order`
- `npm run check:dividend-capture-live-yahoo-parity`
- `npm run check:dividend-capture-streamlit-row-parity`
- `npm run check:dividend-capture-streamlit-parity`
- `npm run check:dividend-capture-streamlit-restore`
- `npm run check:calculators-table-sort-scroll`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 브라우저 검증 결과

이 작업 환경에서는 실제 Android Chrome 또는 Vercel Preview 브라우저 로그인이 불가능했다. 따라서 모바일 Google 계정 선택 후 Logout UI 전환은 완료로 보고하지 않는다. 대신 정적 regression script로 redirect result, local persistence, mobile redirect fallback, auth hydration guard, Logout rendering path를 검증했다.

## 남은 한계

Firebase authorized domain, third-party storage 차단, 실제 Google OAuth redirect 설정 문제는 코드 정적 검증만으로 확정할 수 없다. Preview 배포 후 Android Chrome에서 직접 Google 계정 선택, 앱 복귀, Logout 표시, 새로고침 세션 유지, 클라우드 동기화 인식을 확인해야 한다.
