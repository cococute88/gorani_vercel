# SMALL-UI-FAVICON-MODAL-CHART-FIX-1

## 수정한 문제 3개

1. 라이트모드 표시명 변경 모달 input의 어두운 배경/낮은 대비 문제를 수정했다.
2. 배당치기 시뮬레이터 수익률 분포 그래프의 x축 날짜 tick이 장기 구간에서 너무 듬성듬성 보이는 문제를 수정했다.
3. 브라우저 탭/사이트 metadata icon이 `public/gorani-logo.png`를 참조하도록 보정했다.

## 변경 파일

- `components/auth/LoginButton.tsx`
- `components/calculator/DividendCaptureSimulator.tsx`
- `app/layout.tsx`
- `scripts/check-small-ui-favicon-modal-chart-fix.mjs`
- `package.json`
- `docs/AUDIT.md`
- `docs/SMALL_UI_FAVICON_MODAL_CHART_FIX1.md`

## favicon 적용 방식

Next.js App Router의 `metadata.icons`에 `icon`, `shortcut`, `apple` 경로를 추가해 모두 `/gorani-logo.png`를 참조하도록 했다. 기존 title과 description은 보존했다.

## chart x축 tick 정책

- 계산 결과 rows는 `exDate` 오름차순으로 정렬한 뒤 chart rows로 변환한다.
- x축 tick은 실제 sorted rows의 시작/끝 날짜를 항상 포함한다.
- 장기 구간에서는 UTC 월 기준 6개월 간격 후보를 만들고, 각 후보를 실제 row 날짜 중 가장 가까운 날짜로 매핑한다.
- Recharts `XAxis`에는 `ticks`, `interval={0}`, `minTickGap`, angle을 명시해 desktop에서 과도하게 생략되지 않도록 했다.
- tick label은 `YY.MM` 형식으로 표시한다.

## 테스트 명령어

- `npm run check:small-ui-favicon-modal-chart-fix`
- `npm run check:dividend-capture-streamlit-row-parity`
- `npm run check:dividend-capture-streamlit-parity`
- `npm run check:dividend-capture-streamlit-restore`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

- 반기 후보는 실제 배당락일이 존재하는 가장 가까운 row 날짜로 매핑되므로, 월말/월초 배당 스케줄에 따라 label이 정확히 `06`/`12`가 아닐 수 있다.
- 매우 좁은 모바일 폭에서는 label 겹침 방지를 위해 Recharts 렌더링 영역에 따라 일부 시각적 혼잡이 남을 수 있다.
