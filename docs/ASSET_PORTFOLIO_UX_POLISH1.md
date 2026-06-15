# ASSET-PORTFOLIO-UX-POLISH-1

자산시뮬레이터 입력 밀도 개선 + 포트폴리오 트리맵/라벨/스크롤바 라이트모드 수정.

날짜: 2026-06-15
범위: `/asset-simulator`, `/portfolio` UI/UX polish (1~4번). 시장현황 실데이터 연결은 제외.

---

## 1. 자산 시뮬레이터 입력 UI (`/asset-simulator`)

- 기본 설정 입력폼 그리드를 한 줄 3개 → **desktop/wide 4개**로 변경해 세로 공간을 절약.
  - `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (mobile 1 / tablet 2 / desktop·wide 4).
- `초기화` 버튼 **왼쪽에 `Save` 버튼**을 추가.
  - Save 는 현재 입력값/계획표를 즉시 localStorage(로그아웃) 또는 Firestore(로그인)에 저장.
  - 저장 직후 `저장됨` 상태 텍스트를 2초간 표시.
  - mobile 에서 두 버튼은 `flex-1` 로 한 줄에 들어가며 overflow 없음.
- 입력 순서·계산 로직·기본값·기존 reset 동작은 그대로 유지.
  - 기존 useEffect 자동 저장은 유지하고, Save 는 명시적 즉시 저장 + 사용자 피드백을 위한 추가 경로.

변경 파일:
- `components/asset-simulator/SimulatorInputPanel.tsx` (그리드, Save 버튼, `저장됨` 상태)
- `components/asset-simulator/AssetSimulatorPage.tsx` (`handleSave` → `onSave` prop)

---

## 2. 보유종목 트리맵 비율 (`/portfolio`)

- 트리맵 타일 면적을 **전역 `valueKRW` 비중**에 비례시킴.
  - 기존: 그룹(위탁/절세)별 합계로 정규화 → 작은 그룹의 종목이 큰 그룹 종목과 비슷한 크기로 보여 비율이 왜곡.
  - 변경: `flex-grow = valueKRW`, 목표 폭(basis)·최소 높이를 **전역 weightPct** 기준으로 산정.
    - basis: `clamp(88px, weightPct%, 100%)`
    - minHeight: `clamp(56px, 52 + weightPct*4, 190px)` → 큰 비중일수록 확실히 높고 넓게.
  - 위탁/절세 그룹 라벨 구분은 유지하되, 사이징은 전역 비중을 사용해 그룹 간 비교가 일관됨.

### 2% 미만 제외

- 전체 평가금액 대비 **비중 2% 미만 종목은 트리맵 표시에서만 제외** (`TREEMAP_MIN_WEIGHT_PCT = 2`).
- 제외 항목을 `기타`로 묶지 않음.
- 합계/랭킹/요약 수치(`holdingsRankingRows`, summary KPI)는 원본 snapshot 기준 그대로 유지 — 트리맵 표시에만 적용.

변경 파일:
- `lib/portfolio-from-snapshots.ts` (`buildTreemapAndRanking` 의 `treemapItems` 에 2% 필터)
- `components/PortfolioTreemap.tsx` (사이징)

---

## 3. 트리맵 색상 정책

`lib/treemap-color.ts` 의 `treemapColorCategory({ name, ticker })` 가 4개 카테고리로 분류:

| 카테고리 | 색상 | 신호 |
| --- | --- | --- |
| nasdaq | red | TQQQ/QQQ/QQQM/QLD, 이름에 `나스닥`/`NASDAQ` |
| cash | green | 현금/예수금/MMF/CMA/달러/파킹, SGOV/BIL/CASH_LIKE |
| sp | yellow | SPY/SPYM/VOO/IVV/SCHD/MSFT, `S&P`/`SP500`/`에스앤피` |
| other | blue | 위 외 전부 |

- 기존 트리맵은 수익률 기반 색(`rateColor`)이었으나, 요구에 맞춰 카테고리 색으로 교체.

### 라이트/다크 가독성

`TREEMAP_CATEGORY_CLASSES` 가 테마별 클래스 제공:
- **라이트**: `bg-{red|green|yellow|blue}-100` + `text-slate-900` — 연한 배경에 검은 글씨가 잘 보임 (기존 강한 붉은 배경에 검은 글씨가 안 보이던 문제 해결).
- **다크**: `bg-{red-600|emerald-600|amber-500|blue-600}/85` + `text-white` — 기존처럼 선명한 진한 배경 유지.
- 타일 보조 텍스트(평가금액·비중)도 라이트는 `text-slate-700`, 다크는 `text-white/80` 로 분기.

---

## 4. KRX 숫자 ticker → 한글 상품명 라벨

`lib/holding-display-label.ts` 의 `holdingDisplayLabel({ name, ticker })` 공유 helper:

우선순위: `cleanName` → `productName` → (숫자가 아닌) `name` → registry 한글명 → ticker fallback.

- `360200.KS`, `367380.KS`, `379780.KS`, `368590.KS`, `360750.KS` 같은 KRX 숫자 티커가
  단독으로 노출되면 `korean-etf-registry` 의 `displayName`(예: `ACE 미국S&P500`)으로 치환.
- 숫자 티커 단독 표시 방지. 라벨이 길면 트리맵에서 `line-clamp-2` 로 1~2줄 truncate.

적용 위치 (동일 helper 재사용):
- 트리맵 타일 라벨 (`components/PortfolioTreemap.tsx`)
- 종목별 비중 상위 15개 도넛/리스트 (`lib/portfolio-from-snapshots.ts` `stockAllocation`)
- 비중 계산 자체는 변경하지 않고 라벨만 개선. 도넛 색상/비율도 변경하지 않음.

---

## 5. 라이트모드 검은 스크롤바 복구

원인: 다수 표/카드 컴포넌트(`HoldingsTable`, `AssetTable`, `SnapshotHistory`,
`PortfolioParsePreview`, 배당/캘린더 테이블 등)가 테마와 무관하게 `scroll-dark` 를 하드코딩.
라이트모드에서 흰 카드 위에 어두운(`#2f3a3d`) 스크롤바가 "검은 스크롤바"로 보였음.

