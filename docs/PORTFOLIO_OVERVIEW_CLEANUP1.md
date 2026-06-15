# PORTFOLIO-OVERVIEW-CLEANUP-1

`/portfolio` 화면 상단을 정리해, 사용자에게 의미가 적은 sample 시장 지표/장황한 안내/비동작 버튼을 제거하고 포트폴리오 핵심 정보에 집중하도록 한 후속 정리 작업.

## 배경

`/portfolio` 상단이 다음 요소들로 어수선했다.

- `시장 지표` 영역에 `샘플` 배지가 붙은 static mock ticker strip (`PIN_TICKERS`)
- 여러 줄짜리 안내/경고 박스 (info notices + 항상 열린 warning 박스)
- `실시간 시세 (참고용)` strip
- summary 카드 내부의 `구성 요약` (계좌/종목/자산 행/경고 카운트)
- 제목 오른쪽의 `계좌 n개 · 종목 n개` 텍스트와 동작하지 않는 `+ 계좌 추가` 버튼

## 제거한 UI

| 항목 | 위치 | 처리 |
| --- | --- | --- |
| 시장 지표 sample strip (`PIN_TICKERS`/`MiniTickerCard`/`SampleBadge`) | `app/portfolio/page.tsx` 제목줄 | 제거 |
| `실시간 시세 (참고용)` strip (`PortfolioQuoteStatusPanel`) | `app/portfolio/page.tsx` | `/portfolio`에서 제거 |
| 우측 `계좌 n개 · 종목 n개` 카운트 | `app/portfolio/page.tsx` 제목줄 | 제거 |
| 비동작 `+ 계좌 추가` 버튼 (`Plus` 아이콘 포함) | `app/portfolio/page.tsx` 제목줄 | 제거 |
| info notices 안내 박스 | `app/portfolio/page.tsx` | 제거 → summary 보조문구로 축약 |
| `구성 요약` (계좌/종목/자산 행/경고 카운트) | `components/PortfolioSummary.tsx` | 제거 |

## 유지한 핵심 정보

- 총 금융자산 / 누적 손익 / 스냅샷 기준일
- 투자 평가금액 / 현금성·기타 자산 / 투자원금
- 데이터 상태(불러온 파일 / 최신 스냅샷 여부 / 미니 추이)
- 투자 / 현금 비중 카드
- 계좌별 현황(`AssetAccountCards`), 자산군 도넛, 계좌/자산 구성 도넛

summary 좌측 카드는 기존 4열 그리드에서 `구성 요약`을 빼고 3열(총자산 / 투자·현금성·원금 / 데이터 상태)로 재배치했다.

## 시장 지표 sample 처리 정책

기존 `/portfolio` 시장 지표는 `lib/mockData.ts`의 `PIN_TICKERS` static mock 값이었고 `샘플` 배지를 달고 있었다.
`/market`에 이미 `/api/market` live briefing 기반의 상세 시장현황 페이지가 있으므로, mock 값을 live처럼 보여주는 위험을 피하고 화면을 단순화하기 위해 **`/portfolio` 상단의 시장 지표 strip 자체를 제거**했다. 시장현황이 필요한 사용자는 `/market`을 사용한다.

## 안내/경고 처리 정책

- 단순 안내(info) notice 박스는 제거하고, caveat가 있을 때만 summary 카드 하단에 한 줄 보조문구(`일부 수익률은 원금 정보가 있는 계좌만 계산됩니다.`)로 축약.
- 조치가 필요한 경고(severity `warning`)는 완전히 숨기지 않고 기본 접힌 `<details>`(`확인이 필요한 항목 N건`) 형태로 유지 — 평상시 화면을 차지하지 않으면서도 심각한 데이터 문제는 펼쳐 확인 가능.
- 스냅샷이 없을 때의 빈 상태 안내(empty state)는 유지.
- 경고/안내 데이터 계산 로직(`portfolio-from-snapshots.ts`)은 변경하지 않고, summary의 카운트 표시만 제거했다.

## 변경 파일

- `app/portfolio/page.tsx`
- `components/PortfolioSummary.tsx`
- `scripts/check-portfolio-overview-cleanup.mjs` (신규)
- `package.json` (`check:portfolio-overview-cleanup` 스크립트 추가)
- `docs/AUDIT.md`, `docs/PORTFOLIO_OVERVIEW_CLEANUP1.md`

`components/MiniTickerCard.tsx`, `components/common/SampleBadge.tsx`, `components/portfolio/PortfolioQuoteStatusPanel.tsx`, `lib/mockData.ts`의 `PIN_TICKERS`는 `/portfolio-manager`(`components/portfolio/PortfolioPage.tsx`) 등에서 계속 사용하므로 삭제하지 않았다.

## 테스트 명령어

```bash
npm run check:portfolio-overview-cleanup   # 신규: 정리한 UI 회귀 방지
npm run check:portfolio-ux-rules
npm run check:portfolio-realdata
npm run check:portfolio-totals-reconcile
npm run check:portfolio-account-returns
npm run lint
npm run typecheck
npm run build

# 회귀 (영향 없음 확인)
npm run check:market-data-real
npm run check:market-chart-formatters
npm run check:performance-qld-snapshots
npm run check:dividend-estimates
npm run check:calendar-provider
```

## 남은 한계

- `/portfolio`에서는 시장 지표를 더 이상 보여주지 않는다. 향후 live 시장 요약이 `/portfolio`에 필요하면 `/api/market` briefing을 재사용하는 소형 strip을 별도 작업으로 추가할 수 있다.
- `+ 계좌 추가` 버튼은 동작 자체가 없었으므로 숨겼을 뿐, 계좌 추가 기능을 새로 구현하지 않았다.
- `PortfolioQuoteStatusPanel`(실시간 시세 strip)은 `/portfolio`에서만 제거했고 `/portfolio-manager`에는 그대로 남아 있다.
