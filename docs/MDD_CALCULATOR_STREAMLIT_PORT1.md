# MDD-CALCULATOR-STREAMLIT-FULL-PORT-1

원본 Streamlit MDD 계산기(`original/pages_app/7_mdd_calculator.py`)의 UI/차트/표를
Vercel(Next.js + Recharts) MDD 계산기 탭(`/calculator` → "MDD 계산기")에 최대한 가깝게 이식했다.

## 1. 원본 Streamlit 분석 (`7_mdd_calculator.py` + `logic/market.py`)

### 입력값 구조
- `ticker` (텍스트, 기본 `QQQ`)
- `start_date` / `end_date` (날짜, 기본 최근 5년)
- 입력 방어: 티커 없음/시작일>종료일이면 분석 중단.

### 상단 KPI/요약 지표
2행 × 3열 metric 카드:
1. 현재가 (`current_price`)
2. 기간 내 최고가 (`period_high`)
3. 현재 고점대비 하락률 (`current_drawdown`)
4. 최대 MDD (`mdd`)
5. MDD 고점일 (`peak_date`, help: 고점가)
6. MDD 저점일 → 회복일 (`trough_date` → `recovery_date`), 미회복 시 "· 미회복"
- 회복 소요 안내 caption: `고점(peak_date)에서 회복까지 약 N일 소요`.

### 가격 그래프 계산 로직 (`build_price_chart`)
- 종가 line(파랑 `#3182F6`) + MDD 고점(초록 triangle-up) / MDD 저점(빨강 triangle-down) / 회복일(주황 circle) 마커.
- tooltip 날짜 `%Y-%m-%d`, y축 `$,.2f`.

### Drawdown/MDD 계산 로직 (`compute_drawdown_series`, `compute_mdd`, `build_drawdown_chart`)
- `drawdown = close / close.cummax() - 1` (비율).
- `mdd = drawdown.idxmin()` 값, `trough_date`는 최저 drawdown 날짜, `peak_date`는 저점일 이전 구간의 최고 종가 날짜.
- 기준선 0 / -10 / -20 / -30 / -40%, 최대 MDD는 빨강 X 마커.

### 달러 vs 원화 Drawdown 비교 (`align_and_convert_to_krw`, `build_dd_compare_chart`)
- `fetch_usdkrw_series()`로 `KRW=X`/`USDKRW=X` 환율 종가 시계열 확보(정상범위 700~3000).
- 달러+환율 합집합 인덱스에 환율 reindex 후 `ffill` → 달러 거래일 정렬, `krw = usd * rate`.
- 두 series의 drawdown을 비교 (달러 파랑, 원화 주황). 환율 실패 시 원화 분석 생략(달러 결과는 유지).

### 회복일 산출 (`compute_recovery_date`)
- 저점일 이후 종가가 고점가(`peak_price`) 이상으로 처음 올라온 날.

## 2. 현재 Vercel 기존 구조와 누락 항목

기존 `MddCalculator.tsx`:
- 영어 라벨(Current price, Period high, Max drawdown, Recent price and drawdown…).
- Drawdown area chart 1개, "MDD segments" 표, "Recent price and drawdown" 표만 존재.
- 가격 그래프 / 원화 비교 / 연도별 수익률 / 기준년도 표 / 변동성 표 부재.
- 기간 버튼/range selector(brush) 부재. x축은 ISO 날짜 그대로.

## 3. 이번 작업 구현 결과

### 한글화
KPI/차트 제목/표 헤더/tooltip/legend 전부 한글화. 영어 라벨 제거.
`Recent price and drawdown` → `최근 가격 및 Drawdown 상세`.

### 데이터 흐름
- 분석 실행 시 USD 전체(`range=max`) + `KRW=X` 전체 히스토리를 동시에 fetch (기존 quote/history API 재사용).
- 기간 버튼(3개월/1년/5년/10년/최대)으로 클라이언트에서 분석 구간을 slice.
- **fake/sample 차트 금지**: USD source가 `sample`(라이브 실패)이면 차트/표 대신 명확한 unavailable 카드 표시.

