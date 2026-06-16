# DIVIDENDS-PERFORMANCE-BACKCAST-GROUP-FIX-2

## 원인
위탁/절세 계좌 성과 카드는 최신 스냅샷의 원본 holdings만 사용해 backcast를 만들었습니다. 반면 보유 배당 표는 quote/current price를 적용한 뒤 `quantityEstimated`, `currentPriceKRW`, `valueKRW`로 수량을 추정한 enriched rows를 사용했습니다. 따라서 보유 배당 표에는 위탁/절세 종목이 보여도 성과 helper에는 수량/가격 기준이 부족해 데이터 부족으로 떨어질 수 있었습니다.

## Streamlit 기준 재확인
원본 `build_performance_result`는 거래내역(`transactions`) 기반으로 월별 보유수량/현금흐름을 재구성합니다. Vercel에는 배당 거래내역 store가 없으므로 최신 holdings 기준 backcast를 명시합니다. 원본 Plotly y축은 0 고정이 아니라 자동 data range 기반입니다. 월별 손익 섹션은 월 프레임 병합 후 빈 달을 0으로 채웠지만, 이번 Vercel 요구사항에 맞춰 실제 데이터 없는 달은 null로 둡니다. 총자산 line은 월말 평가액, 연간 손익은 선택 연도의 실제 월별 손익 합계입니다.

## 계산 정책
과거 포트폴리오 가치 = `sum(최신 보유수량 × 해당 월 가격 × 해당 월 환율)`입니다. 수량은 `quantity`를 우선하고, 없으면 보유 배당 표의 추정 수량 또는 `valueKRW/currentPriceKRW`, `valueOriginalCurrency/currentPrice`로 추정합니다. 일부 종목 가격 이력이 없으면 제외 warning을 표시하고, 모든 종목이 실패했을 때만 unavailable입니다.

## Benchmark 실패 처리
KOSPI/S&P 500 이력이 없거나 환율이 없으면 해당 benchmark line만 null/unavailable 처리합니다. 내 포트폴리오 line은 benchmark 실패와 독립적으로 표시됩니다.

## y축 domain
전체 합산 및 계좌별 성과 그래프 y축은 visible series의 min/max에 8% padding을 적용합니다. 0부터 강제 시작하지 않습니다.

## 월별 손익 null month
연도 선택 시 1~12월 축은 유지하되 데이터 없는 달의 `monthlyProfit`/`totalAssets`는 null입니다. 연간 손익은 null month를 제외하고 실제 값만 합산합니다.

## 테스트
- `npm run check:dividends-performance-group-backcast`
- `npm run check:dividends-performance-backcast`
- `npm run check:dividends-performance-streamlit-port`
- `npm run check:dividend-estimates`
- `npm run check:dividends-data`
- `npm run lint`
- `npm run typecheck`

## 남은 한계
거래내역 기반 원금 흐름이 없는 Vercel `/dividends`에서는 원본 Streamlit과 달리 최신 보유 기준 역산이며, 시작월 backcast 평가액을 누적 입금 기준값으로 사용합니다.

## Follow-up 3 note

FIX-2 이후 실제 Preview에서 위탁/절세 계좌 성과가 계속 데이터 부족으로 보인 원인은 enriched holdings 전달 자체가 아니라 계좌별 quote history 조회 시작일이 최신 스냅샷 날짜로 고정되어 과거 월말 가격이 잘린 것이었습니다. Follow-up 3에서 계좌별 history start를 최신 스냅샷 기준 25개월 전으로 보정하고, 수량/티커 fallback 및 월별 손익/총자산 y축 분리를 보강했습니다. 자세한 내용은 `DIVIDENDS_PERFORMANCE_GROUP_BACKCAST_FIX3.md`를 참조하세요.

## FIX-4 follow-up: benchmark/axis/unit

위탁/절세 backcast 벤치마크는 첫 월 원금을 시작 원금으로 사용해 `SPY`, `^KS11` 가격 history와 `KRW=X` 환율로 계산한다. 계산 실패는 `0`이 아니라 unavailable(`비교 불가`)로 표시한다. 성과 그래프 y축은 visible series min/max padding을 사용하며 0을 강제로 포함하지 않는다. 월별 손익 chart는 좌측 `profit` 축을 `만원` 단위로, 총자산 line은 우측 `asset` 축으로 분리한다.
