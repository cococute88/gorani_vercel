# CALENDAR-DIVIDEND-LIVE-UPDATE-1

## Streamlit 원본 분석

`original/modules/dividend_calendar.py`는 `_get_api_key`로 `POLYGON_API_KEY`, `FINNHUB_API_KEY`를 읽고, `fetch_ticker_bundle(ticker)`에서 yfinance 가격/배당/info, Finnhub 배당·실적, Polygon 배당을 ticker 단위로 수집했다. `project_future_dividends`는 과거 배당 간격의 median으로 월/분기/반기/연간 빈도를 추정하고, 배당락일·매수마감일·지급일을 생성했다. `batch_project_events(tickers)`는 Polygon 무료 제한을 고려해 ticker 사이에 12.5초 delay를 두며 실패 ticker를 모았다.

Streamlit 저장 흐름은 `load_cached_events(uid)` / `save_cached_events(uid, data)`가 `div_calendar.cached_events`를 ticker별로 읽고 쓰며, 저장 시 `_push_cloud(silent=True)`를 통해 `auto_save_calendar_data`로 Firebase에 동기화하는 구조였다. `render()`의 `🔄 일정 최신화`는 `fetch_ticker_bundle.clear()` 후 `force_api_refresh=True`로 cached events를 무시했고, `💾 강제 클라우드 저장`은 `auto_save_calendar_data(silent=False)`를 호출했다.

## Next.js 이식 구조

현재 Vercel 캘린더는 `/watchlist`와 새 `/calendar` route에서 `DividendCalendarPage`를 렌더링한다. 기존 데이터 흐름은 `getCalendarEventsForTickersWithProvider`가 `/api/quote/dividends` Yahoo 기반 provider와 localStorage `calendarCache`를 사용하고, Firestore에는 `calendarCache`, `calendarEvents`, `calendarCustomEvents`, legacy import 메타가 저장된다. 기존 화면에는 Streamlit식 수동 최신화/강제 저장 버튼이 없었다.

이번 이식은 serverless timeout을 피하기 위해 긴 batch route를 만들지 않고, client가 선택 ticker를 순차로 `/api/calendar/dividend-events?ticker=...`에 요청한다. 성공 ticker만 local cache와 Firestore cache에 반영하고, 실패 ticker는 기존 cache를 유지한다.

## API route와 provider 우선순위

`GET /api/calendar/dividend-events?ticker=MSFT`는 server-only route에서만 provider key를 읽는다.

1. Polygon dividends API (`POLYGON_API_KEY`)
2. Finnhub stock dividend API (`FINNHUB_API_KEY`)
3. Yahoo dividends fallback (`getQuoteDividends`)
4. 과거 dividend rows 기반 projection

Key가 없으면 fatal error가 아니라 `missing_key` provider status로 내려가며 fallback을 계속 시도한다. secret 값은 응답과 client bundle에 포함하지 않는다.

## Projection 정책

`lib/calendar-dividend-live.ts`는 다음 helper를 제공한다.

- `getNextTradingDay`: 주말이면 다음 평일로 보정
- `getPrevTradingDay`: 배당락일 전 거래일 산출
- `inferDividendFrequency`: median interval 기준 월/분기/반기/연간 추정
- `normalizeDividendEvents`: declared row를 `estimated: false`에 해당하는 `status: confirmed` 이벤트로 정규화
- `projectFutureDividends`: 미래 12개월 `status: estimated` 이벤트 생성

공휴일 캘린더는 아직 반영하지 않고 주말 보정을 우선 적용했다.

## Cache/cloud save 정책

- localStorage: 기존 `calendarCache` ticker cache map 재사용
- Firestore: 기존 `users/{uid}/calendarCache/{ticker}` helper 재사용
- 성공 ticker만 cache 교체
- 실패 ticker는 기존 cache 유지
- custom events, event metas(heart/star/memo/tax source), legacy imported events는 별도 collection/doc을 유지하고 덮어쓰지 않음
- `💾 클라우드 저장`은 현재 cache/custom events/event metas를 기존 Firestore helpers로 저장

## Vercel timeout/rate limit 대응

API route는 ticker 하나만 처리한다. 여러 ticker 최신화는 browser client loop에서 처리하며 route가 장시간 batch 작업을 하지 않는다. 응답의 `rateLimitDelayMs`를 이용해 Polygon 사용 시 ticker 간 delay를 둘 수 있다.

## Env

```txt
POLYGON_API_KEY=
FINNHUB_API_KEY=
```

값은 Vercel/서버 환경변수로만 설정하고 repository에 커밋하지 않는다.

## 테스트

```bash
npm run check:calendar-dividend-live-update
npm run check:calendar-provider
npm run lint
npm run typecheck
npm run build
```

## 남은 한계

- Finnhub earnings calendar는 이번 범위에서 배당일정 우선 구현으로 남겼다.
- 미국 공휴일 거래일 보정은 주말 보정보다 정밀하게 개선할 수 있다.
- Polygon 무료 한도는 사용자 환경마다 다르므로 UI에서 순차 조회 정책만 적용했다.
