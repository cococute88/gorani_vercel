# CALENDAR-UX-POLISH-1 — 배당캘린더 우측 패널 / 예상 절세액 / 미국 주요 일정 레이아웃 개선

`/watchlist` 배당캘린더 화면의 우측 정보 패널과 미국 경제 일정 영역을 원본 Streamlit
(`docs/reference/dividend_calendar.py`)의 의도에 더 가깝게 다듬은 **레이아웃/정렬/표시
전용** 작업이다. import 로직·Firestore 스키마·legacy import helper는 변경하지 않았다.

## 변경 파일

신규:
- `lib/economic-calendar-data.ts` — 정적 미국 경제 일정 스냅샷 + 이번주/다음주 분리 헬퍼
- `components/watchlist/EconomicCalendarSection.tsx` — 풀폭 "주요 미국 경제 일정" 섹션
- `scripts/check-calendar-ux-rules.mjs` — 본 작업 회귀 스크립트
- `docs/CALENDAR_UX_POLISH1.md` — 본 문서

수정:
- `components/watchlist/TaxSavingTable.tsx` — Buy 컬럼 제거, 내부 스크롤, 파란 음영, `$xx.xx`
- `lib/mock-calendar-data.ts` — `buildTaxSavingRows` 정렬에 "이번 달 Buy 우선" 규칙 추가
- `components/watchlist/DividendCalendarPage.tsx` — 우측 rail 폭 축소, `이번 달 주요 일정`
  배당 카드 제거, `EconomicCalendarSection` 풀폭 배치
- `package.json` — `check:calendar-ux-rules` 스크립트 추가
- `docs/AUDIT.md` — 한 줄 추가

## 1. 절세액 패널 높이 제한 + 내부 스크롤

- `TaxSavingTable`을 `flex flex-col` 카드로 바꾸고, 헤더(제목/설명)는 `shrink-0`,
  본문(테이블)은 `max-h-[420px] xl:max-h-[600px] overflow-y-auto`로 감쌌다.
- `<thead>`는 `sticky top-0`으로 스크롤 시에도 컬럼 라벨이 유지된다.
- 정확한 "왼쪽 column 높이"에 픽셀 단위로 맞추는 대신, 캘린더 본문(약 750px) 안쪽에서
  자연스럽게 멈추는 `max-h` 캡을 사용했다(태스크가 허용한 fallback). 종목이 많아지면
  카드 내부에서만 스크롤되고 페이지 전체 높이는 늘어나지 않는다.
- 우측 aside는 `xl:sticky xl:top-4`로 스크롤 시 시야에 머문다.

검증(데스크톱 1440px): 좌측 컬럼 905px / 절세액 카드 376px → 패널이 캘린더 아래로
튀어나오지 않음. 종목 수가 cap을 넘으면 `overflow-y-auto`로 내부 스크롤된다.

## 2. Buy 버튼 제거 + 패널 폭 축소

- 테이블 컬럼을 **종목 / 절세액** 2개로 축소했다(`<colgroup>` 2칸). 기존 Buy 버튼 컬럼은
  완전히 삭제했다.
- 금액은 `$71.02` 형식(`$` + 소수 2자리)으로 우측 정렬, 긴 ticker는 `truncate`.
- 메인 그리드 우측 rail 폭을 `340px → 260px`로 축소(`xl:grid-cols-[minmax(0,1fr)_260px]`),
  캘린더 월간 그리드 폭이 넓어졌다(검증: 캘린더 카드 ≈ 940px).

## 3. 현재 달 Buy 종목 우선 정렬 + 연한 파란색 음영

- `buildTaxSavingRows`는 입력으로 **현재 visible month 이벤트(`monthEvents`)**만 받으므로,
  `shouldBuyThisMonth = 해당 ticker에 buy_by 이벤트 존재`는 곧 "이번 달 매수 대상"을 의미한다.
- 정렬 규칙(우선순위 순):
  1. `shouldBuyThisMonth` true 우선
  2. 계산 가능(`canCalculate`) 우선
  3. 예상 절세액 내림차순
  4. (로딩/티커명 tie-break)
  → Buy가 있는 종목이 절세액이 더 낮아도 상단에 온다.
- highlight: `shouldBuyThisMonth` row에 `bg-blue-500/10`(연한 파랑) + 작은 파란 점.
  다크 톤 카드 위에서 과하지 않은 tint이며 라이트/다크 모두 동일 클래스로 안전하다.
- 달 이동 시 `month` → `monthEvents` → `taxRows`가 재계산되어 정렬/highlight도 갱신된다.

## 4. 미국 주요 일정 데이터 source

- 원본 Streamlit은 GitHub Actions가 생성한 `data/economic_calendar_us_high.json`을
  `render_us_economic_calendar_section`에서 렌더했다(향후 30일, 중요도 높은 미국 지표).
