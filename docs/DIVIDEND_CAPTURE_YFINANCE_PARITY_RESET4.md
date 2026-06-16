# DIVIDEND-CAPTURE-YFINANCE-PARITY-RESET-4

## 이전 PR 실패 원인
배당치기 시뮬레이터가 가격 OHLC와 배당 이벤트를 서로 다른 quote endpoint에서 가져온 뒤 배당락일 exact matching을 수행했습니다. Yahoo history 응답과 dividends 응답의 range/date convention이 달라 ARCC 전체 기간에서 대부분의 배당락일이 가격 dataframe index에 존재하지 않았고, 원본 Streamlit/yfinance의 단일 dataframe 방식과 달라졌습니다.

## 86개 event skip 원인
기존 UI는 `/api/quote/history`와 `/api/quote/dividends`를 병렬 호출했습니다. history는 Yahoo chart history 또는 Stooq fallback 가격을, dividends는 별도 Yahoo chart dividend range를 사용할 수 있었습니다. 그 결과 배당 이벤트 날짜와 가격 row 날짜가 같은 source/timezone/range에서 normalize되지 않았고, `dateToIndex.get(dividend.exDate)` exact lookup에서 ARCC 배당 이벤트 대부분이 누락되었습니다.

## 원본 Streamlit 방식
`original/pages_app/3_dividend_sim.py`는 yfinance dataframe 하나에서 OHLC와 Dividends를 함께 사용합니다. 배당 이벤트와 가격 row가 같은 dataframe index/date convention을 공유하므로, 배당락일이 거래일이면 exact matching이 성립합니다.

## 새 Yahoo chart 단일소스 adapter 구조
배당치기 전용 adapter는 Yahoo chart API를 한 번 호출합니다.

`/v8/finance/chart/{ticker}?period1=0&period2={now}&interval=1d&events=div,splits&includeAdjustedClose=false`

같은 응답에서 `indicators.quote[0]`의 raw `open/high/low/close`와 `events.dividends`를 읽습니다. UI는 `/api/calculator/dividend-capture-data`만 사용하며 기존 `/api/quote/history`, `/api/quote/dividends` 혼합 source를 쓰지 않습니다.

## timestamp/date normalization 정책
가격 timestamp와 dividend timestamp 모두 Yahoo chart `meta.exchangeTimezoneName` 기준 `YYYY-MM-DD`로 변환합니다. timezone이 없으면 `America/New_York`을 fallback으로 사용합니다.

## ARCC 결과 기록
실제 값은 Yahoo live 응답에 따라 변동될 수 있습니다. 검증 script는 회귀 방지를 위해 ARCC 전체 기간 조건에서 분석 이벤트 80~95개, 승률 80~90%, 성공 평균수익률 1.5~3.0%, 실패 평균손실률 음수, 손익비 finite, 기대수익률 양수, skip 50개 미만을 요구합니다.

## BCSF 2020-03-30 row 비교
BCSF 2020-03-30 row는 실제 Yahoo chart 단일소스 adapter 기준으로 포함되어야 합니다. 원본 Streamlit fixture 기준 수익률은 약 -12.76%이며, 기존 source mismatch/adjusted mismatch에서 나온 -30.07% 회귀는 실패로 처리합니다.

## 남은 한계
Yahoo chart live historical data는 Yahoo 자체 수정/정정에 따라 소폭 달라질 수 있습니다. 네트워크가 막히면 live parity script는 성공으로 처리하지 않고 실패합니다.
