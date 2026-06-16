# DIVIDEND-CAPTURE-STREAMLIT-RESTORE-1

## 원본 Streamlit 분석

`original/pages_app/3_dividend_sim.py`는 `yfinance.Ticker(ticker).history(period="max", auto_adjust=False)` 한 번으로 가격 OHLC와 `Dividends` 컬럼을 함께 확보한다. 인덱스는 timezone을 제거하고 일자 단위로 normalize하며, `Dividends > 0`인 행을 배당락 이벤트로 사용한다. ARCC처럼 Yahoo Finance에 장기 history가 있는 종목은 이 `period="max"` 호출 때문에 2004년대부터 2026년 현재까지의 배당 이벤트가 확보된다.

`최근 5년 데이터만 보기`가 켜진 경우에만 `pd.Timestamp.now().normalize() - pd.DateOffset(years=5)` 이후 배당 이벤트로 필터링한다. 꺼져 있으면 원본은 배당 이벤트를 별도로 기간 제한하지 않는다.

## 원본 계산 정책

- 매수가: 배당락일이 가격 DataFrame 인덱스에 있을 때 해당 위치 `idx`를 찾고, `D-1 종가`, `D-1 시가`, `D-2 종가`, `D-2 시가`에 따라 `df.iloc[idx-1/idx-2]`의 `Close` 또는 `Open`을 사용한다.
- 매도허용기간: `df.iloc[idx : idx + sell_window + 1]`로 배당락일부터 N거래일 포함 구간을 만든다. `sell_window=0`이면 배당락 당일 1개 거래일만 본다.
- 배당소득세율: `after_tax_div = div_amount * (1 - tax_rate / 100)`.
- 손익분기점: `buy_price - after_tax_div`.
- 성공 판정: 매도허용기간 내 `High.max() >= 손익분기점`이면 성공.
- 성공 수익률: `(세후배당금 / 매수가) * 100`.
- 실패 수익률: 허용기간 마지막 행의 `Close`를 매도가로 보고 `((sell_price + 세후배당금 - 매수가) / 매수가) * 100`.
- 원금 회복일: 실패 case에서 배당락일부터 미래 전체 가격 rows 중 `High >= 손익분기점` 최초일. 없으면 `회복불가`.
- 소요 기간(거래일): `df.index.get_loc(recovery_dt) - idx`.
- 소요 기간(달력): `(recovery_dt - ex_date).days`.

## KPI 6개 계산식

- 전략 승률: 성공 row 비율 × 100.
- 성공 평균수익률: 성공 row의 `수익률(%)` 평균.
- 실패 평균손실률: 실패 row의 `수익률(%)` 평균.
- 손익비: `abs(성공 평균수익률 / 실패 평균손실률)`, 실패 평균이 없거나 0이면 `∞`.
- 1회 기대수익률: 전체 row의 `수익률(%)` 평균.
- 1회 절세예상액: `(성공 평균수익률 / 100) * 투자자금 * 0.22`.

## 기존 Vercel 문제 원인

기존 구현은 full-history 옵션이 꺼져도 `analysisMonths` 기본값 36개월에서 시작일을 만들었고, dividend API 요청도 기본적으로 5년 window를 선호했다. 또한 계산 결과를 `.slice(-16)`으로 마지막 16개만 남겨 장기 배당 이벤트가 UI/그래프/표에서 사라졌다. 이 때문에 ARCC 장기 history가 있어도 12~16회 수준만 분석되는 상태가 발생했다.

## 복구 정책

- `최근 5년 데이터만 보기 = 예`: `/api/quote/history`, `/api/quote/dividends`에 `range=5y`를 사용한다.
- `최근 5년 데이터만 보기 = 아니오`: 클라이언트는 `range=max`를 보내고 `start`를 생략한다. 서버는 이를 Yahoo chart `range=max` 요청으로 변환하여 Streamlit 원본의 `history(period="max")`와 같은 full-history 경로를 사용한다.
- 서버 quote fetcher는 `range=max`를 `period1` 없이 Yahoo `range=max`로 처리할 수 있다.
- 가격 history는 배당 이벤트 기간 전체를 커버해야 하며, 배당 이벤트는 있지만 D-1/D-2 또는 sell-window 가격 row가 실제로 없을 때만 skip한다.
- skip warning은 이벤트별 장문 반복 대신 집계형 warning으로 표시한다.
- 외부 source가 부족할 때 sample/fake backtest row를 만들어 성공한 것처럼 보여주지 않는다.

## UI 복구

- 결과 상단에 `총 N회의 과거 배당 이벤트 분석 완료! (적용 세율: X%)`와 실제 분석 row의 배당락일 시작~종료 기간을 표시한다.
- 메인 KPI는 원본 Streamlit의 6개 카드로 교체했다.
- 그래프 제목은 `수익률 분포 그래프`이며 x축은 배당락일, y축은 수익률(%), 성공/실패 scatter와 legend를 유지한다.
- 상세 표 컬럼은 `배당락일`, `매수가`, `세후배당금`, `손익분기점`, `성공여부`, `수익률(%)`, `원금 회복 날짜`, `소요 기간(거래일)`, `소요 기간(달력)` 순서로 맞췄다.
- 상세 표는 정렬과 내부 세로 스크롤을 유지한다.

## 테스트 명령어

- `npm run check:dividend-capture-streamlit-restore`
- `npm run check:calculators-table-sort-scroll`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

Yahoo Finance가 특정 종목의 과거 배당/가격 데이터를 제한하거나 네트워크 오류가 발생하면 전체 기간이 줄어들 수 있다. 이 경우 sample을 생성하지 않고 warning/unavailable 상태로 원인을 표시한다.


## 현재 Vercel 구현과 원본 대조 상세

- 현재 Vercel의 12회 수준 분석 문제는 UI가 최근 5년/36개월성 기간을 요청하거나 계산 단계에서 최신 일부 row만 남기는 구조에서 발생했다. 복구 후 full-history 모드는 dividend event array 전체를 순회한다.
- 배당락일이 가격 row와 정확히 일치하지 않으면 같은 날짜 이후의 첫 거래일로 보정한다. 단, D-1/D-2 매수 기준에 필요한 과거 거래일이나 매도허용기간에 필요한 미래 row가 실제로 없을 때만 skip한다.
- ARCC 같은 장기 배당 종목은 Yahoo가 제공하는 가격/배당 데이터 한계 안에서 2004년대 이벤트부터 분석된다. Yahoo 장애나 종목별 source 제한이 있으면 fake row를 만들지 않고 warning으로 노출한다.
- 메인 카드에서 기존 Vercel의 매수 가능 수량/세후 배당금/예상 가격 하락/손익분기 가격/평균 회복일 중심 구성을 제거하고, 원본 Streamlit KPI 6개를 우선 표시한다.
- 다른 계산기(MDD, 매도전환), 포트폴리오/캘린더/배당/마켓/자산시뮬레이터/Auth/Firestore 파일은 변경 대상에서 제외했다.
