# PORTFOLIO-DIVIDEND-UX-FIX-3 — 자산 구성/투자·현금 비중 정합성 + 환산 예상 배당 카드

작업일: 2026-06-14

## 1. 배경 / 사용자가 발견한 문제

- `/portfolio` 상단 `투자 / 현금 비중`은 투자 99.7% / 현금 0.3% 로 표시되는데,
  하단 `자산 구성` 도넛에서는 현금이 약 22.3% 로 보여 같은 화면에서 두 수치가 모순됐다.
- `자산 구성`은 성장/배당/현금 3분류였는데, 현금을 통화(원/달러)별로 나누고 싶다.
- `/dividends` 상단 배당 요약 카드에 `환산 예상 배당`(평가금액 × 3.5% 인출 가정) 카드를 추가하고 싶다.

## 2. 불일치 원인 분석 (수정 전)

`lib/portfolio-from-snapshots.ts` 에 두 수치가 **서로 다른 기준**으로 계산되고 있었다.

| 화면 | 함수 | 기준 (수정 전) |
| --- | --- | --- |
| 투자/현금 비중 (`summary.stockCashTargets`) | `buildStockCashTargets` | 투자 = **모든 보유종목** valueKRW 합, 현금 = `financeAssets` 중 `category === "현금"` 만 |
| 자산 구성 (`assetAllocation`) | `buildAssetAllocation` → `classifyHoldingPurposeGroup` / `classifyFinanceAssetPurposeGroup` | 현금성 보유종목(예수금·MMF 등)도 현금으로, 비투자성 금융자산 전부(예적금/현금/기타)를 현금으로 |

즉 투자/현금 비중은 현금성 **보유종목**을 전부 투자로 세고, 현금은 `category==="현금"` 잔액만 셌기 때문에 현금이 0.x% 로 과소 집계됐다.
반면 자산 구성은 현금성 보유종목 + 예적금/기타까지 현금으로 보아 현금이 크게 잡혔다. 같은 화면에서 두 기준이 충돌한 것이 원인이다.

## 3. 수정 내용

### 3-1. 투자/현금 비중 정합성 (#2)

- `computeAssetPurposeTotals(holdings, financeAssets)` 를 신설해 **표시용 항목**(보유종목 + 비투자성 현금성 잔액)을
  성장/배당/현금(원)/현금(달러) 4그룹으로 한 번만 집계한다.
- `buildAssetAllocation` 와 `buildStockCashTargets` 모두 이 함수에서 파생한다.
  - 투자 = 성장 + 배당
  - 현금 = 현금(원) + 현금(달러)
- 결과적으로 도넛 합계와 투자/현금 비중이 항상 같은 분모/분류에서 나온다.
- 총자산 KPI(`summary.totalAssetKRW`, `investmentValueKRW`)는 기존 snapshot 원본 로직을 유지했다(변경 없음).
- 20만원 미만 소액 계좌 숨김 정책(`MIN_VISIBLE_ACCOUNT_AMOUNT_KRW`)과 위탁/절세 트리맵 분류는 그대로다.

실데이터 검산(현재 스냅샷): 자산 구성 성장 64.1% + 배당 25.4% = **투자 89.5%**, 현금(원) 10.5% = **현금 10.5%** → 두 영역 일치.

### 3-2. 자산 구성 4분류 (#3)

`AssetPurposeGroup` 을 `성장 | 배당 | 현금(원) | 현금(달러)` 로 확장했다.

분류 정책:

1. **성장** — 배당/현금성으로 분류되지 않는 투자 종목 기본값 (TQQQ/QLD/QQQ/SPY/VOO 등).
2. **배당** — `③목적` 태그 또는 대표 배당 ETF(`SCHD/JEPI/JEPQ/SPYM/...`).
3. **현금(원)** — KRW 현금성. 통화가 KRW 이거나 상품명/계좌명에 달러 신호가 없는 현금성.
4. **현금(달러)** — USD 현금성. `holding.currency` 가 USD 이거나 상품명/계좌명에 `달러/USD/외화/$` 등 신호가 있는 현금성.

현금성 통화 판정은 `classifyCashCurrencyGroup(haystack, currency?)`:
- 명시 통화(USD/KRW) → 이름 신호(USD) → **보수적으로 현금(원)** 순.
- `FinanceAsset` 은 통화 필드가 없어 이름 신호로만 판단한다.
- **기타 그룹은 만들지 않는다.** 통화를 알 수 없는 현금성은 현금(원)으로 둔다.

색상: 성장 `#22c55e`, 배당 `#3b82f6`, 현금(원) `#f59e0b`, 현금(달러) `#14b8a6`.

### 3-3. 환산 예상 배당 카드 (#4)

`/dividends` 배당 요약을 4개 → 5개 카드로 변경: 평가금액 / 연간 예상 배당 / 월평균 예상 배당 / **환산 예상 배당** / 목표 달성률.

