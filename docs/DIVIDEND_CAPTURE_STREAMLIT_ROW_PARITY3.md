# DIVIDEND-CAPTURE-STREAMLIT-ROW-PARITY-3

## 원본 Streamlit 행 단위 로직

- 원본 파일: `original/pages_app/3_dividend_sim.py`.
- Price source: `yf.Ticker(ticker).history(period="max", auto_adjust=False)`에서 받은 yfinance 일봉 dataframe.
- Dividend event source: 같은 yfinance history dataframe의 `Dividends > 0` 행. 별도 provider를 섞지 않는다.
- OHLC 기준: `auto_adjust=False`이므로 raw `Open`, raw `High`, raw `Close`를 사용한다. `Adj Close`는 계산에 쓰지 않는다.
- 배당락일 매칭: `df.index.get_loc(ex_date)`를 사용하고, price dataframe index에 없으면 `KeyError`로 해당 배당 이벤트를 `continue`한다. 가까운 다음 거래일로 보정하지 않는다.
- D-1 매수가: 배당락일 price row index `idx`의 `idx - 1` row에서 `Close` 또는 `Open`을 선택한다.
- D-2 매수가: `idx - 2` row에서 `Close` 또는 `Open`을 선택한다.
- `매도허용기간 0`: window가 `df.iloc[idx : idx + 1]`이므로 배당락일 당일 한 row만 사용한다. 당일 `High`로 성공 여부를 판단하고 당일 `Close`가 실패 매도가가 된다.
- 성공 판정식: `window_data['High'].max() >= buy_price - after_tax_dividend`.
- 성공 수익률: `(after_tax_dividend / buy_price) * 100`.
- 실패 수익률: `((sell_price + after_tax_dividend - buy_price) / buy_price) * 100`, 여기서 `sell_price = window_data.iloc[-1]['Close']`.
- 원금 회복일: 실패 row에 대해 `df.iloc[idx:]` 중 `High >= breakeven`인 첫 row.
- 최근 5년 필터: `pd.Timestamp.now().normalize() - pd.DateOffset(years=5)` 이후의 dividend event만 남긴다.
- KPI 6개: 상세 결과 dataframe의 row만 사용해 승률, 성공 평균수익률, 실패 평균손실률, 손익비, 전체 평균 기대수익률, 성공 평균수익률 기반 절세예상액을 계산한다.
- 상세표 row: 배당락일, 매수가, 세후배당금, 손익분기점, 성공여부, 수익률, 원금 회복 날짜, 거래일/달력일 회복기간을 append한다.

## 기존 Vercel이 ARCC 승률 100%를 만들던 이유

Vercel row builder가 원본과 달리 배당락일이 price row에 없을 때 `prices.findIndex(point.date >= dividend.exDate)`로 다음 price row를 임의 매칭했다. 그 결과 배당락일과 OHLC row가 원본보다 낙관적으로 결합될 수 있었고, 실패 row가 사라지거나 성공으로 바뀌어 KPI가 100% 승률, 실패 평균손실률 0, 손익비 ∞로 치우쳤다.

## BCSF 2020-03-30 차이 원인

원본은 raw yfinance history와 같은 dataframe의 dividend event를 같이 사용한다. BCSF 2020-03-30 fixture에서 원본식 row는 다음과 같다.

| field | Streamlit raw-row fixture | old mismatched symptom |
| --- | ---: | ---: |
| buy_date | 2020-03-27 | provider/date convention mismatch 가능 |
| buy_price | 11.14 | raw/adjusted 혼합 가능 |
| ex_date | 2020-03-30 | 2020-03-30 |
| ex_date high | 9.45 | adjusted/stooq high 가능 |
| ex_date close | 9.31 | adjusted/stooq close 가능 |
| dividend | 0.48 | 0.48 |
| after_tax_dividend | 0.408 | 0.408 |
| breakeven | 10.732 | raw breakeven과 adjusted sell 비교 가능 |
| success/failure | 실패 | 실패 |
| returnPct | -12.76% | -30.07% |

`-30.07%`는 원본의 raw buy/raw close/raw dividend 조합에서 나오기 어렵고, adjusted/Stooq 가격과 raw dividend 또는 다른 date convention이 섞였을 때 나타나는 크기다. 이번 수정은 배당치기 row calculator에서 원본처럼 exact ex-date row만 사용하게 하고, `buyDate`, `sellDate`, `windowHigh`, `dividendAmount`, `returnPct`를 한 row에 보존해 상세표/KPI/그래프가 같은 row array만 보게 했다.

## 수정 사항

- `buildDividendCaptureRowsFromStreamlitLogic` pure function을 추가해 원본 Streamlit 행 계산을 분리했다.
- `summarizeDividendCaptureRows` pure function을 추가해 KPI가 동일 rows에서만 계산되도록 했다.
- 배당락일이 가격 index에 없으면 다음 거래일을 고르지 않고 skip한다.
- D-1/D-2 매수일, 매수가, 세후배당, 손익분기점, window high, 매도일, 매도가, 성공여부, 수익률, 원금 회복일을 row에 저장한다.
- 차트 입력 rows를 `exDate` 오름차순으로 고정하고, 성공은 파란색, 실패는 하늘색으로 유지했다.
- 백테스트 기간 문구는 light mode `text-slate-800`, dark mode `text-emerald-50`, `font-semibold`로 강화했다.

## Parity 결과와 테스트

- Deterministic BCSF 2020-03-30 row fixture: `-12.76%` 근처를 검증하고 기존 `-30.07%` 회귀를 실패 처리한다.
- Deterministic ARCC 87회 fixture: 승률 100%, 실패 평균손실률 0, 손익비 ∞ 회귀를 실패 처리한다.
- 기존 parity/restore/table-sort checks, lint, typecheck, build를 실행했다.

## 남은 한계

- 이 환경에서는 Yahoo 직접 호출이 프록시/403으로 막혀 live ARCC/BCSF yfinance 값을 새로 다운로드해 비교하지 못했다. 따라서 live provider parity는 배포 환경의 Yahoo 응답에 의존한다.
- 테스트 fixture는 ARCC/BCSF 값을 화면에 하드코딩하지 않고, 원본 row 산식과 date matching 회귀를 잡기 위한 deterministic 검증용이다.
