# DIVIDENDS-PERFORMANCE-LATEST-HOLDINGS-BACKCAST-FIX-1

## 원본 재분석
- `original/pages_app/9_dividend_ledger.py`는 현재 원장 거래로 만든 `priced_holdings`를 보유 현황 표에 표시한 뒤 `render_performance_section(ledger.get("transactions", []), priced_holdings)`를 호출한다.
- `original/logic/dividend_performance.py`의 `build_performance_result(transactions, priced_holdings, today)`는 스냅샷 2개를 요구하지 않는다. 원본 필수 입력은 거래내역이며, 최신 평가금액 보정에는 `priced_holdings.current_value_krw`를 사용한다.
- `priced_holdings`는 현재 보유 수량, 평균단가, 현재가, 현재 평가금액(KRW), 비중이 붙은 최신 보유종목 평가 테이블이다.
- 거래내역이 없으면 원본은 성과 그래프를 표시하지 않는다. Vercel에는 배당 원장 거래내역 store가 없으므로 이번 수정에서는 최신 스냅샷 holdings를 원본의 최신 보유 테이블에 대응시키고 과거 가격을 대입해 역산한다.
- 원본 benchmark는 현금흐름 누적 원금을 기준으로 KOSPI/S&P 500에 같은 현금흐름을 투자했다고 가정한다. Vercel backcast는 시작일 역산 포트폴리오 가치를 기준 원금으로 삼는다.

## Vercel 오류 원인
이전 구현은 `/dividends` 성과분석을 포트폴리오 snapshot history 2개 이상으로만 계산했다. 그래서 최신 snapshot 1개에 충분한 holdings가 있어도 “최소 2개 이상의 스냅샷” empty state가 표시됐다. 이는 원본 Streamlit의 최신 보유/거래 기반 철학과 다르다.

## 변경된 계산식
- 최신 보유종목 = 최신 snapshot holdings 또는 계좌 그룹별 최신 holdings.
- 수량 = `quantity` 우선, 없으면 `valueKRW / currentPriceKRW`, 또는 원통화 평가금액/currentPrice로 추정.
- 과거 포트폴리오 가치 = `최신 수량 × 해당 날짜 종가 × 해당 날짜 환율`.
- 기준 원금 = 시작일의 역산 포트폴리오 가치.
- KOSPI 투자 시 = 기준 원금 × KOSPI 가격 변화율.
- S&P 500 투자 시 = 기준 원금 × SPY 가격 변화율 × USD/KRW 환율 변화율.

## 계좌 분리
위탁/절세 성과는 기존 `classifyPerformanceAccountType` 기반 분류를 재사용한다. 각 그룹은 최신 holdings만 있어도 과거 가격 데이터가 있으면 backcast를 시도한다.

## 데이터 부족 처리
- 보유종목 없음: 계좌 그룹에 보유종목이 없다고 표시.
- 과거 가격 없음: 과거 가격을 확인할 수 있는 종목이 없다고 표시.
- benchmark 실패: 해당 benchmark line만 unavailable 처리하고 내 포트폴리오 line은 유지.
- sample/fake series는 만들지 않는다.

## 테스트
- `npm run check:dividends-performance-backcast`
- `npm run check:dividends-performance-streamlit-port`
- `npm run check:dividend-estimates`
- `npm run check:dividends-data`
- `npm run lint`
- `npm run typecheck`

## 남은 한계
Vercel에는 원본 배당금가계부의 BUY/SELL 거래 원장 store가 아직 연결되어 있지 않다. 따라서 월중 매수/매도 현금흐름이 아니라 “현재 수량을 과거에도 보유했다”는 backcast 참고 성과이다.
