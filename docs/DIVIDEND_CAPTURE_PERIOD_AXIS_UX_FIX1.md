# DIVIDEND-CAPTURE-PERIOD-AXIS-UX-FIX-1

## 원인

수익률 분포 그래프는 배당락일 문자열을 정렬한 뒤 `exDateMs` timestamp로 렌더링하고 있었고 XAxis domain도 `dataMin`/`dataMax`를 사용했습니다. 하지만 Recharts의 자동 tick 산출과 `minTickGap` 조합에서는 마지막 데이터 월이 항상 tick label로 선택되지 않아, 실제 마지막 이벤트가 2026년이어도 하단 축에서 2024년대 label까지만 보이는 UX가 발생할 수 있었습니다.

## 수정 내용

- chart row는 `exDate` 오름차순을 유지하고 `new Date(`${row.exDate}T00:00:00Z`).getTime()` 기반의 안정적인 `exDateMs`를 사용합니다.
- XAxis는 numeric time axis를 명시적으로 유지합니다.
- XAxis domain은 `dataMin`부터 `dataMax`까지 chart data 실제 시작/종료일을 사용합니다.
- 별도 `chartTicks`를 생성해 첫 이벤트 timestamp와 마지막 이벤트 timestamp를 반드시 포함합니다.
- `interval={0}`으로 제공한 tick이 자동으로 생략되지 않게 했고, label은 `YY.MM` 형식으로 표시합니다.
- tooltip은 기존처럼 실제 배당락일 `YYYY-MM-DD`를 표시합니다.

## 조회 기간 UI 변경

- 기존 `최근 5년 데이터만 보기` boolean UI를 `조회 기간` select로 변경했습니다.
- option은 `전체기간`, `최근5년`입니다.
- 기본값은 `전체기간`입니다.

## 기존 boolean state 호환 정책

`DividendCaptureInput`에 선택형 state `lookbackPeriod?: "all" | "recent5y"`를 추가했습니다. 기존 저장값이나 외부 호출에 `lookbackPeriod`가 없으면 기존 `recent5yOnly` boolean으로 fallback합니다.

- `recent5yOnly: true` → `recent5y`
- `recent5yOnly: false` → `all`
- `전체기간` 선택 → 기존 `recent5yOnly=false` 경로와 동일
- `최근5년` 선택 → 기존 `recent5yOnly=true` 경로와 동일

## 테스트 명령어

- `npm run check:dividend-capture-period-axis-ux`
- `npm run check:dividend-capture-streamlit-row-parity`
- `npm run check:dividend-capture-streamlit-parity`
- `npm run check:dividend-capture-streamlit-restore`
- `npm run check:calculators-table-sort-scroll`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

- chart tick label은 공간이 좁은 모바일 화면에서 겹침을 줄이기 위해 6개 기준으로 생성합니다. 마지막 timestamp는 포함되지만 매우 좁은 화면에서는 label 간 간격이 빽빽해 보일 수 있습니다.
- 이번 변경은 그래프 축과 조회 기간 UI만 다루며, 배당치기 성공/실패 계산식과 quote provider는 변경하지 않았습니다.
