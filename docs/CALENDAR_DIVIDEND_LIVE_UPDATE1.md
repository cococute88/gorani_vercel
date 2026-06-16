# CALENDAR-DIVIDEND-LIVE-UPDATE-1-RECREATE

## 재구현 배경

기존 PR #42 브랜치는 현재 실행 환경에서 가져오지 않았고 충돌 해결도 시도하지 않았다. 이 작업은 최신 main/current checkout의 `/watchlist` 배당캘린더 구조를 기준으로 Streamlit 원본 의도만 참고해 새로 구현했다.

## Streamlit 원본 분석

`original/modules/dividend_calendar.py`는 `🔄 일정 최신화` 버튼으로 포트폴리오 티커를 순회하며 `fetch_ticker_bundle` → `project_future_dividends`/`batch_project_events` 흐름을 실행한다. `💾 강제 클라우드 저장`은 `_push_cloud`/`auto_save_calendar_data`를 통해 `div_calendar` 캐시, 메모, 포트폴리오 메타를 저장한다. Provider는 Polygon/Finnhub/yfinance를 조합하고, 과거 배당 이력으로 미래 배당락/매수마감/지급일을 추정한다.

## 현재 Next.js 구조

현재 사용자가 보는 배당캘린더는 `app/watchlist/page.tsx` → `components/watchlist/WatchlistPage.tsx` → `components/watchlist/DividendCalendarPage.tsx` 흐름이다. `/calendar` 전용 route는 없고 `/watchlist`가 캘린더 화면이다. 로컬 캐시는 `lib/calendar-cache.ts`의 `STORAGE_KEYS.calendarCache`, cloud cache는 Firestore `users/{uid}/calendarCache/{ticker}` 구조를 사용한다. Custom events는 `calendarCustomEvents`, heart/star/memo는 `calendarEvents` meta, legacy import는 기존 `calendarEvents`/`legacyDividendCalendarMeta`를 사용한다.

## API route

새 route는 `GET /api/calendar/dividend-events?ticker=MSFT`이다. 한 요청은 한 ticker만 처리하며 API key는 server route에서만 읽는다. 응답은 `ticker`, `source`, `events`, `updatedAt`, `providerStatus`, `warnings`, 선택적 `failedReason`/`rateLimitDelayMs`를 포함하고 secret 값은 포함하지 않는다.

## Provider 우선순위

1. Polygon dividends API
2. Finnhub stock dividend API
3. Yahoo dividend history via existing server quote fetcher
4. 과거 dividend history 기반 projection

Yahoo가 sample fallback이면 live refresh에서는 fake row를 만들지 않는다.

## Projection 정책

과거 ex-dividend date interval median으로 frequency를 추정한다. 기존 provider helper가 monthly/quarterly/semiannual/annual 추정을 수행하고, projection event는 `sourceKind: estimated`/`status: estimated`이다. 매수마감일은 ex-dividend 전 영업일이며 지급일은 provider pay date 또는 ex-dividend + 약 14일을 주말 보정한다. 미국 공휴일 정교 보정은 남은 한계다.

## Cache/cloud 저장 정책

클라이언트는 ticker별 순차 API 호출을 수행한다. 성공 ticker만 local calendar cache를 갱신하고, 로그인 상태면 해당 cache entry를 Firestore에도 저장한다. 실패 ticker는 기존 cache를 덮어쓰지 않는다. 별도 `💾 클라우드 저장` 버튼은 현재 local cache, custom events, eventMetas를 Firestore에 저장한다.

## Vercel timeout/rate limit 대응

서버 route는 ticker 하나만 처리하고 provider fetch timeout을 둔다. Polygon rate limit은 `rate_limited`와 `rateLimitDelayMs`로 표현한다. 전체 티커 batch는 서버가 아닌 client sequential loop에서 처리한다.

## Env 설정

- `POLYGON_API_KEY`: 선택. 없으면 `providerStatus.polygon = missing_key`.
- `FINNHUB_API_KEY`: 선택. 없으면 `providerStatus.finnhub = missing_key`.

## 테스트 명령어

```bash
npm run check:calendar-dividend-live-update
npm run check:calendar-provider
npm run lint
npm run typecheck
npm run build
```

## 남은 한계

- Earnings live 이식은 이번 범위에서 제외했다.
- 미국 공휴일 정교한 거래일 보정은 주말 보정보다 정밀하지 않다.
- 외부 provider key/rate limit 상태에 따라 live declared rows가 없을 수 있다.
