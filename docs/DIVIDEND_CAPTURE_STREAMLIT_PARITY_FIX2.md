# DIVIDEND-CAPTURE-STREAMLIT-PARITY-FIX-2

## 원본 Streamlit 계산식

`original/pages_app/3_dividend_sim.py`는 배당락일이 가격 인덱스에 정확히 존재하는 이벤트만 분석한다. 매수가는 선택한 D-1/D-2 행의 시가/종가이고, 세후배당금은 `dividend_amount * (1 - tax_rate / 100)`이다.

- 손익분기점: `buy_price - after_tax_div`.
- 매도허용기간 0: 배당락 당일 한 행만(`df.iloc[idx:idx+1]`) 검사한다는 의미이다. 0일 때도 배당락일 고가가 손익분기점 이상이면 성공이고, 아니면 실패이다.
- 성공 판정: `window_data['High'].max() >= bep`.
- 성공 수익률: `(after_tax_div / buy_price) * 100`.
- 실패 수익률: `((sell_price + after_tax_div - buy_price) / buy_price) * 100`, 여기서 `sell_price`는 허용기간 마지막 행의 종가이다. 매도허용기간 0이면 배당락일 종가이다.
- 원금 회복일: 실패한 경우 전체 미래 데이터(`df.iloc[idx:]`)에서 `High >= bep`인 첫 날짜이다.
- 손익비: `abs(avg_profit / avg_loss)`, 실패 평균손실률이 없거나 0일 때만 `∞`이다.
- 1회 기대수익률: 모든 row의 `수익률(%)` 평균이다.
- 1회 절세예상액: `(avg_profit / 100) * invest_capital * 0.22`이다.
- 최근 5년 필터: 전체 배당 이벤트 중 `pd.Timestamp.now().normalize() - pd.DateOffset(years=5)` 이후의 배당 이벤트만 남긴다.

## 기존 Vercel 회귀 원인

기존 구현은 성공 row에서 `sellPrice = breakevenPrice`라는 내부 값을 만들고 손익을 별도로 계산했다. 수익률 표시는 성공 row를 세후배당 수익으로 보이게 하려는 보정이 있었지만, 실패 row의 Streamlit 산식과 KPI 산식 parity를 검증하는 테스트가 없었다. 이 때문에 데이터 소스/기간 조합에서 실패가 누락되거나 0% 손실처럼 보이는 회귀를 잡지 못했다.

## 수정 사항

- 실패 수익률을 원본과 동일하게 허용기간 마지막 종가 + 세후배당금 - 매수가 기준으로 계산한다.
- 성공 수익률을 원본과 동일하게 세후배당금 / 매수가 기준으로 계산한다.
- KPI 6개는 상세 row의 성공/실패와 수익률 평균에서 계산되도록 유지했다.
- Recharts `Scatter`에 성공/실패 fill 값을 명시해 legend marker가 검정색으로 떨어지지 않도록 했다.
- parity regression check를 추가해 승률 100%, 실패 평균손실률 0, 손익비 ∞, 실패 음수 수익률 누락, 검정 legend 회귀를 막는다.

## ARCC parity 기준

입력값은 ARCC, 투자자금 10000, D-1 종가, 매도허용기간 0, 배당소득세율 15%이다.

- 전체 기간 원본 기준: 87회, 2004-12-22 ~ 2026-06-15, 승률 85.1%, 성공 평균수익률 2.14%, 실패 평균손실률 -1.67%, 손익비 1.28, 기대수익률 1.57%, 절세예상액 $47.01.
- 최근 5년 원본 기준: 2021-09-14 ~ 2026-06-15, 승률 80.0%, 성공 평균수익률 2.03%, 실패 평균손실률 -1.89%, 손익비 1.07, 기대수익률 1.25%, 절세예상액 $44.62.

## 테스트

- `npm run check:dividend-capture-streamlit-parity`
- `npm run check:dividend-capture-streamlit-restore`
- `npm run check:calculators-table-sort-scroll`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

실시간 Yahoo/Stooq 데이터가 원본 Streamlit의 yfinance `auto_adjust=False` 응답과 완전히 동일하지 않으면 이벤트 수나 일부 OHLC 값에 소폭 차이가 날 수 있다. 계산식은 원본 산식에 맞췄고, parity check는 계산식과 UI 색상 회귀를 검증한다.
