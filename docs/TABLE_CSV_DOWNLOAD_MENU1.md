# TABLE-CSV-DOWNLOAD-MENU-1

## 설계
- `lib/csv-download.ts`가 CSV 문자열 생성과 브라우저 다운로드를 담당한다.
- `buildCsv`는 UTF-8 BOM(`\uFEFF`)을 맨 앞에 붙이고 CRLF 줄바꿈을 사용한다.
- comma, quote, CR/LF가 포함된 값은 따옴표로 감싸며 quote는 `""`로 escape한다.
- `null`/`undefined`는 빈 문자열로 내보낸다.

## TableCsvMenu 사용법
```tsx
<TableCsvMenu
  filename="portfolio-holdings-2026-06-17.csv"
  rows={visibleRows}
  columns={[{ header: "티커", value: (row) => row.ticker }]}
/>
```
작은 outline `CSV` 버튼이며 행이 없으면 disabled 상태가 된다. 테이블 컬럼을 추가하지 않고 카드 제목/요약 우측 또는 미리보기 wrapper 우측 상단에 배치한다.

## 적용한 표 목록
- 배당치기 시뮬레이터 회차별 상세 결과 표
- 매도전환 계산기 전환비 상세 표
- MDD 계산기 역대 최대 낙폭/회복기간 표
- MDD 계산기 최근 가격 및 Drawdown 상세 표
- 배당 페이지 보유 배당 표
- 배당캘린더 전체 배당 일정 표
- 배당캘린더 종목별 예상 절세액 표
- 포트폴리오 관리 보유종목 리스트
- 포트폴리오 관리 원본 데이터 미리보기 표
- 투자 성과 종목 랭킹 표

## 제외한 항목과 이유
- 월간 캘린더 grid: 날짜 배치 UI이며 데이터 table 다운로드 대상이 아니다.
- 도넛/차트 legend, KPI 카드, ticker chip grid: 표가 아니며 CSV에 적합한 행/열 구조가 아니다.
- 경제 캘린더의 단순 key/value 목록: 주요 데이터 표 범위에서 제외했다.
- 자산 시뮬레이터/스냅샷 부가 테이블: 이번 작업의 우선 후보 범위 밖이며 별도 기능으로 확장 가능하다.

## filename 정책
route/table/ticker/date 또는 month를 포함한다. 예: `dividend-capture-results-ARCC-2026-06-17.csv`, `calendar-tax-savings-2026-06.csv`.

## 정렬/필터 정책
정렬 가능한 표는 렌더링에 사용하는 `sortedRows`, `sortedRecent`, `sortedEpisodes`, 필터링 후 `rows`를 그대로 CSV에 넘긴다. 스크롤 표는 현재 정렬/필터된 전체 rows를 다운로드한다.

## 테스트 명령어
- `npm run check:table-csv-download-menu`
- `npm run check:calculators-table-sort-scroll`
- `npm run check:dividends-data`
- `npm run check:calendar-provider`
- `npm run check:portfolio-realdata`
- `npm run check:performance-qld-snapshots`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계
브라우저에서 Excel을 직접 열어 한글 표시를 자동 검증하지는 못한다. 대신 BOM 포함과 escaping 정적 검사를 추가했다.
