# UI-3 — 자산 시뮬레이터 표 스크롤 + 포트폴리오 데스크탑 트리맵/계좌 레이아웃 정리

작업일: 2026-06-14
유형: 레이아웃/UI 정리 (데이터 엔진·분류 로직·테마 아키텍처 변경 없음)
모델: Claude Code Opus

## 1. 읽은 파일

- `components/asset-simulator/AssetSimulatorPage.tsx`
- `components/asset-simulator/YearPlanTable.tsx`
- `components/asset-simulator/SimulatorInputPanel.tsx` (테마/표면 패턴 확인용)
- `app/asset-simulator/page.tsx`
- `app/portfolio/page.tsx`
- `components/AssetAccountCards.tsx`
- `components/TreemapMock.tsx`
- `components/PortfolioSummary.tsx` / `components/DonutChartCard.tsx` (구조 확인)
- `lib/account-status-group.ts` (분류 로직 — 변경하지 않음)
- `lib/mock-asset-simulator-data.ts` (`DEFAULT_YEAR_PLANS`, 기본 `years: 30`)
- `tailwind.config.ts` / `package.json` (Tailwind 3.4.6, 임의 `min-[…]` variant 정렬 확인)
- `app/globals.css` (THEME-2 `.light` 다크표면 remap 레이어)
- `docs/PORTFOLIO_PERFORMANCE_UI1_RESTRUCTURE.md`
- `docs/THEME2_LIGHT_MODE_POLISH_HOTFIX.md`
- `docs/AUDIT.md`

## 2. 작업 전 레이아웃 진단

### `/asset-simulator` — `연도별 투자 계획표`
- 기본 입력 `years: 30` → 계획표가 **30개 연차 행**을 한 번에 모두 렌더링.
- sm+ 표(`YearPlanTable.tsx`)와 모바일 카드 모두 행/카드 수만큼 세로로 끝없이 늘어나 페이지가 과도하게 길어졌다.
- 표 컨테이너는 `overflow-x-auto` 만 있고 세로 max-height/스크롤이 없었다.

### `/portfolio` — 트리맵 / 계좌 그룹
- 하단이 세로 스택: `AssetAccountCards`(위탁/절세) → `배당 / 성장 분석` 트리맵.
- 트리맵 컨테이너는 `max-w-[560px]` 로 좌측에 좁게 배치되어, 넓은 데스크탑에서 우측 가로 공간이 비었다.
- 위탁/절세 계좌 그룹이 트리맵과 멀리 떨어진 위쪽에 따로 있었다.

## 3. 핵심 테마 전제 (THEME-2)

`app/globals.css` 의 `.light` 레이어가 bare 다크 유틸(`bg-[#171d1e]`, `bg-[#111516]`, `border-[#263033]` 등)을 라이트 표면으로 remap한다. 따라서 기존 다크 하드코딩 컴포넌트(YearPlanTable 포함)는 라이트 모드에서도 자동으로 흰/연회색 표면이 된다. 이번 작업은 **이미 remap 목록에 있는 색만 사용**하고 새로운 색을 도입하지 않아 THEME-2를 건드리지 않는다. 네이티브 스크롤바는 `:root`/`.dark` 의 `color-scheme` 를 따라 라이트/다크 자동 대응하므로 커스텀 스크롤바 클래스가 필요 없다.

## 4. 자산 시뮬레이터 스크롤 구현 (`components/asset-simulator/YearPlanTable.tsx`)

### sm+ 표 (데스크탑/태블릿)
- 표 래퍼를 `overflow-x-auto` → `max-h-[556px] overflow-auto` 로 변경.
  - 1280px에서 측정한 행 높이(약 51px)+헤더(약 44px) 기준으로 **본문 10행 + 헤더**가 보이도록 556px 산정 (실측: 정확히 10행 fully visible).
  - 넘치는 연차(기본 30년 중 나머지 20년)는 컨테이너 내부에서만 세로 스크롤.
- `<thead>` 에 `sticky top-0 z-10` + 미세 그림자(`shadow-[0_1px_0_0_rgba(0,0,0,0.25)]`) 추가 → 스크롤 중에도 헤더 고정·가독.
- 기존 `min-w-[640px]` 가로 스크롤(모바일 이전 수정) 동작은 그대로 유지.