### 기간 버튼 / range selector
- `resolvePeriodWindow(prices, period)`: 마지막 거래일 기준 역산. 요청 기간이 보유 데이터보다 길면 `clampedToMax=true`로 전체 기간 표시(예: 10년 버튼·데이터 5년 → 전체).
- 가격/Drawdown 그래프에 Recharts `<Brush>` 적용. 연도별 그래프에도 Brush 적용.
- x축 `YY.MM`(`formatAxisDate`), tooltip `YYYY.MM.DD`(`formatTooltipDate`).

### 그래프
1. **가격** (`{ticker} 달러 기준 가격`): 종가 line + 고점/저점/회복 마커 + legend + Brush.
2. **Drawdown/MDD** (`고점 대비 하락률 (Drawdown / MDD)`): area + 0/-10/-20/-30/-40% 점선 기준선(우측 라벨) + 최대 MDD X 마커 + Brush.
3. **달러 vs 원화 비교**: 달러(파랑)/원화(주황) drawdown line. 환율 unavailable 시 원화 line 생략 + 안내 문구.
4. **연도별 수익률** (`{ticker} 주식 연도별 수익률`): bar chart(양수 파랑/음수 빨강, 진행 연도 옅게) + Brush.

### 계산식 (`lib/mdd-calculator.ts` 추가 함수)
- `computeDrawdownEpisodes`: 고점 갱신 기준으로 낙폭 구간 분리, 저점 이후 고점 회복일 산출, 심한 낙폭 순 정렬, 미회복 포함, 최대 8행.
- `computeYearlyReturns`: `연수익률 = 해당 연도 마지막 종가 / 첫 종가 - 1`, 진행 연도 partial.
- `computeComparisonTable`: 1/3/5/7/10년 전 대비 총수익률 + CAGR. 데이터 부족 기간은 `데이터 부족`.
- `computeVolatilityStats`: 52주 최고/최저가, 1년전 대비 상승률, 현재/최대 낙폭, 연 최고/최저 수익률(완결 연도 기준).
- `alignKrwCloses`: 환율 ffill 정렬 후 `usd * rate`(원본 `align_and_convert_to_krw` 포팅).
- `computeDrawdownCompare`: 달러/원화 drawdown(`close/cummax-1`)을 같은 날짜축에 정렬, 환율 없으면 krw=null.

### 표
- **역대 최대 낙폭과 회복기간**: 순위/고점일/저점일/회복일/최대 낙폭/하락 기간/회복 기간/총 소요. 정렬 가능 + 12행 스크롤 + sticky 헤더. 미회복 표기.
- **비교 기준년도별 수익률**(좌) + **주요 변동성 지표**(우): desktop 2열 / mobile stack.
- **최근 가격 및 Drawdown 상세**: 정렬/스크롤 유지, 페이지 최하단 이동.

## 4. 테스트 명령어
```bash
npm run check:mdd-calculator-streamlit-port
npm run check:calculators-table-sort-scroll
npm run lint
npm run typecheck
npm run build
```
회귀: `check:portfolio-realdata`, `check:market-data-real`, `check:dividend-estimates`, `check:calendar-provider`.

## 5. 남은 한계
- 라이브 시세는 Yahoo/Stooq 의존. 네트워크가 차단된 환경에서는 unavailable 카드가 표시된다(의도된 동작, 가짜 차트 미생성).
- 역대 낙폭 구간에 닷컴버블/서브프라임 같은 사람이 붙인 이벤트명은 표기하지 않는다(실데이터 기준 날짜·낙폭만).
- 원화 기준 비교는 `KRW=X` 일별 종가에 ffill 정렬한 근사치이며 공식 환율과 미세 차이가 있을 수 있다.
- 연도별/기준년도/변동성 표는 전체 보유 데이터 기준, KPI/가격·Drawdown 차트는 선택 기간 기준으로 분리 산출한다.
