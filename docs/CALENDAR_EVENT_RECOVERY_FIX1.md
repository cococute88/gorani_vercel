# CALENDAR-EVENT-RECOVERY-FIX-1

## PR #223 Preview 조사 결과

2026-08-17 Preview의 로그인된 실제 캘린더에서 APAM 일정은 다음 canonical identity로 확인됐다.

- `dividend:APAM:buy:2026-08-14`
- `dividend:APAM:ex_div:2026-08-17`

현재 canonical local cache entry는 `source=polygon`, `schemaVersion=2`이며 두 일정은 모두 `declared/confirmed`다. 같은 Preview의 `/api/calendar/dividend-events?ticker=APAM`도 Polygon과 Yahoo 상태가 `ok`인 live 응답에서 배당금 0.80달러, 배당락일 2026-08-17, 지급일 2026-08-31을 반환했다. 반면 자동 로드가 사용하는 `/api/quote/dividends`의 현재 Yahoo 응답에는 2026-08-17 row가 없었다.

따라서 이미 소실된 두 일정의 현재 정상 복구 source는 Polygon live dividend history다. 특정 APAM/date seed나 alert 문구 역파싱은 필요하지 않다.

## 다른 source 조사

- 현재 Chrome origin에는 `calendar:cache:default`만 있고 구형 `gorani.dividend-calendar.cache.v1` key는 없다.
- `calendar-alert-cache.ts`는 별도 발송 이력 저장소가 아니다. Firestore `calendarCache`를 Goralert 같은 read-only consumer에 노출하기 위한 provenance/TTL 계약이다.
- 발송 메시지 history는 이 레포의 저장 모델에 없고, 메시지만으로 dividend amount/payment/source를 검증할 수 없어 recovery source로 사용하지 않는다.
- legacy RTDB import 문서는 `source=legacy-rtdb-import`인 경우에만 정규화된다. 이 경로의 `declared/estimated` event body는 ticker/type/date와 dividend metadata를 보유하므로 신뢰 가능한 보조 recovery source다.
- event meta는 heart/star/memo와 canonical ID를 보존하지만 완전한 배당 본문이 아니므로 단독 복구 source로 사용하지 않는다.

## 후속 보강

1. default namespace는 현재 local cache와 구형 pre-portfolio cache를 canonical identity 기준으로 union한다.
2. 정규화된 legacy-import `declared/estimated` 이벤트를 canonical ticker cache에 멱등 병합한다.
3. Firestore cache가 fresh v2여도 후보 cache에 없는 canonical identity가 발견되면 transaction writer로 누락 event를 backfill한다.
4. provider result의 렌더링 body도 병합된 canonical cache에서 다시 만든다. Firestore/legacy에 event가 있어도 ticker 단위 provider 우선 선택 때문에 숨겨지지 않는다.
5. sample/custom/economic 이벤트와 alert 메시지 텍스트는 자동 복구에 사용하지 않는다.

이 정책은 기존 retention과 동일하게 `ticker + event type + event date` identity를 사용하며 여러 source 또는 반복 reload가 같은 이벤트를 중복 생성하지 않는다.
