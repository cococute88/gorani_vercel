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
| 시장 지표 sample strip (`PIN_TICKERS`/`MiniTickerCard`/`SampleBadge`) | `app/portfolio/page.tsx` 제목줄 | 제거 → FOLLOWUP에서 live strip으로 복구 (아래 참조) |
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
1차 작업에서는 mock 값을 live처럼 보여주는 위험을 피하기 위해 strip 자체를 제거했으나, FOLLOWUP에서 **mock을 쓰지 않는 `/api/market` live briefing 기반 compact strip**으로 복구했다(아래 FOLLOWUP 절 참조). 상세 시장현황은 여전히 `/market`이 담당한다.

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

## FOLLOWUP: compact 시장지표 strip 복구 (PORTFOLIO-OVERVIEW-CLEANUP-1-FOLLOWUP)

최초 작업에서 시장지표 strip을 통째로 제거한 것은 과했다는 피드백에 따라, **mock/static을 쓰지 않는 live 기반 compact strip**으로 복구했다.

- 신규 컴포넌트 `components/portfolio/PortfolioMarketIndicatorStrip.tsx`
  - 위치: `포트폴리오 현황` 제목 아래, summary 카드 위
  - client `useEffect`에서 `fetchMarketPayload("6개월")`로 `/api/market` live briefing 재사용 (build time fetch 없음)
  - 노출 항목: `S&P 500 · Nasdaq · USD/KRW · VIX · WTI` (briefing key `sp500/nasdaq/usdkrw/vix/wti`)만 compact 카드로 표시
  - 모바일에서는 가로 스크롤(`overflow-x-auto`), `sm` 이상에서는 wrap. 320/390px overflow 없음
  - 상태 문구: `source === "live"` → `시장 데이터 Live`(emerald), `"partial"` → `시장 데이터 일부 조회 불가`(amber), `"unavailable"` → 카드 대신 `시장 데이터 조회 불가`(muted)
  - 개별 항목 `changePct === null`(item source `unavailable`)이면 fake 값 대신 `조회 불가` 표시
  - 상승 빨강/하락 파랑(국내 관습) 유지, 장황한 설명/경고 박스 없음
- 금지 사항 준수: `PIN_TICKERS`/`lib/mockData` 시장값/`샘플` 배지/`MiniTickerCard`(mock props 구조) 미사용. `/market`의 CNN/Yahoo fetcher·RSI/MDD/VIX 로직 미변경.
- `/portfolio` 전체가 `/api/market` 실패로 깨지지 않도록 `fetchMarketPayload`는 실패 시 `unavailable` 페이로드를 반환하고 strip은 작은 문구만 노출한다.

`check:portfolio-overview-cleanup`을 확장해 strip 복구/live 재사용/금지값 미사용/상태 문구 존재를 함께 검증한다.

## FOLLOWUP-2: live 미니 스파크라인 복구 (PORTFOLIO-OVERVIEW-CLEANUP-1-FOLLOWUP-2)

복구한 compact strip에 기존 UI처럼 각 카드 오른쪽 미니 스파크라인을 다시 추가했다. **fake/random/sine/static이 아닌 실데이터**만 사용한다.

- 데이터: `lib/server/market-fetchers.ts`의 briefing은 이미 `fetchPrices(item.ticker, "1m")`(Yahoo 1개월 daily close)을 가져와 등락률을 계산하고 있었다. 이 series를 버리지 않고 `BriefingItem.sparkline`(최근 30 daily close, `{date, value}[]`)으로 함께 내려준다.
- 타입: `lib/market-data.ts`의 `BriefingItem`에 `sparkline?: { date: string; value: number }[]` 추가.
- UI: `PortfolioMarketIndicatorStrip`에 작은 SVG `Sparkline`(line + gradient area) 추가. 상승 빨강/하락 파랑, `changePct`가 `null`(조회 불가)이거나 포인트가 2개 미만이면 차트를 생략하고 텍스트만 표시. 카드 폭은 168px로 compact 유지, 숫자 줄바꿈 없음, dark/light 가독성 유지, 모바일 가로 스크롤/wrap.
- `/market`의 CNN/Yahoo fetcher·RSI/MDD/VIX 로직은 변경하지 않았다(briefing에 선택적 필드만 추가). 신규 chart library 없음(기존 SVG sparkline 방식 재사용).
- `check:portfolio-overview-cleanup`에 sparkline 렌더 경로(`Sparkline`/`item.sparkline`), fake 곡선 금지(`Math.random`/`Math.sin` 미사용), 서버 `sparkline = prices…` 파생 검증을 추가했다.

## 남은 한계

- compact strip은 `briefing` 값(전일 대비 등락)만 사용하며 스파크라인/세부 차트는 표시하지 않는다. 상세 시장현황은 `/market`에서 확인한다.
- strip은 페이지 로드마다 `/api/market`(no-store)를 client에서 1회 조회한다. 별도 캐싱/공유 store는 두지 않았다.
- `+ 계좌 추가` 버튼은 동작 자체가 없었으므로 숨겼을 뿐, 계좌 추가 기능을 새로 구현하지 않았다.
- `PortfolioQuoteStatusPanel`(실시간 시세 strip)은 `/portfolio`에서만 제거했고 `/portfolio-manager`에는 그대로 남아 있다.
