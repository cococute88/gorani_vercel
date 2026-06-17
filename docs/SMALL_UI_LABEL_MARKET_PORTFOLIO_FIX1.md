# SMALL-UI-LABEL-MARKET-PORTFOLIO-FIX-1

## Nav label changes

- `전체 종목` / `전체종목` → `투자현황`
- `자산 시뮬레이터` → `자산시뮬`
- `배당캘린더` → `캘린더`
- `투자 성과` → `투자성과`

Route paths, active-tab matching, and icons are unchanged.

## Portfolio market indicators

`/portfolio` keeps reusing `fetchMarketPayload("6개월")` and the `/api/market` live briefing payload. The compact card order is:

1. `S&P 500`
2. `Nasdaq`
3. `Dow Jones`
4. `SCHD`
5. `USD/KRW`
6. `VIX`
7. `WTI`
8. `GLD`

The portfolio strip still uses the same card width, typography, live/partial/unavailable states, sparkline rendering, and mobile horizontal overflow policy. No static/mock fallback values or sample badges were added.

## Dow Jones / SCHD / GLD source handling

- `Dow Jones` uses the existing Yahoo briefing symbol `^DJI` and key `dow`.
- `SCHD` was added to briefing symbols with ticker `SCHD`, using the same quote/history fetch path as other briefing cards.
- `GLD` was added to briefing symbols with ticker `GLD`, using the same quote/history fetch path as other briefing cards.
- If any symbol fails, the existing unavailable policy returns `조회 불가` without fake values.

## Portfolio section title changes

- `자산 구성` → `목적별 비중`
- `보유 자산군 분석` → `보유 비중 분석`
- Card title `자산군 비중` → `종목별 비중`

Only display labels changed; allocation and account calculation logic was not changed.

## 위탁계좌 card layout policy

The account card grid now supports three desktop columns, including the compact portfolio layout. Narrow screens still fall back to one or two columns so the cards can wrap naturally.

## Fear & Greed tooltip sentiment policy

Fear & Greed chart tooltip labels now render as `YYYY.MM.DD(구간명)`. The x-axis keeps the existing `YY.MM` formatter and the value line remains unchanged.

Sentiment bands for tooltip labels:

- `0~24`: `극단공포`
- `25~44`: `공포`
- `45~55`: `중립`
- `56~75`: `탐욕`
- `76~100`: `극단탐욕`

The formatter reads the hovered score from the Recharts tooltip payload to avoid exposing raw index labels.

## Test commands

- `npm run check:small-ui-label-market-portfolio-fix`
- `npm run check:portfolio-market-indicators-live`
- `npm run check:portfolio-realdata`
- `npm run check:portfolio-ux-rules`
- `npm run check:market-data-real`
- `npm run check:market-chart-formatters`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Remaining limitations

- Browser hover/screenshot verification depends on the local preview environment and browser tooling availability.
- Live market availability still depends on upstream Yahoo/CNN endpoints; failures continue to use the existing unavailable display policy rather than fake values.
