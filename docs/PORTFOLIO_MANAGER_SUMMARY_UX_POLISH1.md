# PORTFOLIO-MANAGER-SUMMARY-UX-POLISH-1

`/portfolio-manager` 화면의 **파싱 결과 요약 카드 / 스냅샷 상세 / 보유종목 소액 항목**
표시를 정리한 UI·레이아웃 polish 작업이다. parser 원천 로직, 저장 schema,
Firestore/Auth, 전역 계산 정책은 건드리지 않았다.

## 작업 전 구조 분석

| 항목 | 위치 |
| --- | --- |
| `파싱 결과 요약` 카드 렌더 | `components/portfolio/PortfolioParsePreview.tsx` (상단 3-카드 중 세 번째) |
| 요약 값 source | `ParseResult` (`lib/banksalad-parser.ts`) / 스냅샷은 `PortfolioSnapshot` |
| `총 부채`·`순자산`·`평가금액 합계` 라벨 정의 | `PortfolioParsePreview.tsx` 의 `<Metric>` 라벨 (하드코딩) |
| 현금/KRW/USD 합계 source | `FinanceAsset.category` (`현금`/`예적금`), `lib/banksalad-parser.ts` `classifyAsset` |
| 과거 스냅샷 도넛 렌더 | `components/portfolio/PortfolioPage.tsx` `previewSnapshot` 블록 + `AssetAllocationDonut` |
| 보유종목 리스트 렌더 | `components/portfolio/HoldingsTable.tsx` (모바일 카드 + 데스크톱 표) |
| 소액 필터 가능 지점 | `HoldingsTable` 렌더 직전 (표시 단계) |

## 변경 사항

### 1. 파싱 결과 요약 카드 재사용/오버플로우 정리
- 3x3 요약 그리드를 **`components/portfolio/ParseSummaryCard.tsx`** 로 분리해
  파싱 직후(`PortfolioParsePreview`)와 스냅샷 상세에서 같은 컴포넌트를 재사용한다.
- view model: **`lib/portfolio-parse-summary.ts`**
  - `ParseSummaryModel`, `parseSummaryFromResult(result)`, `parseSummaryFromSnapshot(snapshot)`
  - 두 source 를 같은 모델로 환산해 동일 카드로 렌더.
- 오버플로우 방지: 각 타일에 `min-w-0` + `truncate` + `whitespace-nowrap`,
  라벨/값/보조줄 모두 `title`(tooltip)로 정확한 값 보존.
- 큰 금액은 기존 helper `formatCompactKrw` 를 감싼 **`formatWonCompact`**(`lib/format.ts`)
  로 축약 표기(`₩ 6.79억`)하고, tooltip 에 `formatWon` 전체 금액을 노출.

### 2. 3x3 grid 정책
```
총 금융자산      투자자산 합계    현금자산
투자원금 합계    수익금          수익률
인식 보유종목    제외 항목        보강 필드
```
- grid class: `grid-cols-2 md:grid-cols-3` (desktop 3열x3행, mobile 2열 wrap).
- 카드 컨테이너 `min-w-0` 로 grid/flex 안에서도 폭이 줄어들 때 타일이 잘리지 않게 함.

### 3. 부채/순자산 제거 → 현금자산
- **`총 부채` 카드 제거**: 사용자는 부채를 관리하지 않음. 내부 데이터(`totalDebtKRW`)는
  그대로 두고 UI 에서만 미표시.
- **`순자산` → `현금자산`**: `computeCashAssetKRW(financeAssets)` =
  부채가 아니고 `category` 가 `현금`/`예적금` 인 재무자산 합계.
  현금성 source 가 전혀 없으면(빈 배열/undefined 또는 현금/예적금 분류 0건) `—` 표시.

### 4. 명칭 정리
- `평가금액 합계` → `투자자산 합계`
- `순자산` → `현금자산`
- `총 부채` 제거
- 유지: `총 금융자산`, `투자원금 합계`, `수익금`, `수익률`, `인식 보유종목`, `제외 항목`, `보강 필드`
- 개발자 필드명(`financeAssets`, `principalKRW` 등)은 화면에 노출하지 않음.
- `/portfolio` 의 `투자 평가금액`·`현금성/기타 자산` 명칭은 변경하지 않음(충돌 없음).

### 5. 과거 스냅샷 상세 도넛 옆 요약
- `PortfolioPage` 의 `previewSnapshot` 블록을 `lg:grid-cols-2` 로 바꿔
  **왼쪽 자산군 도넛 + 오른쪽 `ParseSummaryCard`(스냅샷 기준)** 를 나란히 표시.
- mobile 에서는 세로 stack. 선택된 스냅샷 값 기준이며 누락 필드는 `—`.
- 현재 값으로 대체하지 않고 선택 스냅샷의 값만 사용. 스냅샷 없으면 기존 empty state 유지.

### 6. 소액 항목 UI 숨김
- helper: **`lib/portfolio-small-holdings.ts`**
  - `SMALL_HOLDING_THRESHOLD_KRW = 200000`
  - `isHiddenSmallHolding(h)`: ① `#소액`/`소액` 태그·이름 → 숨김, ② `valueKRW` 가 양수이고
    20만원 미만 → 숨김, ③ 금액이 없고(0/누락) 소액 태그도 없으면 표시.
  - `splitSmallHoldings(holdings)` → `{ visible, hidden, hiddenCount }`.
- `HoldingsTable` 은 `visible` 만 렌더하고, 숨긴 개수를 `소액 N개 숨김` 칩으로 표시.
- **표시 단계 전용 필터**다. parser/저장 데이터는 삭제·변경하지 않으며,
  스냅샷 등록(selection)에는 영향을 주지 않는다.

## 현금자산 계산 source
- `FinanceAsset.category` 가 `현금` 또는 `예적금` 이고 `isDebt !== true` 인 항목의
  `amountKRW` 합계.
- 분류는 `lib/banksalad-parser.ts` `classifyAsset` 의 기존 휴리스틱을 그대로 사용
  (자유입출금/현금/통장/CMA/파킹 → 현금, 적금/예금/저축성 → 예적금).

## 테스트
```bash
npm run check:portfolio-manager-summary-ux   # 신규
npm run check:portfolio-parser
npm run check:asset-map
npm run check:asset-map-etf-decomposition
npm run check:portfolio-realdata
npm run lint
npm run typecheck
npm run build
```
회귀(선택): `check:market-data-real`, `check:calendar-provider`, `check:dividend-estimates`.

신규 check(`scripts/check-portfolio-manager-summary-ux.mjs`) 검증 항목:
- `총 부채`/`순자산`/`평가금액 합계` 제거, `현금자산`/`투자자산 합계` 존재
- 3x3 grid + overflow 방지 class
- 스냅샷 상세 도넛 옆 `ParseSummaryCard` 렌더 경로
- 소액 필터(`splitSmallHoldings`)·현금자산 view model 기능 테스트

## 남은 한계 / 후속 작업
- **parser 원천 소액 제외는 후속 Codex 작업**이다. 이번 작업은 `/portfolio-manager`
  보유종목 리스트 **표시 단계**에서만 소액 항목을 숨긴다. 저장된 스냅샷/파싱 데이터에는
  여전히 소액 항목이 포함된다.
- **현금자산은 KRW 환산 합계**다. USD 현금이 parser 단계에서 `현금`/`예적금` 으로
  분류되지 않은 경우(예: `기타`) 합계에서 빠질 수 있다. 정밀 통화 분리는 후속 과제.
