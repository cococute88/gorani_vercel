# PORTFOLIO-PERF-UI-1 — `/portfolio` · `/performance` 정보구조 정리

작업일: 2026-06-14
유형: 정보구조(IA) / UI 정리 (데이터 엔진 변경 없음)

## 1. 읽은 파일

- `app/portfolio/page.tsx`
- `app/performance/page.tsx`
- `components/PortfolioSummary.tsx`
- `components/PerformanceChart.tsx`
- `components/AssetAccountCards.tsx`
- `components/DonutChartCard.tsx`
- `components/TreemapMock.tsx`
- `components/qld/QldValueFxChart.tsx`
- `components/qld/QldAssetSummaryCard.tsx`
- `components/qld/QldAccountBarChart.tsx`
- `components/portfolio/PortfolioPage.tsx` (= `/portfolio-manager`)
- `components/common/StorageModeBadge.tsx`
- `components/theme/ThemeProvider.tsx`
- `lib/portfolio-aggregate.ts`
- `lib/portfolio-tags.ts`
- `lib/portfolio-types.ts`
- `lib/use-portfolio-view.ts`
- `lib/mockData.ts` (`ACCOUNT_CARDS`, `PERFORMANCE_KPIS`, `PERFORMANCE_SERIES`, `ACCOUNT_ALLOCATION`)
- `app/globals.css` (`.light` 다크표면 remap 레이어)
- `package.json` (check 스크립트)
- `docs/AUDIT.md`, `docs/THEME1_*`, `docs/THEME2_*`

## 2. 작업 전 `/portfolio` · `/performance` 구조

### `/portfolio` (변경 전)

1. 헤더(포트폴리오 현황) + 미니 티커 strip + 환율 + 스냅샷 일자
2. 스냅샷 실데이터/목업 안내 배너
3. `PortfolioQuoteStatusPanel` (스냅샷 기준)
4. `PortfolioSummary` (요약)
5. 도넛 3종 (계좌별/종목별/목적별 비중)
6. `QldAccountBarChart`(계좌별 평가금액) + `QldValueFxChart`(총 평가금액 및 환율 추이) — **mock**
7. `TreemapMock`(배당/성장) + `AssetAccountCards`(계좌 현황, 단일 혼합 섹션)

### `/performance` (변경 전)

1. 헤더(투자 성과) + MD복사/데이터입력 버튼
2. KPI 6종 (`PERFORMANCE_KPIS`)
3. `현황 / 시뮬레이션 · 목표` 탭 strip (시뮬/목표 탭은 미사용·빈 동작)
4. `PerformanceChart` — 누적원금·평가액·배당금·**임대소득(rent)** 포함
5. "포트폴리오 평가 대시보드" 섹션: `QldAssetSummaryCard` + `QldValueFxChart` + `QldHoldingsRankTable`

## 3. real vs mock/static 판정

| 섹션 | 데이터 출처 | 판정 |
| --- | --- | --- |
| `PortfolioSummary` | `usePortfolioView()` | 스냅샷 있으면 real, 없으면 목업 폴백 |
| 도넛 3종 | `usePortfolioView()` | 스냅샷 기반 real (폴백 mock) |
| `AssetAccountCards` | `usePortfolioView().accountCards` | 스냅샷 기반 real (폴백 mock) |
| `PortfolioQuoteStatusPanel` | 스냅샷 holdings | real |
| `QldAccountBarChart` | `qldDashboardData` | **mock/static** |
| `QldValueFxChart` | `qldDashboardData` | **mock/static** |
| `QldAssetSummaryCard` | `qldDashboardData` | **mock/static** |
| `QldHoldingsRankTable` | `qldDashboardData` | **mock/static** |
| `TreemapMock` | `TREEMAP_DATA` | **mock/static** |
| `PERFORMANCE_KPIS` / `PERFORMANCE_SERIES` | `mockData.ts` (시드 난수) | **mock/static** |
| 미니 티커 strip (`PIN_TICKERS`) | `mockData.ts` | **mock/static** |

### 공유(중복) 컴포넌트

- `QldValueFxChart`(총 평가금액 및 환율 추이) 가 `/portfolio`(compact) 와 `/performance`(full) **양쪽에서 동시에** 렌더링되어 중복이었다.

