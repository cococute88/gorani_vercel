# ASSET-SIMULATOR-PERSISTENCE-FIX-1

## 문제 원인

`/asset-simulator`의 기존 `Save` 버튼은 localStorage 저장 직후 Firestore 저장을 `void saveAssetSimulatorConfig(...).catch(...)`로 백그라운드 실행했습니다. 따라서 Firestore write가 실패해도 버튼 UI는 즉시 `저장됨`으로 표시했고, 사용자는 cloud persistence 실패를 알 수 없었습니다. 또한 기존 hydration은 로그인 상태에서 cloud 값을 무조건 먼저 적용하고 local 값의 `updatedAt`과 비교하지 않아, 더 최신 local/current 값이 오래된 cloud 값에 의해 덮일 수 있었습니다.

## 기존 Save 흐름

1. 입력값 state를 그대로 localStorage에 저장
2. 로그인 상태이면 Firestore 저장을 비동기로 시작하되 await 하지 않음
3. 실패는 console warning만 남기고 UI에는 성공처럼 표시
4. 저장 payload에 local `updatedAt`이 없어 local/cloud 최신성 비교가 불가능

## 수정된 Save/cloud write 흐름

1. `Save` 클릭 시 현재 inputs/yearPlans를 `normalizeInputs`/`normalizeYearPlans`로 정규화
2. localStorage에 `{ inputs, yearPlans, updatedAt: ISO string }` 저장
3. 로그인 상태이면 `users/{uid}/assetSimulatorConfigs/default`에 동일 payload를 저장하고 Firestore repository가 기존 convention대로 `updatedAt: serverTimestamp()`를 기록
4. cloud write를 `await`하여 실제 완료 후 성공 상태 표시
5. 실패하면 `저장 실패` 문구를 표시하고 raw stack trace는 노출하지 않음

## hydration 우선순위

1. 로그인 상태이면 Firestore `users/{uid}/assetSimulatorConfigs/default`와 localStorage를 모두 읽음
2. cloud/local 모두 있으면 `updatedAt`이 더 최신인 config를 적용
3. cloud만 있으면 cloud 적용 후 local cache를 cloud 값으로 갱신
4. local만 있으면 local 적용
5. 둘 다 없으면 default 입력값/계획표 유지

## local/cloud conflict 정책

- local `updatedAt`은 ISO string으로 저장합니다.
- Firestore `updatedAt`은 기존 프로젝트 convention인 `serverTimestamp()`를 유지합니다.
- Firestore Timestamp, ISO string, Date, epoch number를 모두 millisecond로 변환해 비교합니다.
- 저장 직후 `lastLocalWriteAtRef`보다 오래된 hydration 결과는 적용하지 않아 stale cloud/default overwrite를 막습니다.

## Firebase path/schema

- Firestore path: `users/{uid}/assetSimulatorConfigs/default`
- Schema 유지:

```txt
inputs: { ...numeric simulator inputs }
yearPlans: YearPlanRow[]
updatedAt: Firestore serverTimestamp()
```

localStorage는 같은 `inputs`/`yearPlans`에 ISO `updatedAt`을 추가해 최신성 비교 cache로 사용합니다.

## 테스트 명령어

- `npm run check:asset-simulator-persistence`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run check:portfolio-realdata`
- `npm run check:market-data-real`
- `npm run check:calendar-provider`

## 남은 한계

로컬 CI/터미널 환경에는 실제 브라우저 로그인 세션과 Firebase 콘솔 접근 권한이 없으므로, Firebase 콘솔의 실제 `updatedAt` 시각 갱신은 배포/preview 환경에서 로그인 후 수동 확인해야 합니다.
