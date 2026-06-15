# ASSET-MAP-ETF-DECOMPOSITION-FIX-1

## 문제 원인

`실질 보유 TOP 100`은 `lib/asset-map-exposure.ts`의 `buildAssetMapExposureFromHoldings`가 최신 포트폴리오 스냅샷 holdings를 받아 계산한다. 기존 로직은 티커를 정규화한 뒤 ETF로 판단되면 `lib/asset-map-etf-constituents.ts`의 정적 fixture로 구성종목을 배분하고, ETF가 아니면 직접 보유 종목으로 TOP 100에 넣었다.

`토스SPYM` 문제의 직접 원인은 `SPYM`이 asset map ETF fixture와 known ETF ticker 목록에 없었기 때문이다. 상품명에서 `SPYM`이 추출되지 않거나, 추출되더라도 구성종목 fixture가 없어 ETF wrapper가 안정적으로 look-through되지 못했다. 이 상태에서 wrapper 성격을 충분히 차단하지 못하면 상품명이 개별주처럼 TOP 100에 섞일 수 있었다.

## ETF look-through 정책

- 유효한 `valueKRW`가 있고 0보다 큰 보유 항목만 분석한다.
- 직접 보유 개별주는 해당 ticker로 바로 합산한다.
- ETF/펀드 wrapper는 wrapper 자체를 TOP 100에 넣지 않는다.
- 구성종목 fixture가 있는 ETF는 `holding.valueKRW * constituent.weightPct / 100`으로 실질 보유금액을 만든다.
- 같은 ticker는 직접 보유와 여러 ETF source를 모두 합산한다.
- TOP 100에는 구성종목 또는 직접 개별주 ticker/name만 표시한다.

## alias 정책

보수적인 alias만 사용한다.

- 명시 상품명/태그에 `QQQ`, `SPYM`, `SCHD`, `SPY`, `VOO`, `TQQQ`, `QLD`가 포함되면 해당 ETF 계열로 매핑한다.
- 한국상장 미국 ETF registry의 `exposureProxy`가 있으면 asset map은 원 기초 ETF 계열을 사용한다.
- `ACE/RISE/TIGER 미국S&P500` 계열은 `SPY` fixture로 투시한다.
- `ACE/RISE 미국나스닥100` 계열은 `QQQ` fixture로 투시한다.
- 위험한 fuzzy matching은 추가하지 않았다.

## 분해 불가 상품 처리 정책

분해 불가/제외 항목은 TOP 100에 넣지 않고 `excludedHoldings`로 분리한다.

- `ticker_unresolved`: 티커 확인 불가
- `constituents_unavailable`: ETF로 인식했지만 구성종목 데이터 없음
- `not_look_through_target`: MMF/현금성/펀드성 등 개별주 look-through 대상 아님

UI warning은 사용자가 이해할 수 있도록 “티커 확인 불가”, “구성종목 데이터 없음”, “look-through 대상 아님” 문구를 사용한다.

## 분석금액/제외금액 정의

- `ETF 평가액`: ETF로 판정된 holding의 평가액 합계
- `투시 커버리지`: ETF 평가액 중 정적 fixture 구성종목 weight로 실제 배분된 금액 비율
- `분석금액`: 성공적으로 배분된 ETF 구성종목 금액과 직접 개별주 금액의 합계
- `제외금액`: 구성종목 데이터가 없거나 ticker/대상 판단에 실패해 TOP 100에서 제외한 금액

fixture는 현재 상위 구성종목 중심의 정적 데이터이므로 ETF 평가액 전체가 분석금액으로 들어가지 않을 수 있다.

## 구성종목 데이터 source

현재 구성종목 데이터는 외부 API가 아니라 `lib/asset-map-etf-constituents.ts`에 저장된 deterministic static fixture다. 이번 작업은 신규 API/provider/의존성을 추가하지 않았다.

## 테스트 명령어

- `npm run check:asset-map`
- `npm run check:asset-map-etf-decomposition`
- `npm run check:portfolio-realdata`
- `npm run check:krx-ticker-name-map`
- `npm run lint`
- `npm run typecheck`
- 가능하면 `npm run build`

## 남은 한계

- ETF 구성종목 fixture는 전체 holdings가 아니라 상위 구성종목 중심이다.
- fixture weight가 100% 미만인 ETF는 투시 커버리지가 낮게 표시된다.
- 신규 한국상장 ETF는 registry 또는 명확한 상품명 alias가 없으면 제외된다.
- 실시간 holdings API를 추가하지 않았으므로 fixture 갱신은 코드 변경으로 관리한다.
