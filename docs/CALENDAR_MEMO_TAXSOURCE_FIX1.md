# CALENDAR-MEMO-TAXSOURCE-FIX-1 — 이벤트 상세 모달 메모/절세액 source 통일

## 문제 원인

`TickerMemoDialog`와 선택 날짜 일정 카드는 `legacyDividendCalendarMeta/memos.items`에서 로드된 ticker-level memo map을 상위 `WatchlistPage`에서 받아 사용했다. 반면 `CalendarEventDialog`는 `calendarEvents/{eventId}`의 event-level `meta.memo` 또는 `event.note`만 초기값으로 사용했기 때문에 같은 ticker의 공유 메모가 있어도 상세 모달 textarea가 비어 보일 수 있었다.

절세액도 동일한 불일치가 있었다. 오른쪽 `종목별 예상 절세액` 패널과 선택 날짜 일정 카드는 `DividendCalendarPage`가 `buildTaxSavingRows(...)`로 만든 월별 per-ticker `taxSavingByTicker` map을 사용했지만, `CalendarEventDialog` 요약 카드는 event payload의 `event.taxSavingUsd`만 보았다. real/imported provider event에서는 이 필드가 0 또는 미설정일 수 있어 `절세액($10K)`이 `—`로 표시됐다.

## ticker-level memo source 정책

- source: `WatchlistPage`의 `memos` state.
- Firestore: `users/{uid}/legacyDividendCalendarMeta/memos` 문서의 `items` field.
- local fallback: `STORAGE_KEYS.calendarMemos` (`gorani.dividend-calendar.memos.v1`).
- 조회: `lookupTickerMemo`를 사용해 exact → uppercase/canonical → suffix-stripped base ticker 순서로 찾는다.
- 저장: `canonicalMemoTickerKey(ticker)`로 canonical key를 만들고 localStorage 및 `saveLegacyDividendCalendarMemo`에 저장한다.

## UI별 memo 통일

- `TickerMemoDialog`: 기존처럼 `WatchlistPage`가 `lookupTickerMemo(memos, memoTicker)`로 찾은 `initialMemo`를 표시한다.
- `SelectedDateList`: `DividendCalendarPage`를 통해 `tickerMemos`를 받고, `CalendarEventList`에서 `lookupTickerMemo`로 표시한다.
- `CalendarEventDialog`: 이제 같은 `tickerMemos` prop을 받아 ticker-level memo를 우선 표시한다. ticker-level memo가 없을 때만 기존 event-level `meta.memo` / `event.note`를 fallback으로 사용한다.

## save 정책

이벤트 상세 모달의 `메모` 저장 버튼은 `onSaveTickerMemo(event.ticker, memo)`를 호출해 ticker-level memo source에 저장한다. 별/하트 저장은 기존 event-level `calendarEvents/{eventId}` meta path를 유지하며, ticker memo를 event마다 중복 저장하지 않는다. `onSaveTickerMemo`가 없는 방어적 상황에서는 기존 event-level memo save fallback을 유지한다.

## `절세액($10K)` source 통일

`CalendarEventDialog`는 `DividendCalendarPage`가 `TaxSavingTable`과 선택 날짜 일정에 이미 쓰는 `taxSavingByTicker` map을 함께 받는다. 요약 카드의 `절세액($10K)`은 이 map의 현재 시세 기준 per-$10k 1회 예상 절세액을 먼저 사용하고, 명시적인 `event.taxSavingUsd`가 양수일 때만 fallback으로 사용한다. 계산 공식은 새로 만들지 않고 기존 `buildTaxSavingRows(...)` 결과만 재사용한다.

## `1회 절세 예상(과거5년)` 유지

과거 5년 회복 기준 metric은 `loadHistoricalTaxSavingMetricCached`를 사용하는 별도 보조 지표로 유지했다. 이 값은 현재 시세 기준 `절세액($10K)`과 다른 개념이므로 상세 모달에 별도 카드로 표시한다.

## `연간 배당률` 라벨

`annualYield`는 배당캘린더 이벤트의 annual dividend yield 의미로 사용된다. 상세 모달의 기존 `연간 수익률` 라벨은 가격/총수익률로 오해될 수 있어 `연간 배당률`로 변경했다.

## 테스트

- `npm run check:calendar-memo-taxsource-dialog`
- `npm run check:calendar-memo-matching`
- `npm run check:calendar-provider`
- `npm run check:legacy-calendar-import`
- `npm run check:calendar-ux-rules`
- `npm run lint`
- `npm run typecheck`

## 남은 한계

로컬 Firebase 미설정 환경에서는 Firestore legacy memo가 로드되지 않을 수 있다. 이 경우 localStorage fallback 또는 fixture/static checks로만 확인되며, 실제 legacy memo 시각 확인은 Firebase-connected Vercel/preview 환경에서 해야 한다.