- 외부 API 신규 연결은 범위 밖이므로, 그 JSON의 **정적 스냅샷**을
  `lib/economic-calendar-data.ts`(`STATIC_US_ECONOMIC_EVENTS`)에 임베드했다.
  날짜/시간/지표명은 원본 export(investing.com) 기준이며, 일부 부차 지표만 시각적
  구분을 위해 `medium`으로 태깅했다.
- 기존 `lib/mock-dividend-data.ts`의 `MOCK_ECONOMIC_EVENTS`는 time/주차 분리 개념이
  없어 재사용하지 않고, 원본 포맷(date/time/name/importance)에 맞춘 전용 모듈을 새로 만들었다.

## 5. 이번주 / 다음주 2표 레이아웃

- `EconomicCalendarSection`은 **풀폭**(`DividendSchedulePreview`처럼 캘린더/rail 바깥)에 배치된다.
- `splitEconomicEventsByWeek(today)`가 오늘 기준 이번주(today..+6)/다음주(today+7..+13)로
  분리한다(날짜·시간 정렬).
- 데스크톱(`lg:`)은 2-column grid(왼쪽 이번주 / 오른쪽 다음주), 모바일은 1-column stack.
- 각 표 항목: 날짜(`6/17(수)`) · 시간 · 지표명 · 중요도 태그(중요/보통/낮음).
- 스크롤 정책: 두 카드 모두 `max-h-[300px] lg:max-h-[360px] flex flex-col`,
  본문은 `flex-1 min-h-0 overflow-y-auto`. 데스크톱 grid stretch + max-h 조합으로 두 카드가
  **같은 높이**가 되고, 긴 쪽(이번주)만 내부 스크롤되며 짧은 쪽은 스크롤이 없다.
  (검증: 이번주 clientH 320 / scrollH 335 → scroll, 다음주 320/320 → no scroll)

## 회귀 방지 확인

- imported legacy events / custom events 로딩·머지(`loadLegacyImportedCalendarEvents`,
  `mergeGeneratedAndCustomCalendarEvents`)는 그대로 유지.
- Ex-Div / Buy / Pay / Earn / 사용자 필터, 전체 배당 일정 미리보기(`DividendSchedulePreview`),
  Firestore sync, 2999-12-31 sentinel 제외, `/dev/calendar-import` 모두 유지.
- `check:calendar-provider`, `check:legacy-calendar-import` 통과.

## 테스트 / 검증 명령

```bash
npm.cmd run check:calendar-ux-rules
npm.cmd run check:calendar-provider
npm.cmd run check:legacy-calendar-import
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

회귀 배치(통과 확인): `check:portfolio-realdata`, `check:dividend-estimates`,
`check:dividends-data`, `check:performance-qld-snapshots`, `check:krx-ticker-name-map`,
`check:market-chart-formatters`.

`check:calendar-ux-rules`가 검증하는 것:
- Buy 종목이 절세액이 더 낮아도 상단 정렬되는지 + highlight 플래그
- 절세액 테이블 컬럼이 2개(Buy 컬럼 제거), 내부 스크롤/파란 음영 클래스 존재
- 경제 일정이 이번주/다음주로 분리되고, 배당 이벤트가 아닌 date/time/name/importance
  구조인지(이벤트에 ticker/dividendAmount 없음)
- 페이지가 `이번 달 주요 일정` 배당 카드를 더 이상 쓰지 않고 경제 섹션을 렌더하는지

## 시각 검증 결과 (Claude Preview)

- 데스크톱 1440px: horizontal overflow 없음(clientWidth 1425 = scrollWidth 1425),
  rail 260px, 캘린더 ≈ 940px, 절세액 카드 376px(좌측 905px 대비 안 튀어나옴),
  절세액 헤더 `[종목, 절세액]`, 금액 `$14.61`, row bg `rgba(59,130,246,0.1)`,
  경제 표 이번주(335>320 → scroll)/다음주(320=320 → no scroll), 콘솔 에러 없음.
- 모바일 390px(dark): overflow 없음, 경제 grid 1-column.
- 모바일 320px: overflow 없음, 절세액 내부 스크롤 컨테이너 존재.

## 남은 한계

- 경제 일정은 정적 스냅샷(2026-06 기준)이라 실제 날짜가 스냅샷에서 크게 벗어나면 두 표가
  비어 보일 수 있다(원본도 생성형 JSON에 의존). 향후 GitHub Actions/JSON 연결 시
  `splitEconomicEventsByWeek`는 그대로 두고 데이터 source만 교체하면 된다.
- 절세액 패널 높이는 픽셀 단위로 좌측 컬럼과 동기화하지 않고 `max-h` cap을 사용한다(허용 fallback).
- mock 캘린더에서는 모든 종목이 매월 buy_by를 갖도록 생성되어 highlight가 전부 적용될 수 있다.
  실데이터(특정 달에 배당 있는 종목만 buy)에서는 차별화되어 표시된다.

원본 Streamlit 참고 파일: `docs/reference/dividend_calendar.py`
(`load_us_high_importance_economic_calendar`, `render_us_economic_calendar_section`).
