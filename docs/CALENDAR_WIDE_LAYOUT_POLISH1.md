# CALENDAR-LAYOUT-WIDE-STREAMLIT-POLISH-1

배당캘린더(`/calendar` → 실제 라우트 `/watchlist`) 화면의 와이드 레이아웃 및 Streamlit
사용감 복원 작업. 캘린더 데이터/API/정렬/스타일 로직은 그대로 두고 UI 레이아웃만
정리한다.

## 레이아웃 변경 전 문제

- `/watchlist` 메인 컨테이너가 `max-w-[1280px]`로 다른 페이지(`/portfolio`,
  TopNav: `max-w-[1640px]`)보다 좁아 캘린더가 답답했다.
- 상단에 `포트폴리오` 카드와 `필터` 카드가 가로 폭을 차지해 캘린더가 작아졌다.
- 월간 day cell 높이(`sm:min-h-[100px]`)가 낮아 일정 3개 이후 바로 `+N`이 떴다.
- 캘린더 하단 legend가 클릭 불가능한 설명용 칩이라, 필터는 상단 카드에서만
  조작할 수 있었다.
- 월간 chip이 `CRBG 배당락`처럼 텍스트만 표시하고 절세액 금액이 없었다.

## 와이드 컨테이너 정책

- `components/watchlist/WatchlistPage.tsx`의 `<main>`을
  `mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8`로
  변경. `/portfolio` 및 `TopNav`와 같은 max-width·padding을 써서 좌측 시작점(GORAFI
  로고 라인)과 우측 끝(Logout 버튼)이 자연스럽게 정렬된다.
- 메인 콘텐츠 grid는 `xl:grid-cols-[minmax(0,1fr)_280px]` — 캘린더는 1fr로 넓게,
  오른쪽 `종목별 예상 절세액` 표는 280px 고정폭(기존 260px 수준 유지)으로 우측 끝이
  Logout 버튼 끝과 비슷한 위치에 온다. 간격은 `gap-4`로 과하지 않게 유지.

## 캘린더 높이/셀 높이 정책

- day cell `min-h`를 `min-h-[88px] sm:min-h-[140px] lg:min-h-[152px]`로 확대.
- 한 셀에 chip을 최대 4개까지 표시(`dayEvents.slice(0, 4)`)한 뒤 `+N` pill로 collapse.
- chip 폰트/간격은 기존 수준 유지. 모바일은 base 높이(88px)로 과도하게 길어지지 않게 조정.

## 하단 필터 toggle 정책

- 상단 `필터` 카드 + `포트폴리오` 카드(`PortfolioSelectorMock`) 제거.
- 캘린더 카드 하단 legend를 실제 필터 toggle 버튼으로 전환. `filters`/`onToggleFilter`를
  `CalendarGrid`에 내려 기존 `setFilters` 상태 로직을 그대로 재사용한다.
  - ON: 기존 이벤트 타입 색상 유지.
  - OFF: `border-white/10 bg-white/5 text-slate-500 opacity-60` (흐린 outline).
  - `aria-pressed`로 ON/OFF 상태 노출.
- `+ 일정 추가` 버튼은 같은 하단 toolbar 줄의 오른쪽 끝에 배치
  (`justify-between`), 기존 `openCreateCustomEvent`를 그대로 호출.

## 일정 chip 절세액 표시 정책

- `lib/event-visuals.ts`에 `formatTaxSavingChipAmount(value)` 추가. 오른쪽 절세액 표와
  동일한 numeric 값(`taxSavingUsd`)을 두 자리 소수(`$17.25`)로 포맷한다. 값이 없거나
  계산 불가/로딩 중이면 `null`을 반환해 기존 chip label을 유지(하드코딩 없음).
- `DividendCalendarPage`가 이미 계산하는 `taxSavingByTicker`(절세액 표와 같은 source)를
  `CalendarGrid`에 전달. chip은 `ticker` 기준으로 금액을 붙여
  `CRBG 매수 $17.25`처럼 표시한다.
- 금액 span은 `hidden sm:inline`으로 desktop/tablet에서만 노출, 모바일/좁은 칸에서는
  숨겨 셀 깨짐과 `+N` 충돌을 방지. 하트/별 prefix 및 우선정렬은 그대로 유지.

## 포트폴리오 관리/티커 관리 병합 정책

- 상단 `포트폴리오 / 기본 포트폴리오 / 관리` 카드 제거.
- 하단 `티커 관리` 섹션 제목 줄 오른쪽 끝에 `포트폴리오 관리` 버튼 배치.
  기존 `onManagePortfolio`(→ `PortfolioManageModal`)를 그대로 호출해 추가/삭제/선택을
  처리하므로 localStorage/Firestore persistence는 변경 없음.
- 티커 버튼 grid, legacy 메모 조회/수정 연동은 `TickerManager` 그대로 유지.
- (`PortfolioSelectorMock.tsx`는 더 이상 렌더되지 않지만 파일은 보존.)

## 보존된 기존 기능

하트/별 우선정렬, 절세액 컬럼 정렬, 추정 row 회색 배경, custom event 추가/편집,
ticker memo, portfolio selection, cloud sync, imported legacy events,
배당락/매수마감/지급/실적 필터, 전체 배당 일정 표, 종목별 예상 절세액 표, 모바일
레이아웃 — 모두 동작 유지. 데이터/API 최신화 로직, parser는 미변경.

## 테스트 명령어

```bash
npm run check:calendar-wide-layout-polish
npm run check:calendar-priority-tax-style
npm run check:calendar-provider
npm run lint
npm run typecheck
npm run build
# 회귀
npm run check:portfolio-realdata
npm run check:market-data-real
npm run check:dividend-estimates
npm run check:dividends-data
```

`scripts/check-calendar-wide-layout-polish.mjs`는 와이드 컨테이너, 상단 필터/포트폴리오
카드 제거, 하단 toggle 필터 동작, `+ 일정 추가` 위치, 포트폴리오 관리 병합, cell 높이
증가, chip 절세액 표시 경로, 절세액 rail 폭 유지를 정적 검증한다.

## 남은 한계

- chip 절세액은 desktop/tablet(`sm:`)에서만 노출되고 모바일에서는 숨겨진다(셀 폭 보호).
- 절세액 값 자체는 기존 `buildTaxSavingRows` / quote 파이프라인에 의존하며, live quote가
  없으면 chip 금액도 표시되지 않는다(기존 동작과 동일).
- `PortfolioSelectorMock` 컴포넌트는 사용처가 없지만 회귀 위험을 줄이기 위해 삭제하지
  않고 남겨 두었다.

## 후속 polish

- `CALENDAR-DESIGN-FINAL-POLISH-1` (chip 가독성, 날짜칸 5줄 기준 높이, 절세액 패널
  높이 정렬, 불필요한 IMPORTED/클라우드 동기화 액션 제거)은
  `docs/CALENDAR_WIDE_LAYOUT_POLISH1_FINAL.md` 참고.
