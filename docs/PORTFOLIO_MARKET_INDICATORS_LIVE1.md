# PORTFOLIO-MARKET-INDICATORS-LIVE-VERIFY-1

`/portfolio` 상단 시장지표 strip 이 실제 live market payload 를 재사용하는지 검증하고, 사용자 화면에 sample/static/mock 값이 live 처럼 보이지 않도록 정리한 작업이다.

## 작업 전 렌더링 경로 분석

- `/portfolio` route 는 `app/portfolio/page.tsx` 에서 렌더링된다.
- 시장지표 영역은 `components/portfolio/PortfolioMarketIndicatorStrip.tsx` 가 담당한다.
- 해당 컴포넌트는 client component 이며 `useEffect` 안에서 `fetchMarketPayload("6개월")`를 호출한다. 따라서 Next build 시점에 외부 API fetch 가 실행되지 않는다.
- `fetchMarketPayload`는 `lib/market-data.ts`의 `/api/market?range=...` client 이고, API route 는 `app/api/market/route.ts`에서 `buildMarketPayload(range)`를 호출한다.
- server payload 는 `lib/server/market-fetchers.ts`의 Yahoo/CNN 기반 market adapter 에서 생성된다.

## 기존 source 판정

이번 기준 브랜치에는 Claude cleanup 이후 follow-up 결과가 이미 포함되어 있어, 과거 `PIN_TICKERS`/`MiniTickerCard`/`SampleBadge` 기반 sample strip 은 남아 있지 않았다.

현재 `/portfolio` 시장지표는 다음 이유로 live source 로 판정했다.

- `components/portfolio/PortfolioMarketIndicatorStrip.tsx`가 `fetchMarketPayload`를 import 한다.
- `fetchMarketPayload`는 `/api/market`을 `cache: "no-store"`로 호출한다.
- `app/api/market/route.ts`는 `dynamic = "force-dynamic"`이고 `buildMarketPayload(range)`를 호출한다.
- 카드의 `sparkline`은 `item.sparkline`만 사용하며 random/sine/fallback 곡선을 만들지 않는다.
- 개별 카드 실패는 `changePct === null`을 `조회 불가`로 표시한다.

## 유지/제거한 항목

유지한 compact 표시 대상은 `/api/market` briefing key 에 존재하는 항목만이다.

- `S&P 500` (`sp500`)
- `Nasdaq` (`nasdaq`)
- `USD/KRW` (`usdkrw`)
- `VIX` (`vix`)
- `WTI` (`wti`)

과거 sample/static/mock 계열 UI는 `/portfolio` 사용자 화면에서 사용하지 않는다.

- `PIN_TICKERS` 직접 참조 없음
- `MiniTickerCard` 사용 없음
- `SampleBadge` 사용 없음
- `샘플` 배지 없음
- `lib/mockData` 또는 `lib/mock-market-data`를 `/portfolio` 시장지표가 import 하지 않음

## `/api/market` 재사용 방식

`PortfolioMarketIndicatorStrip`는 `/market` page 가 사용하는 market payload type/client 를 재사용한다.

- 재사용 타입: `BriefingItem`, `MarketPayload`
- 재사용 client: `fetchMarketPayload(range)`
- 재사용 API: `/api/market?range=6개월`
- 재사용 payload field: `MarketPayload.briefing`, `source`, `updatedAt`, `BriefingItem.sparkline`

이번 작업에서는 CNN endpoint, Yahoo fetcher, RSI/MDD/VIX 계산 로직, `/market` adapter 자체를 변경하지 않았다.

## live / partial / unavailable 처리 정책

- `source === "live"`: `시장 데이터 Live`
- `source === "partial"`: `시장 데이터 일부 조회 불가`
- `source === "unavailable"` 또는 payload 없음: `시장 데이터 조회 불가`
- 개별 briefing item 의 `changePct === null`: fake 등락률 대신 `조회 불가`
- 전체 API 실패: `fetchMarketPayload`가 `source: "unavailable"` payload 를 반환하므로 `/portfolio` 전체 화면은 깨지지 않는다.
- 카드와 sparkline 은 live briefing payload 에 있는 값만 렌더링한다.

## Claude cleanup 결과와의 충돌 가능성

충돌 가능성은 낮다. 현재 화면은 Claude cleanup 의 핵심 목표였던 상단 정리, verbose notice 제거, account/summary/donut 레이아웃 유지 상태 위에 compact live strip 만 둔다.

이번 변경은 검증 스크립트와 문서 보강 중심이며 다음 영역을 변경하지 않았다.

- 총금융자산 계산
- 계좌별 원금/수익률 계산
- 자산군 도넛 분류/색상
- calendar/auth/dividend/asset-map
- `/market` live adapter 계산 로직

## 추가한 회귀 검증

신규 script:

```bash
npm run check:portfolio-market-indicators-live
```

검증 항목:

1. `/portfolio`가 `PortfolioMarketIndicatorStrip`를 렌더링한다.
2. 시장지표 UI가 `PIN_TICKERS`, `MiniTickerCard`, `SampleBadge`, `샘플`, `mock-market-data`를 사용하지 않는다.
3. `fetchMarketPayload`와 `/api/market` live route 를 재사용한다.
4. `live/partial/unavailable` 및 `조회 불가` 상태 문구가 존재한다.
5. fake random/sine/fallback 곡선을 만들지 않고 `item.sparkline`을 사용한다.
6. 기존 overview cleanup guard 가 동일 정책을 계속 감시한다.

## 남은 한계

- `/portfolio` strip 은 `/api/market` briefing 이 제공하는 항목만 표시한다.
- 외부 Yahoo/CNN 조회가 실패하면 값은 보강하지 않고 unavailable/partial 로 표시한다.
- 이 작업은 data source 검증/guard 보강 범위이며, `/market` 상세 지표 계산이나 fetcher 안정화는 별도 작업 범위다.