수정 (`app/globals.css`):
```css
.light .scroll-dark::-webkit-scrollbar-thumb { background: #cbd5e1; } /* slate-300 */
.light .scroll-dark::-webkit-scrollbar-track { background: #f8fafc; } /* slate-50 */
.light .scroll-dark { scrollbar-color: #cbd5e1 #f8fafc; }
```
- 라이트 클래스가 적용된 동안에는 `scroll-dark` 도 밝은 중립색으로 분기.
- 다크모드(`.dark`)에서는 기존 어두운 스크롤바 그대로 유지.
- page scrollbar 는 `color-scheme` 가 light/dark 자동 대응(기존 동작 유지).
- 캘린더/tax saving/전체 배당일정 등 모든 `scroll-dark` 컨테이너가 라이트모드에서 밝게 복구됨.

---

## 시장현황 실데이터는 후속 작업

이번 작업에서 제외 (다음 Codex 작업으로 분리):
- `/market` 공포탐욕지수 mock 교체
- RSI/MDD/VIX 실데이터 연결
- 시장현황 API route 추가, yfinance/외부 API 연결

캘린더 UI, Firebase Auth, portfolio snapshot persistence, memo source 로직은 건드리지 않음.

---

## 테스트

신규: `npm run check:asset-portfolio-ux-polish` (`scripts/check-asset-portfolio-ux-polish.mjs`)
검증 항목:
1. asset simulator 입력 그리드 desktop 4-column 클래스
2. Save 버튼이 초기화 왼쪽 + `handleSave` 연결
3. 트리맵 2% 미만 제외(랭킹 유지)
4. 트리맵 라벨 KRX 숫자 티커 → 한글
5. 종목별 비중 상위 라벨 KRX 숫자 티커 → 한글
6. 트리맵 색상 카테고리 매핑
7. 라이트모드 트리맵 색상 클래스 연한(100~200)+slate-900
8. 전역 스크롤바 light/dark 분기 + 라이트 비검정

회귀(통과 확인):
`check:portfolio-realdata`, `check:portfolio-ux-rules`, `check:krx-ticker-name-map`,
`check:asset-map`, `check:tax-saving`, `check:calendar-provider`,
`check:auth-firestore-persistence`, `check:dividend-estimates`, `check:dividends-data`,
`check:performance-qld-snapshots`, `check:korean-etf`.

빌드/품질: `npm run lint`, `npm run typecheck`, `npm run build` 통과.

---

## 변경 파일 목록

- `components/asset-simulator/SimulatorInputPanel.tsx`
- `components/asset-simulator/AssetSimulatorPage.tsx`
- `components/PortfolioTreemap.tsx`
- `lib/portfolio-from-snapshots.ts`
- `lib/holding-display-label.ts` (신규)
- `lib/treemap-color.ts` (신규)
- `app/globals.css`
- `scripts/check-asset-portfolio-ux-polish.mjs` (신규)
- `package.json` (script 등록)
- `docs/ASSET_PORTFOLIO_UX_POLISH1.md` (신규), `docs/AUDIT.md`

---

## 남은 한계

- 트리맵은 flex-wrap 기반의 근사 트리맵이라 픽셀 단위로 정확한 area=value 는 아님(신규 라이브러리 도입 금지 제약). 다만 전역 비중 기반 width+height 스케일로 큰/작은 종목 차이는 명확히 반영됨.
- 한글명 registry 는 현재 미국 S&P500/나스닥100 ETF 5종(360200/367380/379780/368590/360750) 위주. 그 외 KRX 코드는 `cleanName`/`productName` 이 없으면 ticker fallback 으로 남을 수 있음(registry alias 확장은 후속).
- 색상 카테고리는 티커/이름 신호 기반 휴리스틱이라 신규 상품명 패턴은 추가 신호 보강이 필요할 수 있음.
- 시각검증은 헤드리스 환경 제약으로 build/단위 검증으로 대체. Vercel preview 에서 light/dark/390/320px 육안 확인 권장.

## Next step recommendation

- 후속 Codex: `/market` 시장현황 실데이터(공포탐욕/RSI/MDD/VIX) + API route 연결.
- KRX registry alias 확장(추가 ETF/개별주 한글명) + 색상 카테고리 신호 보강.