## 4. 새 `/portfolio` 역할 — 현재 스냅샷 개요

현재 보유/배분/계좌 현황 스냅샷에 집중한다. mock QLD 시계열 차트를 제거하여 "현재 상태" 페이지로 정리.

새 구조:

1. 헤더 + 티커 strip + 환율 + 스냅샷 일자
2. 스냅샷 실데이터/목업 안내
3. `PortfolioQuoteStatusPanel`
4. `PortfolioSummary`
5. 도넛 3종 (계좌별/종목별/목적별 비중)
6. **계좌 현황: 위탁 / 절세 분리** (`AssetAccountCards`, 스냅샷 기반)
7. 하단 분석 블록 — `TreemapMock` (배당/성장 분석, `샘플 데이터` 배지)

제거: `QldAccountBarChart`, `QldValueFxChart`(중복 + 시계열 → `/performance` 소속).

## 5. 새 `/performance` 역할 — 시간에 따른 성과 분석

1. 헤더 + `샘플 데이터` 배지 + "실데이터 연결 전 샘플 그래프입니다" 안내문
2. KPI 6종
3. `PerformanceChart` (누적투자원금 · 평가액 · 배당금) — 라이트/다크 테마 대응
4. "평가금액 · 환율 추이 분석" 섹션(`샘플 데이터` 배지): `QldAssetSummaryCard` + `QldValueFxChart` + `QldHoldingsRankTable`

`QldValueFxChart` 는 이제 `/performance` 에만 존재하여 중복 해소.

## 6. 계좌 분류 로직 (위탁 / 절세)

신규 헬퍼: `lib/account-status-group.ts`

- `classifyAccountStatusGroup({ name, type, statusGroup, tax })` → `"위탁" | "절세" | "미확인"`.
- 절세 신호: `ISA, 연금저축, 미래연금, 퇴직연금, IRP, 연금, 절세, 비과세`.
- 위탁 신호: `위탁, 일반, 해외주식, 국내주식, 예수금, 현금, 과세`.
- **순서 주의**: `비과세 ⊃ 과세` 문자열 충돌을 피하려고 절세 신호를 먼저 검사한다.
- 어떤 신호도 없으면 추측하지 않고 `"미확인"` 으로 두고, `분류 미확인 계좌` 그룹에 모아 표시한다(현재 mock/live 데이터에서는 비어 있음).
- mock(`ACCOUNT_CARDS`) 과 live(`accountCards`) 모두 동일 헬퍼로 분류된다.

`AssetAccountCards` 는 그룹별로 제목 + 계좌 수 + 합산 평가금액 + 합산 손익 + 반응형 카드 grid 를 라이트/다크 모두 대응하여 렌더링한다.

검증 결과(현재 데이터):

- 위탁 계좌 현황 (4개): 미국주식 / 일본주식 / 국내주식 / 현금 → ₩694,800,000
- 절세 계좌 현황 (3개): 연금저축 / ISA / 퇴직연금 → ₩306,600,000 (비과세)

## 7. 미사용 탭 제거 결과

- `/performance` 의 `현황 / 시뮬레이션 · 목표` 탭 strip 과 관련 `useState<"status"|"sim">` 상태를 제거했다.
- 사용자가 쓰지 않는 시뮬/목표 탭의 죽은 UI가 더 이상 노출되지 않는다.
- 시뮬레이션/목표 관련 별도 백엔드 코드는 존재하지 않아 제거할 위험 코드가 없었다 (이 페이지에는 탭 UI만 존재).

## 8. 임대소득(rent) 차트 제거 결과

- `PerformanceChart` 에서 `dataKey="rent"`(임대소득) `Bar` 와 범례를 제거했다.
- 차트 제목을 `누적투자원금 · 평가액 · 배당금` 으로 변경.
- **데이터 스키마는 유지**: `mockData.ts` 의 `PERFORMANCE_SERIES` 는 `rent` 필드를 그대로 보존하며, 렌더링에서만 제외했다.

## 9. 중복 대시보드 처리 결과

