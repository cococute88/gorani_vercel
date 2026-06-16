# DIVIDENDS PERFORMANCE STREAMLIT PORT 1

이번 보정 후 `/dividends` 성과분석의 기본 해석은 “스냅샷 2개 이상”이 아니라 “최신 보유종목 기준 과거 가격 역산”이다.

## 원본 Streamlit 확인
- `original/pages_app/9_dividend_ledger.py`는 `priced_holdings`를 만든 뒤 `render_performance_section(ledger.get("transactions", []), priced_holdings)`를 호출한다.
- `original/logic/dividend_performance.py`의 `build_performance_result`는 스냅샷 2개를 요구하지 않는다.
- 원본은 거래내역으로 월별 보유수량/현금흐름을 재구성하고, 최신 월 평가액은 `priced_holdings.current_value_krw` 합계로 보정한다.
- `priced_holdings`는 최신 보유 수량·현재가·평가금액(KRW)이 붙은 현재 보유 평가 테이블이다.
- 거래내역이 없으면 원본은 그래프를 만들지 않는다. Vercel에는 거래 원장이 없으므로 최신 snapshot holdings를 사용해 backcast한다.

## Vercel 수정 정책
- 최신 snapshot 하나만 있어도 holdings가 있으면 성과분석을 시도한다.
- 과거 포트폴리오 가치는 `현재 보유 수량 × 과거 가격 × 과거 환율`로 역산한다.
- 기준 원금은 시작일 역산 포트폴리오 가치이다.
- KOSPI/S&P 500 benchmark는 실제 quote history가 있을 때만 표시한다.
- benchmark 실패는 해당 line만 unavailable 처리한다.
- sample/mock/fake 성과 그래프는 표시하지 않는다.

## UI 문구
source badge는 `최신 보유 기준 역산`을 사용한다. empty state는 과거 가격 데이터 또는 보유종목 부족을 안내하며 “최소 2개 이상의 스냅샷”을 더 이상 요구하지 않는다.
