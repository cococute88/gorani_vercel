# PERFORMANCE-DONUT-RANKING-1

작업일: 2026-06-15
대상 화면: `/performance` (투자 성과)

## 1. 현재 문제점

- `/performance` 좌측 카드(`components/qld/QldAssetSummaryCard.tsx`)의 **자산 구성** 영역이
  Streamlit 스타일 도넛이 아니라 **stacked bar + Top 5 상품명 리스트**였다.
- 항목 집계가 **원본 상품명 단위**(`buildRankings`의 `groupTicker` = ticker/cleanName)였다.
  그래서 `키움TQQQ1`, `키움TQQQ`, `삼성위탁TQQQ` 가 각각 별도 조각/행으로 보였다.
- 사용자는 **같은 성격의 자산군/종목군을 합산**한 비중을 원했다
  (TQQQ는 TQQQ끼리, QLD는 QLD끼리 …).
- 하단 종목 랭킹 표는 `평가금액순`으로 **고정**되어 있었고 컬럼 정렬 기능이 없었다.

## 2. 기존 stacked bar/리스트 대체 이유

- Streamlit 원본(`original/pages_app/2_asset_tracker.py`)의 자산 구성은 도넛이며,
  사용자가 첨부한 세 번째 스크린샷도 중앙이 뚫린 도넛 + 상세 범례 형식이다.
- stacked bar + 상품명 리스트는 계좌/상품명이 그대로 노출돼 "같은 종목군 합산" 요구와 어긋난다.

## 3. 그룹화 기준 (정규화 종목군)

`lib/performance-asset-group.ts` 의 `classifyPerformanceGroup()` 가 canonical key로 분류한다.

| 그룹 | 분류 키워드(요약) |
|------|------------------|
| `TQQQ` | ticker/이름에 `tqqq` |
| `QLD` | `qld` |
| `QQQ` | `qqq`/`qqqm`/`나스닥`/`nasdaq` (한국상장 나스닥100 ETF 포함) |
| `SPY` | `spy`/`spym`/`voo`/`ivv`/`splg`/`s&p`/`sp500`/`snp` (한국상장 S&P500 ETF 포함) |
| `SCHD` | `schd`/`배당`/`다우존스` |
| `MSFT` | `msft`/`마이크로소프트` |
| `달러` | `usd`/`dollar`/`달러` |
| `현금` | `cma`/`mmf`/`rp`/`sgov`/`현금`/`예수금`/`파킹`/`입출금` 등 |
| `예적금` | `예적금`/`예금`/`적금`/`저축` |
| `기타` | 위에 해당하지 않는 개별주/미분류 |

- 분류 입력은 `ticker / cleanName / productName / tag` 를 종합한다.
- 영문 ticker 토큰은 정확 일치, 한글/기호는 부분 문자열로 매칭(`KODEX`의 `ko` 오분류 방지).
- 현금성(달러→예적금→현금)을 종목 ticker보다 먼저 판정한다.
- TQQQ/QLD(레버리지)를 일반 QQQ(나스닥)보다 먼저 판정한다.

### 비중 계산
`weightPct = 그룹 합산 평가금액 / 전체 합산 평가금액 × 100`. invalid/0/NaN/음수 평가금액 제외.
도넛/범례는 평가금액 내림차순으로 정렬(동률은 canonical 순서).

## 4. 도넛 범례 포맷

`components/performance/PerformanceAllocationDonut.tsx` 가 각 그룹에 대해 다음을 표시한다.

```
[색상] 종목군  비중  (수익률)  평가금액
TQQQ   31.7%  (+182.2%)  2.14억
SPY    12.9%  (+23.6%)   7,571만
현금    8.5%   (-)        4,351만
```

- 비중: 소수점 1자리 `%`
- 수익률: `(+182.2%)` / 원금 없으면 `(-)` (양수 emerald, 음수 rose)
- 평가금액: 한국어 축약(`formatCompactKrw`) — `2.14억`, `7,571만`

### 그룹 수익률
`groupReturnPct = (groupValue - groupPrincipal) / groupPrincipal × 100`.
원금이 0이거나 없으면 `returnPct`/`profitKRW` 는 `null` → 범례에 `(-)`.

## 5. 색상 정책

