# DIVIDENDS-PERFORMANCE-GROUP-BACKCAST-FOLLOWUP-3

## FIX-2 실제 화면 실패 원인

FIX-2는 `estimatedTaxableHoldings` / `estimatedTaxAdvantagedHoldings`를 계좌별 성과 컴포넌트로 전달했지만, 계좌별 quote history 조회 시작일을 최신 스냅샷 날짜 그대로 사용했습니다. `/api/quote/history?range=max&start=<latest snapshot>` 형태가 되어 과거 월말 가격이 1개월 미만으로 잘렸고, `buildDividendPerformanceBackcast`의 월말 시계열이 2개 미만이 되어 계좌별 그래프가 `데이터 부족`으로 떨어졌습니다.

## enriched holdings 전달/필드 shape

`DividendPage`는 보유 배당 표에서 쓰는 enriched rows를 `accountBackcastHoldings`로 묶어 `DividendAccountPerformanceSection`에 전달합니다. rows에는 `ticker`, `valueKRW`, `currentPrice`, `currentPriceKRW`, `quantity`, `quantityEstimated`가 포함될 수 있으며, 원본 수량이 없을 때 보유 배당 표와 동일한 추정 수량이 들어갈 수 있습니다.

## 최종 backcast input 정책

성과 backcast는 보유 배당 표와 같은 rows를 입력으로 사용합니다.

- 티커는 `normalizedTicker`, `ticker`, 기존 holding ticker normalizer 순서로 결정합니다.
- 수량은 `quantity`, `estimatedQuantity`, `shares`, `estimatedShares` 순서로 사용합니다.
- 명시 수량이 없으면 `valueKRW / currentPriceKRW` 또는 `valueOriginalCurrency / currentPrice`로 추정합니다.
- 계좌별 history start는 최신 스냅샷에서 25개월 전으로 계산해 24개월 backcast에 필요한 월말 가격이 확보되도록 했습니다.

## quote history 실패 처리

개별 ticker history 요청은 실패해도 빈 가격 배열로 격리됩니다. 하나 이상의 ticker history가 성공하면 포트폴리오 라인은 계산하며, 실패 ticker는 warning으로 표시합니다. 모든 ticker history가 실패한 경우에만 `성과분석 데이터 부족: 과거 가격을 확인할 수 있는 보유종목이 없습니다.` 상태가 됩니다. 벤치마크 실패는 포트폴리오 성과를 막지 않고 해당 비교선만 숨깁니다.

## 월별 손익 chart y축 분리

월별 손익 chart는 Streamlit과 동일하게 두 축을 사용합니다.

- 좌측 `profit` 축: `monthlyProfit` 값만 기반으로 domain 계산, 0 포함 및 padding 적용
- 우측 `asset` 축: `totalAssets` 값만 기반으로 domain 계산, 0 강제 시작 없음
- `Bar`는 `yAxisId="profit"`, 총자산 `Line`은 `yAxisId="asset"` 사용
- 데이터 없는 달은 `null`로 유지하여 실제 0 손익과 구분합니다.

## 테스트 보강

`scripts/check-dividends-performance-group-backcast.mjs`에 현실적인 위탁/절세 holdings fixture를 추가했습니다.

- 위탁: MSFT, SPY, SCHD, 원본 quantity 없음, `estimatedQuantity`/평가금액 기반 추정 혼합
- 절세: SPY, QQQ, 원본 quantity 없음, USD 현재가/원통화 평가금액 기반 추정
- benchmark 실패 시 holdings history가 있으면 available 유지
- 일부 ticker 실패 시 available 유지 및 제외 warning 확인
- 모든 ticker 실패 시에만 unavailable 확인
- 월별 chart의 `profit`/`asset` y축 분리와 null month 유지 정적 검사

## 남은 한계

실제 브라우저에서 quote provider가 모든 보유 ticker에 대해 sample만 반환하거나 네트워크가 실패하면 fake graph는 표시하지 않고 데이터 부족으로 남습니다. 이 경우에도 일부 ticker만 성공하면 가능한 종목으로 계산합니다.
