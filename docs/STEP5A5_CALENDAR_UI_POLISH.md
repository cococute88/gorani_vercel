# Step 5A-5: 배당캘린더 UI Polish

## 읽은 문서/파일

### 문서
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
- `docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`
- `docs/STEP5A4_CALENDAR_PROVIDER_REGRESSION.md`

### 수정한 파일
- `lib/event-visuals.ts`
- `components/watchlist/CalendarGrid.tsx`
- `components/watchlist/CalendarEventDialog.tsx`
- `components/watchlist/CalendarEventList.tsx`
- `components/watchlist/DividendCalendarPage.tsx`
- `components/watchlist/DividendSchedulePreview.tsx`
- `components/watchlist/TaxSavingTable.tsx`
- `components/watchlist/WatchlistPage.tsx`

### 읽기 전용 확인
- `lib/calendar-grid.ts`
- `lib/calendar-event-provider.ts` (변경 없음)
- `lib/calendar-cache.ts` (변경 없음)
- `lib/calendar-event-identity.ts` (변경 없음)
- `lib/mock-calendar-data.ts` (변경 없음)
- `lib/storage-keys.ts` (변경 없음)
- `lib/firebase/firestore-repositories.ts` (변경 없음)

## CalendarGrid polish

1. **셀 높이/패딩**: `min-h-[92px]` → `min-h-[72px]` (모바일), `sm:min-h-[100px]` (데스크톱) — 더 compact
2. **오늘 날짜**: `bg-blue-500` 원형 + `shadow-md shadow-blue-500/30` glow 효과로 명확히 강조
3. **선택된 날짜**: `ring-2 ring-inset ring-blue-400/80` — 경계 명확
4. **이전/다음월 날짜**: `bg-[#141a1b]` + `text-slate-600` — 현재월보다 약하게 표시
5. **요일 헤더**: 일=빨강, 토=파랑, 나머지=slate-500 — 주말 구분 직관적
6. **이벤트 칩**: `text-[9px]`→`sm:text-[10px]`, `truncate`, `min-w-0` 적용 — 모바일에서 넘침 방지
7. **+N 표시**: 셀 상단 우측에 작고 깔끔한 badge
8. **네비게이션 버튼**: `◀`/`▶` 아이콘 사용, 모바일에서 작게 유지
9. **범례**: compact한 pill 형태, 점선 = 추정 표시 포함

## Event chip polish

1. **한국어 라벨**: `Ex-Div`→`배당락`, `Buy By`→`매수마감`/`매수`, `Pay`→`지급`, `Earnings`→`실적`
2. **칩 라벨 형식**: `{ticker} {shortLabel}` (중간점 `·` 제거 → 공간 절약)
3. **일관된 색상**: blue/red/emerald/purple 4색 유지, border 밝기 통일 (`/60`)
4. **estimated 이벤트**: `border-dashed opacity-60` 유지 (기존 로직)
5. **과거 이벤트**: `opacity-45 grayscale` 유지 (기존 로직)
6. **텍스트 overflow**: 모든 칩에 `truncate` + `min-w-0` 적용

## Source/cache/warning 표시 개선

1. **상단 소스 badge**: 페이지 제목 우측에 compact pill로 표시
   - `LIVE`: emerald (정상)
   - `CACHE`: cyan (캐시 사용)
   - `MOCK`/`SAMPLE`: slate (fallback)
   - `LOADING`: yellow (로딩 중)
2. **경고 표시**: 제목 아래 한 줄로 첫 번째 warning만 표시, `truncate` 적용
3. **기존 큰 blue info box 제거**: layout 공간 확보, 정보는 badge + 한 줄로 충분

## EventDialog polish

1. **타입 badge + 추정 badge**: 상단에 나란히 표시
2. **닫기**: `✕` 문자 사용, backdrop 클릭으로도 닫힘
3. **Info 그리드**: 한국어 라벨(`배당금`, `매수마감`, `배당락일`, `지급일`, `연간 수익률`, `절세액`)
4. **Star/Heart**: hover시 색상 변화 transition 추가
5. **Source 정보**: 하단에 작은 텍스트로 `데이터: 추정(과거 패턴 기반)` 표시
6. **모바일**: `max-w-md sm:max-w-lg`, padding 축소, 텍스트 크기 반응형

## Mobile 확인 (320px~430px)

- CalendarGrid 셀이 7열로 `overflow-hidden`, 터지지 않음
- 이벤트 칩 `text-[9px]` + `truncate`로 좁은 셀에서도 읽힘
- dialog `p-3 sm:p-4`, `max-w-md` — 화면 안에 들어옴
- 모든 table에 `overflow-x-auto` 적용
- 버튼/입력 터치 영역 유지 (`py-1.5` 이상)

## Desktop 확인 (768px+)

- container `max-w-[1280px]` — 너무 넓게 퍼지지 않음 (기존 1640px에서 축소)
- 카드 간격 `gap-4` 통일
- 그리드 셀 `sm:min-h-[100px]` — 적당한 높이
- 사이드바 `340px` (기존 380px에서 축소) — 좌측 캘린더에 더 많은 공간

## 변경하지 않은 데이터/로직 영역

- `lib/calendar-event-provider.ts` — provider/cache fallback 순서 변경 없음
- `lib/calendar-cache.ts` — cache TTL/read/write 변경 없음
- `lib/calendar-event-identity.ts` — canonical/legacy ID 생성 변경 없음
- `lib/mock-calendar-data.ts` — mock 데이터 변경 없음
- `lib/firebase/firestore-repositories.ts` — Firestore 저장 구조 변경 없음
- `lib/storage-keys.ts` — 저장 키 변경 없음
- DividendCalendarPage의 meta resolve/persist 로직 변경 없음
- 이벤트 타입 mapping 로직 변경 없음

## 검증 결과

| 명령 | 결과 |
|------|------|
| `npm run typecheck` | pass |
| `npm run lint` | pass (no warnings/errors) |
| `npm run build` | pass (14 pages) |
| `npm run check:calendar-provider` | pass |
| `npm run check:portfolio-parser` | pass |
| `npm run check:portfolio-parser:private` | pass |

## 남은 UI 이슈

1. 실제 브라우저에서 320px/390px 모바일 시뮬레이션 필요 (build 기반 확인만 완료)
2. 월간 grid에 이벤트가 10개 이상인 날의 실제 렌더링 확인 필요
3. dialog에서 매우 긴 메모 입력시 스크롤 동작 확인 필요
4. 다크모드 컬러 대비 접근성(WCAG AA) 정밀 확인 미완

## 다음 단계 추천

1. **Step 5A-6**: 커스텀 이벤트 추가 UI (사용자가 직접 ex-div/pay 일정 등록)
2. **Step 5B**: TaxSavingTable 실제 계산 연결
3. **Step 5C**: Economic calendar 이벤트 통합
4. **Step 5D**: Firestore 동기화 고도화 (meta migration)
