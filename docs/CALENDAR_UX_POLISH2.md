# CALENDAR-UX-POLISH-2 — 배당캘린더 표/필터/티커관리/메모매칭/라이트모드 가독성

`/watchlist` 배당캘린더 화면을 직전 `CALENDAR-UX-POLISH-1` 이후 발견된 사용자 지적
사항에 맞춰 다듬은 **UI/UX + 메모 매칭 로직** 작업이다. import 로직·Firestore 스키마·
legacy import helper의 기존 동작은 변경하지 않았다.

원본 Streamlit 참고 파일: `docs/reference/dividend_calendar.py`
(`_events_to_dataframe`, "전체 배당 일정 (All Tickers, 1 Year)" expander,
`show_memo_dialog`, `_render_ticker_manager`, `render_us_economic_calendar_section`).

## 변경 파일

신규:
- `lib/calendar-memo-matching.ts` — ticker memo key 정규화/lookup/merge 헬퍼
- `components/watchlist/PortfolioManageModal.tsx` — 기본 포트폴리오 관리 modal
- `components/watchlist/TickerMemoDialog.tsx` — 종목 메모 조회/수정 dialog
- `scripts/check-calendar-memo-matching.mjs` — memo 매칭 회귀 스크립트
- `docs/CALENDAR_UX_POLISH2.md` — 본 문서

수정:
- `components/watchlist/DividendSchedulePreview.tsx` — 전체 배당 일정 표 재구성
- `components/watchlist/EconomicCalendarSection.tsx` — 라이트모드 가독성
- `components/watchlist/CalendarGrid.tsx` — hover/past/custom 표시
- `components/watchlist/TickerManager.tsx` — x 삭제 제거, 클릭 → 메모
- `components/watchlist/PortfolioSelectorMock.tsx` — 관리 버튼 동작
- `components/watchlist/WatchlistPage.tsx` — memo state, manage modal, memo dialog 배선
- `components/watchlist/DividendCalendarPage.tsx` — custom 분리, onManagePortfolio, 표에 월 범위 전달
- `lib/event-visuals.ts` — past event muted(색 유지) 스타일
- `lib/firebase/firestore-repositories.ts` — legacy memo load/save
- `lib/storage-keys.ts` — `calendarMemos` 키 추가
- `app/globals.css` — 라이트모드 purple(실적) 텍스트 remap
- `scripts/check-calendar-ux-rules.mjs` — 표/그리드/메모 배선 검증 추가
- `package.json`, `docs/AUDIT.md`

## 1. 전체 배당 일정 표 (12행/스크롤/현재월 우선/컬럼순서/정렬/필터)

- 종목별 1행이 아니라 **이벤트별 1행**으로 모든 일정을 표시한다(원본 561건 표와 동일 개념).
  custom/사용자 일정은 표에서 제외(그리드에서만 표시).
- 컬럼 순서(한국어): **종목 / 타입 / 상태 / 배당금 / 매수마감일 / 배당락일 / 지급일**.
  별도 `Date` 컬럼은 제거하고 event type별 날짜 컬럼으로 통합. 배당금은 우측 정렬,
  날짜는 `YYYY-MM-DD`. 모바일에서는 상태/매수마감일/지급일을 숨겨 셀이 밀리지 않게 하고,
  표 컨테이너만 가로 스크롤(`min-w-[520px] overflow-auto`)되어 페이지 overflow는 없다.
- 높이: 본문을 `max-h-[460px] overflow-auto`(약 12행)로 캡하고 `<thead>`는 `sticky top-0`.
  종목이 많아도 카드 내부에서만 스크롤되고 페이지가 늘어나지 않는다.
- 기본 정렬: **현재 보고 있는 월(visible month)에 가까운 날짜 우선**. 월 안의 이벤트가
  먼저, 그다음 월 경계로부터의 거리순. 컬럼 헤더 클릭 시 해당 컬럼 정렬로 전환된다.
- 정렬 컬럼: 종목/타입/상태/배당금/매수마감일/배당락일/지급일. 클릭마다 오름/내림 토글,
  현재 정렬 컬럼은 `▲/▼`, 나머지는 연한 `↕`. 날짜는 날짜기준, 배당금은 숫자기준,
  비어있는 값(`—`)은 정렬 방향과 무관하게 항상 아래로 내려간다.
