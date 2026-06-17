# SCHD-ATTRACTIVENESS-DENSE-DATA-FIX-1

## 1. 원본 Streamlit 로직 분석

대상 원본은 `original/pages_app/8_attractiveness_score.py`입니다.

- 가격 조회: `yf.Ticker("SCHD").history(start=..., end=..., auto_adjust=False, actions=True)`를 호출하며 `interval`을 별도로 월별로 지정하지 않습니다. yfinance 기본 daily 가격 history를 사용합니다.
- 조회 창: 현재 UTC 날짜 다음 날을 `end`로 두고, `365 * 11 + 10`일을 뺀 `start`부터 가져옵니다. 10Y 그래프와 5년 평균 계산에 필요한 충분한 가격/배당 이력을 확보하기 위한 구조입니다.
- 가격 기준: Yahoo `Close`를 `price`/`Close`로 사용합니다. 주석상 일반 종가이며 split-adjusted 기준을 기대합니다.
- 배당 기준: `Dividends` 이벤트를 정리하고, `Stock Splits`가 있을 때 과거 배당이 명백히 pre-split cash amount로 보이면 split ratio로 보정합니다.
- TTM 배당금: 각 가격 날짜마다 그 날짜까지 발생한 배당 이벤트 중 “최근 4회” 합계를 계산합니다. 원문 요구의 365일 누적과 유사한 TTM 의도이지만, 원본 구현은 365일 window가 특정 ex-dividend 주변에 5개 배당을 포함하는 spike를 피하려고 최근 4회 배당 합계를 사용합니다.
- TTM 배당률: `ttm_dividend / price * 100`입니다. 배당 이벤트 날짜만이 아니라 daily 가격 index 전체 날짜에 대해 계산합니다.
- 기간 필터: `1M`, `6M`, `1Y`, `5Y`, `10Y` 버튼은 이미 계산된 daily metrics를 `latest_date - DateOffset(...)` 기준으로 필터링합니다.
- 5년 평균 배당률: 최신 유효 날짜 기준 최근 5년의 일별 TTM 배당률 평균입니다.
- 목표가 표: 목표 배당률 3.5/3.6/3.7/3.8%에 대해 `최근 4회 배당금 / 목표 배당률`, `최근 분기 배당금 * 4 / 목표 배당률`, `TTM 기준 매수가 / 현재가 - 1`을 계산합니다.
- 최근 분기 배당금: 가장 최근 배당 이벤트 1개의 금액입니다.

## 2. 기존 Vercel 데이터 흐름과 원인

기존 Vercel 구현은 `SchdAttractivenessSection`에서 `/api/quote/history?ticker=SCHD&range=max`와 `/api/quote/dividends?ticker=SCHD&range=max`를 호출했습니다. `/api/quote/history` 서버 fetcher는 Yahoo chart API를 `interval=1d`로 호출하므로 명시적 `1mo` 요청은 없었습니다.

다만 SCHD 매력도 컴포넌트가 `range=max`를 사용하면 provider/응답 특성에 따라 너무 긴 range 요청이 sparse하게 내려올 위험이 있고, 원본 Streamlit의 `start/end` 기반 daily history window와도 다릅니다. 이번 수정은 SCHD 매력도 전용 호출을 원본처럼 약 11년 `start/end` 창으로 고정해 Yahoo daily chart 경로가 실제 거래일 단위 가격을 반환하도록 의도를 명확히 했습니다.

## 3. 수정된 range별 데이터 간격 정책

- `1M`: daily trading-day 가격 포인트를 그대로 사용합니다. 월별 1개로 downsample하지 않습니다.
- `6M`: daily 가격 포인트를 그대로 사용합니다.
- `1Y`: daily 가격 포인트를 그대로 사용합니다.
- `5Y`: daily 가격 포인트를 우선 사용합니다. 현재 구현에서는 별도 weekly downsample을 강제하지 않습니다.
- `10Y`: daily 가격 포인트를 우선 사용합니다. 현재 구현에서는 별도 weekly downsample을 강제하지 않습니다.

차트 x축은 데이터 자체를 줄이지 않고 `minTickGap`과 `YY.MM` formatter로 라벨만 적절히 줄입니다.

## 4. TTM dividend yield 계산식

Vercel 계산은 원본 Streamlit port와 동일하게 각 가격 날짜별로 최근 4회 배당 합계를 구한 뒤 다음 식으로 y값을 만듭니다.

```txt
TTM Dividend Yield = latest four dividends as of the price date / close price on that date * 100
```

원문 요구의 “최근 365일 누적 배당금”과 달리 원본 Streamlit은 365일 window의 5개 배당 spike를 피하기 위해 최근 4회 방식을 사용하므로, 목표가 표/KPI와 동일한 기준을 유지했습니다.

## 5. 테스트 결과

신규 `npm run check:schd-attractiveness-dense-data`는 다음을 검증합니다.

- SCHD 매력도 구현에 `1mo`/monthly-only bucket 강제가 없는지
- quote fetcher가 Yahoo `interval=1d`를 쓰는지
- TTM series가 dividend event date가 아니라 price date 기준으로 만들어지는지
- fixture 기준 1M이 10개 이상 포인트를 만드는지
- fixture 기준 1Y가 월 1개 수준으로 줄어들지 않는지
- y값이 `ttmDividend / close * 100`인지
- x축 `YY.MM` formatter가 유지되는지
- 목표가 표 계산식이 유지되는지
- mock/sample fallback을 SCHD 매력도 차트에 표시하지 않는지

## 6. 남은 한계

- 실제 포인트 수는 Yahoo/Stooq provider가 반환하는 daily history 품질에 의존합니다.
- SCHD 매력도는 sample/mock series로 보강하지 않습니다. provider가 실패하거나 배당 이벤트가 부족하면 unavailable 상태를 표시합니다.
- 배당 split 보정은 현재 Vercel quote dividends response에 split event가 포함되지 않아 원본의 `_normalize_dividends_to_close_basis`와 완전히 동일한 자동 보정은 아닙니다. 다만 기존 port와 동일하게 sample source를 거부하고 real provider data만 사용합니다.
