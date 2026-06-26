# SCHD Attractiveness Port 1

## 원본 Streamlit 파일
- `original/pages_app/8_attractiveness_score.py`

## 읽은 원본 로직 요약
- ticker는 `SCHD` 고정이다.
- yfinance history에서 `Close`, `High`, `Dividends`, `Stock Splits`를 받아 가격과 배당 이벤트를 정규화한다.
- 배당 TTM은 단순 365일 합계가 아니라 각 가격일 기준 최근 4회 배당 이벤트 합계(`_calculate_latest_four_dividend_sum`)를 사용한다.
- TTM 배당률은 `최근 4회 배당 합계 / 가격 * 100`이다.
- 1% 미만 또는 8% 초과 TTM 배당률은 데이터 오류 가능성으로 chart/평균에서 제외한다.
- 52주 고점은 최신 유효일 기준 365일 구간의 `High` 우선, 없으면 `Close` 최고값이다.
- 5년 평균 배당률은 최신 유효일 기준 최근 5년 일별 TTM 배당률 평균이다.
- 목표가 표는 3.5%, 3.6%, 3.7%, 3.8%에 대해 TTM 기준 매수가와 최근 분기 배당금×4 기준 매수가를 계산한다.

## 데이터 source
- Vercel/Next.js quote API를 사용한다.
  - `/api/quote/history?ticker=SCHD&range=max`
  - `/api/quote/dividends?ticker=SCHD&range=max`
  - `/api/quote/last?ticker=SCHD`
- sample 응답은 실제 화면 데이터로 사용하지 않고 unavailable state로 처리한다.

## 계산식
- TTM 배당금: 가격일 이하 배당 이벤트 중 최신 4개 합계.
- 현재 TTM 배당률: `TTM 배당금 / 현재가 * 100`.
- 5년 평균 배당률: 최신 유효일 기준 5년간 유효 일별 TTM 배당률 산술 평균.
- 52주 고점 대비: `현재가 / 52주 고점 - 1`.
- 목표가 표:
  - TTM 기준 매수가: `최근 4회 배당금 / 목표 배당률`
  - 최근 분기×4 기준 매수가: `최근 분기 배당금 * 4 / 목표 배당률`
  - 현재가 대비 하락률: `(TTM 기준 매수가 / 현재가 - 1) * 100`

## UI 구성
- `/dividends` 상단에 계산기 탭과 동일한 톤의 `배당현황`, `SCHD 매력도` 탭을 추가했다.
- `SCHD 매력도` 탭은 상단 KPI 5개, 기간 selector, `SCHD Dividend Yield TTM` chart, 오른쪽 compact 목표가 표로 구성한다.
- 목표가 표 하단에는 원본 참고용 Seeking Alpha 링크를 둔다: `https://seekingalpha.com/symbol/SCHD/dividends/yield`.

## unavailable 정책
- quote/history/dividends/last 요청 실패, sample 응답, 배당/가격 부족 시 `조회 불가` 또는 empty state를 보여준다.
- sample/mock 값을 실제 SCHD 값처럼 표시하지 않는다.

## 테스트 명령어
- `npm run check:schd-attractiveness-port`
- `npm run check:dividend-estimates`
- `npm run check:dividends-data`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계
- 서버 quote API가 split 이벤트를 별도 반환하지 않으므로 Streamlit의 배당 split-adjustment heuristic은 API가 제공하는 가격/배당 basis를 신뢰한다.
- Seeking Alpha URL은 원본 파일에 URL 상수가 없어 SCHD dividend yield 페이지 URL을 신규 상수로 문서화했다.
