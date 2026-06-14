# Step MARKET-UX-POLISH-1 — 시장온도 차트 축/기준선/브리핑 카드 정리

`/market` (시장 현황) 화면의 차트 축·기준선·브리핑 카드를 첨부된 참고 화면의 사용감에 맞춰
정리한 UI/표시 정책 polish 작업이다. 데이터 구조는 유지하고 표시 정책 중심으로만 손봤다.

## 변경 요약

### 1. 시장 브리핑 단독 VIX 카드 제거
- `components/market/MarketTopBriefing.tsx` 에서 우측 지수/매크로 카드 그리드 필터를
  `key !== "fng"` → `key !== "fng" && key !== "vix"` 로 확장했다.
- 7개 카드(3+3+1)로 VIX 가 마지막 줄에 혼자 떨어져 보이던 문제를 제거하고 6개(3+3)로 균형을 맞췄다.
- VIX 데이터(`MOCK_BRIEFING` 의 `vix` 항목)와 하단 **VIX 참고 그래프**(`VixChart`)는 그대로 유지한다.
  VIX 는 이제 하단 참고 그래프에서만 확인한다.

### 2. 공통 날짜 formatter
- `lib/chart-style.ts` 에 `formatChartMonthTick(value)` 를 추가했다.
  - `YYYY-MM` / `YYYY-MM-DD` 문자열, `Date` 객체, timestamp(number) 를 안전하게 `YY/MM` 로 변환한다.
    (예: `2026-03` → `26/03`, `2026-06-14` → `26/06`)
  - 타임존 시프트 방지를 위해 ISO 문자열은 로컬 시간 기준으로 직접 파싱한다.
  - invalid date 는 원본 문자열을 그대로 반환하거나(`"T-52"` → `"T-52"`), 비문자열이면 빈 문자열로 방어한다.
- RSI / MDD / VIX 세 차트의 x축 `tickFormatter` 에서 이 함수를 재사용한다.

### 3. mock 시계열 날짜를 실제 ISO 날짜로
- `lib/mock-market-data.ts` 의 `buildRsiSeries` / `buildDrawdownSeries` / `buildVixSeries` 가
  기존 `T-{n}` 라벨 대신 실제 ISO(`YYYY-MM-DD`) 날짜를 emit 하도록 했다(`buildSeriesDates`).
  - 6개월/1년은 주간(7일) 간격, 3년/5년/전체는 월간 간격으로 최근 날짜에서 과거로 거슬러 생성한다.
  - **시계열 수치(RSI 값/하락률/VIX 값) 자체는 변경하지 않았다.** `date` 라벨 형식만 바뀐다.
  - `SeriesPoint` 구조(`{ date: string, [ticker]: number }`)는 그대로 유지한다.

### 4. RSI 14 추이 차트 (`MarketRsiSection.tsx`)
- x축 tick 을 `formatChartMonthTick` 으로 `YY/MM` 표기. (`minTickGap` 으로 라벨 겹침 방지 유지)
- y축(0~100), 과매수 70 / 과매도 30 기준선, QQQ/SCHD/SPY series 는 그대로 유지.

### 5. MDD(고점 대비 하락률) 차트 (`MarketMddSection.tsx`)
- x축 tick 을 `YY/MM` 표기.
- y축을 **0% 를 위쪽 기준선으로 두고 하락률이 음수로 아래로 내려가는 구조**로 정리.
  - `buildDrawdownFloor()` 가 가장 깊은 낙폭을 5% 단위로 내림해 도메인 하한을 만든다(최소 -5%).
  - 도메인 하한이 항상 5의 배수라 `tickCount` + `allowDecimals={false}` 자동 눈금이
    `0% / -5% / -10% / -15% / -20%` 로 깔끔하게 떨어진다.
  - **explicit `ticks` 배열은 사용하지 않는다** — recharts 가 도메인 끝(0%) edge tick 을 생략해
    상단 `0%` 라벨이 빠지는 문제가 있어, RSI 와 동일하게 자동 눈금 방식으로 전환했다.
    그 결과 상단 `0%` 라벨이 정상 표시되고 불필요한 phantom 눈금(`-25%`)도 사라졌다.
  - y=0 에 실선 ReferenceLine, -10 / -20 에 점선 ReferenceLine 으로 기준선을 표시.
- tooltip 에 `%` 단위를 명시(`formatter` 로 `-12.3%` 형태).
- QQQ/SCHD/SPY series 유지.

### 6. VIX 참고 그래프 (`VixChart.tsx`)
- x축 tick 을 `YY/MM` 표기.
- 변동성 기준선을 가로 ReferenceLine 으로 표시:
  - `높은 변동성 30` (빨강 점선)
  - `변동성 주의 20` (주황 점선)
  - 임계값은 `lib/mock-market-data.ts` 의 `VIX_THRESHOLDS = { high: 30, watch: 20 }` 상수에서 가져온다.
  - label 은 작은 폰트(`fontSize: 11`)로 방해하지 않게 표시.
- y축 도메인을 데이터 범위와 임계값(20/30)을 함께 감싸도록 5단위로 만들고(`buildVixDomain`),
  `tickCount` + `allowDecimals={false}` 로 `10 / 15 / 20 / 25 / 30 / 35` 처럼 읽기 쉬운 눈금으로 정리.
  (기존 `10 / 17 / 24 / 35` 같은 어색한 눈금 제거)
- tooltip 의 VIX 값 표시는 기존대로 유지.

## 변경하지 않은 영역
- **시장온도 참고 구글시트** (`components/market/MarketTemperatureSheet.tsx`) — 그대로 둠.
- **미국주식 섹터 트리맵** (`components/market/TradingViewTreemap.tsx`) — 그대로 둠.
- 공포 & 탐욕 지수 카드, 주요 지수/매크로 카드(VIX 제외), RSI/MDD 카드의 수치/구조.
- `/market` 미사용 레거시 컴포넌트(`MarketBriefingCards`, `MarketRiskCards`, `FearGreedCard`,
  `MarketRsiChart`, `RsiDrawdownChart`, `MarketTemperatureSection`, `MarketTemperatureTable`).

## 검증

```bash
npm.cmd run check:market-chart-formatters   # YY/MM formatter, ISO 날짜, 0기준 음수 하락률, VIX 20/30 임계값
npm.cmd run lint
npm.cmd run typecheck
```

브라우저(`/market`) DOM 검증으로 확인한 항목:
- RSI/MDD/VIX x축이 모두 `25/06 … 26/06` 형태의 `YY/MM`.
- MDD y축 `-20% / -15% / -10% / -5% / 0%` (상단 0% 표시, phantom 눈금 없음).
- VIX y축 `10 / 15 / 20 / 25 / 30 / 35`, 기준선 `높은 변동성 30` · `변동성 주의 20`.
- 첫 브리핑 섹션에 단독 VIX 카드 없음.
- 1440 / 390 / 320px 모두 horizontal overflow 0px.
- 콘솔 실제 오류 없음(기존 recharts `defaultProps` deprecation 경고만 존재).

## 남은 한계 / 다음 단계
- 시장 데이터는 여전히 mock(`lib/mock-market-data.ts`)이다. 실제 CNN Fear&Greed / 지수 / 환율 /
  yfinance RSI·VIX 연결은 `lib/market-data.ts` 의 `TODO(codex)` 지점에서 진행하면 된다.
- recharts 2.x `defaultProps` deprecation 경고는 라이브러리 차원 이슈로 본 작업 범위 밖이다.