### 모바일 카드 (sm 미만)
- 카드 리스트 래퍼에 `max-h-[60vh] overflow-y-auto` + 스크롤바 여백(`-mr-1 pr-1`) 추가.
  - 390×844 기준 약 506px 높이, 카드 30장 내부 스크롤 (실측: `canScroll=true`).
  - 카드 내부 레이아웃(월적립 input + ISA/연금저축/연금이전 체크박스 3종)은 변경 없음.

### 변경하지 않은 것
- 시뮬레이터 수식/상태 로직(`lib/asset-simulator.ts`, `AssetSimulatorPage.tsx` 상태) 무변경.
- 입력값·체크박스 핸들러(`updatePlan`/`setMonthly`) 무변경.

## 5. 포트폴리오 데스크탑 레이아웃 구현

### `app/portfolio/page.tsx`
하단 두 섹션(계좌 현황 + 배당/성장 분석)을 반응형 그리드로 묶었다:

```
grid grid-cols-1 gap-6
min-[1300px]:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]
min-[1300px]:items-start
```

- 계좌 현황 `<section>`: `min-[1300px]:col-start-2 min-[1300px]:row-start-1` → 1300px+ 우측 컬럼.
- 트리맵 `<section>`: `min-[1300px]:col-start-1 min-[1300px]:row-start-1` → 1300px+ 좌측 컬럼.
- DOM 순서는 **계좌 → 트리맵** 유지 → 1300px 미만 단일 컬럼에서 기존(계좌 위, 트리맵 아래) 스택 순서 보존.
- 트리맵 컨테이너에 `min-[1300px]:max-w-none` 추가 → 좌측 컬럼을 가득 채워 가로 공간 활용.
- `min-[1300px]:mb-0` 으로 좌우 컬럼 정렬 정돈.

### `components/AssetAccountCards.tsx` — `compact` prop 추가
- `compact?: boolean` (기본 false, 다른 사용처 없음 — `/portfolio` 단독 사용).
- compact일 때 카드 grid가 1300px+ 에서만 2열로 좁아짐:
  - `grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 min-[1300px]:grid-cols-2 min-[1300px]:gap-2`
  - Tailwind 3.4.6은 임의 `min-[1300px]` variant를 min-width 값(1300)으로 정렬해 `xl`(1280) 뒤에 출력 → 1300px+ 에서 2열이 이긴다.
- 카드 패딩도 1300px+ 에서만 축소: `p-3 min-[1300px]:p-2.5`.
- **1300px 미만에서는 compact가 영향 없음** → 320/390/780px 기존 카드 레이아웃(`grid-cols-2 sm:grid-cols-3 xl:grid-cols-4`) 그대로.
- 텍스트 크기·라벨·제목/계좌수/합산 평가·손익·수익률 표시는 변경 없음(가독성 유지).

결과 1300px+ 배치:

```
[ 배당 / 성장 트리맵            ][ 위탁 계좌 현황 (2열 4카드) ]
                               [ 절세 계좌 현황 (2열 3카드) ]
```

## 6. 반응형 동작 결과 (실측)

| 폭 | `/asset-simulator` | `/portfolio` |
| --- | --- | --- |
| 320px | overflow=false, 모바일 카드 내부 스크롤 | overflow=false, 계좌→트리맵 세로 스택 유지 |
| 390px | overflow=false, 카드 max-h≈506px 내부 스크롤 (30장) | overflow=false |
| 780px | overflow=false, 표 10행+sticky 헤더 내부 스크롤 | overflow=false (단일 컬럼) |
| 1280px | overflow=false (sw=1265) | overflow=false, 아직 세로 스택 (1300 미만) |
| 1440px | — | overflow=false, 트리맵 좌 / 위탁·절세 우측 stacked (sideBySide=true, sw=1425) |

- `/portfolio` 1440px 좌표 실측: 트리맵 left=32 right=909, 위탁 left=933/top=344, 절세 left=933/top=620 (위탁 아래 같은 우측 컬럼).

