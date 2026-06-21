# 역산 성과 분석 MDD 정확도 개선 + 모바일 카드 UI 정리

## 1. 배경 / 증상

포트폴리오 관리 > 역산 성과 분석 카드의 위험지표(MDD/Calmar/Sharpe/Sortino)가
시장 흐름과 불일치했다. 대표 증상: 6개월 역산에서 QQQ MDD 가 -2.3% 로 표시되나
실제 해당 구간에는 -7% 이상의 하락 구간이 존재.

## 2. 원인 분석

데이터 소스(quote API)는 이미 **일별** 시세를 반환한다(`lib/server/quote-fetchers.ts`
의 daily-density 가드 + `interval=1d, period1/period2` 요청). 문제는 백테스트 계층에 있었다.

- `lib/snapshot-backtest.ts` 의 `buildSnapshotBacktest` 는 차트 렌더링을 위해
  `monthEnds()` 로 **월말 1포인트**만 추려 `result.points`(월별)를 만든다.
- 컴포넌트(`SnapshotBacktestSection.tsx`)가 위험지표를 **이 월별 `result.points`**
  로 계산했다 → 6개월이면 표본이 ~6~7개뿐. 월중에 깊게 빠졌다가 월말에 회복한
  하락(예: 관세 쇼크 V자 반등)은 월말 종가에 흔적이 없어 MDD 가 과소 계산됐다.

즉 **차트용 축약(월별) 데이터를 위험지표 계산에 재사용**한 것이 근본 원인이다
(요구사항의 실패 조건과 정확히 일치). MDD 가 왜곡되면 Calmar(=CAGR/|MDD|)도 연쇄 왜곡.

## 3. 수정 내용

차트용 데이터와 지표용 데이터를 분리했다.

- `lib/snapshot-backtest.ts`
  - 공통 준비(`prepareBacktest`)와 시리즈 계산(`buildSeriesForDates`)을 추출해
    차트(월별)·지표(일별)가 **동일한 계산식**을 쓰되 날짜 축만 다르게 했다.
  - `dailyDates()` 추가: 기간 내 **모든 거래일**을 축으로 사용.
  - `buildBacktestDailyCurves()` 신규 export: 포트/SPY/QQQ/custom 의 **일별** 평가액
    곡선 + 시리즈별 유효 포인트 수(`counts`) 반환.
  - 월별 경로(`buildSnapshotBacktest`)의 출력(차트·카드)은 **동일하게 유지**(회귀 안전).
- `lib/backtest-risk-metrics.ts`
  - 연율화 계수를 인자화(`periodsPerYear`, 기본 `TRADING_DAYS_PER_YEAR=252`).
    일별 시계열에 맞는 Sharpe/Sortino 연율화. MDD/Calmar 계산식은 그대로.
- `components/portfolio/SnapshotBacktestSection.tsx`
  - `cardMetrics` 를 `result.points`(월별)가 아니라 `buildBacktestDailyCurves`(일별)
    기준으로 계산. 차트는 기존대로 월별 `result.points` 사용.
  - 모바일 카드: 위험조정수익률 줄을 `flex flex-wrap` + 각 지표 `whitespace-nowrap`
    으로 변경 → 좁은 폭에서 Calmar 가 잘리지 않고 지표 단위로 자연 줄바꿈. 데스크탑
    (lg:grid-cols-4)은 폭이 넓어 한 줄 유지 → 기존 디자인 보존.

## 4. 검증 (`npm run verify:backtest-daily-mdd`)

합성 일별 시세에 "급락월 월중 V자 -12%(월말 회복)" 구간을 심어 실제 production
함수로 검증.

| 기간 | 일별 포인트(QQQ) | 차트(월별) 포인트 | QQQ MDD 월별축약(옛) | QQQ MDD 일별(신) |
|------|------------------|-------------------|----------------------|-------------------|
| 2년  | 521              | 25                | 0.00%                | **-11.38%**       |
| 1년  | 260              | 13                | 0.00%                | **-11.38%**       |
| 6개월| 130              | 7                 | 0.00%                | **-11.38%**       |

- 월말 종가만 보면 0% → 월중 급락을 전부 놓침(= 보고된 버그).
- 일별 곡선은 심어둔 -12% 급락을 정확히 반영. 모든 비교군(포트/SPY/QQQ/SCHD)이
  동일 기준으로 계산되고, Calmar 도 자동 재계산됨.
- 거래일 ≈ 21/월이므로 6개월 130 · 1년 260 · 2년 521 포인트(달력일 기준 180/365/730
  대비 실제 거래일 밀도).

회귀: `npm run check:snapshot-backtest` 통과(월별 차트·카드 출력 불변),
`npx next lint` / `tsc` 통과(기존 webp 이미지 import 경고만 잔존, 본 변경 무관).
