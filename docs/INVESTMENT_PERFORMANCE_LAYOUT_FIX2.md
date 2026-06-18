# INVESTMENT-PERFORMANCE-LAYOUT-FIX-2

PR #87 (`PERFORMANCE-VALUE-CHART-UI-1`) 이 의도한 `/performance` 레이아웃
(상단 KPI 7개, 좌 도넛 / 우 "평가금 추이", 배당 막대 2종)은 올바른 방향이었으나,
"평가금 추이" 차트가 화면에서 사라지는 버그 때문에 PR #89 로 revert 되었다.
이 작업은 동일한 레이아웃을 유지하되 차트가 항상 렌더되도록 고친 재시도이다.

## 1. 수정 전 문제

- `xl`(1280px) 미만 폭에서 "평가금 추이" 차트가 보이지 않음 (높이 0 으로 붕괴).
- KPI/도넛/표는 정상인데 우측 추이 차트만 사라져 레이아웃이 깨져 보임.

## 2. 원인

- `QldValueFxChart` 의 차트 컨테이너가 `h-[440px] w-full flex-1` 를 함께 사용.
- `flex-1` 은 `flex-basis: 0%` 를 강제하므로 `h-[440px]` 가 무시된다.
- 카드는 `flex h-full flex-col`. `xl` 그리드(stretch)에서는 도넛 카드 높이에 맞춰
  늘어나 차트가 채워지지만, `xl` 미만 단일 컬럼에서는 부모 높이가 content-auto 라
  `flex-basis: 0` 차트가 0 높이로 붕괴 → Recharts `ResponsiveContainer height="100%"`
  가 0px 를 측정해 아무것도 그리지 못함.
- 도넛은 고정 픽셀 크기(148px)라 영향이 없었다.

## 3. 읽은 파일

- `app/performance/page.tsx`
- `components/qld/QldValueFxChart.tsx`
- `components/qld/QldAssetSummaryCard.tsx`
- `components/performance/PerformanceAllocationDonut.tsx`
- `lib/performance-dividend-bars.ts`
- PR #87(`abf8473`) / PR #89 diff

## 4. 변경 파일

- `components/qld/QldValueFxChart.tsx` (1줄): 차트 컨테이너 높이 클래스를
  `h-[440px]/h-[210px]` → `min-h-[440px]/min-h-[210px]` 로 변경.
  - `min-h` 는 구체적인 최소 픽셀 높이를 보장하므로 모든 폭에서 차트가 보인다.
  - `flex-1` 은 유지하여 `xl` 에서는 도넛 카드 높이에 맞춰 균형 있게 늘어난다.

## 5. 도넛그래프 구조

- `QldAssetSummaryCard` → `PerformanceAllocationDonut`. 독립된 `rounded-[18px]`
  카드/경계선 박스. 변경 없음. 평가금 추이 차트와 합치지 않음.

## 6. 평가금 추이 구조

- `QldValueFxChart`. 독립된 `rounded-[18px]` 카드/경계선 박스. 제목 "평가금 추이".
- 평가액(area) + 누적투자원금(line) + 배당 막대만 표시. 환율/별도 막대그래프 없음.

## 7. 배당 막대 구현 방식

- 스냅샷마다 막대 2개:
  - 왼쪽: 위탁 연간예상배당(초록, `stackId="annual"`).
  - 오른쪽: stack — 하단 위탁 환산예상배당(파랑) + 상단 절세 환산예상배당(겨자),
    `stackId="converted"`.
- 툴팁: 절세 환산예상배당 / 위탁 환산예상배당 / 합산 환산예상배당 / 위탁 연간예상배당
  모두 표시.

## 8. 브라우저 검증

- 1440px(xl), 1100px(xl 미만) 모두에서 "평가금 추이" 차트 surface 994×440 렌더 확인.
- bar rectangle 18개(6 스냅샷 × 3 시리즈), line 1, area 1.
- 상단 KPI 정확히 7개(투자 평가금액/누적투자원금/누적 손익/누적 수익률/최고점/최저점/MDD),
  CAGR 등 신규 카드 없음. 609,624,228원 아래에 신규 카드 추가 없음.
- 수정 전(pre-fix) 1100px 에서는 recharts surface 0개(차트 미렌더) 확인.

## 9. 최종 결과

- 도넛 / 평가금 추이 모두 독립 박스로 렌더되고, 모든 폭에서 차트가 보인다.
- 금지 사항(신규 KPI/카드/섹션/박스 병합 등) 위반 없음. 변경은 1줄 높이 클래스 수정뿐.
</content>
</invoke>
