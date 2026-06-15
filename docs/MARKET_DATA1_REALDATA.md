# MARKET-DATA-1 — /market real data adapter

## 기존 문제

`/market`은 `lib/mock-market-data.ts`의 고정 브리핑, CNN Fear & Greed mock score/history, `Math.sin` 기반 RSI/MDD/VIX 곡선을 화면 초기값과 adapter 기본값으로 사용했다. 실패 시에도 mock 값이 유지되어 실제 데이터처럼 보일 수 있었다.

## 새 구조

- Client: `components/market/MarketPage.tsx`가 `/api/market?range=...`를 호출한다.
- Client adapter: `lib/market-data.ts`는 타입, range, UI helper, API fetch만 제공하며 mock을 import하지 않는다.
- Server route: `app/api/market/route.ts`가 build/runtime 실패를 막기 위해 항상 normalized payload를 반환한다.
- Server adapter: `lib/server/market-fetchers.ts`가 CNN/Yahoo 데이터를 조회하고 계산 결과를 정규화한다. CNN 조회에는 별도 timeout을 두고, 일부 항목만 실패하면 payload `source`를 `partial`로 내려 UI가 `일부 데이터 조회 불가` 상태를 표시한다.

## 데이터 source

- Fear & Greed: CNN dataviz Fear & Greed graph endpoint. 현재 score, history, CNN timestamp(가능한 경우)를 사용한다. 실패 시 score/history를 만들지 않고 `null`과 warning을 반환한다.
- Index/FX/commodity/VIX: 기존 `fetchYahooChart` helper를 재사용한다. S&P 500, Dow Jones, Nasdaq, USD/KRW, WTI, Gold, VIX를 Yahoo daily data에서 계산한다. 각 briefing card는 마지막 거래일 기준 `updatedAt`을 별도로 보유하며 실패한 카드만 `조회 불가`가 된다.
- RSI/MDD 대상: QQQ, SCHD, SPY daily close.

## 계산식

RSI 14는 daily close 변화분으로 초기 14일 평균 gain/loss를 구하고 이후 Wilder smoothing을 적용한다.

MDD/고점 대비 하락률은 각 날짜에서 최근 252거래일 rolling high 기준으로 계산한다.

```txt
drawdownPct = (close / rollingHigh - 1) * 100
```

## unavailable/fallback 정책

외부 API 실패 시 fake/random/sine/sample 값을 만들지 않는다. 섹션별로 빈 배열 또는 `null`을 반환하고 UI는 `조회 불가`, `데이터 조회 불가`, `일부 데이터 조회 불가`를 표시한다. 실패 카드의 change percentage는 `0`으로 위장하지 않고 `null`로 유지한다.

## 테스트 명령어

```bash
npm run check:market-data-real
npm run check:market-chart-formatters
npm run lint
npm run typecheck
npm run build
```

## 남은 한계

CNN/Yahoo가 차단되거나 응답 형식을 변경하면 해당 섹션은 unavailable로 표시된다. 이 작업은 유료 API key나 신규 외부 의존성을 추가하지 않았다.

## MARKET-FEAR-GREED-CHART-LABELS-1

- `/market` 공포탐욕 차트의 하단 x축은 history item의 `date`를 기준으로 월 tick을 `YY.MM` 형식(예: `25.07`, `26.03`)으로 표시한다.
- tooltip 상단 label은 `YYYY.MM.DD` 형식(예: `2026.03.12`)의 사용자용 날짜만 표시하며, Recharts index 숫자(`142`, `245` 등), raw timestamp, 개발자 필드명을 노출하지 않는다.
- tooltip 값 label은 영문 `value` 대신 `공포탐욕 지수`를 사용한다.