- 필터: 배당락(`ex_div`) / 매수마감(`buy_by`) / 지급(`pay`) / 실적(`earnings`) 4종,
  **기본 전체 체크**. 체크 해제 시 해당 타입 row가 표에서 빠진다. 상단에 `총 N건` 표기.

## 2. 실적발표일 row 표시 정책

earnings는 배당 이벤트가 아니므로:
- 종목 = ticker, 타입 = 실적, 상태 = 기존 status(없으면 그대로),
- 배당금 = `—`, 매수마감일 = `—`, 지급일 = `—`,
- 배당락일 칸 = **earnings 이벤트의 실제 날짜**(event.date / exDivDate)로 채워 row 날짜가 보이게 함.
- 임의 배당금/지급일은 절대 채우지 않는다.

## 3. 기본 포트폴리오 관리 modal

- `기본 포트폴리오` 카드의 `관리` 버튼 → `PortfolioManageModal` 오픈.
- 등록 티커 목록(전부) + 각 티커 `x` 삭제, 티커 입력 추가, `저장 / 닫기`.
- 추가/삭제는 페이지가 이미 쓰던 **calendarTickers 저장 구조**(localStorage + Firestore
  `saveCalendarTicker`/`deleteCalendarTicker`)를 그대로 사용한다(스키마 변경 없음).
- 모바일에서 modal 본문은 `max-h-[85vh]` + 내부 스크롤.

## 4. 하단 티커 관리: 메모 조회/수정으로 역할 변경

- 하단 ticker chip에서 `x` 삭제 버튼 제거. 추가/삭제는 위 관리 modal로 일원화.
- ticker 버튼 클릭 → `TickerMemoDialog`(해당 종목 메모 조회/수정). 메모가 있으면 버튼에
  파란 점 표시. 원본 Streamlit 데스크톱 ticker 버튼 그리드(`show_memo_dialog`)와 동일 의도.

## 5. legacy memo 매칭 정책

- legacy import는 memos를 `users/{uid}/legacyDividendCalendarMeta/memos`의 `items`
  (canonical 대문자 ticker key)로 보존한다. 이번에 이를 읽는
  `loadLegacyDividendCalendarMemos`와 저장하는 `saveLegacyDividendCalendarMemo`를 추가했다.
- 페이지는 legacy memos를 base로, 로컬 편집 memo(`localStorage` `calendarMemos`)를 override로
  병합(`mergeMemoMaps`)한다.
- lookup 순서(`lib/calendar-memo-matching.ts`): ① exact ticker ② uppercase
  ③ canonical(normalizeCalendarTicker) ④ suffix-stripped(`.KS/.KQ/...` 제거). `F` 같은
  단일 문자 ticker, `360200.KS` 같은 suffix ticker 모두 매칭된다. 없으면 빈 textarea.
- 저장은 canonical 대문자 key로만 기록하며, 사용자가 명시적으로 저장할 때만 update(이벤트별
  중복 저장 없음, 원본 import 데이터 파괴 없음).

## 6. 라이트모드 가독성 / hover / past / custom

- **경제 일정 표**: bare dark hex 대신 명시적 light/dark 쌍(`bg-slate-50 dark:bg-[#141a1b]`,
  `text-slate-800 dark:text-slate-200`, 시간 `text-blue-600 dark:text-blue-300`, 중요도 배지
  light 색)으로 교체해 흰 배경 위 대비를 확보했다.
- **purple(실적) 텍스트**: 기존 light remap에 빠져 있던 `text-purple-200/100`을 purple-700로
  remap(`app/globals.css`)해 실적 칩/배지/legend가 라이트모드에서 또렷하다.
- **날짜 hover**: 라이트모드는 `hover:bg-sky-50`(연한 하늘색)만 적용. 다크 표면색 hover는
  `dark:hover:bg-[#1e2628]`로 `dark:`에 한정 — 전역 light remap이 `hover:` 클래스를 건드리지
  않아 생기던 "검은색 hover"를 제거.
