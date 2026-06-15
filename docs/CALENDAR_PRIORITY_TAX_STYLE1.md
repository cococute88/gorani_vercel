# CALENDAR-PRIORITY-SORT-TAX-SORT-ESTIMATE-STYLE-1

## 작업 전 구조 분석

- 월간 캘린더 셀은 `CalendarGrid`에서 `eventsByDate`에 들어온 이벤트 배열의 삽입 순서를 그대로 사용하고, 셀 안에서는 `dayEvents.slice(0, 3)`으로 앞 3개 chip만 렌더링했다. 따라서 같은 날짜 안에서 하트/별을 켜도 정렬 기준이 바뀌지 않았다.
- 선택 날짜 일정 목록은 `DividendCalendarPage`의 `selectedEvents = filteredEvents.filter(event.date === selectedDate)` 결과를 `SelectedDateList`/`CalendarEventList`에 그대로 전달했다.
- 하트/별 상태는 `CalendarEvent.favorite` 표시값(`💗`, `⭐`)으로 UI 이벤트에 병합된다. 저장 source는 생성 이벤트 메타의 `heart`/`star` boolean이며, `users/{uid}/calendarEvents/{eventId}` Firestore와 `STORAGE_KEYS.calendarEventMeta` localStorage에 저장된다. 저장 직후에는 `setEventMetas(next)`로 local state가 먼저 갱신된다.
- 오른쪽 `종목별 예상 절세액` 표는 `buildTaxSavingRows(monthEvents, ...)`가 만든 `TaxSavingRow[]`를 사용한다. 핵심 numeric 값은 `taxSavingUsd`이고, 렌더링 때만 `$xx.xx` 문자열로 포맷한다.
- `전체 배당 일정` 표는 `DividendSchedulePreview`의 `ScheduleRow.status`를 사용한다. 이 값은 `CalendarEvent.status`의 `confirmed | estimated`에서 온다. 화면 라벨은 `eventStatusLabel(row.status)`가 `확정/추정`으로 변환한다.
- 이번 변경은 렌더링 정렬/표시 helper와 컴포넌트 state만 변경한다. legacy import, custom event, ticker memo, tax source, Firestore schema, dividend estimate 계산식은 변경하지 않았다.

## 하트/별 priority sort 정책

`lib/calendar-event-sort.ts`에 순수 정렬 helper를 추가했다.

정렬 우선순위:

1. 하트(`favorite === "💗"`)
2. 별(`favorite === "⭐"`)
3. 확정(`status === "confirmed"`)
4. 이벤트 타입(`배당락 → 매수마감 → 지급 → 실적 → custom`)
5. 종목명 alphabetic
6. 기존 stable order(index fallback)

적용 위치:

- 월간 캘린더 셀 chip: 날짜별 이벤트를 `sortCalendarEventsByPriority(...)`로 정렬한 뒤 최대 3개를 표시한다.
- 선택 날짜 일정 목록: `selectedEvents`를 같은 helper로 정렬해서 전달한다.
- 전체 배당 일정 표는 기존 독립 정렬 정책을 유지한다.

## 절세액 sort 정책

`TaxSavingTable`에 local sort state를 추가했다.

- 초기 방향: 내림차순(`desc`)
- 헤더 클릭: `desc ↔ asc` 단순 토글
- 표시 indicator: `절세액 ↓` / `절세액 ↑`
- 정렬 기준: `TaxSavingRow.taxSavingUsd` numeric value
- `canCalculate === false`, `null`, `undefined`, `NaN` 계열은 하단 고정
- 동률/미계산끼리는 ticker alphabetic fallback

## 추정 row styling 정책

`DividendSchedulePreview`의 `전체 배당 일정` row에서 `row.status === "estimated"`인 경우에만 은은한 회색 배경을 적용한다.

- light: `bg-slate-50`
- dark: `dark:bg-slate-800/40`
- hover는 기존 `hover:bg-black/[0.03]` / `dark:hover:bg-white/[0.03]` 유지
- 타입 badge 색상은 기존 `getEventVisual(row.type)` 결과를 유지
- 확정 row는 추가 배경 class 없이 기존 스타일 유지

## 테스트 명령어

- `npm run check:calendar-priority-tax-style`
- `npm run check:calendar-provider`
- `npm run lint`
- `npm run typecheck`
- 가능 시 `npm run build`
- 회귀 확인: `npm run check:portfolio-realdata`, `npm run check:market-data-real`, `npm run check:dividend-estimates`, `npm run check:dividends-data`

## 남은 한계

- 브라우저에서 실제 하트/별 클릭 후 재정렬은 local state 즉시 갱신 구조와 정적 검사로 검증했다. 이 환경에서는 원격 Firebase/Vercel Preview 접속 검증은 수행하지 않았다.
- 하트/별의 저장 schema는 기존 `heart`/`star` boolean과 `favorite` 표시 병합을 그대로 사용한다.