| 그룹 | 색상 | hex |
|------|------|-----|
| TQQQ | 진빨강 | `#B71C1C` |
| QLD | 빨강 | `#E53935` |
| QQQ | 핑크 | `#EC407A` |
| SPY | 주황 | `#FB8C00` |
| MSFT | 진노랑(골드) | `#F9A825` |
| SCHD | 노랑 | `#FDD835` |
| 달러 | 진초록 | `#2E7D32` |
| 현금 | 연두 | `#7CB342` |
| 예적금 | 녹색 | `#43A047` |
| 기타 | 하늘색 | `#38BDF8` |

조각 위 라벨은 생략하고 상세 정보는 범례에 집중해 라이트/다크 모두 가독성을 확보했다.
(이 카드는 부모 컴포넌트와 동일하게 항상 다크 톤으로 렌더된다.)

## 6. 종목 랭킹 정렬 정책

`components/qld/QldHoldingsRankTable.tsx` 에 컬럼 헤더 클릭 정렬을 추가했다.

- 정렬 컬럼: `비중`, `평가금액`, `투자원금`, `누적 손익`, `누적 수익률`
- 같은 헤더 재클릭 시 내림/오름 토글, 다른 헤더 클릭 시 내림차순부터 시작
- 활성 컬럼/방향은 화살표(`ArrowUp`/`ArrowDown`) + 상단 배지로 표시
- 실제 numeric sort(문자열 정렬 아님), `null`/`undefined`/`NaN`은 방향과 무관하게 항상 맨 아래
- 기본값: `평가금액 내림차순`(기존 동작 유지)
- 계좌 필터(위탁/연금/ISA)와 공존: **필터 적용 → 정렬 적용 → 렌더링** 순서
- 데스크톱은 헤더 버튼, 모바일은 별도 정렬 칩으로 동일 동작 제공

## 7. 테스트 명령어

```bash
npm run check:performance-donut-ranking   # 신규 회귀
npm run check:portfolio-realdata
npm run check:performance-qld-snapshots
npm run check:asset-allocation-donut
npm run check:performance-ranking-filters
npm run lint
npm run typecheck
npm run build
```

신규 스크립트(`scripts/check-performance-donut-ranking.mjs`) 검증 항목:
1. 계좌/상품명별 TQQQ 합산
2. QLD/QQQ/SPY/SCHD/MSFT 분류(한국상장 ETF 포함)
3. 달러/현금/예적금/기타 분류 + 색상 규칙 존재
4. 그룹 비중 합 ≈ 100%, 범례 데이터 생성
5. 그룹 수익률 평가금액/원금 기준, 원금 없으면 null
6. 스냅샷 → `assetGroups` 생성 + 원본 상품명 비노출
7. 비중/평가금액/투자원금/누적손익/누적수익률 numeric 정렬
8. null/invalid 정렬 값 하단 고정
9. 필터 + 정렬 동시 사용 안정성

## 8. 변경 파일

- `lib/performance-asset-group.ts` (신규) — 종목군 분류/합산 helper
- `lib/performance-qld-from-snapshots.ts` — 결과에 `assetGroups` 추가
- `components/performance/PerformanceAllocationDonut.tsx` (신규) — 도넛 + 범례
- `components/qld/QldAssetSummaryCard.tsx` — stacked bar/리스트 → 도넛 교체
- `components/qld/QldHoldingsRankTable.tsx` — 컬럼 정렬 추가
- `scripts/check-performance-donut-ranking.mjs` (신규) + `package.json` script
- `docs/PERFORMANCE_DONUT_RANKING1.md`, `docs/AUDIT.md`

## 9. 남은 한계 (Remaining limitations)

- 그룹 수익률은 스냅샷의 holding `principalKRW`/`valueKRW` 에 의존한다. 일부 보유종목에
  원금 필드가 없으면 해당 그룹은 `(-)` 로 표시된다(정상 동작).
- ETF look-through(구성종목 분해)는 이번 범위가 아니다. 도넛은 보유 상품 레벨에서
  종목군으로만 묶는다(예: S&P500 wrapper 안의 개별주 분해는 `/market`·asset-map 영역).
- `/market` 공포탐욕/RSI/MDD 실데이터 연결은 후속 Codex `MARKET-DATA-1` 범위.
- 그룹 분류는 키워드 기반이라 신규/이색 상품명은 `기타`로 떨어질 수 있다. 사용자 핵심
  자산군은 정확히 분류되도록 키워드를 보강했고, 필요 시 키워드만 추가하면 된다.

## 10. Next step

다음 단계는 Codex `MARKET-DATA-1` (`/market` 공포탐욕/RSI/MDD 실데이터 연결).
