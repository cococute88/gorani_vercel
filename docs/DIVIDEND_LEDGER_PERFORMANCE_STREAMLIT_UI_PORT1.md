# DIVIDEND-LEDGER-PERFORMANCE-STREAMLIT-UI-PORT-1

원본 Streamlit 배당금가계부(`배당금가계부`)의 **성과 분석** 카드/그래프와 계산 정의를
Vercel `/dividends` 에 이식한다. 위탁/절세 계좌별 누적 성과 그래프 2개와
S&P 500 / QQQ(절세) / KOSPI(위탁) 벤치마크 비교선을 추가한다.

## 1. 원본 Streamlit 분석

참고 파일:

- `original/pages_app/9_dividend_ledger.py` — `render_performance_section()` (성과 분석 UI)
- `original/logic/dividend_performance.py` — `build_performance_result()` (계산 로직)
- `original/logic/dividend_ledger.py` — `normalize_transactions`, `summarize_holdings`, `to_float`

### render_performance_section(transactions, priced_holdings)

- 제목: `### 📊 성과 분석`
- `build_performance_result(transactions, priced_holdings, today)` 호출
- KPI 카드 4개: `누적 입금`, `내 포트폴리오`, `KOSPI 투자 시`, `S&P 500 투자 시`
- 누적 성과 그래프(plotly):
  - KOSPI: `#3B82F6` 점선(`dash="dot"`)
  - S&P 500: `#F97316` 점선
  - 누적 입금: `#CBD5E1` 점선
  - 포트폴리오: `#2DD4BF` 실선(width 3)
- 월별 수익/손실 추이:
  - 월별 손익 bar — 수익 `#EF4444`(빨강) / 손실 `#3B82F6`(파랑)
  - 총자산 line `#2DD4BF`(보조 y축)
  - 연도 selectbox, 연간 손익 카드

### build_performance_result 계산 정의

`transactions[].date` 를 매수/매도일로 보고, **거래내역 기반으로 월별 보유수량을 재구성**한다
(최신 holdings 기준 단순 역산이 아니라, 각 월말 시점에 `date <= 월말`인 거래만 모아
`summarize_holdings`로 그 시점 보유수량을 다시 만든다).

1. **누적 입금 (`cumulative_deposit_krw`)**
   - 거래별 현금흐름 `amount = quantity * price * fx` (BUY +, SELL -)
   - 월별 순투자금(`net_investment_krw`)의 누적합(`cumsum`)
2. **내 포트폴리오 (`portfolio_value_krw`)**
   - 각 월말마다 `date <= month_end` 거래로 보유수량 재구성 → `qty * 월말종가 * fx` 합산
   - 가장 최근 월은 `priced_holdings`의 `current_value_krw` 합으로 덮어씀
3. **KOSPI 투자 시 (`kospi_value_krw`)**
   - 동일한 KRW 현금흐름을 KOSPI(`^KS11`)에 투자했다고 가정(KRW 지수, fx 없음)
   - `units += flow_krw / 종가`, 월말 평가 `units * 월말종가`
4. **S&P 500 투자 시 (`sp500_value_krw`)**
   - 동일 현금흐름을 S&P 500(`^GSPC`, USD 지수)에 투자
   - `units += (flow_krw / fx) / 종가`, 월말 평가 `units * 월말종가 * 월말fx`
5. **월별 손익 (`monthly_profit_krw`)**
   - `이번 달 말 평가액 - 지난 달 말 평가액 - 이번 달 순투자금`
6. **수익률** = `value / 누적입금 - 1`

벤치마크 ticker: `KOSPI_TICKER = "^KS11"`, `SP500_TICKER = "^GSPC"`, `USDKRW_TICKER = "USDKRW=X"`.
가격/환율은 yfinance에서 조회하고, 실패하면 해당 구간을 제외하거나 직전값으로 표시한다(가짜 곡선 생성 없음).

## 2. 현재 Vercel 데이터 구조

- **거래내역 store 없음.** Vercel에는 `transactions` 가계부가 없다.
  대신 `PortfolioSnapshot[]`(엑셀 업로드 → `portfolio-store`)만 존재한다.
- 각 스냅샷: `snapshotDate`, `investmentPrincipalKRW`, `investmentValueKRW`, `totalAssetKRW`,
  그리고 `holdings[]`(각 `principalKRW`, `valueKRW`, 계좌/태그 필드).
- **위탁/절세 식별**: `classifyPerformanceAccountType(holding)`(위탁/연금/ISA)을 재사용하여
  `위탁` 외(연금/ISA)는 `절세`로 본다(`accountGroupOfHolding`). 신호가 없으면 위탁(기본).
- **벤치마크 가격**: 기존 quote/history API(`/api/quote/history`) 재사용.
  - S&P 500 = `SPY`, QQQ = `QQQ`, KOSPI = `^KS11`, 환율 = `KRW=X`.
  - `^GSPC` 대신 `SPY`를 쓰는 이유: Yahoo 실패 시 Stooq fallback이 plain US 티커만 지원하므로 가용성이 높다.

