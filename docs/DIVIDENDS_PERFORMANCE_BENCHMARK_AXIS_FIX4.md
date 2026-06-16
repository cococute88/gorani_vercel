# DIVIDENDS-PERFORMANCE-BENCHMARK-AXIS-FIX-4

## 원인

위탁/절세 성과는 최신 보유 기준 backcast 결과를 사용하면서 월별 순투자금이 모두 `0`인 시계열을 벤치마크 계산에 전달했다. 기존 벤치마크 계산은 순투자금 흐름을 매월 매수금으로 처리했기 때문에 보유 좌수가 `0`으로 유지되어 `latestValue`가 `0`이 되었고, 카드에는 `₩0`이 표시되며 선도 축 하단에 붙어 보이지 않았다.

## 벤치마크 ticker/source 정책

- S&P 500: 기존 `/api/quote/history` 경로로 `SPY`를 요청한다.
- KOSPI: 기존 `/api/quote/history` 경로로 `^KS11`을 요청한다.
- USD 벤치마크는 `KRW=X` 환율 history를 함께 사용한다.
- quote 응답이 `sample` source이거나 빈 가격이면 fake/sample graph 금지 원칙에 따라 unavailable 처리한다.

## 계산식

계좌군별 첫 backcast 원금(`base.points[0].depositKRW`)을 시작 원금으로 사용한다.

```txt
benchmarkValue[t] = startPrincipal * benchmarkPrice[t] / benchmarkPrice[start]
```

USD 벤치마크는 시작/해당 월의 USD/KRW 환율을 반영한다. 가격이나 환율이 없는 월은 `0`으로 채우지 않고 `null`로 둔다.

## 실패 표시 정책

벤치마크 price/fx가 실패하거나 계산 결과가 양수로 생성되지 않으면 해당 벤치마크만 unavailable로 처리한다. 카드에는 `₩0` 대신 `비교 불가`를 표시하고, 다른 벤치마크 및 내 포트폴리오 line은 유지한다.

## y축 domain 정책

성과 그래프 y축은 표시 series(`누적 입금`, `내 포트폴리오`, `S&P 500 투자 시`, `KOSPI 투자 시`)의 finite min/max 기준으로 padding을 적용한다. 0을 강제로 포함하지 않는다.

## 월별 손익 차트 정책

월별 손익 bar는 좌측 `profit` 축을 사용하고 tick은 `만원` 단위로 표시한다. 총자산 line은 우측 `asset` 축을 유지하며, 두 domain은 각각 monthlyProfit과 totalAssets만으로 계산한다. 없는 달은 `null`로 유지한다.

## 테스트

- `npm run check:dividends-performance-benchmark-axis`
- `npm run check:dividends-performance-group-backcast`
- `npm run check:dividends-performance-backcast`
- `npm run check:dividends-performance-streamlit-port`
- `npm run check:dividend-estimates`
- `npm run check:dividends-data`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

로컬/Preview에서 실제 quote provider가 특정 기간의 `SPY`, `^KS11`, `KRW=X` history를 제공하지 못하면 해당 벤치마크는 의도적으로 `비교 불가`로 표시된다.
