# ASSET-SIMULATOR-FIRESTORE-SAVE-FIX-1

## 실제 에러

`/asset-simulator`에서 로그인 후 Save를 누르면 Firestore `setDoc()`이 다음 오류로 실패했다.

```txt
FirebaseError: Function setDoc() called with invalid data.
Unsupported field value: undefined
found in document users/{uid}/assetSimulatorConfigs/default
```

## Firestore Rules 문제가 아닌 이유

현재 Rules는 `users/{userId}` 하위 문서의 read/write를 인증 사용자 본인에게 허용한다. 확인된 오류도 `permission-denied`가 아니라 `Unsupported field value: undefined`이므로 저장 권한 문제가 아니라 payload serialization 문제다.

## 원인

Save 흐름은 입력값과 연도별 계획표를 normalize한 뒤 localStorage에 먼저 저장하고, 로그인 상태면 같은 저장 config를 `users/{uid}/assetSimulatorConfigs/default`에 저장한다. localStorage/JSON은 object의 `undefined` field를 조용히 누락할 수 있지만 Firestore SDK는 문서 payload 내부의 `undefined`를 허용하지 않는다. 특히 `yearPlans`의 optional `status`처럼 계산/화면 상태에서 없을 수 있는 field가 Firestore payload에 남을 가능성이 높았다.

## sanitizer 정책

Firestore 저장 직전에 `inputs`와 `yearPlans`를 다시 normalize한 뒤 deep sanitize한다.

- object 내부 `undefined` field는 제거한다.
- array 내부 `undefined` item은 `null`로 변환한다.
- `NaN`, `Infinity`, `-Infinity`는 `null`로 변환한다.
- function/symbol field는 제거한다.
- sanitize 후 `findFirestoreUnsafePaths()`로 `undefined`, invalid number, function, symbol이 남았는지 검증한다.
- `updatedAt: serverTimestamp()`는 sanitize 이후 root payload에 추가한다.

## yearPlans normalization 정책

`normalizeYearPlans()`로 저장 대상 기간만큼 명시적인 row를 만든다.

- `year`: 입력 시작 연도 + index
- `monthlyContribution`: 유효한 finite number만 사용하고 아니면 fallback
- `isaContribution`, `pensionContribution`, `isaToPensionTransfer`: boolean으로 고정
- `status`: optional field이므로 값이 없으면 sanitizer가 Firestore payload에서 제거

## inputs normalization 정책

`normalizeInputs()`로 모든 numeric input을 finite number와 허용 범위로 보정한다. legacy field(`initialTaxable`, `initDividend`)도 `initialTaxableDividend`로 흡수한다.

## Save 성공 조건

로그인 상태의 Save 성공은 다음 조건을 모두 만족해야 한다.

1. localStorage 저장 성공
2. Firestore payload normalize/sanitize/validation 성공
3. `setDoc(doc(users/{uid}/assetSimulatorConfigs/default), { ...sanitizedPayload, updatedAt: serverTimestamp() }, { merge: true })` 성공
4. UI 메시지: `저장 완료 · 클라우드에 동기화됨`

Cloud 저장이 실패하면 localStorage fallback은 유지하지만 cloud 성공 메시지는 표시하지 않는다.

## 테스트 명령어

```bash
npm run check:asset-simulator-persistence
npm run lint
npm run typecheck
npm run build
```

가능한 회귀 확인:

```bash
npm run check:portfolio-realdata
npm run check:market-data-real
npm run check:calendar-provider
```

## 남은 한계

이 수정은 Firestore payload serialization 방어를 추가한다. 실제 Firebase Console에서 `users/{uid}/assetSimulatorConfigs/default`의 갱신 여부와 새로고침/재접속 복원은 로그인 가능한 브라우저 환경에서 최종 확인해야 한다.