- **past/지난 이벤트**: `eventStateClasses`에서 `grayscale`를 제거하고 `opacity-60`만 적용.
  Ex-Div(파랑)/Buy(빨강)/Pay(초록)/Earn(보라) 본래 색을 유지한 채 살짝 muted, 추정은 dashed 유지.
- **custom/user 일정**: 캘린더 grid에서 칩 슬롯을 차지하지 않고 **날짜 숫자 옆 같은 줄 텍스트**로
  표시한다(여러 개면 `+N`, truncate). 필터와 무관하게 항상 보이도록 `customEvents`를 별도
  prop으로 전달한다. 노란 `사용자` 칩 표기는 제거(legend는 "사용자/경제 일정 = 날짜 옆 텍스트"로 안내).

## 회귀 방지

- legacy imported events 로딩/머지, Ex-Div/Buy/Pay/Earn 필터, custom event 표시,
  Firestore sync, `/dev/calendar-import`, deterministic dedupe, 2999-12-31 sentinel 제외,
  절세액 표 current-month Buy highlight, 미국 경제 일정 이번주/다음주 2표 구조 모두 유지.

## 테스트 / 검증 명령

```bash
npm.cmd run check:calendar-ux-rules
npm.cmd run check:calendar-memo-matching
npm.cmd run check:calendar-provider
npm.cmd run check:legacy-calendar-import
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

회귀 배치(통과 확인): `check:portfolio-realdata`, `check:dividend-estimates`,
`check:dividends-data`, `check:performance-qld-snapshots`, `check:krx-ticker-name-map`,
`check:market-chart-formatters`.

`check:calendar-ux-rules` 추가 검증: 컬럼 순서, 정렬(toggleSort + ▲/▼), 필터 기본 전체체크,
earnings 특수 처리, 12행 cap/sticky/내부 스크롤, custom 미포함, grid 연한 hover + custom prop,
past muted(색 유지), 하단 ticker chip 삭제 제거 + onTickerClick, manage modal/memo dialog 배선,
legacy memo load 배선. `check:calendar-memo-matching`: 정규화/suffix-strip/lookup 순서/merge.

## 시각 검증 결과 (Claude Preview)

- 데스크톱 라이트: horizontal overflow 0(client=scroll), 전체 배당 일정 컬럼 순서
  `[종목,타입,상태,배당금,매수마감일,배당락일,지급일]`, 필터 4종 모두 pressed=true, 총 358건,
  표 본문 clientHeight 458 / scrollHeight 12834 → 내부 스크롤, 기본 정렬이 현재월(5~6월) 우선,
  경제 일정 텍스트 대비 양호, 실적 칩 색 `rgb(126,34,206)`.
- 기본 포트폴리오 관리: 버튼 클릭 → modal(`기본 포트폴리오 관리`, ticker chips + 삭제 + 입력).
- 종목 메모: 하단 SCHD 클릭 → `TickerMemoDialog`(textarea), 저장 후 `localStorage`
  `gorani.dividend-calendar.memos.v1`에 `{"SCHD":...}` 기록, 재오픈 시 값 유지, 버튼에 파란 점.
- 데스크톱 다크: 타입 색 유지, past 이벤트 muted(회색 아님), 필터에 노란 사용자 칩 없음.
- 모바일 390px / 320px: horizontal overflow 0, 전체 배당 일정 표는 카드 내부에서만 가로 스크롤.
- 콘솔 에러 없음.

## 남은 한계

- mock/real-fallback 데이터셋에는 earnings·custom 이벤트가 포함되지 않아, earnings row/날짜옆
  custom 텍스트는 실제 legacy import 데이터에서만 화면으로 직접 확인된다(로직/유닛 검증으로 보강).
- legacy custom 이벤트는 import 단계에서 symbol(※/ⓔ 등)이 ticker 정규화로 제거되어 grid 텍스트는
  name만 표시된다(기존 import 데이터 특성, 본 작업 범위 밖).
- 종목 메모는 ticker 단위 공유 메모이며, 이벤트 dialog의 per-event 메모(calendarEvents meta)는
  별도로 유지된다(원본 Streamlit은 둘이 동일 ticker 메모였으나 통합은 범위 밖).