## 3. Vercel 이식 방식 (스냅샷 기반)

`lib/dividend-ledger-performance.ts`:

- `buildAccountGroupPerformance(snapshots, group)` — 계좌군별 시계열 구성
  - 같은 달 스냅샷이 여러 개면 마지막(월말에 가까운) 것 사용
  - `누적 입금 = 해당 계좌군 holdings 의 principalKRW 합`
  - `포트폴리오 = 해당 계좌군 holdings 의 valueKRW 합`
  - `월별 순투자금 = 이번 원금 - 직전 원금`
  - `월별 손익 = 이번 평가액 - 직전 평가액 - 이번 순투자금` (원본과 동일 정의)
- `computeBenchmarkSeries({ points, prices, fx, isUsd })` — 원본 `_benchmark_values` 흐름과 동일
  - 동일한 순투자금 흐름을 벤치마크에 투자, `asof`(해당일 이하 마지막 종가) 사용
  - USD 벤치마크는 순투자금(KRW)을 환율로 환산해 좌수 매입, 평가 시 다시 KRW 환산

### 원본과의 차이 / source badge

- 원본은 **거래내역 기반**, Vercel은 거래내역이 없어 **스냅샷 기반**으로 대체했다.
- 각 계좌군 카드 헤더에 source badge 표시:
  - `스냅샷 기반` — 스냅샷 2개 이상으로 계산됨
  - `데이터 부족` — 스냅샷 < 2 또는 해당 계좌군 보유 없음 → empty state

## 4. 위탁 / 절세 그래프

`components/dividend/DividendAccountPerformanceSection.tsx` — 제목 `성과 분석`, 하위 2블록.

- **위탁 계좌 성과**: 누적 입금(회색 점선) / 내 포트폴리오(청록 실선) / S&P 500(주황 점선) / KOSPI(파랑 점선)
- **절세 계좌 성과**: 누적 입금 / 내 포트폴리오(청록 실선) / S&P 500(주황 점선) / **QQQ(분홍 점선)**

색상(원본 유지):

| 시리즈 | 색상 |
| --- | --- |
| 포트폴리오 | `#2DD4BF` (실선) |
| 누적 입금 | `#CBD5E1` (점선) |
| S&P 500 | `#F97316` (점선) |
| KOSPI | `#3B82F6` (점선) |
| QQQ | `#EC4899` (점선) |

각 블록에 KPI 카드 4개 + 누적 성과 LineChart + 월별 수익/손실(빨강/파랑 bar + 총자산 line, 연도 선택 + 연간 손익).

### QQQ 비교선 추가 이유

절세 계좌는 주로 미국 지수(S&P500/나스닥100) 중심으로 운용되므로,
KOSPI 대신 나스닥100 ETF(QQQ)를 비교 대상으로 둔다(요구사항). 분홍 점선(`#EC4899`).

## 5. benchmark / fallback / 데이터 부족 정책

- 벤치마크는 기존 quote history API 재사용, **신규 외부 의존성 없음**.
- `source === "sample"` 이거나 비어 있거나 요청 실패면 해당 라인을 **unavailable**(null) 처리.
  KPI는 `비교 불가`로 표시하고 라인은 그리지 않는다. **가짜 상승률/곡선 생성 금지.**
- USD 벤치마크는 `KRW=X` 환율 히스토리가 없으면 unavailable.
- 스냅샷이 부족하면 차트 대신 친절한 empty state(`샘플/가짜 그래프는 표시하지 않습니다`).

## 6. 월별 손익

위탁/절세 각각 월별 손익 bar + 총자산 line + 연도 선택 + 연간 손익 카드를 포함했다.
계산식은 원본과 동일: `월별 손익 = 이번 달 말 평가액 - 지난 달 말 평가액 - 이번 달 순투자금`.

## 7. 테스트

```bash
npm run check:dividend-ledger-performance-ui-port
npm run check:dividends-performance-streamlit-port
npm run check:dividend-estimates
npm run check:dividends-data
npm run lint
npm run typecheck
npm run build
```

`scripts/check-dividend-ledger-performance-ui-port.mjs` 검증 항목: 문서의 원본 파일 reference,
위탁/절세 section, QQQ series·분홍 점선, S&P500 주황 점선, 포트폴리오 청록 실선,
sample/mock 미사용, empty state, benchmark 실패 시 fake line 금지, source badge,
그리고 `buildAccountGroupPerformance` / `computeBenchmarkSeries` 계산 단위 검증.

## 8. 남은 한계

- 거래내역이 없으므로 **월 중 매수/매도 시점**은 반영하지 못하고 스냅샷 시점 원금 증감으로 근사한다.
- 계좌 분류는 holdings 텍스트 신호 기반이므로, 태그/계좌명이 비어 있으면 위탁으로 분류될 수 있다.
- 벤치마크는 스냅샷 날짜에만 현금흐름을 적용(월 중 추가 매수 미반영).
- KOSPI(`^KS11`)는 Yahoo 의존도가 높아 조회 실패 시 위탁 그래프에서 자동 생략된다.