- `QldValueFxChart` 를 `/portfolio` 에서 제거하여 `/portfolio`(현재 스냅샷) ↔ `/performance`(시계열 분석) 역할 중복을 없앴다.
- 사용자에게 보이던 중요한 콘텐츠는 삭제하지 않고 명확한 제목/`샘플 데이터` 배지와 함께 한쪽(`/performance`)으로 이동·정리했다.

## 10. 라이트/다크 검증

- THEME-2 의 `app/globals.css` `.light` 레이어가 bare 다크 표면(`bg-[#191f20]`, `bg-[#12151e]`, `bg-[#1e2324]` 등)을 라이트 표면으로 remap 한다 → QLD 카드/트리맵 컨테이너가 라이트 모드에서 흰 카드로 표시됨을 확인.
- `PerformanceChart` 는 Recharts의 grid/axis/tooltip 색상이 JS prop 이라 전역 CSS로 보정 불가하므로 `useResolvedTheme()` 기반으로 직접 테마 대응시켰다(라이트 모드 tooltip/grid 가독성 개선).
- `AssetAccountCards` / `SampleBadge` 는 라이트/다크 모두 대응.
- 라이트·다크 양쪽에서 계좌 분리, 도넛, 차트, 표가 읽힘을 스크린샷으로 확인.

## 11. 반응형 검증

`/portfolio`, `/performance` 에서 페이지 레벨 가로 오버플로 없음:

| 폭 | `/portfolio` | `/performance` |
| --- | --- | --- |
| 320px | overflow=false | overflow=false |
| 390px | overflow=false | — |
| 780px | overflow=false | overflow=false (765/780) |
| desktop(1280) | OK | OK |

추가 스팟체크(320px): `/dividends` overflow=false, `/portfolio-manager` overflow=false.
계좌 카드 grid: `grid-cols-2 sm:grid-cols-3 xl:grid-cols-4`.

## 12. 회귀 검증

- `npm.cmd run typecheck` ✓
- `npm.cmd run lint` ✓ (No ESLint warnings or errors)
- `npm.cmd run build` ✓ (14/14 정적 페이지 생성)
- `npm.cmd run check:korean-etf` ✓
- `npm.cmd run check:dividend-holdings` ✓
- `npm.cmd run check:asset-map` ✓
- `npm.cmd run check:tax-saving` ✓
- `npm.cmd run check:calendar-provider` ✓
- `npm.cmd run check:portfolio-parser` ✓
- `npm.cmd run check:portfolio-parser:private` ✓
- 콘솔 에러: 신규 에러 없음. Recharts `defaultProps` deprecation 경고만 잔존(기존 알려진 이슈).

## 13. 남은 한계

1. `/performance` 전체와 `/portfolio` 의 트리맵/티커 strip 은 여전히 mock/static (이번 단계는 IA 정리이며 데이터 엔진은 미변경). `샘플 데이터` 배지로 명시.
2. `QldValueFxChart`/`QldAssetSummaryCard`/`QldHoldingsRankTable` 의 일부 내부 tooltip 색(`bg-[#161a25]` 등)은 전역 remap 목록에 없을 수 있어 라이트 모드에서 다크 tooltip 이 보일 수 있음 — sample 영역이라 이번 범위에서 제외.
3. 계좌 분류는 이름/타입/세금 신호 문자열 기반 휴리스틱. 신호 없는 계좌는 `분류 미확인` 으로 남기며, 계좌 레벨 메타데이터가 보강되면 더 정확해진다.
4. `분류 미확인` 그룹은 현재 mock/live 데이터에서 비어 있어 화면상 노출되지 않음(데이터에 따라 자동 노출).

## 14. 다음 권장 단계

- `/performance` 의 시계열(평가액/원금/배당 추이)을 `portfolio-store` 스냅샷 히스토리(`SnapshotHistoryRow`) 기반 실데이터로 연결 (PERF-DATA 단계).
- `QldValueFxChart`/`QldAssetSummaryCard`/`QldHoldingsRankTable` 의 내부 tooltip/축 색을 `useResolvedTheme` 기반으로 마저 테마 대응.
- 계좌 분류 신호를 파서/스냅샷 메타데이터(②계좌/④현황 태그)로 보강하여 `분류 미확인` 케이스 최소화.
