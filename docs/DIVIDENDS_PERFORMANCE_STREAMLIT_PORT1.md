# DIVIDENDS-PERFORMANCE-STREAMLIT-PORT-1

## 기존 Streamlit 성과분석 로직

원본 진입점은 `original/pages_app/5_dividend_calendar.py`이고, 실제 계산은 `original/logic/dividend_performance.py`의 `build_performance_result`에 있다.

- 데이터 소스: 배당 원장 거래내역을 `normalize_transactions`로 정규화하고, 현재 보유 평가는 선택적으로 `priced_holdings`를 사용한다.
- 가격 데이터: yfinance에서 KOSPI(`^KS11`), S&P 500(`^GSPC`), USD/KRW(`USDKRW=X`), 각 보유종목의 월말 종가를 조회한다.
- 누적 입금: BUY는 양수, SELL은 음수인 거래금액을 KRW로 환산한 뒤 월별 순투자금을 누적 합산한다.
- 내 포트폴리오: 각 월말까지의 거래내역으로 보유수량을 요약하고 월말 가격과 환율로 평가한다. 최신 현재가 보유평가가 있으면 마지막 월의 포트폴리오 값에 반영한다.
- KOSPI 투자 시: 동일한 KRW 순투자금 흐름으로 KOSPI 지수를 매수했다고 가정해 월말 평가액을 계산한다.
- S&P 500 투자 시: 동일한 KRW 순투자금을 USD/KRW로 USD 환산해 S&P 500 지수를 매수했다고 가정하고 월말에는 다시 KRW로 환산한다.
- 월별 손익: `이번 달 말 평가액 - 지난 달 말 평가액 - 이번 달 순투자금`.
- 연간 손익: 월별 손익을 연도별 합산한다.

## Vercel 기존 sample 문제

기존 `/dividends`는 `lib/mock-dividend-data.ts`의 `DIVIDEND_PERFORMANCE_SERIES`를 `components/dividend/DividendPerformanceSection.tsx`에 넘겼고, 섹션 헤더에 `샘플 데이터` badge를 항상 표시했다. 이 때문에 실제 스냅샷/거래내역이 없어도 mock curve가 실제 성과처럼 보였다.

## 이번 이식 결과

- `lib/dividend-performance-from-snapshots.ts`를 추가해 localStorage 포트폴리오 스냅샷 히스토리 기반 성과분석을 만든다.
- 거래내역 저장소가 Vercel에 아직 없으므로 benchmark 가격 이력이 없는 상태에서는 KOSPI/S&P 500 값을 `null`로 두고 UI에 `계산 불가`로 표시한다. sample benchmark는 사용하지 않는다.
- 스냅샷이 2개 미만이면 `성과분석 데이터 부족` empty state를 표시하고 mock chart는 표시하지 않는다.
- 스냅샷 기반 모드의 누적 입금은 최신 스냅샷의 `investmentPrincipalKRW`이고, 월별 순투자금은 전월 대비 `investmentPrincipalKRW` 증감액으로 제한적으로 계산한다.
- 내 포트폴리오는 최신 스냅샷의 `investmentValueKRW`를 사용한다.
- 월별 손익은 Streamlit 식과 동일하게 `이번 달 investmentValueKRW - 지난 달 investmentValueKRW - 이번 달 investmentPrincipalKRW 증감액`으로 계산한다.

## SCHD 목표달성률 정의

- 목표 달성률: `SCHD 환산주수 / 목표 수량 * 100`.
- SCHD 환산주수: 현재 요약 대상 평가금액 / SCHD 현재가(KRW). 실제 SCHD 보유주수보다 작으면 실제 보유주수를 하한으로 둔다.
- 실제 SCHD 보유주수: SCHD로 정규화된 보유행의 `quantity`를 우선 합산한다. 수량이 평가금액/현재가에서 추정된 값이면 UI에 `실보유 추정`으로 표시한다. 수량이 없고 SCHD 현재가가 있으면 `valueKRW / targetPriceKRW`를 추정치로 사용한다.
- 기존 `실보유0주` 원인은 SCHD 보유행이 추정 수량(`quantityEstimated`)일 때 실제 수량 합산에서 제외하던 로직이었다. 이제 환산주수와 실제/추정 보유주수를 분리해 표시한다.

## 데이터 부족 시 처리

- 스냅샷 2개 미만: empty state.
- 거래내역 없음: benchmark 미표시 및 제한 설명.
- benchmark 가격 API 연동 전: KOSPI/S&P 500 KPI는 `계산 불가`.
- sample curve, hardcoded KPI, fake monthly profit/loss는 사용하지 않는다.

## 테스트 명령어

- `npm run check:dividends-performance-streamlit-port`
- `npm run check:dividend-estimates`
- `npm run check:dividends-data`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

- Vercel 쪽에 배당 원장 거래내역 데이터 모델이 아직 연결되어 있지 않아 Streamlit과 동일한 BUY/SELL 현금흐름 기반 benchmark 계산은 불가하다.
- quote history API를 benchmark 계산에 연결하는 작업은 후속 작업으로 남겼다.