- 정의: 현재 선택된 범위의 평가금액을 연 3.5%로 인출한다고 가정한 연간 예상 인출액(실제 배당세 계산 아님).
- 계산식(`lib/dividend-estimates.ts` 의 `computeConvertedAnnualDividendKRW`):
  - 세전: `평가금액 × 0.035`
  - 세후: `평가금액 × 0.035 × (1 - 0.154)` = `× 0.846` (다른 배당 카드와 동일 계수)
- 보조 문구: `평가금액 × 3.5%` (세후일 때 `· 세후` 추가).
- 위탁/절세 토글 반영: 기존 평가금액 카드와 **동일한 `evaluationKRW`(선택 범위 합계)** 를 입력으로 쓴다.
  - 위탁만 → 위탁 평가금액 × 3.5%
  - 절세합산 → 합산 평가금액 × 3.5%
- NaN/undefined/0/음수는 0 으로 방어한다.

브라우저 검산(절세합산): 평가금액 ₩94,000,000 → 세후 ₩2,783,340 (= 94,000,000 × 0.035 × 0.846), 세전 ₩3,290,000 (= × 0.035).

### 3-4. 함께 처리한 UX (#5)

- `/dividends` 추정 안내 배너를 노란 warning → neutral/info(slate) 스타일로 낮췄다(추정 정보 자체는 유지, mock/sample 위장 아님).
- 카드 그리드를 `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` 로 바꿔 5개 카드가 모바일에서 자연스럽게 감기게 했다.
- 금액 줄바꿈 방지(NBSP `formatWon` + `.num`/`whitespace-nowrap`) 유지.
- 도넛 범례는 기존 truncate 로 `현금(달러)` 라벨이 좁은 폭에서도 깨지지 않는다.

## 4. 변경 파일

- `lib/portfolio-from-snapshots.ts` — 4분류, `computeAssetPurposeTotals`, `buildStockCashTargets`/`buildAssetAllocation` 공유화, 통화 판정.
- `lib/dividend-estimates.ts` — `computeConvertedAnnualDividendKRW`, `DIVIDEND_WITHDRAWAL_RATE`, `DIVIDEND_AFTER_TAX_FACTOR`.
- `components/dividend/DividendSummaryCards.tsx` — 5번째 카드, Kpi `sub` 라인, 5열 그리드.
- `components/dividend/DividendPage.tsx` — `convertedAnnualDividendKRW` 계산/전달, 안내 배너 neutral 화.
- `scripts/check-portfolio-ux-rules.mjs` — 4라벨 검증 + 투자/현금 정합성 검증 추가.
- `scripts/check-dividend-summary-cards.mjs` — 신규.
- `package.json` — `check:dividend-summary-cards` 스크립트.
- `docs/AUDIT.md`, `docs/PORTFOLIO_DIVIDEND_UX_FIX3.md`.

## 5. 테스트

```bash
npm.cmd run check:portfolio-realdata
npm.cmd run check:portfolio-ux-rules
npm.cmd run check:dividend-estimates
npm.cmd run check:dividend-summary-cards
npm.cmd run lint
npm.cmd run typecheck
```

검증 항목:
- 자산 구성 라벨이 `성장/배당/현금(원)/현금(달러)` 만, 기타/주식/예적금 미노출.
- 현금성 USD → 현금(달러), 현금성 KRW → 현금(원).
- 투자 비중 = (성장+배당)/전체, 현금 비중 = (현금(원)+현금(달러))/전체 로 자산 구성과 일치.
- 20만원 미만 계좌 숨김 유지.
- 환산 예상 배당 세전/세후/범위 계산 및 NaN 방어.

## 6. 시각 검증 (dev server)

| 화면 | 폭 | clientWidth/scrollWidth | overflow | 결과 |
| --- | --- | --- | --- | --- |
| /portfolio dark | 315 | 315/315 | 없음 | 투자 89.5%/현금 10.5%, 자산구성 성장64.1·배당25.4·현금(원)10.5 일치 |
| /portfolio light | 320 | 320/320 | 없음 | 동일, 라벨 4분류 내 |
| /dividends dark | 1265 | 1265/1265 | 없음 | 요약 카드 5개 확인 |
| /dividends | 315 | 315/315 | 없음 | 5개 카드 정상 감김, 환산 예상 배당 노출 |

- 환산 예상 배당 검산: 절세합산 ₩94,000,000 → 세후 ₩2,783,340 / 세전 ₩3,290,000. ✔
- 콘솔 에러는 recharts `defaultProps` 경고와 quote/fx 네트워크 실패(기대됨)뿐, 본 변경 관련 런타임 에러 없음.

## 7. 남은 한계 / 다음 단계

- `FinanceAsset` 에 통화 필드가 없어 현금(달러) 판정은 상품명/계좌명 신호에 의존한다. 파서에서 통화 컬럼을 보존하면 더 정확해진다.
- 현재 보유 스냅샷에는 USD 현금성 잔액이 없어 화면상 현금(달러) 슬라이스는 단위 테스트로만 검증했다.
- 환산 예상 배당의 3.5% 인출률은 고정값이다. 추후 사용자 설정값으로 노출 가능.
- 데스크톱 와이드 스크린샷은 preview 렌더러(recharts) 타임아웃으로 텍스트 기반 검증으로 대체했다.
