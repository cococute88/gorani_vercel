# ASSET-CLASS-DONUT-POLISH-2

직전 작업(PORTFOLIO-TREEMAP-TO-STREAMLIT-DONUT-1 / PERFORMANCE-DONUT-RANKING-1)으로 추가한
Streamlit 방식 자산군 도넛의 후속 polish. 새 기능 없이 기존 helper/component만 최소 수정한다.

## 1. 작업 전 문제 원인 요약

- `/portfolio` "보유 자산군 분석" 도넛(`AssetClassDonut`)이 현금성 자산을 `현금` / `예적금`
  두 라벨로 쪼개서 노출했고, `예적금` 색이 하늘색(`#06b6d4`)이라 `기타`와 혼동됐다.
- `/performance` "자산 구성" 도넛(`PerformanceAllocationDonut`)도 동일하게 `현금` / `예적금`이
  별도 라벨로 떴다.
- `/performance` 큰 KPI 라벨이 `총 평가금액`이라 `/portfolio`의 "총 금융자산"과 혼동됐다.
  (실제 값은 스냅샷 **투자 평가금액** 기준.)
- `/portfolio-manager` 스냅샷 선택 도넛이 max-width 제한 없이 전체 폭을 써서, 와이드 화면에서
  도넛과 범례 사이가 과도하게 벌어졌다.

## 2. 현금성 라벨 정책 (요청 1·2·4)

`/portfolio`와 `/performance` 도넛이 동일한 정책을 쓴다.

- **달러**: USD / `달러` / 외화 / `$` 신호가 있는 현금성 자산.
- **원화**: KRW / `원화` / 예적금 / 현금성 원화 자산(예수금·CMA·MMF·파킹·RP 등). 구분 불가한
  현금성 자산도 보수적으로 `원화`로 합산.
- `현금` / `예적금`은 더 이상 별도 자산군 라벨로 노출하지 않는다.
- 예: `예적금 6,318만 + 원화 현금 152만 → 원화 6,470만`. `달러`는 합치지 않고 별도 유지.

## 3. 색상 정책 (요청 3)

`/portfolio`(`asset-class-allocation.ts`)와 `/performance`(`performance-asset-group.ts`)에서 동일.

| 자산군 | 색상 | 비고 |
| --- | --- | --- |
| TQQQ | `#B71C1C` | 진빨강 |
| QLD | `#E53935` | 빨강 |
| QQQ | `#EC407A` | 핑크·빨강 |
| SPY | `#FB8C00` | 주황 |
| SCHD | `#FDD835` | 노랑 |
| MSFT | `#F9A825` | 진노랑 |
| 달러 | `#2E7D32` | 진한 연두(진초록) |
| 원화 | `#7CB342` | 연두 |
| 기타 | `#38BDF8` | 하늘색 (오직 기타만) |

하늘색은 오직 `기타`에만 사용한다. `예적금`이 하늘색으로 잡히던 문제는 라벨 자체를 `원화`로
통합하면서 사라졌다.

## 4. `/performance` 라벨 명확화 (요청 5)

- 큰 KPI 라벨 `총 평가금액` → `투자 평가금액` (`QldAssetSummaryCard.tsx`).
- 차트 제목 `총 평가금액 및 환율 추이` → `투자 평가금액 및 환율 추이` (`QldValueFxChart.tsx`).
- 섹션 제목 `평가금액 · 환율 추이 분석` → `투자 평가금액 · 환율 추이 분석` (`app/performance/page.tsx`).
- 총액 **계산 자체는 변경하지 않았다**. 라벨 혼동만 줄였다. 총액 정합성은 후속 Codex 작업
  `PORTFOLIO-TOTALS-RECONCILE-1`에서 별도 처리.

## 5. `/portfolio-manager` 스냅샷 도넛 폭 (요청 6)

- 스냅샷 선택 후 표시되는 `AssetAllocationDonut` 카드를 `max-w-[520px]`로 제한해, 상단 3-카드 중
  가운데 "자산군 비중" 카드와 비슷한 밀도로 보이게 했다.
- 모바일(<sm)에서는 max-width가 뷰포트보다 커서 기존처럼 자연스럽게 세로 배치되며,
  `w-full min-w-0`로 320px/390px 가로 overflow가 없다.

## 6. 변경 파일

- `lib/asset-class-allocation.ts` — `AssetClassName`에서 `현금`/`예적금` 제거, `원화` 추가.
  현금성 분류·색상 정책 갱신.
- `lib/performance-asset-group.ts` — `PerformanceGroupKey`에서 `현금`/`예적금` 제거, `원화` 추가.
  분류·순서·색상 갱신.
- `components/qld/QldAssetSummaryCard.tsx` — KPI 라벨 `투자 평가금액`.
- `components/qld/QldValueFxChart.tsx` — 차트 제목 `투자 평가금액 및 환율 추이`.
- `app/performance/page.tsx` — 섹션 제목 `투자 평가금액 · 환율 추이 분석`.
- `components/portfolio/PortfolioPage.tsx` — 스냅샷 도넛 `max-w-[520px]` 제한.
- `scripts/check-performance-donut-ranking.mjs` — `원화` 통합 라벨로 회귀 테스트 갱신.
- `scripts/check-asset-class-donut-labels.mjs` (신규) — `/portfolio` 도넛 현금성 라벨 정책 회귀 테스트.
- `package.json` — `check:asset-class-donut-labels` 스크립트 추가.

## 7. 범위 밖(미변경)

- `lib/asset-allocation-donut.ts`(`/portfolio` 가운데 "자산군 비중" 3-카드, `/portfolio-manager`
  3-카드/스냅샷 도넛의 분류) — 이 카드는 기존 `현금` 라벨/슈퍼그룹 정렬을 유지한다.
  요청 1~4의 라벨 정책은 명시적으로 `/portfolio` "보유 자산군 분석"과 `/performance` "자산 구성"
  도넛만 대상으로 했다.
- `/market` 실데이터, 캘린더/Auth/Firestore/배당/asset-map ETF decomposition — 범위 밖.
- 총액 계산 정합성 — 후속 `PORTFOLIO-TOTALS-RECONCILE-1`.

## 8. 검증 결과

- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run build` ✓
- `npm run check:portfolio-realdata` ✓
- `npm run check:portfolio-ux-rules` ✓
- `npm run check:performance-donut-ranking` ✓ (원화 통합 반영)
- `npm run check:asset-class-donut-labels` ✓ (신규)
- `npm run check:asset-allocation-donut` ✓ (미변경 회귀)
- `npm run check:portfolio-totals-reconcile` ✓