## 7. 라이트/다크 검증

- `/asset-simulator` 표: 라이트(흰 카드·연회색 sticky 헤더·짙은 텍스트), 다크(기존 다크 표면) 모두 10행+헤더 가독. 입력/체크박스 정상.
- `/asset-simulator` 모바일 카드: 다크에서 내부 스크롤·카드 레이아웃 정상.
- `/portfolio` 1440px: 라이트(흰 계좌 카드), 다크(다크 계좌 카드) 모두 트리맵 좌 / 계좌 우 배치 가독.
- THEME-2 `.light` remap 으로 새 래퍼(이미 remap 대상 색 사용)가 라이트 모드에서 다크 패널로 남지 않음을 스크린샷으로 확인. 샘플 배지(`샘플 데이터`)·mock/real 안내 배너 그대로 유지.

## 8. 스팟체크 결과 (320px 기준)

- `/performance`: 렌더 OK, overflow=false.
- `/dividends`: 렌더 OK, overflow=false (스냅샷 미로드 시 빈 상태 안내 정상 — 이번 작업과 무관).
- `/portfolio-manager`: 렌더 OK, overflow=false.

## 9. 검증 커맨드 결과

| 커맨드 | 결과 |
| --- | --- |
| `npm.cmd run typecheck` | ✓ |
| `npm.cmd run lint` | ✓ No ESLint warnings or errors |
| `npm.cmd run build` | ✓ 14/14 정적 페이지 |
| `npm.cmd run check:korean-etf` | ✓ passed |
| `npm.cmd run check:dividend-holdings` | ✓ passed |
| `npm.cmd run check:asset-map` | ✓ passed |
| `npm.cmd run check:tax-saving` | ✓ passed |
| `npm.cmd run check:calendar-provider` | ✓ passed |
| `npm.cmd run check:portfolio-parser` | ✓ passed |
| `npm.cmd run check:portfolio-parser:private` | ✓ passed (holdings 33) |

(빌드는 dev 서버 정지 후 실행.)

## 10. 변경 파일 목록

- `components/asset-simulator/YearPlanTable.tsx` — 표/카드 내부 세로 스크롤 + sticky 헤더.
- `components/AssetAccountCards.tsx` — `compact` prop (1300px+ 2열·축소 패딩).
- `app/portfolio/page.tsx` — 1300px+ 트리맵/계좌 2열 그리드 래퍼.
- `docs/UI3_ASSET_SIMULATOR_AND_PORTFOLIO_LAYOUT_POLISH.md` (신규), `docs/AUDIT.md` (1줄 추가).

## 11. 남은 한계

1. 표/카드 max-height(556px / 60vh)는 1280px 실측 행 높이 기준 고정값이다. 폰트 스케일이 크게 바뀌면 "정확히 10행" 이 ±1행 흔들릴 수 있다(요구사항 "최대 10행"은 항상 충족).
2. 트리맵은 1300px+ 좌측 컬럼을 가득 채우므로 초광폭(예: 1920px, max-w-[1640px])에서 타일이 다소 커진다 — `샘플 데이터` mock 영역이라 이번 범위에서 추가 캡은 두지 않음.
3. `YearPlanTable` 자체는 여전히 bare 다크 색을 쓰고 THEME-2 remap에 의존한다(이번에 흰 카드로 보임 확인). 컴포넌트 단위 `dark:` 페어 전환은 별도 과제.
4. `분류 미확인` 계좌 그룹이 생길 경우 우측 컬럼이 길어질 수 있으나 현재 mock/live 데이터에서는 비어 있어 영향 없음.

## 12. 다음 권장 단계

- `YearPlanTable` / 시뮬레이터 입력 패널의 bare 다크 색을 `dark:` 페어로 명시 전환하여 globals.css remap 의존도 축소.
- 트리맵을 실데이터(스냅샷 배당/성장 노출)로 연결 시 좌측 컬럼 폭/타일 밀도 재튜닝.
- 계좌 카드 compact 레이아웃을 컨테이너 쿼리(`@container`) 기반으로 전환하면 임의 `min-[1300px]` breakpoint 의존을 줄일 수 있음.
