# CALCULATORS-TABLE-SORT-SCROLL-AND-DIVCAP-DISTRIBUTION-FIX-1

## 구조 분석

- `/calculator` 화면은 `components/calculator/CalculatorPage.tsx`에서 탭을 구성하고, 계산기별 본문은 `DividendCaptureSimulator`, `ConversionCalculator`, `MddCalculator`가 렌더링한다.
- 배당치기 성공/실패 분포 그래프와 회차별 상세 결과 표는 `components/calculator/DividendCaptureSimulator.tsx`에 있다.
- 매도전환 계산기 전환비 상세 표는 `components/calculator/ConversionCalculator.tsx`에 있다.
- MDD 계산기의 drawdown segment 표와 최근 가격/drawdown 표는 `components/calculator/MddCalculator.tsx`에 있다.

## 배당치기 분포 그래프 x축 버그 원인 및 정책

기존 그래프는 x축을 `recoveryDays`로 두고 `unit="일"`을 붙였다. 회복 기간이 0이거나 같은 값인 이벤트가 많으면 x축 tick이 `0일`, `0일`처럼 반복되어 배당락 이벤트별 수익률 분포가 아니라 회복일 중복 분포처럼 보였다.

수정 후 x축은 계산 결과에 이미 있는 `exDate`를 사용한다. fake 날짜는 만들지 않는다. y축은 `profitPct` 수익률(%)이며, 성공/실패는 별도 `Scatter` 시리즈와 legend 색상으로 구분한다. tooltip은 배당락일, 수익률, 성공여부, 원금 회복 날짜, 거래일/달력일 소요 기간을 보여준다.

## 정렬 가능한 표 목록

- 배당치기: 회차별 상세 결과
- 매도전환: 전환비 상세 표
- MDD: MDD segments(drawdown) 표
- MDD: Recent price and drawdown 표

각 표는 자체 sort state를 가진다. 다른 표의 정렬 상태와 공유하지 않는다.

## sort helper 정책

`lib/calculator-table-sort.ts`에 공통 helper를 추가했다.

- `sortRows(rows, sortKey, direction, columnType, getValue)`
- `nextSortState(current, key)`
- `sortArrow(sort, key)`

컬럼 타입은 `number`, `date`, `string`을 지원한다. `null`, `undefined`, 빈 문자열, `-`, `—`, `Unrecovered`, `회복불가`는 항상 하단으로 보낸다. 정렬은 stable sort 방식으로 동일 값의 기존 순서를 유지한다.

## 12행 스크롤 정책

상세 표 wrapper에 `max-h-[520px]`, `overflow-auto`, `min-w-0`를 적용했다. 데이터는 자르지 않고 전체 rows를 유지한다. header는 `sticky top-0`로 고정하고, 좁은 화면에서는 같은 wrapper에서 가로 스크롤도 허용한다.

## MDD full port 범위 제외

이번 작업은 MDD 계산기 전체 Streamlit 기능 이식이 아니다. 원화 MDD, 원본의 전체 보강 항목 등은 후속 작업 `MDD-CALCULATOR-STREAMLIT-FULL-PORT-1`로 남긴다.

## 테스트 명령어

```bash
npm run check:calculators-table-sort-scroll
npm run lint
npm run typecheck
npm run build
```
