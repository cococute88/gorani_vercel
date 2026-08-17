# CALENDAR-EVENT-RETENTION-FIX-1

## 문제와 재현 경로

배당 캘린더의 티커 캐시는 24시간 TTL을 사용한다. Firestore에 정상 저장된 캐시라도 TTL이 지나면 `isCurrentPersistedAlertCacheEntry`에서 갱신 대상으로 분류된다.

기존 흐름은 다음 두 경로에서 저장된 추정 일정을 제거할 수 있었다.

1. 페이지 진입 자동 로드
   - 만료된 Firestore/local 캐시를 읽는다.
   - `/api/quote/dividends` 조회가 성공하면 새 historical/projection 배열만으로 캐시를 다시 만든다.
   - 이전 캐시에만 있던 추정 일정은 새 배열에 없으면 탈락한다.
   - 더 최신 `fetchedAt`으로 localStorage와 Firestore에 전파된다.
2. 사용자의 `일정 최신화`
   - 기존 캐시 중 confirmed 이벤트만 남긴 뒤 새 응답을 합쳤다.
   - 저장돼 있던 estimated 이벤트는 새 응답에 같은 일정이 없으면 제거됐다.

APAM의 `2026-08-14 매수마감일`과 `2026-08-17 배당락일`은 이 정책에서 소실될 수 있는 회귀 fixture다. 이벤트 meta와 Goralert 기록은 남아도, 티커 캐시의 이벤트 본문이 교체되면 캘린더에서는 더 이상 표시되지 않는다.

## 수정 정책

- provider 응답에서 일정이 빠졌다는 사실을 삭제 근거로 사용하지 않는다.
- 기존 `declared`/`estimated` 이벤트를 유지하고, 동일 canonical identity(`ticker + type + date`)의 새 이벤트만 certainty 우선순위에 따라 갱신한다.
- 빈 응답, 실패, sample fallback, 부분 티커 응답은 기존 provider 이벤트를 보존한다.
- localStorage, Firestore, React state 캐시는 티커 단위 보존 병합을 사용한다. 한 저장소에 없는 티커/이벤트를 빈 값으로 해석하지 않는다.
- Firestore write transaction 안에서 기존 문서와 candidate를 다시 병합한다. 늦게 도착한 과거 snapshot은 최신 `fetchedAt`을 되돌릴 수 없지만, 최신 문서에서 빠진 이벤트는 복구할 수 있다.
- 초기 provider load와 수동 refresh는 request sequence를 공유한다. 먼저 시작한 요청이 늦게 완료돼도 최신 UI/cache 상태를 덮어쓸 수 없다.
- custom event는 기존 별도 collection과 명시적 삭제 흐름을 그대로 사용한다.

## 검증 fixture

`scripts/check-calendar-alert-cache.mts`에서 다음을 실행 검증한다.

- 만료된 APAM 캐시 자동 갱신 후 8월 14일/17일 유지
- 빈 refresh 응답에서 기존 일정 유지
- sample fallback에서 기존 일정 유지
- 일부 티커만 있는 cache map 병합에서 APAM 유지
- 동일 identity의 estimated → declared 승격 및 중복 제거
- 동일 날짜의 다른 티커 이벤트 비충돌
- ISO 날짜가 `2026-08-14`, `2026-08-17` 그대로 유지
- 오래된 snapshot과 최신 snapshot의 역순 저장 시 revision rollback 방지 및 누락 이벤트 복구

UI 스타일과 자동 최신화 기능은 변경하지 않는다.
